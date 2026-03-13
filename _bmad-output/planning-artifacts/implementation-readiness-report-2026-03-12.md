# Implementation Readiness Assessment Report

**Date:** 2026-03-12
**Project:** salig-affiliate

---

## PRD Analysis

### Functional Requirements

**Account & Tenant Management (9 requirements)**
- **FR1:** A visitor can register a SaaS Owner account with email and password
- **FR2:** A SaaS Owner can log in and log out of their account securely
- **FR3:** A SaaS Owner can connect their SaligPay credentials via OAuth to enable billing event integration
- **FR4:** A SaaS Owner can reconnect or update their SaligPay credentials when they expire or change
- **FR5:** A SaaS Owner can view and manage their salig-affiliate subscription plan and billing status
- **FR6:** A SaaS Owner can invite team members by email and assign them a role (Owner, Manager, Viewer)
- **FR7:** A SaaS Owner can remove team members from their account
- **FR8:** A team member can accept an invitation and set up their account
- **FR9:** A SaaS Owner can view and update their account profile and settings

**Campaign Management (6 requirements)**
- **FR10:** A SaaS Owner can create an affiliate campaign with a name, description, and commission structure
- **FR11:** A SaaS Owner can configure commission structures as percentage-of-sale or flat-fee per conversion
- **FR12:** A SaaS Owner can enable recurring commissions on a campaign so affiliates earn on every renewal charge
- **FR13:** A SaaS Owner or Manager can edit, pause, or archive an existing campaign
- **FR14:** A SaaS Owner can set per-campaign commission approval thresholds (auto-approve vs. manual review)
- **FR15:** A SaaS Owner can apply individual commission rate overrides to specific affiliates within a campaign

**Referral Tracking (6 requirements)**
- **FR16:** A SaaS Owner can generate unique referral links for affiliates in multiple URL formats
- **FR17:** The system can track affiliate link clicks with deduplication by IP and cookie
- **FR18:** The system can attribute a conversion to an affiliate when a referred visitor completes a tracked action
- **FR19:** A SaaS Owner can install a JavaScript tracking snippet on their website to enable referral attribution
- **FR20:** The system can attribute conversions using cookie-based tracking within a configurable attribution window
- **FR21:** The system can pass referral attribution metadata through SaligPay checkout sessions for server-side attribution

**Commission Engine (8 requirements)**
- **FR22:** The system can process a `payment.updated` billing event from SaligPay and create a commission record for the attributed affiliate
- **FR23:** The system can process subscription billing lifecycle events (recurring charge, upgrade, downgrade, cancellation, refund, chargeback) and adjust commission records accordingly
- **FR24:** The system can detect and reject commission creation for payments with FAILED or PENDING status
- **FR25:** The system can reverse a commission record when a refund or chargeback billing event is received — without deleting the original record
- **FR26:** The system can deduplicate billing events by event ID to prevent double commission awards
- **FR27:** The system can store every incoming billing event as a raw payload before processing
- **FR28:** A SaaS Owner or Manager can manually approve or decline a commission record that is pending review
- **FR29:** The system can write every commission event (created, adjusted, approved, declined, reversed) to an immutable audit log

**Affiliate Management (7 requirements)**
- **FR30:** A visitor can register as an affiliate on a SaaS Owner's branded portal
- **FR31:** The system can protect affiliate portal registration with bot-detection verification
- **FR32:** A SaaS Owner or Manager can review, approve, or reject pending affiliate applications
- **FR33:** A SaaS Owner or Manager can suspend or reactivate an affiliate account
- **FR34:** A SaaS Owner or Manager can view an affiliate's profile, referral activity, commission history, and fraud signals
- **FR35:** The system can detect self-referral attempts and flag the associated commission for review
- **FR36:** A SaaS Owner or Manager can view and act on fraud signals for an affiliate (bot traffic score, verification failures, IP anomalies)

**Affiliate Portal (8 requirements)**
- **FR37:** An approved affiliate can log in to a branded affiliate portal with email and password
- **FR38:** An affiliate can view their referral links and copy or share them from the portal
- **FR39:** An affiliate can view their click, conversion, and commission statistics in real time
- **FR40:** An affiliate can view the history and status of all their commissions
- **FR41:** An affiliate can view their pending and paid payout balance
- **FR42:** An affiliate can access a brand asset library provided by the SaaS Owner
- **FR43:** A SaaS Owner can configure the affiliate portal with their brand identity (logo, colors, name)
- **FR44:** A SaaS Owner on the Scale tier can configure a custom domain for their affiliate portal

**Payout Management (6 requirements)**
- **FR45:** A SaaS Owner can generate a payout batch summarizing all affiliates with pending commission balances
- **FR46:** A SaaS Owner can download a payout batch as a CSV with affiliate names, amounts, and payout notes
- **FR47:** A SaaS Owner can mark individual payouts or an entire batch as paid with an optional payment reference
- **FR48:** The system can notify affiliates via email when their payout has been marked as paid
- **FR49:** A SaaS Owner can view the full payout history including status, amounts, dates, and references
- **FR50:** The system can write every payout action to an immutable audit log

