---
status: ready-for-dev
slug: tenant-mutation-write-access
title: Wire past_due write blocks to all tenant mutations
created: 2026-04-14
---

## Context

The `past_due` write-block mechanism exists in `tenantContext.ts` (`checkWriteAccess`, `requireWriteAccess`) and the `tenantMutation` wrapper, but **zero mutations use the wrapper**. As a result, `past_due` tenants can still:
- Invite affiliates
- Create campaigns (campaigns stay active too — `billingLifecycle.pauseAllActiveCampaignsForTenant` is never called on `past_due` entry)

The fix: convert all tenant-scoped mutations to use `tenantMutation`, which calls `requireWriteAccess` before executing the handler.

---

## Scope

### Mutations TO CONVERT (use `tenantMutation`)

These mutations use `getAuthenticatedUser` + `authUser.tenantId` OR `requireTenantId()` and are tenant-scoped. Convert all to `tenantMutation`.

#### `convex/affiliates.ts` — 14 mutations
| Line | Mutation | Auth pattern |
|------|----------|--------------|
| 1080 | `inviteAffiliate` | `getAuthenticatedUser().tenantId` |
| 1211 | `updateAffiliateStatus` | `getAuthenticatedUser().tenantId` |
| 1388 | `updateAffiliateProfile` | `getAuthenticatedUser().tenantId` |
| 1440 | `updateAffiliatePassword` | `getAuthenticatedUser().tenantId` |
| 1484 | `setAffiliatePassword` | `getAuthenticatedUser().tenantId` |
| 1533 | `setAffiliateStatus` | `getAuthenticatedUser().tenantId` |
| 1622 | `suspendAffiliate` | `getAuthenticatedUser().tenantId` |
| 1779 | `reactivateAffiliate` | `getAuthenticatedUser().tenantId` |
| 1953 | `approveAffiliate` | `getAuthenticatedUser().tenantId` |
| 2103 | `rejectAffiliate` | `getAuthenticatedUser().tenantId` |
| 2222 | `bulkApproveAffiliates` | `getAuthenticatedUser().tenantId` |
| 2353 | `bulkRejectAffiliates` | `getAuthenticatedUser().tenantId` |
| 2645 | `setCommissionOverride` | `getAuthenticatedUser().tenantId` |
| 2760 | `removeCommissionOverride` | `getAuthenticatedUser().tenantId` |
| 2834 | `toggleOverrideStatus` | `getAuthenticatedUser().tenantId` |
| 3003 | `updateAffiliateNote` | `getAuthenticatedUser().tenantId` |

**Exclude**: `registerAffiliate` (line 988) — uses `requireTenantId` but is affiliate-token-auth, not user auth.

#### `convex/campaigns.ts` — 5 mutations
| Line | Mutation | Auth pattern |
|------|----------|--------------|
| 86 | `createCampaign` | `getAuthenticatedUser().tenantId` |
| 476 | `updateCampaign` | `getAuthenticatedUser().tenantId` |
| 618 | `archiveCampaign` | `getAuthenticatedUser().tenantId` |
| 685 | `pauseCampaign` | `getAuthenticatedUser().tenantId` |
| 755 | `resumeCampaign` | `getAuthenticatedUser().tenantId` |

#### `convex/subscriptions.ts` — 5 mutations
| Line | Mutation | Auth pattern |
|------|----------|--------------|
| 194 | `upgradeSubscription` | `getAuthenticatedUser().tenantId` |
| 308 | `cancelSubscription` | `getAuthenticatedUser().tenantId` |
| 412 | `convertTrialToPaid` | `getAuthenticatedUser().tenantId` |
| 589 | `upgradeTier` | `getAuthenticatedUser().tenantId` |
| 768 | `downgradeTier` | `getAuthenticatedUser().tenantId` |

