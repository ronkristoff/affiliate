---
stepsCompleted:
  [
    step-01-init,
    step-02-discovery,
    step-02b-vision,
    step-02c-executive-summary,
    step-03-success,
    step-04-journeys,
    step-05-domain,
    step-06-innovation,
    step-07-project-type,
    step-08-scoping,
    step-09-functional,
    step-10-nonfunctional,
    step-11-polish,
  ]
inputDocuments:
  - "_bmad-output/planning-artifacts/product-brief-salig-affiliate-2026-03-09.md"
  - "_bmad-output/brainstorming/brainstorming-session-2026-03-09-0001.md"
workflowType: "prd"
briefCount: 1
researchCount: 0
brainstormingCount: 1
projectDocsCount: 0
---

# Product Requirements Document — salig-affiliate

**Author:** msi
**Date:** 2026-03-09

## Executive Summary

**salig-affiliate** is a full-featured affiliate, referral, and influencer program management platform purpose-built for subscription-based SaaS businesses. It enables SaaS owners to launch, manage, track, and pay affiliates from a single dashboard — with deep native integration into **SaligPay**, the platform's billing backbone. The product targets SaaS owners globally, with community-led go-to-market traction anchored in the Philippine and Southeast Asian digital entrepreneur ecosystem (GHL agency owners, freelancers, SaaS resellers).

**The core problem:** SaaS businesses with affiliate programs suffer from manual commission tracking across subscription billing events, fragmented tooling, no self-service affiliate portal, unreliable third-party billing connectors, and inability to scale programs they can't accurately measure. salig-affiliate eliminates all of these with a vertically integrated solution — commission logic, payout processing, affiliate portal, email automation, reporting, and fraud protection in one platform.

**Primary users:**

- **SaaS Owner / Admin ("Alex")** — paying customer; launches and manages the affiliate program
- **Affiliate / Promoter ("Jamie")** — non-paying end user; accesses branded portal, shares links, tracks commissions
- **Platform Admin** — internal salig-affiliate operations team; multi-tenant superuser

### What Makes This Special

**Native SaligPay integration** is the primary moat. Unlike every competitor (FirstPromoter, Rewardful, Tolt, Tapfiliate), salig-affiliate has zero-latency, zero-connector, first-party access to SaligPay billing events — new charges, recurring charges, upgrades, cancellations, refunds, chargebacks. Commission logic is subscription-billing-first by architecture, not by adaptation. For SaligPay customers, no competitor can offer this depth of integration.

**Secondary differentiators:**

- Built-in email marketing eliminates a separate tool dependency
- Subscription-aware commission engine handles MRR/churn/upgrade events automatically
- White-labeled affiliate portal with custom domain — affiliates trust the program because it looks professional
- Accessible pricing targeting value-conscious PH/SEA market, positioned as a credible FirstPromoter alternative globally
- Community-led distribution through existing PH/SEA digital agency and freelancer networks provides organic, low-CAC growth channel

**Core insight:** SaligPay users are a captive, underserved audience for affiliate tooling. Winning them first with a deeply integrated, zero-friction product creates retention that no horizontal competitor can easily attack — then expand globally.

## Project Classification

| Field                   | Value                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| **Project Type**        | B2B SaaS — Multi-tenant platform                                                          |
| **Domain**              | Fintech — Commission tracking, payout processing, fraud prevention                        |
| **Complexity**          | High — Financial accuracy requirements, fraud detection, multi-tenant billing event logic |
| **Project Context**     | Greenfield — New product; SaligPay as native billing integration                          |
| **Primary Market**      | Global SaaS owners; community beachhead in PH/SEA                                         |
| **Go-to-Market Anchor** | SaligPay ecosystem + community-led growth (PH/SEA freelancer and agency networks)         |

## Success Criteria

### User Success

**SaaS Owner ("Alex"):**

- Completes full setup (SaligPay integration + first campaign + first affiliate invite) in under 15 minutes from signup
- First referral tracked automatically within 24 hours of going live
- Affiliate payout batch completed in under 5 minutes for up to 100+ affiliates
- Commission adjustments for all SaligPay billing events (upgrades, cancellations, refunds) require zero manual intervention
- 80%+ of active SaaS Owner accounts run at least 1 payout per month

**Affiliate / Promoter ("Jamie"):**

- Accesses referral link and assets within 2 minutes of portal registration
- Commission status visible in real-time — lag no greater than 1 hour from billing event
- Payout received within the window communicated in the portal
- Branded affiliate portal loads in under 2 seconds on mobile

### Business Success

**3-Month Targets (Post-Launch MVP):**

- 25 paying SaaS Owner subscribers acquired
- SaligPay integration validated with zero data integrity issues
- < 2% voluntary churn among early adopters
- $5K MRR
- End-to-end payout flow completed with no manual intervention

**12-Month Targets:**

- 200+ paying SaaS Owner subscribers
- $20K MRR
- $500K+ in affiliate-driven revenue tracked across all tenant accounts (platform-wide)
- 10,000+ active affiliates across all tenant programs combined
- 20%+ of new signups sourced from affiliate/word-of-mouth referral of salig-affiliate itself

**Strategic:**

- Establish salig-affiliate as the default affiliate tool for SaligPay ecosystem customers
- 99.9% uptime SLA on tracking and commission event processing
- GDPR compliance achieved before first EU customer onboards (deferred to pre-EU expansion, not MVP blocker)

### Technical Success

- Commission accuracy rate: **99.99%** — at most 1 error per 10,000 transactions; errors must be detectable and resolvable without data loss
- Affiliate portal uptime: **99.9%**
- SaligPay webhook processing: all billing lifecycle events (new charge, recurring, upgrade, cancellation, refund, chargeback) handled correctly and automatically
- Failed charge detection: zero commissions awarded for failed payments
- Fraud protection operational at launch: self-referral detection, reCAPTCHA on portal signup, commission approval threshold enforcement
- Multi-tenant data isolation: zero cross-tenant data leakage

### Measurable Outcomes (MVP Go/No-Go)

The MVP is validated when ALL of the following are true:

- **25 paying SaaS Owner subscribers** acquired within 90 days of launch
- **< 2% involuntary churn** in first 3 months
- **3 customers** have completed a full live cycle: real affiliates tracked via SaligPay + payout cycle completed
- **Zero** commission discrepancy incidents reported in first 60 days
- **5+ unprompted** positive reviews or testimonials from SaaS Owners
- **50+ active affiliates** (across all tenants) logging in weekly

## Product Scope

### MVP — Minimum Viable Product

Core end-to-end affiliate program management for SaligPay-based SaaS businesses:

1. **Multi-tenant SaaS Owner accounts** — signup, login, settings, subscription billing via SaligPay, 3 team roles (Owner, Manager, Viewer)
2. **Campaign management** — create/configure campaigns, percentage and flat-fee commission structures, recurring commissions; up to 3 campaigns on Starter tier
3. **Referral tracking engine** — unique referral link generation, click/conversion tracking, cookie-based attribution, JS tracking snippet
4. **SaligPay native integration** — webhook coverage of billing lifecycle events, automatic commission adjustment, failed charge detection, zero-dev setup via API credentials
5. **Affiliate management** — signup/approval workflow, profile management, individual commission overrides, up to 1,000 affiliates on Starter, reCAPTCHA bot protection
6. **Branded affiliate portal** — white-labeled with SaaS Owner logo/colors, asset library, stats overview, referral links, commission history, payout balance
7. **Payouts engine** — manual payout batch workflow, mark-as-paid flow, payout history, self-referral fraud detection
8. **Reporting dashboard** — overview, campaign performance, promoter performance, date range filtering, CSV export
9. **Automated emails** — transactional (welcome, commission confirmed, payout sent, new referral alert) + simplified broadcast (compose + send to all active affiliates + sent log)
10. **Platform Admin panel** — multi-tenant superuser dashboard with tenant search, account detail, impersonation (audit-logged), and plan limit visibility

### Growth Features (Post-MVP)

_Months 4–9 — v2 scope:_