**Email Communications (7 requirements)**
- **FR51:** The system can send a transactional welcome email to a new affiliate upon portal registration
- **FR52:** The system can send a transactional commission confirmed email to an affiliate when a commission is approved
- **FR53:** The system can send a transactional payout sent email to an affiliate when a payout is marked as paid
- **FR54:** The system can send a transactional new referral alert email to a SaaS Owner when a new conversion is attributed
- **FR55:** A SaaS Owner or Manager can compose and send a broadcast email to all active affiliates in their program
- **FR56:** A SaaS Owner can view the sent log of broadcast emails
- **FR57:** A SaaS Owner can customize the subject lines and body content of affiliate-facing email templates

**Reporting & Analytics (5 requirements)**
- **FR58:** A SaaS Owner or Manager can view a dashboard overview of program performance (clicks, conversions, commissions, active affiliates)
- **FR59:** A SaaS Owner or Manager can view campaign-level performance metrics
- **FR60:** A SaaS Owner or Manager can view affiliate-level performance metrics
- **FR61:** A SaaS Owner or Manager can filter all reports by date range
- **FR62:** A SaaS Owner or Manager can export report data as CSV

**Platform Administration (6 requirements)**
- **FR63:** A Platform Admin can search for and view any tenant account by email or identifier
- **FR64:** A Platform Admin can view tenant account details including subscription plan, affiliate count, and payout history
- **FR65:** A Platform Admin can impersonate a tenant account to see exactly what the SaaS Owner sees — with the action audit-logged
- **FR66:** A Platform Admin can view a tenant's plan limit usage and proximity to tier limits
- **FR67:** A Platform Admin can manually override a tenant's tier limits for enterprise exceptions or support cases
- **FR68:** A Platform Admin can configure platform-wide tier definitions including pricing, affiliate limits, campaign limits, and feature gates without a code deployment

**Security & Access Control (6 requirements)**
- **FR69:** The system enforces role-based access control — Owner, Manager, and Viewer roles have distinct permission boundaries as defined in the RBAC matrix
- **FR70:** The system enforces tenant data isolation — no operation may return or modify data belonging to another tenant
- **FR71:** The system verifies HMAC-SHA256 signatures on all incoming SaligPay webhook events before processing
- **FR72:** The system rejects or quarantines any webhook event that fails signature verification
- **FR73:** A SaaS Owner's SaligPay credentials are stored encrypted at rest and never exposed client-side
- **FR74:** The system presents a re-authentication prompt to a SaaS Owner when their SaligPay token is expired or invalid

**Marketing Page (8 requirements)**
- **FR75:** A visitor can access a public marketing page at the root domain that communicates salig-affiliate's value proposition, features, pricing, and a primary call to action to start a free trial
- **FR76:** The marketing page must display a pricing section showing all three subscription tiers (Starter, Growth, Scale) with prices, affiliate limits, campaign limits, and key feature differentiation — including a "Start free trial" CTA per tier
- **FR77:** The marketing page must include a features section that communicates the core platform capabilities: SaligPay native integration, automated commission tracking, branded affiliate portal, manual payout workflow, fraud detection, and reporting
- **FR78:** The marketing page must include a social proof section (testimonials, logos, or usage stats) — initially seeded with placeholder content and replaced with real customer evidence as it becomes available post-launch
- **FR79:** The marketing page must include a navigation header with a link to log in (for returning users) and a primary "Start free trial" CTA
- **FR80:** The marketing page must be a Next.js Server Component page rendered at the root route (`/`), fully SEO-optimised with metadata, Open Graph tags, and structured page title and description
- **FR81:** The marketing page must be responsive and load to interactive state in under 2 seconds on mobile (consistent with NFR1)
- **FR82:** All "Start free trial" CTAs on the marketing page must route the visitor to the SaaS Owner signup flow without requiring a credit card

**Total Functional Requirements: 82**

### Non-Functional Requirements

**Performance (6 requirements)**
- **NFR1:** The affiliate portal must load to interactive state in under 2 seconds on a mobile connection (measured at P75)
- **NFR2:** Dashboard pages must load in under 3 seconds for SaaS Owners under normal load
- **NFR3:** Referral link click tracking must complete attribution recording within 3 seconds of the click event
- **NFR4:** Commission status must be visible to an affiliate within 60 minutes of the corresponding billing event being processed
- **NFR5:** Payout batch generation (up to 1,000 affiliates) must complete within 30 seconds
- **NFR6:** Report CSV exports must complete within 60 seconds for any date range within a tenant's data history

**Security (10 requirements)**
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

**Scalability (5 requirements)**
- **NFR17:** The platform must support at least 200 concurrent tenant accounts without performance degradation
- **NFR18:** Each tenant must be able to support up to 10,000 affiliates on the Scale tier without query performance degradation
- **NFR19:** The webhook ingestion pipeline must handle burst webhook delivery (up to 100 events per second) without dropping events — raw storage must absorb bursts before async processing
- **NFR20:** The commission engine must process a backlog of up to 10,000 queued billing events within 1 hour during a catch-up scenario
- **NFR21:** The platform tier configuration system (`getTierConfig`) must support a 10x increase in tenant count without architectural changes