#### `convex/users.ts` — 3 mutations
| Line | Mutation | Auth pattern |
|------|----------|--------------|
| 400 | `createUser` | `requireTenantId` |
| 449 | `removeTeamMember` | `getAuthenticatedUser().tenantId` |
| 630 | `updateUserProfile` | `getAuthenticatedUser().tenantId` |

**Exclude**: `completeSignUp` (line 106) — no prior auth, creates tenant from scratch. **Exclude**: `syncCurrentUserAuthId` (line 916) — uses `ctx.auth.getUserIdentity` directly, not tenant-scoped.

#### `convex/templates.ts` — 4 mutations
| Line | Mutation | Auth pattern |
|------|----------|--------------|
| 656 | `upsertMyEmailTemplate` | `getAuthenticatedUser().tenantId` |
| 754 | `resetMyEmailTemplate` | `getAuthenticatedUser().tenantId` |
| 982 | `upsertEmailTemplate` | `getAuthenticatedUser().tenantId` |
| 1064 | `resetEmailTemplate` | `getAuthenticatedUser().tenantId` |

#### `convex/payouts.ts` — 4 mutations
| Line | Mutation | Auth pattern |
|------|----------|--------------|
| 44 | `generatePayoutBatch` | `requireTenantId` + `getAuthenticatedUser` |
| 435 | `recalcPendingPayoutStats` | `requireTenantId` |
| 837 | `markPayoutAsPaid` | `requireTenantId` |
| 995 | `markBatchAsPaid` | `requireTenantId` |

#### `convex/conversions.ts` — 1 mutation
| Line | Mutation | Auth pattern |
|------|----------|--------------|
| 768 | `updateConversionStatus` | `getAuthenticatedUser().tenantId` |

#### `convex/referralLinks.ts` — 2 mutations
| Line | Mutation | Auth pattern |
|------|----------|--------------|
| 226 | `generateReferralLink` | `requireTenantId` |
| 695 | `updateVanitySlug` | `requireTenantId` |

**Exclude**: `createReferralLink` (line 180) — affiliate-signup flow, no user auth.

#### `convex/notifications.ts` — 2 mutations
| Line | Mutation | Auth pattern |
|------|----------|--------------|
| 339 | `markNotificationRead` | `getAuthenticatedUser().tenantId` |
| 390 | `markAllNotificationsRead` | `getAuthenticatedUser().tenantId` |

#### `convex/tracking.ts` — 4 mutations
| Line | Mutation | Auth pattern |
|------|----------|--------------|
| 143 | `getTrackingSnippetConfig` | `getAuthenticatedUser().tenantId` |
| 226 | `recordTrackingPing` | `getAuthenticatedUser().tenantId` |
| 319 | `markTrackingVerified` | `getAuthenticatedUser().tenantId` |
| 336 | `resetTrackingVerification` | `getAuthenticatedUser().tenantId` |

#### `convex/tenants.ts` — 9 mutations
| Line | Mutation | Auth pattern |
|------|----------|--------------|
| 111 | `updateTenantWebsiteDomain` | `getAuthenticatedUser().tenantId` |
| 469 | `updateTenant` | `getAuthenticatedUser().tenantId` |
| 539 | `updateTenantBranding` | `getAuthenticatedUser().tenantId` |
| 639 | `resetTenantBranding` | `getAuthenticatedUser().tenantId` |
| 812 | `connectMockSaligPay` | `getAuthenticatedUser().tenantId` |
| 903 | `disconnectSaligPay` | `getAuthenticatedUser().tenantId` |
| 974 | `connectStripe` | `getAuthenticatedUser().tenantId` |
| 1126 | `disconnectStripe` | `getAuthenticatedUser().tenantId` |
| 1216 | `completeOnboarding` | `getAuthenticatedUser().tenantId` |

**Exclude**: `updateTenantDomain` (1972), `initiateSslProvisioning` (2105), `removeTenantDomain` (2255) — likely internal/admin context, verify per mutation.