- Stripe, Paddle, Chargebee, Recurly, Braintree billing integrations (opens platform to non-SaligPay customers)
- Wise payouts + SaligPay Payouts API integration + managed auto-payout service
- Coupon code tracking (pending SaligPay Coupon Codes API availability)
- Zapier and Make integrations
- Multi-tier / sub-affiliate commission structures
- Embeddable affiliate dashboard with SSO (JWT-based)
- Trigger-based automated email sequences (milestones, inactivity nudges)
- Broadcast email segmentation, scheduling, and template editor
- Traffic source and landing page analytics reports
- Custom CSS / JavaScript on affiliate portal
- Sub-ID link tracking and A/B testing
- Magic link and OAuth affiliate login
- Per-member RBAC permission toggles
- AI anomaly detection (commission accuracy monitoring)

### Vision (Future)

_Months 10–18 — v3 scope:_

- Multi-currency support (190 currencies, 170 conversions)
- W-9 / W-8BEN tax form collection and management
- Direct URL tracking (no referral link required)
- White-label / self-hosted offering for agencies and enterprises
- Public affiliate marketplace (affiliates discover programs to join)
- AI affiliate recruitment recommendations
- AI commission optimization

## User Journeys

### Journey 1: Alex — The SaaS Owner (Success Path)

**Who:** Alex runs a bootstrapped SaaS productivity tool with ~200 customers and has been manually tracking 12 affiliate referrals in a spreadsheet for three months. Every time a referred customer upgrades their plan, he has no idea how to credit that back to the affiliate. He's been putting off fixing it because every solution he looked at required connecting a Stripe webhook himself.

**Opening Scene:** It's Sunday evening. Alex finds salig-affiliate through a post in a Filipino founders Facebook group. He signs up and sees a familiar dashboard — clean, not overwhelming. He already uses SaligPay, so he pastes his SaligPay API key into the integration screen and hits Connect. A green checkmark appears. That's it. No developer required.

**Rising Action:** Alex creates his first campaign in 8 minutes — 20% recurring commission on every active subscriber referred. He generates a referral link for his top affiliate, Maria, and emails it to her. He installs the one-line JS tracking snippet on his website and runs a test click through Maria's link. It shows up in the dashboard in under 3 seconds.

**Climax:** Three weeks later, Alex logs in on a Monday morning. He sees $3,400 in affiliate-driven MRR, 6 active affiliates, and a row of green "Commission Confirmed" badges next to every recurring charge SaligPay processed over the weekend — automatically. He clicks "Pay All Pending" and generates a payout batch for 6 affiliates in under 2 minutes, marks them as paid, and the system sends each affiliate an automated notification.

**Resolution:** Alex schedules a post in the Facebook group: "Set up my affiliate program in 15 minutes. It tracked a plan upgrade I would have missed manually. Paid 6 affiliates while eating breakfast." Three other founders DM him asking which tool he used.

**Capabilities revealed:** SaligPay connection setup, campaign creation, referral link generation, JS snippet installation, automated commission tracking on recurring charges, manual payout batch flow, dashboard overview.

---

### Journey 2: Alex — Edge Case (Fraud Detection + Commission Dispute)

**Who:** Same Alex, three months into running his program. His affiliate program is growing — 40 affiliates now. But one morning he gets a support email from an affiliate named "RJ" claiming his commission was declined for a referral he swears was legitimate.

**Opening Scene:** Alex logs into salig-affiliate and searches for RJ's activity. He sees the referral in question flagged with a yellow "Self-Referral Detected" badge — the referred customer email matches RJ's own signup email from a previous trial. The system caught it automatically and held the commission pending manual review.

**Rising Action:** Alex reviews the evidence in the dashboard — IP match log, email history, registration timestamps. It's a clear self-referral attempt. He clicks "Decline Commission" with a one-click action and adds a note. The system sends RJ an automated notification.

**Climax:** A week later, Alex notices one of his other affiliates has an unusually high click-to-conversion ratio — 0.3%, against a platform average of 4%. He checks the fraud signals panel: high bot-traffic score, reCAPTCHA failures on portal signup. He suspends the affiliate account pending investigation with a single toggle.

**Resolution:** Alex's commission accuracy stays clean. He exports the fraud log as CSV for his records. He didn't need to contact support once — every decision was made inside the dashboard with full evidence.

**Capabilities revealed:** Self-referral detection, fraud signals panel, commission approval/decline workflow, affiliate suspension, commission dispute audit trail, CSV export.

---

### Journey 3: Jamie — The Affiliate Promoter (Success Path)

**Who:** Jamie is a content creator in Cebu who writes a newsletter about productivity tools for Filipino remote workers. She's been referred to Alex's affiliate program by a friend. She has 2,400 newsletter subscribers and has never run an affiliate program before.

**Opening Scene:** Jamie receives an email invitation from Alex's SaaS. The email is clean, professional — it has Alex's brand logo and colors, not some generic platform branding. She clicks the link and lands on a white-labeled affiliate portal. She registers in 90 seconds.

**Rising Action:** Her dashboard is immediately populated: a referral link (she can also create a custom vanity link), a promo banner she can embed, and her commission rate — 20% recurring. She copies her referral link and drops it into her next newsletter with a short recommendation. 72 hours later she logs back in.

**Climax:** She sees: 47 clicks, 3 trial signups, 1 paying customer — $29/month plan. Her commission: $5.80/month recurring, locked in automatically. There's a green "Commission Confirmed" badge. No waiting, no manual approval from Alex needed. She screenshots it and posts it in a freelancer Telegram group.

**Resolution:** Six months later Jamie is earning $340/month in recurring commissions from 17 referred customers. She's become Alex's most-referred affiliate. She's never once needed to contact Alex about a missing commission.

**Capabilities revealed:** White-labeled portal, branded email invitation, custom referral links, asset library, real-time commission tracking, recurring commission visibility, automated confirmation notifications.

---

### Journey 4: Platform Admin — Operational Monitoring & Support Escalation

**Who:** The internal salig-affiliate ops team member, "Sam." It's 9am on a Tuesday and a tenant SaaS Owner has submitted a support ticket: "Payouts are stuck — 3 affiliates haven't received their payments from last Friday's batch."

**Opening Scene:** Sam logs into the Platform Admin panel. She searches the tenant's account by email and opens their account detail view. She sees the payout batch from Friday — 3 transactions show "Processing" status, stalled for 48 hours.

**Rising Action:** Sam impersonates the tenant account (audit-logged) to see exactly what the SaaS Owner sees. She identifies the issue: the tenant's SaligPay API key expired after a password reset — payouts couldn't complete. She exits impersonation, sends the tenant an automated resolution email with instructions to re-authenticate their SaligPay connection.

**Climax:** Sam also notices while reviewing the account that it's approaching its Starter plan affiliate limit (940 of 1,000 affiliates). She logs a note on the account and marks the support ticket resolved — all from the admin panel without touching the database directly.

**Resolution:** The tenant reconnects SaligPay, the 3 stalled payouts complete within minutes. Sam's resolution time: 11 minutes. No engineering escalation required.

**Capabilities revealed:** Platform Admin panel, tenant account search, payout status visibility, account impersonation (audit-logged), plan limit monitoring, admin notes.

---

### Journey 5: Alex — Onboarding a New Team Member (Manager Role)

**Who:** Alex's affiliate program has grown. He hires a part-time affiliate manager, "Dana," to handle day-to-day affiliate approvals and communications. He doesn't want Dana to have access to billing or payout controls.

**Opening Scene:** Alex opens Settings → Team Members and clicks "Invite Team Member." He enters Dana's email and selects "Manager" role. Dana receives a branded invitation email and sets up her account in 3 minutes.

**Rising Action:** Dana logs in and immediately sees her scoped dashboard — she can view and manage affiliates, approve applications, send broadcast emails, and monitor campaign performance. She cannot see the Billing tab or initiate payouts. The interface doesn't even show her options she doesn't have access to.

**Climax:** Dana approves 7 pending affiliate applications in her first 10 minutes, sends a welcome broadcast email to new affiliates, and flags one suspicious account for Alex's review using an internal note.