**Reliability (6 requirements)**
- **NFR22:** Affiliate portal uptime must meet 99.9% monthly availability (approximately 44 minutes downtime per month maximum)
- **NFR23:** SaaS Owner dashboard uptime must meet 99.9% monthly availability
- **NFR24:** Webhook processing must guarantee at-least-once delivery semantics — no billing event may be silently dropped; unrecognized event types must be stored raw and flagged for review
- **NFR25:** Commission records must never be deleted — only reversed via an append-only audit trail; hard deletion is prohibited at the application layer
- **NFR26:** The system must detect and alert on stalled Convex Workflow jobs (payout batches, commission processing) that have not progressed within a configurable timeout window
- **NFR27:** Failed Resend email delivery attempts must be retried with exponential backoff; persistent failures must be logged and surfaced to the Platform Admin

**Integration (6 requirements)**
- **NFR28:** The `BillingEvent` normalized type must be the sole interface between the SaligPay webhook ingestion layer and the commission engine — no SaligPay-specific payload types may appear in commission processing logic
- **NFR29:** SaligPay OAuth token refresh must occur automatically when the token is within 60 seconds of expiry — no manual intervention required
- **NFR30:** A SaligPay API 401 response during any operation must immediately surface a re-authentication prompt to the SaaS Owner and halt the affected operation gracefully
- **NFR31:** Resend API calls must be made from Convex Actions only — never from client-side code
- **NFR32:** Custom domain SSL provisioning for affiliate portals must complete within 24 hours of DNS configuration by the SaaS Owner (Scale tier)
- **NFR33:** The platform must store the raw payload, timestamp, and signature verification status for every incoming SaligPay webhook event — regardless of whether processing succeeds or fails

**Accessibility (2 requirements)**
- **NFR34:** The affiliate portal must meet WCAG 2.1 Level AA standards — it is a public-facing surface serving a broad affiliate audience
- **NFR35:** The SaaS Owner dashboard must meet WCAG 2.1 Level A as a baseline at MVP, with Level AA as the v1.1 target

**Total Non-Functional Requirements: 35**

### Additional Requirements & Constraints

**Technical Constraints:**
- SaligPay OAuth Credential Management — tokens server-side only, cached with pre-expiry refresh
- Webhook Security — HMAC-SHA256 with `crypto.timingSafeEqual`
- Idempotency — all webhook handlers must be idempotent
- Event Ingestion Architecture — store raw first, process asynchronously
- Subscription Event Dependency Gate — schema confirmation required before architecture finalization
- Multi-tenant Data Isolation — row-level security at data layer
- Financial Audit Log — append-only, immutable
- Affiliate Portal Authentication — Better Auth with httpOnly cookies
- Commission Accuracy Safeguard — payment status validation, idempotency, referral chain verification

**MVP Payout Model:**
- Manual-assisted workflow (not automated)
- Batch summary generation + CSV download
- External payment execution by SaaS Owner
- Mark-as-paid flow with notification automation

**Compliance Requirements:**
- Philippine Data Privacy Act (DPA of 2012) — privacy notice, DPA template, data retention policy
- PCI DSS — delegated to SaligPay (salig-affiliate out of scope)
- KYC/AML — deferred post-MVP
- Tax Reporting — deferred post-MVP

### PRD Completeness Assessment

| Category | Status | Notes |
|----------|--------|-------|
| Functional Requirements | ✅ Complete | 82 FRs across 12 capability areas |
| Non-Functional Requirements | ✅ Complete | 35 NFRs across 6 categories |
| Technical Constraints | ✅ Complete | Well-defined integration and security constraints |
| User Journeys | ✅ Complete | 5 detailed journeys covering all user types |
| Success Criteria | ✅ Complete | User, Business, and Technical success metrics defined |
| Risk Register | ✅ Complete | Fintech domain risks identified with mitigations |
| Phased Roadmap | ✅ Complete | MVP, v1.1, v2, v3 scopes clearly defined |


## Document Inventory

### PRD Files Found
- **Whole Documents:** `prd.md` (80 KB, modified Mar 11 09:15)
- **Sharded Documents:** None

### Architecture Files Found
- **Whole Documents:** `architecture.md` (23 KB, modified Mar 11 10:40)
- **Sharded Documents:** None

### Epics & Stories Files Found
- **Whole Documents:** `epics.md` (84 KB, modified Mar 12 12:07)
- **Sharded Documents:** None

### UX Design Files Found
- **Whole Documents:** `ux-design-specification.md` (117 KB, modified Mar 10 18:00)
- **Sharded Documents:** None

### Issues Found
- ✅ No Duplicates Found
- ✅ No Missing Required Documents

### Documents Selected for Assessment
| Document Type | File | Size | Last Modified |
|---------------|------|------|---------------|
| PRD | `prd.md` | 80 KB | Mar 11 09:15 |
| Architecture | `architecture.md` | 23 KB | Mar 11 10:40 |
| Epics & Stories | `epics.md` | 84 KB | Mar 12 12:07 |
| UX Design | `ux-design-specification.md` | 117 KB | Mar 10 18:00 |

---