#### `convex/audit.ts` — 1 mutation
| Line | Mutation | Auth pattern |
|------|----------|--------------|
| 327 | `logClientAuthEvent` | `getAuthenticatedUser().tenantId` |

#### `convex/teamInvitations.ts` — 2 mutations
| Line | Mutation | Auth pattern |
|------|----------|--------------|
| 54 | `createTeamInvitation` | `getAuthenticatedUser().tenantId` |
| 392 | `cancelInvitation` | `getAuthenticatedUser().tenantId` |

**Exclude**: `completeInvitationAcceptance` (line 646) — invite-token auth, not user auth.

#### `convex/couponCodes.ts` — 1 mutation
| Line | Mutation | Auth pattern |
|------|----------|--------------|
| 324 | `updateAffiliateCouponCode` | `getAuthenticatedUser().tenantId` |

#### `convex/fraudSignals.ts` — 2 mutations
| Line | Mutation | Auth pattern |
|------|----------|--------------|
| 211 | `dismissFraudSignal` | `getAuthenticatedUser().tenantId` |
| 323 | `suspendAffiliateFromFraudSignal` | `getAuthenticatedUser().tenantId` |

---

### Mutations NOT CONVERTED (intentional)

| File | Mutation | Reason |
|------|---------|--------|
| `affiliates.ts` | `registerAffiliate` | Affiliate-token auth (public signup flow) |
| `affiliateAuth.ts` | All 5 mutations | Affiliate-session auth, not user-scoped |
| `tenants.ts` | `updateTenantDomain`, `initiateSslProvisioning`, `removeTenantDomain` | Internal/domain operations, verify individually |
| `teamInvitations.ts` | `completeInvitationAcceptance` | Invite-token auth |
| `users.ts` | `completeSignUp` | No prior auth context |
| `users.ts` | `syncCurrentUserAuthId` | Auth identity sync, not tenant-scoped |
| `referralLinks.ts` | `createReferralLink` | Affiliate-token auth (public signup flow) |
| `rateLimit.ts` | Both mutations | System-level, no tenant context |
| `sessions.ts` | `invalidateSession` | Auth session management |
| `admin/*` | All mutations | Platform admin-scoped, use `requireAdmin` |

---

## Conversion Pattern

### Before (current pattern)
```typescript
export const someMutation = mutation({
  args: { ... },
  returns: v...,
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) throw new Error("Unauthorized");
    // optionally: const tenantId = authUser.tenantId;
    // ... handler body
  },
});
```

### After (using `tenantMutation`)
```typescript
export const someMutation = tenantMutation({
  args: { ... },
  returns: v...,
  handler: async (ctx, args, tenantId) => {
    // tenantId injected automatically
    // requireWriteAccess checked automatically
    // ... handler body (remove manual auth + tenantId extraction)
  },
});
```

### Key changes per mutation:
1. Replace `mutation({` with `tenantMutation({`
2. Remove `const authUser = await getAuthenticatedUser(ctx);` + auth check
3. Remove `const tenantId = authUser.tenantId;` (or `const tenantId = await requireTenantId(ctx)`)
4. Change handler signature from `(ctx, args)` to `(ctx, args, tenantId)`
5. Keep the rest of the handler body unchanged

---

## Acceptance Criteria

- [ ] All ~65 tenant-scoped mutations listed above are converted to `tenantMutation`
- [ ] `inviteAffiliate` returns error for `past_due` tenant (write blocked)
- [ ] `createCampaign` returns error for `past_due` tenant (write blocked)
- [ ] `past_due` tenant cannot: invite affiliates, create/edit/pause/resume/archive campaigns, approve/reject/suspend affiliates, create payouts, update templates, etc.
- [ ] Mutations NOT in scope (admin, affiliate-auth, signup) continue to work unchanged
- [ ] `pnpm tsc --noEmit` passes with zero errors
- [ ] `pnpm lint` passes with zero errors