**Resolution:** Alex reviews Dana's activity log at end of week. Everything she did is auditable — approvals, emails sent, accounts flagged. He promotes her to a higher responsibility level knowing the role-based access controls kept the financial layer safe.

**Capabilities revealed:** Team member invite flow, role-based access control (Owner/Manager/Viewer), scoped dashboard per role, activity audit log, affiliate approval workflow, broadcast email from manager role.

---

### Journey Requirements Summary

| Capability Area                                  | Revealed By  |
| ------------------------------------------------ | ------------ |
| SaligPay integration setup (no-code)             | Journey 1    |
| Campaign creation + referral link generation     | Journey 1    |
| Automated recurring commission tracking          | Journey 1, 3 |
| Manual payout batch execution                    | Journey 1    |
| Self-referral fraud detection + audit trail      | Journey 2    |
| Fraud signals panel + affiliate suspension       | Journey 2    |
| White-labeled affiliate portal                   | Journey 3    |
| Branded email invitation to affiliates           | Journey 3    |
| Real-time commission confirmation                | Journey 3    |
| Platform Admin tenant management + impersonation | Journey 4    |
| Payout status monitoring + stall detection       | Journey 4    |
| Plan limit monitoring                            | Journey 4    |
| Team member invite + RBAC                        | Journey 5    |
| Scoped dashboards per role                       | Journey 5    |
| Activity audit log                               | Journey 5    |

## Domain-Specific Requirements

### Domain Classification

salig-affiliate operates in the **fintech** domain — high complexity. The product processes real financial data (commission calculations tied to live billing events), executes affiliate payouts, and must maintain audit-grade accuracy and financial integrity across a multi-tenant architecture.

### Compliance & Regulatory

- **PCI DSS** — salig-affiliate does not store, process, or transmit cardholder data directly. All payment processing is fully delegated to SaligPay. salig-affiliate operates outside PCI scope; SaligPay bears PCI compliance responsibility. This must be contractually confirmed with SaligPay before EU or enterprise expansion.
- **KYC / AML** — At MVP, salig-affiliate does not perform KYC on affiliates. The SaaS Owner (tenant) is responsible for knowing their own affiliates. This is acceptable at PH/SEA MVP scale with lower payout volumes. Formal KYC/AML compliance is deferred until payout volumes or jurisdiction requirements trigger the obligation.
- **Philippine Data Privacy Act (DPA of 2012)** — Affiliate personal data (name, email, payout information) is classified as personal data under the Philippine DPA. Required actions at MVP: privacy notice displayed on affiliate portal signup, data processing agreement template provided for SaaS Owners to use with their affiliates, and a defined data retention and deletion policy. GDPR compliance is deferred until EU market expansion.
- **Tax Reporting** — At MVP, salig-affiliate does not perform tax withholding or reporting. SaaS Owners are fully responsible for their own tax obligations to affiliates. 1099 / BIR-equivalent reporting is deferred to post-MVP, triggered by regulatory requirement or customer demand.

### SaligPay API Integration — Current State

Based on review of the SaligPay API documentation (`https://api.saligpay.com/guides`):

| Capability                                                                   | Status           | Notes                                                                                          |
| ---------------------------------------------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------- |
| OAuth 2.0 (`client_credentials`)                                             | ✅ Documented    | Tenant credential entry in dashboard; token cached server-side with pre-expiry refresh         |
| Checkout payment events (`payment.updated`)                                  | ✅ Documented    | COMPLETED / PENDING / FAILED statuses; HMAC-SHA256 signature verification                      |
| HMAC-SHA256 webhook signature verification                                   | ✅ Documented    | Raw body must be preserved before JSON parsing for signature validation                        |
| Subscription billing events (recurring, upgrade, cancel, refund, chargeback) | ⚠️ Undocumented  | Confirmed implemented in SaligPay — exact webhook event schema to be provided by SaligPay team |
| Payouts / Disbursement API                                                   | ❌ Not available | **Deferred to v2** — manual payout marking workflow at MVP                                     |
| Coupon Codes API                                                             | ❌ Not available | **Deferred to v2** — referral link tracking only at MVP launch                                 |
| Payment metadata passthrough                                                 | ✅ Documented    | `metadata` object on checkout sessions returned in webhooks — use for referral attribution     |

### Technical Constraints

- **SaligPay OAuth Credential Management** — SaaS Owners connect via SaligPay `client_id` / `client_secret` (OAuth 2.0 `client_credentials` grant). Tokens are server-side only, cached with pre-expiry refresh (token expires in 3600s; refresh at 3540s), never exposed client-side. Credential rotation by the tenant must trigger a re-authentication flow in salig-affiliate. Credentials stored encrypted at rest.
- **Webhook Security** — All incoming SaligPay webhooks must be verified via HMAC-SHA256 signature using `crypto.timingSafeEqual` before any processing occurs. Raw request body must be preserved intact — no JSON pre-parsing before signature verification.
- **Idempotency** — SaligPay may deliver the same webhook event more than once. All webhook handlers must be idempotent — deduplicated by stable billing event ID (e.g., `pay_01HZX0AT8B` pattern — ULID-format, time-ordered, globally unique). A database-level unique constraint on processed event IDs prevents double commission awards.
- **Event Ingestion Architecture** — Webhook events must be stored raw first (raw payload + timestamp + signature status), then processed asynchronously. This ensures zero data loss if the subscription event schema differs from expected, and enables event reprocessing without data loss. Process: receive → validate signature → store raw → enqueue for processing → process → write commission.
- **Subscription Event Dependency Gate** — The subscription billing webhook schema (recurring charge, upgrade, cancellation, refund, chargeback events) must be confirmed and tested with the SaligPay team **prior to architecture finalization**. This is a hard dependency for the commission engine. Architecture work on the commission event processor should not be locked until this schema is in hand.
- **Multi-tenant Data Isolation** — Row-level security enforced at the data layer on all queries — not just application layer. Every query scoped to the authenticated tenant ID. Zero cross-tenant data access permitted. Automated integration tests for cross-tenant isolation are required before launch.
- **Financial Audit Log** — Every commission event (created, adjusted, approved, declined, reversed), every payout action, and every admin impersonation must be written to an immutable, append-only audit log. Required for dispute resolution, fraud investigation, and compliance. Audit log entries must never be editable or deletable by any application-level operation.
- **Affiliate Portal Authentication** — MVP: email/password with secure session management via Better Auth (httpOnly cookies, CSRF protection). Magic link and OAuth (Google/GitHub) are v2 enhancements. Better Auth provides built-in organization support for managing affiliate accounts.
- **Commission Accuracy Safeguard** — Before any commission record is written: (1) validate payment status is COMPLETED (not PENDING or FAILED), (2) check for existing commission record for the same event ID (idempotency), (3) verify the referral attribution chain is intact. Refund and chargeback events must trigger automatic commission reversal, not deletion — preserving the audit trail.

### MVP Payout Model

Since SaligPay has no payout disbursement API at MVP, the payout flow is a **manual-assisted workflow**:

1. salig-affiliate calculates and displays commission balances per affiliate in real-time
2. SaaS Owner initiates a **payout batch** — salig-affiliate generates a batch summary (in-dashboard table + downloadable CSV) with each affiliate's name, payout amount, and any payout method notes on file
3. SaaS Owner executes payments externally (bank transfer, GCash, PayPal, Wise, etc.)
4. SaaS Owner returns to dashboard, marks the batch (or individual payouts) as "Paid" with an optional payment reference / note
5. salig-affiliate records the payout event, updates each affiliate's commission balance, and sends automated "Payout Sent" email notifications to affiliates

> **UX Requirement:** The manual payout flow must be honest and clear to SaaS Owners — this is not a "click and done" experience at MVP. The UX should make the process as frictionless as possible: clear batch summary, easy mark-as-paid flow, and affiliate notification automation. The architecture must cleanly support swapping in a real payout API (SaligPay or otherwise) in v2 without restructuring the commission ledger.

