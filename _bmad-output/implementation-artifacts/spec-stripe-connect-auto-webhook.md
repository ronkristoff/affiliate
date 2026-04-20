---
title: 'Stripe Connect OAuth with Automatic Webhook Endpoint Creation'
type: 'feature'
created: '2026-04-20'
status: 'in-review'
baseline_commit: '527c4dd'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** When a SaaS owner connects Stripe via OAuth, the connection succeeds but no webhook endpoint is created on their Stripe account. The merchant must manually configure webhooks in their Stripe Dashboard, defeating the one-click experience.

**Approach:** After the OAuth callback stores credentials, automatically create a Stripe webhook endpoint on the merchant's account using their access token. The webhook subscribes to all 7 events already handled by the normalizer. On disconnect, delete the webhook endpoint. Store the `webhookEndpointId` in `stripeCredentials` for lifecycle management.

## Boundaries & Constraints

**Always:**
- Webhook creation must use the merchant's OAuth `access_token` (deobfuscated) — NOT the platform secret key
- All 7 events from `STRIPE_EVENT_MAP` must be subscribed: `checkout.session.completed`, `invoice.paid`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `charge.refunded`, `charge.dispute.created`
- Webhook URL must use `SITE_URL` env var: `{SITE_URL}/api/webhooks/stripe`
- Webhook creation/deletion must happen in `internalAction` (Node.js runtime) — `atob` and `stripe` SDK require Node
- Wrap the Stripe API call in the existing `circuitBreaker` from `convex/lib/circuitBreaker.ts`
- Store `webhookEndpointId` in the `stripeCredentials` object on the tenant
- On disconnect/deauthorize, attempt to delete the webhook endpoint before clearing credentials (non-blocking — don't fail disconnect if deletion fails)
- Signature verification in `/api/webhooks/stripe` already works for OAuth connections via `STRIPE_WEBHOOK_SECRET` — no changes needed there

**Ask First:** N/A

**Never:**
- Do NOT modify the existing OAuth flow endpoints (`/api/stripe/connect`, `/api/stripe/callback`, `/api/stripe/deauthorize`) beyond calling the new webhook management actions
- Do NOT change the existing webhook event handler at `/api/webhooks/stripe`
- Do NOT add `webhookEndpointId` as a new top-level field on the tenant — add it inside the existing `stripeCredentials` object
- Do NOT create webhooks for manual (non-OAuth) connections — those require manual secret entry

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| OAuth connect success | OAuth token exchange succeeds, `access_token` valid | Webhook endpoint created on merchant's Stripe account, `webhookEndpointId` stored in `stripeCredentials` | Log error, still mark connection as successful (webhook can be created later via retry) |
| OAuth connect — Stripe API fails | Network error or Stripe API down during webhook creation | Connection succeeds without webhook, `webhookEndpointId` remains empty | Log warning, non-blocking — merchant can reconnect |
| Disconnect — OAuth | Merchant clicks Disconnect, `webhookEndpointId` exists | Call `stripe.webhookEndpoints.del()`, then clear credentials | If deletion fails, log warning, proceed with disconnect |
| Disconnect — Manual (no endpoint) | `webhookEndpointId` is empty | Skip webhook deletion, clear credentials | N/A |
| Reconnect after disconnect | Merchant reconnects OAuth | Create new webhook endpoint, store new `webhookEndpointId` | Same as connect success |
| Webhook already exists | Merchant reconnects without prior cleanup | Stripe creates a new endpoint (Stripe allows multiple endpoints) | N/A |

</frozen-after-approval>

## Code Map

- `convex/schema.ts` — Add `webhookEndpointId` to `stripeCredentials` object definition
- `convex/tenants.ts` — `completeStripeOAuth` mutation: call new webhook creation action after storing credentials
- `convex/tenants.ts` — `clearStripeCredentialsInternal`: accept and use optional `webhookEndpointId` param for cleanup
- `convex/stripeWebhookManagement.ts` — **NEW FILE**: `createWebhookEndpoint` and `deleteWebhookEndpoint` internalActions
- `convex/http.ts` — OAuth callback (`/api/stripe/callback`): call webhook creation after `completeStripeOAuth`; deauthorize: call webhook deletion before `clearStripeCredentialsInternal`
- `convex/encryption.ts` — Existing `deobfuscate()` used to recover access token
- `convex/lib/circuitBreaker.ts` — Existing circuit breaker wraps Stripe API calls
- `convex/webhooks.ts` — `STRIPE_EVENT_MAP` (read-only reference for event list)
- `src/components/settings/IntegrationsSettingsContent.tsx` — Show webhook endpoint status (connected with webhook / connected without webhook warning)

## Tasks & Acceptance

**Execution:**
- [x] `convex/schema.ts` — Add `webhookEndpointId: v.optional(v.string())` to `stripeCredentials` object in tenants table
- [x] `convex/stripeWebhookManagement.ts` — Create new file with `createStripeWebhookEndpoint` internalAction and `deleteStripeWebhookEndpoint` internalAction. Use `stripe` SDK with deobfuscated `accessToken`, circuit breaker, subscribe to all 7 events from `STRIPE_EVENT_MAP`
- [x] `convex/tenants.ts` — Add `setStripeWebhookEndpointId` internalMutation; webhook creation happens in http.ts callback after mutation
- [x] `convex/http.ts` — Update `/api/stripe/callback`: after `completeStripeOAuth`, call `createStripeWebhookEndpoint` action with the raw access token, update tenant with webhookEndpointId via `setStripeWebhookEndpointId`. Update deauthorize handler to call `deleteStripeWebhookEndpoint` before clearing credentials
- [x] `convex/tenants.ts` — Update `getStripeConnectionStatus` query: include `hasWebhook` boolean in the connected response
- [x] `src/components/settings/IntegrationsSettingsContent.tsx` — Show webhook status indicator when connected via OAuth (green "Webhooks Active" badge if configured, amber "Webhooks Not Configured" warning if missing)

**Acceptance Criteria:**
- Given OAuth is configured with valid env vars, when a SaaS owner clicks "Connect Stripe" and completes OAuth, then a webhook endpoint is automatically created on their Stripe account pointing to `{SITE_URL}/api/webhooks/stripe`
- Given a connected Stripe OAuth account, when webhook events fire from the merchant's Stripe account, then they arrive at `/api/webhooks/stripe` and are processed by the existing handler
- Given a connected merchant with `webhookEndpointId`, when they click Disconnect, then the webhook endpoint is deleted from their Stripe account before local credentials are cleared
- Given the Stripe API is down during connect, when webhook creation fails, then the connection still succeeds and the merchant's status shows a warning about missing webhook configuration

## Design Notes

The webhook creation must happen in the `/api/stripe/callback` HTTP action (Node.js runtime) because we have the raw `access_token` in memory from the OAuth token exchange. This avoids needing to deobfuscate in a separate action call.

Pattern for callback update:
```
1. Token exchange → raw accessToken in memory
2. completeStripeOAuth mutation → stores obfuscated credentials
3. createStripeWebhookEndpoint action → uses raw accessToken, returns endpointId
4. Patch tenant with webhookEndpointId
```

On disconnect, the deauthorize handler already runs as an httpAction. Add webhook deletion there using the deobfuscated access token before calling `clearStripeCredentialsInternal`.

## Verification

**Commands:**
- `pnpm tsc --noEmit` -- expected: no type errors
- `pnpm lint` -- expected: no lint errors
- `pnpm convex run tenants:getStripeConnectionStatus --typecheck=disable -- '{"tenantId":"..."}'` -- expected: response includes `hasWebhook` field

**Manual checks:**
- Visit `/settings/integrations` as an owner, verify Stripe card shows webhook status when connected via OAuth
- After connecting via OAuth, verify webhook endpoint exists in Stripe Dashboard (Developers → Webhooks)
- After disconnecting, verify webhook endpoint is removed from Stripe Dashboard
