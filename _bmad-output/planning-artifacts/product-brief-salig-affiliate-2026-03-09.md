---
stepsCompleted: [1, 2, 3, 4, 5, 6]
inputDocuments:
  - "_bmad-output/brainstorming/brainstorming-session-2026-03-09-0001.md (empty/template only)"
  - "https://firstpromoter.com/ (competitive reference - live scraped)"
  - "https://firstpromoter.com/features (competitive reference - live scraped)"
  - "https://firstpromoter.com/pricing (competitive reference - live scraped)"
date: 2026-03-09
author: msi
---

# Product Brief: salig-affiliate

<!-- Content will be appended sequentially through collaborative workflow steps -->

## Executive Summary

**salig-affiliate** is a full-featured affiliate, referral, and influencer program management platform purpose-built for subscription-based SaaS and digital businesses. Modeled closely after FirstPromoter — the market-leading tool in this space — salig-affiliate will give SaaS founders and marketing teams everything they need to launch, manage, track, and pay affiliates from a single, intuitive dashboard.

The platform integrates natively with **SaligPay** (an in-house custom payment platform), delivering a tightly coupled billing + affiliate tracking ecosystem. Core capabilities include: campaign management, branded affiliate portals, referral link and coupon code tracking, subscription-aware commission logic (recurring, upgrades, cancellations, refunds), multi-tier commissions, automated email marketing, powerful reporting across 18 data points, fraud protection, and affiliate payouts — all powered through SaligPay.

The go-to-market positioning is a close functional clone of FirstPromoter, differentiated by deep native integration with the SaligPay ecosystem and delivered as a modern, reliable platform for SaaS businesses already using SaligPay.

---

## Core Vision

### Problem Statement

SaaS businesses with affiliate or referral programs struggle to manage the full lifecycle of their programs efficiently. The core pain points are:

- **Manual commission tracking** across subscriptions, upgrades, downgrades, cancellations, and refunds — especially for recurring billing models
- **Fragmented tooling**: spreadsheets for tracking, separate email tools for affiliate communication, manual payouts, no unified reporting
- **No branded affiliate experience**: affiliates have no self-service portal to see their stats, referral links, or earned rewards
- **Fraud and abuse**: self-referrals, bot signups, and unverified lead commissions eat into program ROI
- **Setup complexity**: connecting billing providers, setting up tracking scripts, and managing coupon codes requires developer time

### Problem Impact

- SaaS founders waste hours/week on manual affiliate administration instead of growing their product
- Affiliates churn from programs due to poor visibility into their performance and delayed payouts
- Businesses leave revenue on the table because they can't confidently scale programs they can't accurately track
- Finance teams face compliance headaches when paying hundreds of international affiliates individually

### Why Existing Solutions Fall Short

The main competitor — **FirstPromoter** — is the clear market leader and largely solves this problem well. The opportunity for salig-affiliate exists because:

- **SaligPay ecosystem lock-in advantage**: salig-affiliate is natively built on SaligPay — SaaS businesses already using SaligPay get a zero-friction, deeply integrated affiliate solution with no third-party billing connectors needed
- **Market demand**: The affiliate SaaS tooling market is growing alongside the explosion of AI SaaS products (as evidenced by FirstPromoter's own case studies with Submagic, CustomGPT, neuroflash)
- **Pricing barrier**: FirstPromoter starts at $49/month; room for a competitive alternative
- Other tools (Rewardful, LeadDyno, Tapfiliate, Tolt, Reditus) each lack some combination of subscription-aware billing, coupon code tracking, or built-in email automation

### Proposed Solution

**salig-affiliate** is a SaaS platform that provides:

1. **Campaign Management** — Create and manage multiple affiliate/referral/influencer campaigns with flexible commission structures (percentage, flat-fee, recurring, one-time, multi-tier)
2. **Branded Affiliate Portal** — A fully white-labeled affiliate dashboard with custom domain support, custom CSS/JS, and 50+ customizable attributes
3. **Referral Tracking Engine** — Track conversions via referral links (8 formats, SEO-friendly, no redirects), SaligPay-native coupon codes, and direct URL assignment
4. **Subscription-Aware Commission Logic** — Automatically adjust commissions for recurring charges, upgrades, cancellations, refunds, and chargebacks in sync with SaligPay billing events
5. **SaligPay Native Integration** — Deep, first-party integration with SaligPay as the billing backbone; no third-party connectors required
6. **Automated Email Marketing** — Built-in broadcast and trigger-based email system for affiliate communication (no third-party tool needed)
7. **Powerful Reporting** — 18-point reporting dashboard covering overview, campaign performance, promoter performance, traffic sources, and landing page analytics; exportable as CSV/JSON
8. **Payouts Engine** — Affiliate payouts processed directly through SaligPay infrastructure; bulk and automated payout support
9. **Fraud Protection** — Self-referral detection, ad-traffic detection, reCAPTCHA on affiliate portal, automatic chargeback/refund tracking, manual commission approval thresholds
10. **Team & Multi-Campaign Management** — Invite team members with role-based access, manage multiple websites/domains, unlimited campaigns (on paid tiers)

### Key Differentiators

- **Native SaligPay integration** — deepest possible billing event tracking with zero third-party latency or webhook reliability concerns; a unique moat for SaligPay ecosystem customers
- **Subscription-billing-first architecture** — commission logic is built around SaaS billing events (MRR, churn, upgrades) from the ground up
- **Built-in email marketing** — eliminates the need for a separate tool for affiliate comms
- **Modern, clean UX** — polished, intuitive interface easy for non-technical users
- **Competitive pricing** — positioned against FirstPromoter's $49–$149/month tiers

---

## Target Users

### Primary Users

#### 1. The SaaS Owner / Subscriber ("Alex")

**Who they are:** A SaaS founder, product owner, or marketing lead at a subscription-based digital business (bootstrapped to Series A stage). They are salig-affiliate's paying customer and a SaligPay user.

**Context & Role:** Alex runs a SaaS product with 50–5,000 customers and wants to grow through word-of-mouth and affiliate marketing. They may manage the affiliate program themselves or delegate it to a marketing manager. They are technical enough to integrate a billing provider but prefer no-code tooling for day-to-day affiliate ops.

**Goals:**

- Launch and manage an affiliate/referral program without engineering help
- Track exactly which affiliates are driving revenue and how much
- Pay affiliates accurately and on time, at scale
- Keep the program clean from fraud and abuse

**Current Pain:** Spreadsheets, manual payouts, no reliable tracking of recurring commissions, no self-service portal for their affiliates, dev time wasted on tracking scripts.

**Success Moment:** Opens the dashboard on a Monday morning, sees $12,000 in affiliate-driven MRR last month, clicks "Pay All" and processes 47 affiliate payouts in under 5 minutes via SaligPay.

**Sub-roles within this account:**

- **Owner/Admin** — full access to all features and billing
- **Manager** — manages affiliates and campaigns, no billing access
- **Viewer** — read-only access (e.g., finance team reviewing payout reports)

---

#### 2. The Affiliate / Promoter ("Jamie")

**Who they are:** A content creator, blogger, newsletter writer, influencer, or existing customer of the SaaS Owner who promotes the SaaS product in exchange for commissions. They are NOT a paying customer of salig-affiliate — but their experience is critical to the SaaS Owner's retention.

**Context & Role:** Jamie logs into the Branded Affiliate Portal (white-labeled under the SaaS Owner's brand). They share referral links, track clicks and conversions, monitor earned commissions, and request or receive payouts.

**Goals:**

- Know exactly how much they've earned and when they'll be paid
- Get their referral links and marketing assets quickly
- Trust that the program is legitimate and professionally run

**Current Pain:** Opaque commission tracking, delayed or manual payouts, ugly/unbranded portals that feel untrustworthy, no visibility into their referred customers' subscription status.

**Success Moment:** Shares a referral link in their newsletter, checks the portal 3 days later, sees 12 clicks, 2 trials, and 1 paying customer — commission locked in automatically.

---

### Secondary Users

#### 3. The Platform Admin (internal team)

**Who they are:** The salig-affiliate internal operations team — the builder and operator of the platform itself.

**Context & Role:** Has superuser access to the entire multi-tenant platform. Manages SaaS Owner subscriptions and billing plans, monitors system health, handles support escalations, can impersonate accounts for debugging, and configures platform-level settings.

**Goals:**

- Monitor platform health and usage across all tenants
- Manage subscription tiers and enforce plan limits
- Resolve support issues quickly with account impersonation tools
- Ensure fraud, abuse, and compliance at the platform level

---

### User Journey

#### SaaS Owner (Alex) — Core Journey

| Stage           | Experience                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------------ |
| **Discovery**   | Searches "affiliate tracking software for SaaS", finds salig-affiliate via SEO or through SaligPay ecosystem |
| **Onboarding**  | Signs up, connects SaligPay account, creates first campaign, generates referral links — under 15 minutes     |
| **First Value** | First affiliate signs up through their portal; first referral tracked automatically                          |
| **Core Usage**  | Weekly: reviews dashboard, approves new affiliates, monitors commissions. Monthly: runs payouts              |
| **Aha Moment**  | Sees recurring commissions auto-adjusting after a referred customer upgrades their plan                      |
| **Long-term**   | Scales affiliate program, adds team members, unlocks higher campaign tiers                                   |

#### Affiliate / Promoter (Jamie) — Core Journey

| Stage          | Experience                                                                          |
| -------------- | ----------------------------------------------------------------------------------- |
| **Discovery**  | Invited by SaaS Owner via email, or finds signup link on the SaaS product's website |
| **Onboarding** | Registers via branded portal, gets referral link and assets immediately             |
| **Core Usage** | Shares links, checks stats weekly, receives automated milestone emails              |
| **Aha Moment** | First commission confirmed — sees money in their "Pending Payouts" balance          |
| **Long-term**  | Becomes a top promoter, receives individual bonus/custom commission rate            |

---

## Success Metrics

### User Success Metrics

**For the SaaS Owner (Alex):**

- Completes full setup (SaligPay integration + first campaign + first affiliate invite) in under 15 minutes from signup
- First referral tracked automatically within 24 hours of going live
- Affiliate payout batch completed in under 5 minutes (for up to 100+ affiliates)
- Commission adjustments for subscription events (upgrades, cancellations, refunds) require zero manual intervention
- 80%+ of active SaaS Owner accounts run at least 1 payout per month (health signal)

**For the Affiliate / Promoter (Jamie):**

- Can access their referral link and assets within 2 minutes of portal registration
- Commission status is visible in real-time (no lag > 1 hour from billing event)
- Payout received within the expected window communicated in the portal
- Portal loads in under 2 seconds on mobile (trust signal = professional experience)

---

### Business Objectives

**3-Month Targets (Post-Launch MVP):**

- Acquire first 25 paying SaaS Owner subscribers
- Validate SaligPay integration with zero data integrity issues
- Achieve < 2% voluntary churn among early adopters
- Complete end-to-end payout flow with no manual intervention

**12-Month Targets:**

- Reach 200+ paying SaaS Owner subscribers
- Track $500K+ in affiliate-driven revenue across all tenant accounts (platform-wide)
- Support 10,000+ active affiliates across all tenant programs combined
- Achieve product-led growth: 20%+ of new signups from affiliate/word-of-mouth referral of salig-affiliate itself

**Strategic:**

- Establish salig-affiliate as the go-to affiliate tool for SaligPay ecosystem customers
- Build reputation for reliability: 99.9% uptime SLA on tracking and commission events
- GDPR compliance achieved before first EU customer onboards

---

### Key Performance Indicators

| KPI                                 | Target           | Timeframe | Why It Matters         |
| ----------------------------------- | ---------------- | --------- | ---------------------- |
| Monthly Recurring Revenue (MRR)     | $5K              | Month 3   | Business viability     |
| MRR                                 | $20K             | Month 12  | Growth trajectory      |
| Paying SaaS Owner Subscribers       | 25               | Month 3   | Adoption               |
| Paying SaaS Owner Subscribers       | 200              | Month 12  | Scale                  |
| Time-to-First-Referral (median)     | < 24 hrs         | Ongoing   | Onboarding quality     |
| Setup Completion Rate               | > 70% of signups | Ongoing   | Activation health      |
| Monthly Affiliate Payout Volume ($) | Growing MoM      | Ongoing   | Program health proxy   |
| Affiliate Portal Uptime             | 99.9%            | Ongoing   | Trust & reliability    |
| SaaS Owner Monthly Churn            | < 3%             | Ongoing   | Retention              |
| Affiliate Retention (active 30d)    | > 60%            | Ongoing   | Promoter engagement    |
| Commission Accuracy Rate            | 99.99%           | Ongoing   | Core product trust     |
| Support Ticket Volume / Account     | Declining MoM    | Ongoing   | Product quality signal |

---

## MVP Scope

### Core Features (Must-Have for Launch)

The MVP is focused entirely on delivering a working end-to-end affiliate program for a SaaS Owner using **SaligPay** as their billing provider. Everything else is v2+.

#### 1. SaaS Owner Account Management

- Multi-tenant signup, login, account settings
- Subscription billing (via SaligPay) for salig-affiliate itself — plan tiers with limits enforced
- Team member invites with 3 roles: Owner, Manager, Viewer
- Platform Admin panel (internal superuser dashboard) with account impersonation

#### 2. Campaign Management

- Create and configure affiliate/referral/influencer campaigns
- Commission structures: percentage-based and flat-fee
- Recurring commissions (in sync with SaligPay subscription billing events)
- Up to 3 campaigns on Starter tier; unlimited on Business+

#### 3. Referral Tracking Engine

- Unique referral link generation per affiliate (SEO-friendly, no redirects, 8 formats)
- SaligPay coupon code tracking — create and assign coupons natively via SaligPay API
- Affiliates can customize or generate their own SaligPay coupon codes
- Click and conversion tracking with cookie-based attribution
- Website visitor tracking via JavaScript snippet

#### 4. Billing Integration — SaligPay (Native)

- Native, first-party integration with SaligPay (internal payment platform)
- SaligPay webhook integration for all billing lifecycle events
- Automatic tracking of: new charges, recurring charges, upgrades, cancellations, refunds, chargebacks
- Commission auto-adjustment on all SaligPay billing events (zero manual intervention)
- Failed charge detection — commissions not awarded for failed payments
- Setup via SaligPay API credentials in dashboard — no developer required

#### 5. Affiliate / Promoter Management

- Affiliate signup and approval workflow (manual or auto-approve)
- Affiliate profile management (custom fields, status, notes)
- Individual commission overrides and performance bonuses
- Up to 1,000 affiliates on Starter; unlimited on Business+
- Custom signup fields (15 default field types)
- reCAPTCHA bot protection on affiliate portal signup

#### 6. Branded Affiliate Portal (MVP Tier)

- White-labeled portal with custom logo, brand colors, background
- Custom domain support (with SSL)
- Affiliate dashboard: stats overview, referral links, commission history, payout balance
- Asset library: upload images, documents, text assets for affiliates
- "Powered by" badge removed on Business+ plan

#### 7. Payouts Engine (MVP Tier)

- Affiliate payouts processed via SaligPay infrastructure
- Bulk payout execution (pay multiple affiliates at once)
- Manual payout marking (for offline/bank payments)
- Payout history and status tracking per affiliate
- Fraud protection: self-referral detection, commission approval threshold setting

#### 8. Reporting Dashboard (MVP Tier)

- Admin dashboard: overview stats (clicks, referrals, revenue, commissions paid)
- Campaign performance report
- Promoter performance report
- Date range filtering (day, week, month)
- Downloadable CSV export

#### 9. Automated Emails (MVP Tier)

- Transactional emails: affiliate welcome, commission confirmed, payout sent, new referral alert
- Basic broadcast email to all affiliates in a campaign
- Customizable email templates (logo, colors, content)

---

### Out of Scope for MVP

These features are explicitly deferred. They will NOT block launch.

| Feature                                                    | Reason for Deferral                                                                  |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Stripe, Paddle, Chargebee, Recurly, Braintree integrations | SaligPay covers all MVP billing needs; 3rd-party integrations are a v2 growth unlock |
| Wise / bank transfer payouts                               | SaligPay handles MVP payout needs; add Wise for non-SaligPay expansion later         |
| Managed Auto-Payouts (single invoice service)              | Requires additional financial/compliance infrastructure                              |
| Multi-tier / sub-affiliate commissions                     | Complex to implement correctly; low MVP priority                                     |
| Embeddable affiliate dashboard (SSO)                       | Custom domain covers trust need at MVP                                               |
| Sub-ID link tracking & A/B testing                         | Power feature for advanced affiliates; v2                                            |
| Traffic source & landing page reports                      | Advanced analytics; basic reporting covers MVP need                                  |
| Affiliate lead submission form                             | Niche use case; deferred                                                             |
| Direct URL tracking (no referral link)                     | Complex tracking edge case; v2                                                       |
| Zapier / Make / Albato integrations                        | API/webhooks cover MVP integration needs                                             |
| Post-back URL tracking                                     | Niche; v2                                                                            |
| Multiple currencies / exchange rates                       | Launch in single currency first; multi-currency v2                                   |
| Custom CSS / JavaScript on affiliate portal                | Custom domain + brand colors covers MVP trust need                                   |
| Trigger-based automated email sequences                    | Basic transactional emails sufficient for MVP                                        |
| W-9 / W-8BEN tax form collection                           | Required for US compliance at scale; deferred                                        |
| EU invoicing for affiliates                                | Regulatory complexity; add when EU market targeted                                   |

---

### MVP Success Criteria (Go/No-Go for v2 investment)

The MVP is considered successful when:

- **25 paying SaaS Owner subscribers** acquired within 90 days of launch
- **< 2% involuntary churn** in the first 3 months (product stability signal)
- **End-to-end flow validated**: at least 3 customers have run a live affiliate program, tracked real referrals via SaligPay, and completed a payout cycle
- **Commission accuracy**: zero reported commission discrepancy incidents in the first 60 days
- **Qualitative signal**: at least 5 unprompted positive reviews or testimonials from SaaS Owners
- **Affiliate portal trust**: at least 50 active affiliates (across all tenants) logging in weekly

---

### Future Vision (v2 and Beyond)

**v2 — Scale & Third-Party Integrations (Months 4–9):**

- Stripe, Paddle, Chargebee, Recurly, Braintree billing integrations (open to non-SaligPay customers)
- Wise payouts + managed auto-payout (single invoice) service
- Zapier and Make integrations
- Multi-tier / sub-affiliate commission structures
- Embeddable affiliate dashboard with SSO (JWT-based)
- Trigger-based automated email sequences (milestones, inactivity nudges)
- Traffic source and landing page analytics reports
- Custom CSS / JavaScript on affiliate portal
- Sub-ID link tracking and A/B testing

**v3 — Differentiation & Expansion (Months 10–18):**

- Multi-currency support (190 currencies, 170 conversions)
- W-9 / W-8BEN tax form collection and management
- Direct URL tracking (no referral link required)
- White-label / self-hosted offering for agencies and enterprises
- Public affiliate marketplace (affiliates discover programs to join)
- Advanced fraud detection with ML-based signals
- AI-powered affiliate recruitment recommendations