> **Marketing constraint:** Do not promise automated payouts in any marketing material at MVP. The SaligPay Payouts API is the top v2 priority and will be the trigger for updating this messaging.

### Risk Register — Fintech Domain

| Risk                                                                      | Likelihood | Impact   | Mitigation                                                                                                                                 |
| ------------------------------------------------------------------------- | ---------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Subscription webhook schema confirmation delayed (SaligPay dependency)    | Medium     | Critical | Treat as hard gate for architecture; escalate to SaligPay team immediately; design commission engine to be event-schema-agnostic at intake |
| Duplicate webhook delivery → double commission award                      | Medium     | High     | Idempotency key per billing event ID; DB unique constraint on processed event IDs                                                          |
| SaligPay OAuth token expiry during payout batch generation                | Low        | Medium   | Pre-flight token refresh before all SaligPay API operations; surface re-auth prompt to SaaS Owner on 401                                   |
| Tenant SaligPay credential compromise                                     | Low        | Critical | Encrypted credential storage; re-auth flow on rotation; full audit log on credential access and changes                                    |
| Multi-tenant data leak via API                                            | Low        | Critical | Row-level security at data layer; automated cross-tenant isolation integration tests required pre-launch                                   |
| Commission awarded for failed / refunded payment                          | Medium     | High     | Payment status validation before commission write; refund/chargeback webhooks trigger commission reversal (not deletion)                   |
| Manual payout marked as paid fraudulently (SaaS Owner error or bad actor) | Low        | Medium   | Immutable audit log; affiliate receives automated email on payout marked — can dispute directly                                            |
| Click fraud / referral link abuse                                         | Medium     | Medium   | IP deduplication on click tracking, rate limiting on tracking endpoint, cookie attribution window enforcement                              |
| Unknown subscription event type received from SaligPay                    | Medium     | High     | Raw event storage first; alert on unrecognized event types; graceful no-op with logging — never silently drop                              |
| Coupon-preferred affiliates unable to promote effectively at MVP          | Medium     | Medium   | Monitor early adopter feedback; accelerate coupon code tracking to v2 if adoption signal warrants it                                       |

## Innovation & Novel Patterns

### Vertical Integration as Architectural Moat

Every competitor in the affiliate SaaS space (FirstPromoter, Rewardful, Tolt, Tapfiliate) is built on a _horizontal integration_ model: they sit outside your billing stack and connect via third-party webhooks, introducing connector latency, reliability variance, and a trust chain they don't control. salig-affiliate operates on a fundamentally different architectural premise — it is _native to_ the billing infrastructure, not connected to it.

This changes what's possible at the data layer:

- Zero-latency access to billing lifecycle events — no polling, no connector middleware, no reliability SLA dependency on a third party
- Billing events are first-class product primitives, not webhook payloads to be parsed and adapted
- Commission logic is designed _around_ subscription billing events (MRR, upgrades, cancellations, refunds, chargebacks) from the ground up — not retrofitted to handle them as edge cases

This vertical integration is the primary moat. It cannot be replicated by horizontal competitors without rebuilding their architecture around a specific payment platform. The innovation story is not "we built something no one has built before." It is: "we built the right thing for the right architecture, and our data asset compounds over time in ways horizontal competitors cannot replicate."

**Market context:** The affiliate SaaS market is growing alongside the explosion of AI SaaS products — the exact ICP salig-affiliate targets. FirstPromoter's own case studies (Submagic, CustomGPT, neuroflash) demonstrate the demand pattern: AI SaaS founders need affiliate programs but don't have time to build custom tracking infrastructure. No competitor currently offers native SaligPay integration, subscription-billing-first commission logic without adapter complexity, or a credible AI intelligence roadmap grounded in first-party billing event data.

### Subscription-Billing-First Commission Engine

Existing affiliate tools track _sales events_ and then attempt to model subscription behavior on top. salig-affiliate inverts this: the commission engine's native unit is the _billing lifecycle event_, not the transaction. This means:

- Recurring commissions are not a feature — they are the default behavior
- Upgrade/downgrade commission adjustments are automatic, not manual overrides
- Cancellation and refund handling is architecturally baked in, not an exception handler
- Failed charge detection is a first-class concern at the engine level

This is a meaningful conceptual and technical reframe that produces a fundamentally more accurate and lower-maintenance commission ledger for SaaS businesses.

### AI-Powered Affiliate Intelligence — Strategic Horizon

salig-affiliate's core data asset — affiliate performance events linked to billing lifecycle events — is uniquely rich compared to what horizontal competitors accumulate. This positions the platform for an AI capability layer that competitors cannot easily match:

- **v2 — Anomaly Detection:** Automated flagging of commission accuracy anomalies (statistical outliers in commission events per affiliate, per campaign) for human review. Requires minimum 3 months of production data before meaningful signal.
- **v3 — AI Affiliate Recruitment Recommendations:** Suggest potential affiliates based on audience niche, engagement data, and historical conversion patterns from similar programs on the platform. Requires cross-tenant aggregate data at scale.
- **v3 — AI Commission Optimization:** Recommend commission rate structures based on campaign performance benchmarks, churn patterns, and affiliate lifetime value data.

> **MVP Architecture Decision:** No AI features ship at MVP. The data model must be designed to be ML-queryable from day one — affiliate performance events, commission events, and billing lifecycle events stored with sufficient metadata and indexing to support future model training without a data migration. This is an architecture constraint, not a product feature.

### Innovation Validation

| Innovation Claim                                   | Validation Method                                                                                                     | Timeline                  |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Vertical integration eliminates connector friction | Measure time-to-first-tracked-referral vs. competitor benchmarks; zero webhook reliability incidents in first 90 days | First 90 days post-launch |
| Subscription-billing-first accuracy                | Commission accuracy rate ≥ 99.99%; zero manual correction requests from SaaS Owners in first 60 days                  | First 60 days post-launch |
| AI-ready data model                                | Architecture review confirms ML-queryable schema; no schema migration required when v2 anomaly detection is built     | Architecture phase gate   |
| AI anomaly detection (v2)                          | Precision/recall on commission anomaly flagging; reduction in support tickets about commission discrepancies          | v2 release + 30 days      |

### Innovation Risk Mitigation

| Risk                                                                      | Mitigation                                                                                                                                                  |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SaligPay subscription event schema narrower than expected                 | Design commission engine as event-schema-agnostic at intake layer; raw event storage ensures no data loss if schema expands later                           |
| AI cold-start problem at v2 (insufficient training data)                  | Defer AI features until 3+ months of production data; use rule-based anomaly detection as AI precursor at v2                                                |
| Vertical integration moat erodes if SaligPay opens third-party connectors | Deepen integration advantage with features only possible with first-party access (real-time billing event streaming, predictive churn signals)              |
| AI recommendation quality insufficient at v3 scale                        | Use aggregate anonymized cross-tenant data with strict privacy controls; build human-in-the-loop review layer before surfacing AI-generated recommendations |

## SaaS B2B Requirements

### Tenant Model

salig-affiliate is a multi-tenant B2B SaaS platform serving three distinct user types across shared infrastructure: SaaS Owners (paying tenants), their Affiliates (non-paying end users of the tenant's branded portal), and Platform Admins (internal operations team). The architecture is subscription-gated, role-controlled, and admin-configurable at the platform tier level.

| Concern                   | Decision                                                                                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tenancy type**          | Logical multi-tenancy — shared infrastructure, strict data isolation                                                                                                            |
| **Tenant identifier**     | Every data record scoped to `tenantId` at the data layer                                                                                                                        |
| **Data isolation**        | Row-level security enforced in Convex queries — every query filters by authenticated `tenantId`                                                                                 |
| **Cross-tenant access**   | Zero — no application-level operation may access another tenant's data; automated integration tests required pre-launch                                                         |
| **Platform Admin access** | Superuser role with explicit impersonation flow — impersonation is audit-logged with start/end timestamps, acting user, and all actions taken during session                    |
| **Tenant onboarding**     | Self-serve signup → immediate dashboard access → guided setup checklist (SaligPay connect → create campaign → invite first affiliate)                                           |
| **Tenant offboarding**    | Account deletion triggers: data export package generated, affiliate portal deactivated, SaligPay credentials purged, all data soft-deleted with 30-day hard-delete grace period |

### Technical Architecture

**Backend:** Convex — real-time reactive database, server functions, and native Convex Workflows for all async job orchestration (webhook processing pipeline, commission calculation jobs, payout batch generation, email dispatch queues). No external workflow or queue infrastructure required.

**Authentication:** Better Auth — comprehensive authentication solution for SaaS Owners and Affiliates. Provides email/password authentication, OAuth (Google, GitHub), session management, organization/team support, and role-based access control. Integrated with Convex for secure server-side verification.

**Email Delivery:** Resend — all transactional and broadcast emails sent via Resend API from Convex Actions. API key stored as a Convex environment variable. Email templates are React Email components; SaaS Owners customize subject lines and basic body content from dashboard settings.

**Workflow Orchestration:** Convex Workflows handles all multi-step async processes:

- Webhook receive → signature verify → raw store → enqueue → process → write commission
- Payout batch generation → affiliate balance calculation → CSV export → mark-as-paid flow → email dispatch
- Affiliate onboarding → approval → portal access → welcome email sequence

**Tier Enforcement Architecture Constraint:** Tier limit enforcement must route through a single platform service layer (`getTierConfig(tenantId)`) — no direct config reads from individual feature handlers. Every enforcement point in the codebase calls through this single helper. This prevents config drift and ensures that Platform Admin overrides and runtime tier changes propagate consistently across all enforcement points.

### RBAC Matrix

**Model:** Fixed roles at MVP. Per-member permission customization deferred to v2. The `permissionOverrides` field on team member records is nullable at MVP — present for schema readiness, no behavioral effect until v2.

| Permission                    | Owner | Manager | Viewer |
| ----------------------------- | ----- | ------- | ------ |
| View dashboard + reports      | ✅    | ✅      | ✅     |
| Export CSV                    | ✅    | ✅      | ❌     |
| Manage campaigns              | ✅    | ✅      | ❌     |
| Approve / reject affiliates   | ✅    | ✅      | ❌     |
| Send broadcast emails         | ✅    | ✅      | ❌     |
| Flag affiliates for review    | ✅    | ✅      | ❌     |
| Initiate payout batch         | ✅    | ❌      | ❌     |
| Mark payouts as paid          | ✅    | ❌      | ❌     |
| View billing / subscription   | ✅    | ❌      | ❌     |
| Invite / remove team members  | ✅    | ❌      | ❌     |
| Edit SaligPay integration     | ✅    | ❌      | ❌     |
| Delete campaigns / affiliates | ✅    | ❌      | ❌     |

### Subscription Tiers

**Configuration model:** All tier definitions — pricing, affiliate limits, campaign limits, and feature gates — are **Platform Admin-configurable** from the admin panel without a code deployment. Tier configuration is stored in the platform database (`platformConfig` table), not hardcoded. All enforcement logic reads from this config at runtime via the single `getTierConfig` service layer.

> **Strategic note:** Admin-configurable pricing is a competitive agility capability. Unlike competitors with rigid public pricing pages, salig-affiliate can run pricing experiments, offer custom enterprise quotes, and respond to PH/SEA market feedback without a deployment cycle.

**Default tier structure at launch (prices in PHP):**

| Tier        | Price     | Affiliate Limit | Campaign Limit | Key Feature Gates                                          |
| ----------- | --------- | --------------- | -------------- | ---------------------------------------------------------- |
| **Starter** | ₱1,999/mo | 1,000           | 3              | Core tracking, manual payouts, standard email templates    |
| **Growth**  | ₱4,499/mo | 5,000           | 10             | Priority support, advanced reports, custom email templates |
| **Scale**   | ₱8,999/mo | Unlimited       | Unlimited      | Custom domain + SSL, CSV export, API access (v2)           |

**Free trial:** 14-day free trial, no credit card required. Full feature access at Scale tier capabilities during trial.

**Trial expiry UX:** On trial expiry, the SaaS Owner is NOT hard-blocked. A prominent in-dashboard banner communicates the trial has ended and which tier restores gated features. All data (affiliates, campaigns, commission history) is preserved. The SaaS Owner can continue in read-only view for 7 days post-trial before any data access is restricted.

**Annual pricing:** 2 months free on annual commitment (~17% effective discount). Annual plans billed upfront via SaligPay.

**Tier enforcement:**

- Enforced at the application layer via `getTierConfig` on every relevant operation
- Approaching-limit warnings surfaced at 80% and 95% of limits in dashboard
- Platform Admin can manually override limits per tenant (enterprise negotiations, support exceptions)

**Billing:** SaaS Owner subscription billed via SaligPay. salig-affiliate is itself a SaligPay customer — meta-integration.

### Integration List

| Integration                               | Purpose                                                 | Scope             | Notes                                                    |
| ----------------------------------------- | ------------------------------------------------------- | ----------------- | -------------------------------------------------------- |
| **SaligPay**                              | Billing events, OAuth auth, tenant subscription billing | MVP — Core        | Hard dependency; see Domain Requirements                 |
| **Better Auth**                           | Authentication for SaaS Owners and Affiliates            | MVP — Core        | Email/password, OAuth providers, session management       |
| **Resend**                                | Transactional + broadcast email delivery                | MVP               | Called via Convex Actions; API key as Convex env var     |
| **Google reCAPTCHA v3**                   | Affiliate portal bot protection on signup               | MVP               | Score-based, invisible to legitimate users               |
| **Custom domain + SSL**                   | White-labeled affiliate portal per tenant               | v1.1 — Scale tier | DNS CNAME configuration; auto-SSL provisioning           |
| **Convex Workflows**                      | Internal async job orchestration                       | MVP — Internal    | Not user-facing; no external queue infrastructure needed |
| **Zapier / Make**                         | External workflow automation for SaaS Owners            | v2                | Pipe affiliate events to tenants' own tools              |
| **Stripe / Paddle / Chargebee / Recurly** | Non-SaligPay billing integrations                     | v2                | Opens platform to non-SaligPay customers                 |
| **Wise Payouts API**                      | Automated affiliate payout disbursement                 | v2                | Parallel track to SaligPay Payouts API                   |

### Affiliate Email & Portal — Brand Trust Requirements

> **Design principle:** The affiliate's first impression of a SaaS Owner's program is the **email invitation**. The second is the **affiliate portal**. Both must render the SaaS Owner's brand — logo, colors, domain — not salig-affiliate's brand. This is a conversion and trust mechanism, not a cosmetic feature.

- All affiliate-facing emails sent via Resend must render the SaaS Owner's logo, brand name, and reply-to address — never salig-affiliate branding
- Email templates (React Email components) stored in codebase; SaaS Owners customize subject lines, body copy, and basic template content from dashboard settings
- The white-labeled affiliate portal and branded email system are treated as a unified trust experience — not independent settings features
- Scale tier: custom domain + SSL on affiliate portal. Starter and Growth tiers: salig-affiliate subdomain (e.g., `affiliates.saligaffiliate.com/[tenant-slug]`) with SaaS Owner logo and colors applied

### Compliance Requirements

- **Subscription agreement:** SaaS Owners must accept Terms of Service on signup before accessing the dashboard. Terms must cover: data processing responsibilities for their affiliates, acceptable use policy, and limitation of liability on commission accuracy for events outside salig-affiliate's control.
- **Data processing agreement (DPA):** A template DPA is provided to SaaS Owners for use with their affiliates. salig-affiliate acts as data processor; SaaS Owner acts as data controller for their affiliates' personal data.
- **Session security:** Authenticated sessions managed by Better Auth with httpOnly cookies, CSRF protection, and configurable session timeout. Better Auth handles secure session lifecycle including token refresh and revocation. Platform Admin sessions have a shorter forced timeout (30 min idle) than SaaS Owner sessions.
- **Audit log retention:** All audit log entries (commission events, payout actions, admin impersonations) retained for minimum 2 years. Accessible to Platform Admin; SaaS Owners can view their own tenant's audit log.
- _(Full compliance detail including PCI DSS, KYC/AML, Philippine DPA, and tax reporting obligations is in the Domain-Specific Requirements section.)_

### V2 Data Model Readiness

The following fields must be included in the MVP schema even if unused at MVP:

- `permissionOverrides` on team member records (nullable) — enables v2 per-member RBAC without schema migration
- Event metadata fields on commission records — ML-queryable from day one for v2 anomaly detection
- `payoutMethod` structured field on affiliate records — supports future payout API swap-in without data migration

## Project Scoping & Phased Development

### MVP Strategy

**Approach:** Revenue MVP — the product charges from day one with a 14-day free trial (no credit card required). No closed beta or free early access period. The goal is validated revenue and real billing cycles within 90 days of launch.

**Rationale:** The 25-paying-tenant / $5K MRR / 3-validated-full-cycles success criteria demand a revenue MVP. Free early access would delay the validation signal. The 14-day free trial (full Scale tier access) provides sufficient low-friction entry without sacrificing monetization discipline.

**Resource Profile:** Small team (2–4 people). Scope must be buildable without heroics. This is the primary constraint governing what stays in MVP vs. what moves to v1.1 or v2.

### SaligPay Integration Strategy — Mock-First Architecture

Given the unconfirmed subscription event schema from SaligPay, the MVP adopts a **mock-first integration architecture**:

- The commission engine is built against a clean internal interface — an explicit seam between "billing event arrives" and "commission logic processes it"
- The seam is defined as a **normalized internal `BillingEvent` type** — the interface contract between the webhook ingestion layer (Convex HTTP Action) and the commission engine. The commission engine never knows it is talking to SaligPay; it receives only `BillingEvent` objects
- `payment.updated` (checkout / one-time payments) — fully real at MVP; schema is documented
- Subscription billing events (recurring charge, upgrade, downgrade, cancellation, refund, chargeback) — built and fully tested against a **proposed mock schema** derived from the `payment.updated` pattern
- salig-affiliate will publish the proposed subscription event schema to the SaligPay team for confirmation or correction
- When SaligPay confirms the real schema, integration is completed by updating the normalization layer in the HTTP Action only — the commission engine does not change
- Real SaligPay subscription webhook wiring is a **v1.1 task** — scoped as a narrow, low-risk swap-in

**Architecture constraint:** The `BillingEvent` normalized type is the non-negotiable interface contract. No SaligPay-specific payload structures may appear inside commission engine logic. This is enforced via TypeScript type boundaries.

| Integration Layer                              | MVP Status                                      |
| ---------------------------------------------- | ----------------------------------------------- |
| `payment.updated` — checkout / one-time        | ✅ Real — fully documented                      |
| Subscription billing events — commission logic | ✅ Built + tested against proposed mock schema  |
| Real SaligPay subscription webhook wiring      | 🔄 v1.1 — swap-in once SaligPay confirms schema |

### MVP Feature Set

**Core User Journeys Supported at MVP:**

- Journey 1: Alex — full setup to first payout (happy path)
- Journey 2: Alex — fraud detection + commission dispute resolution
- Journey 3: Jamie — affiliate portal signup to recurring commission visibility
- Journey 4: Platform Admin — tenant support + impersonation
- Journey 5: Alex — team member invite + RBAC
- Journey 6: Visitor — discovers salig-affiliate via marketing page and starts free trial

**Must-Have Capabilities (MVP — non-negotiable):**

| #   | Capability                                                                                                   | Rationale                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| 1   | Multi-tenant SaaS Owner accounts (signup, login, settings, 3 roles)                                          | Core platform foundation                                                       |
| 2   | SaligPay OAuth connection — no-code setup                                                                    | Primary integration, primary moat                                              |
| 3   | Campaign creation — percentage + flat-fee commission, recurring support                                      | Without this, no program to run                                                |
| 4   | Referral link generation + click/conversion tracking + JS snippet                                            | Core tracking mechanism                                                        |
| 5   | Commission engine — `payment.updated` real + subscription events mocked against `BillingEvent` type          | Financial accuracy is the product                                              |
| 6   | Idempotency + raw event storage + audit log                                                                  | Fintech non-negotiable                                                         |
| 7   | Affiliate signup / approval workflow + reCAPTCHA                                                             | Program can't run without affiliates                                           |
| 8   | Branded affiliate portal — white-labeled, stats, links, commission history                                   | Jamie's entire experience                                                      |
| 9   | Manual payout batch flow — generate, mark-as-paid, Resend notification                                       | Only payout mechanism at MVP                                                   |
| 10  | Fraud detection — self-referral detection, affiliate suspension                                              | Financial integrity                                                            |
| 11  | Reporting dashboard — overview, campaign + promoter performance, CSV export                                  | Alex can't manage blind                                                        |
| 12  | Transactional emails via Resend — welcome, commission confirmed, payout sent                                 | Communication backbone                                                         |
| 13  | Simplified broadcast email — compose + send to all active affiliates + sent log                              | Affiliate retention; minimal viable on top of existing Resend integration      |
| 14  | Platform Admin panel — tenant search + account detail + impersonation (audit-logged) + plan limit visibility | Ops team survival minimum for first 25 tenants                                 |
| 15  | RBAC — Owner / Manager / Viewer fixed roles                                                                  | Journey 5 — team management                                                    |
| 16  | Tier enforcement via `getTierConfig` — limits, approaching-limit warnings (80% + 95%), upgrade prompts       | Monetization enforcement                                                       |
| 17  | Public marketing page — hero, features, pricing, social proof, free trial CTA                                | Front door at launch; required for any organic or community-driven acquisition |

**Deliberately excluded from MVP:**

| Capability                                                  | Phase | Reason for deferral                              |
| ----------------------------------------------------------- | ----- | ------------------------------------------------ |
| Real SaligPay subscription webhook wiring                   | v1.1  | Schema unconfirmed — mock-first approach         |
| Custom domain + SSL on affiliate portal                     | v1.1  | Infrastructure complexity; subdomain used at MVP |
| Platform Admin upsell flagging                              | v1.1  | Not survival-critical for first 25 tenants       |
| Magic link / OAuth login for affiliates                     | v2    | Email/password sufficient at MVP                 |
| Coupon code tracking                                        | v2    | SaligPay Coupon API not available                |
| SaligPay / Wise automated payouts                           | v2    | Payout APIs not available                        |
| Stripe / Paddle / other billing integrations                | v2    | SaligPay-first strategy at MVP                   |
| Zapier / Make external integrations                         | v2    | No tenant demand validated yet                   |
| Multi-tier / sub-affiliate commissions                      | v2    | Complexity without validated demand              |
| Broadcast email segmentation / scheduling / template editor | v2    | Simplified version sufficient at MVP             |
| AI anomaly detection                                        | v2    | Requires 3+ months production data               |
| W-9 / tax form collection                                   | v3    | Regulatory trigger not yet reached               |
| White-label / self-hosted offering                          | v3    | Enterprise market not MVP target                 |

### Phased Development Roadmap

**Phase 1 — MVP (Launch)**
_Goal: 25 paying tenants, $5K MRR, 3 validated full live cycles_

- All 17 must-have capabilities (16 platform capabilities + public marketing page)
- `payment.updated` real integration + full mock-based subscription event engine (normalized `BillingEvent` type)
- Manual payout workflow
- Simplified broadcast email (compose + send + log)
- Fixed RBAC (3 roles)
- Admin-configurable tier system with plan limit monitoring
- Fintech infrastructure: idempotency, audit log, RLS, fraud detection
- Platform Admin: tenant search, account detail, impersonation, plan limit visibility
- Public marketing page: hero, features, pricing (3 tiers), social proof, free trial CTA

**Phase 1.1 — Fast Follow (Weeks 4–8 post-launch)**
_Goal: Complete the SaligPay integration promise; close UX gaps found in first 25 tenants_

- Real SaligPay subscription webhook wiring (swap-in once schema confirmed — single-layer change)
- Custom domain + SSL for affiliate portals (Scale tier)
- Platform Admin upsell flagging
- Trial-to-paid conversion flow polish based on early user feedback
- Coupon code tracking (if SaligPay API becomes available ahead of schedule)

**Phase 2 — Growth (Months 4–9)**
_Goal: 200 tenants, $20K MRR, open platform to non-SaligPay customers_

- Stripe, Paddle, Chargebee, Recurly billing integrations
- Wise payouts + SaligPay Payouts API (when available)
- Coupon code tracking (when SaligPay API available)
- Zapier / Make integrations
- Magic link + OAuth affiliate login
- Multi-tier / sub-affiliate commissions
- Broadcast email segmentation, scheduling, and template editor
- Trigger-based automated email sequences
- Per-member RBAC permission toggles
- AI anomaly detection (commission accuracy monitoring)
- Sub-ID link tracking + A/B testing

**Phase 3 — Expansion (Months 10–18)**
_Goal: Global market, enterprise tier, platform network effects_

- Multi-currency support (190 currencies)
- W-9 / W-8BEN tax form collection
- White-label / self-hosted offering
- Public affiliate marketplace
- AI affiliate recruitment recommendations
- AI commission optimization
- Direct URL tracking (no referral link required)

### Risk Mitigation

**Technical Risks:**

| Risk                                                      | Mitigation                                                                                                                                                            |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SaligPay subscription schema delayed beyond v1.1 window   | Mock-first architecture; `payment.updated` delivers real value at MVP; subscription events are an enhancement, not a blocker for first revenue                        |
| `BillingEvent` seam design violated during implementation | Architecture review gate before commission engine build begins; no SaligPay payload types permitted inside commission logic — enforced via TypeScript type boundaries |
| Commission engine complexity exceeds small team capacity  | Convex Workflows handles orchestration complexity; team focuses on business logic only; raw event storage means no data loss if processing has bugs                   |
| Multi-tenant RLS implemented incorrectly                  | Automated cross-tenant isolation integration tests required before launch; not optional                                                                               |

**Market Risks:**

| Risk                                                                | Mitigation                                                                                                                                                      |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 25-tenant target not reached in 90 days                             | Community-led distribution (PH/SEA networks) as primary channel; free trial lowers conversion friction; 14-day trial = fast feedback loop on product-market fit |
| Affiliates resist referral link-only tracking (prefer coupon codes) | Monitor early adopter feedback; coupon code tracking accelerated to v1.1 if demand signal is strong before v2                                                   |
| Pricing in PHP limits international expansion perception            | Tier prices are admin-configurable; can run USD pricing experiments without deployment                                                                          |

**Resource Risks:**

| Risk                                                      | Mitigation                                                                                                                                           |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Small team scope overrun                                  | 16 must-have capabilities are the hard line; v1.1 list is the overflow valve; nothing from v1.1 enters MVP without explicit decision                 |
| Single point of failure on SaligPay integration knowledge | `BillingEvent` seam isolates SaligPay integration to a single layer; any team member can own the swap-in task                                        |
| Platform Admin panel scope creep under launch pressure    | Admin panel scope is explicitly bounded to 4 capabilities: tenant search, account detail, impersonation, plan limit visibility — nothing else at MVP |

## Functional Requirements

### Account & Tenant Management

- **FR1:** A visitor can register a SaaS Owner account with email and password
- **FR2:** A SaaS Owner can log in and log out of their account securely
- **FR3:** A SaaS Owner can connect their SaligPay credentials via OAuth to enable billing event integration
- **FR4:** A SaaS Owner can reconnect or update their SaligPay credentials when they expire or change
- **FR5:** A SaaS Owner can view and manage their salig-affiliate subscription plan and billing status
- **FR6:** A SaaS Owner can invite team members by email and assign them a role (Owner, Manager, Viewer)
- **FR7:** A SaaS Owner can remove team members from their account
- **FR8:** A team member can accept an invitation and set up their account
- **FR9:** A SaaS Owner can view and update their account profile and settings

### Campaign Management

- **FR10:** A SaaS Owner can create an affiliate campaign with a name, description, and commission structure
- **FR11:** A SaaS Owner can configure commission structures as percentage-of-sale or flat-fee per conversion
- **FR12:** A SaaS Owner can enable recurring commissions on a campaign so affiliates earn on every renewal charge
- **FR13:** A SaaS Owner or Manager can edit, pause, or archive an existing campaign
- **FR14:** A SaaS Owner can set per-campaign commission approval thresholds (auto-approve vs. manual review)
- **FR15:** A SaaS Owner can apply individual commission rate overrides to specific affiliates within a campaign

### Referral Tracking

- **FR16:** A SaaS Owner can generate unique referral links for affiliates in multiple URL formats
- **FR17:** The system can track affiliate link clicks with deduplication by IP and cookie
- **FR18:** The system can attribute a conversion to an affiliate when a referred visitor completes a tracked action
- **FR19:** A SaaS Owner can install a JavaScript tracking snippet on their website to enable referral attribution
- **FR20:** The system can attribute conversions using cookie-based tracking within a configurable attribution window
- **FR21:** The system can pass referral attribution metadata through SaligPay checkout sessions for server-side attribution

### Commission Engine

- **FR22:** The system can process a `payment.updated` billing event from SaligPay and create a commission record for the attributed affiliate
- **FR23:** The system can process subscription billing lifecycle events (recurring charge, upgrade, downgrade, cancellation, refund, chargeback) and adjust commission records accordingly
- **FR24:** The system can detect and reject commission creation for payments with FAILED or PENDING status
- **FR25:** The system can reverse a commission record when a refund or chargeback billing event is received — without deleting the original record
- **FR26:** The system can deduplicate billing events by event ID to prevent double commission awards
- **FR27:** The system can store every incoming billing event as a raw payload before processing
- **FR28:** A SaaS Owner or Manager can manually approve or decline a commission record that is pending review
- **FR29:** The system can write every commission event (created, adjusted, approved, declined, reversed) to an immutable audit log

### Affiliate Management

- **FR30:** A visitor can register as an affiliate on a SaaS Owner's branded portal
- **FR31:** The system can protect affiliate portal registration with bot-detection verification
- **FR32:** A SaaS Owner or Manager can review, approve, or reject pending affiliate applications
- **FR33:** A SaaS Owner or Manager can suspend or reactivate an affiliate account
- **FR34:** A SaaS Owner or Manager can view an affiliate's profile, referral activity, commission history, and fraud signals
- **FR35:** The system can detect self-referral attempts and flag the associated commission for review
- **FR36:** A SaaS Owner or Manager can view and act on fraud signals for an affiliate (bot traffic score, verification failures, IP anomalies)

### Affiliate Portal

- **FR37:** An approved affiliate can log in to a branded affiliate portal with email and password
- **FR38:** An affiliate can view their referral links and copy or share them from the portal
- **FR39:** An affiliate can view their click, conversion, and commission statistics in real time
- **FR40:** An affiliate can view the history and status of all their commissions
- **FR41:** An affiliate can view their pending and paid payout balance
- **FR42:** An affiliate can access a brand asset library provided by the SaaS Owner
- **FR43:** A SaaS Owner can configure the affiliate portal with their brand identity (logo, colors, name)
- **FR44:** A SaaS Owner on the Scale tier can configure a custom domain for their affiliate portal

### Payout Management

- **FR45:** A SaaS Owner can generate a payout batch summarizing all affiliates with pending commission balances
- **FR46:** A SaaS Owner can download a payout batch as a CSV with affiliate names, amounts, and payout notes
- **FR47:** A SaaS Owner can mark individual payouts or an entire batch as paid with an optional payment reference
- **FR48:** The system can notify affiliates via email when their payout has been marked as paid
- **FR49:** A SaaS Owner can view the full payout history including status, amounts, dates, and references
- **FR50:** The system can write every payout action to an immutable audit log

### Email Communications

- **FR51:** The system can send a transactional welcome email to a new affiliate upon portal registration
- **FR52:** The system can send a transactional commission confirmed email to an affiliate when a commission is approved
- **FR53:** The system can send a transactional payout sent email to an affiliate when a payout is marked as paid
- **FR54:** The system can send a transactional new referral alert email to a SaaS Owner when a new conversion is attributed
- **FR55:** A SaaS Owner or Manager can compose and send a broadcast email to all active affiliates in their program
- **FR56:** A SaaS Owner can view the sent log of broadcast emails
- **FR57:** A SaaS Owner can customize the subject lines and body content of affiliate-facing email templates

### Reporting & Analytics

- **FR58:** A SaaS Owner or Manager can view a dashboard overview of program performance (clicks, conversions, commissions, active affiliates)
- **FR59:** A SaaS Owner or Manager can view campaign-level performance metrics
- **FR60:** A SaaS Owner or Manager can view affiliate-level performance metrics
- **FR61:** A SaaS Owner or Manager can filter all reports by date range
- **FR62:** A SaaS Owner or Manager can export report data as CSV

### Platform Administration

- **FR63:** A Platform Admin can search for and view any tenant account by email or identifier
- **FR64:** A Platform Admin can view tenant account details including subscription plan, affiliate count, and payout history
- **FR65:** A Platform Admin can impersonate a tenant account to see exactly what the SaaS Owner sees — with the action audit-logged
- **FR66:** A Platform Admin can view a tenant's plan limit usage and proximity to tier limits
- **FR67:** A Platform Admin can manually override a tenant's tier limits for enterprise exceptions or support cases
- **FR68:** A Platform Admin can configure platform-wide tier definitions including pricing, affiliate limits, campaign limits, and feature gates without a code deployment

### Security & Access Control

- **FR69:** The system enforces role-based access control — Owner, Manager, and Viewer roles have distinct permission boundaries as defined in the RBAC matrix
- **FR70:** The system enforces tenant data isolation — no operation may return or modify data belonging to another tenant
- **FR71:** The system verifies HMAC-SHA256 signatures on all incoming SaligPay webhook events before processing
- **FR72:** The system rejects or quarantines any webhook event that fails signature verification
- **FR73:** A SaaS Owner's SaligPay credentials are stored encrypted at rest and never exposed client-side
- **FR74:** The system presents a re-authentication prompt to a SaaS Owner when their SaligPay token is expired or invalid

> **Capability contract:** This FR list is binding. Any feature not listed here will not exist in the final product unless explicitly added. **82 functional requirements across 12 capability areas.**

### Marketing Page

- **FR75:** A visitor can access a public marketing page at the root domain that communicates salig-affiliate's value proposition, features, pricing, and a primary call to action to start a free trial
- **FR76:** The marketing page must display a pricing section showing all three subscription tiers (Starter, Growth, Scale) with prices, affiliate limits, campaign limits, and key feature differentiation — including a "Start free trial" CTA per tier
- **FR77:** The marketing page must include a features section that communicates the core platform capabilities: SaligPay native integration, automated commission tracking, branded affiliate portal, manual payout workflow, fraud detection, and reporting
- **FR78:** The marketing page must include a social proof section (testimonials, logos, or usage stats) — initially seeded with placeholder content and replaced with real customer evidence as it becomes available post-launch
- **FR79:** The marketing page must include a navigation header with a link to log in (for returning users) and a primary "Start free trial" CTA
- **FR80:** The marketing page must be a Next.js Server Component page rendered at the root route (`/`), fully SEO-optimised with metadata, Open Graph tags, and structured page title and description
- **FR81:** The marketing page must be responsive and load to interactive state in under 2 seconds on mobile (consistent with NFR1)
- **FR82:** All "Start free trial" CTAs on the marketing page must route the visitor to the SaaS Owner signup flow without requiring a credit card

## Non-Functional Requirements

### Performance

- **NFR1:** The affiliate portal must load to interactive state in under 2 seconds on a mobile connection (measured at P75)
- **NFR2:** Dashboard pages must load in under 3 seconds for SaaS Owners under normal load
- **NFR3:** Referral link click tracking must complete attribution recording within 3 seconds of the click event
- **NFR4:** Commission status must be visible to an affiliate within 60 minutes of the corresponding billing event being processed
- **NFR5:** Payout batch generation (up to 1,000 affiliates) must complete within 30 seconds
- **NFR6:** Report CSV exports must complete within 60 seconds for any date range within a tenant's data history

### Security

- **NFR7:** All data in transit must be encrypted via TLS 1.2 or higher — no exceptions for any endpoint
- **NFR8:** All data at rest must be encrypted — including SaligPay credentials, affiliate personal data, and commission records
- **NFR9:** SaligPay OAuth credentials (`client_id`, `client_secret`) must never appear in client-side code, browser storage, or API responses
- **NFR10:** HMAC-SHA256 webhook signature verification must be performed using timing-safe comparison (`crypto.timingSafeEqual`) on the raw request body before any payload processing
- **NFR11:** Authenticated sessions must use httpOnly cookies with CSRF protection — no token storage in localStorage or sessionStorage. Better Auth handles secure session management by default.
- **NFR12:** Platform Admin sessions must enforce a 30-minute idle timeout — shorter than standard SaaS Owner session timeout
- **NFR13:** All impersonation actions by Platform Admin must be recorded in the audit log with start timestamp, end timestamp, acting admin identity, and all mutations performed during the session
- **NFR14:** Audit log records must be immutable — no application-level operation may update or delete an audit log entry
- **NFR15:** Audit log records must be retained for a minimum of 2 years
- **NFR16:** Cross-tenant data isolation must be validated by automated integration tests that run before every production deployment

### Scalability

- **NFR17:** The platform must support at least 200 concurrent tenant accounts without performance degradation
- **NFR18:** Each tenant must be able to support up to 10,000 affiliates on the Scale tier without query performance degradation
- **NFR19:** The webhook ingestion pipeline must handle burst webhook delivery (up to 100 events per second) without dropping events — raw storage must absorb bursts before async processing
- **NFR20:** The commission engine must process a backlog of up to 10,000 queued billing events within 1 hour during a catch-up scenario
- **NFR21:** The platform tier configuration system (`getTierConfig`) must support a 10x increase in tenant count without architectural changes

### Reliability

- **NFR22:** Affiliate portal uptime must meet 99.9% monthly availability (approximately 44 minutes downtime per month maximum)
- **NFR23:** SaaS Owner dashboard uptime must meet 99.9% monthly availability
- **NFR24:** Webhook processing must guarantee at-least-once delivery semantics — no billing event may be silently dropped; unrecognized event types must be stored raw and flagged for review
- **NFR25:** Commission records must never be deleted — only reversed via an append-only audit trail; hard deletion is prohibited at the application layer
- **NFR26:** The system must detect and alert on stalled Convex Workflow jobs (payout batches, commission processing) that have not progressed within a configurable timeout window
- **NFR27:** Failed Resend email delivery attempts must be retried with exponential backoff; persistent failures must be logged and surfaced to the Platform Admin

### Integration

- **NFR28:** The `BillingEvent` normalized type must be the sole interface between the SaligPay webhook ingestion layer and the commission engine — no SaligPay-specific payload types may appear in commission processing logic
- **NFR29:** SaligPay OAuth token refresh must occur automatically when the token is within 60 seconds of expiry — no manual intervention required
- **NFR30:** A SaligPay API 401 response during any operation must immediately surface a re-authentication prompt to the SaaS Owner and halt the affected operation gracefully
- **NFR31:** Resend API calls must be made from Convex Actions only — never from client-side code
- **NFR32:** Custom domain SSL provisioning for affiliate portals must complete within 24 hours of DNS configuration by the SaaS Owner (Scale tier)
- **NFR33:** The platform must store the raw payload, timestamp, and signature verification status for every incoming SaligPay webhook event — regardless of whether processing succeeds or fails

### Accessibility

- **NFR34:** The affiliate portal must meet WCAG 2.1 Level AA standards — it is a public-facing surface serving a broad affiliate audience
- **NFR35:** The SaaS Owner dashboard must meet WCAG 2.1 Level A as a baseline at MVP, with Level AA as the v1.1 target
