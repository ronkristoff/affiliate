---
stepsCompleted: [step-01-validate-prerequisites, step-02-design-epics, step-03-create-stories]
inputDocuments:
  - "_bmad-output/planning-artifacts/prd.md"
  - "_bmad-output/planning-artifacts/architecture.md"
  - "_bmad-output/planning-artifacts/ux-design-specification.md"
  - "_bmad-output/screens/01-owner-dashboard.html"
  - "_bmad-output/screens/02-owner-affiliates.html"
  - "_bmad-output/screens/03-owner-commissions.html"
  - "_bmad-output/screens/04-owner-payouts.html"
  - "_bmad-output/screens/05-owner-campaigns.html"
  - "_bmad-output/screens/06-owner-reports.html"
  - "_bmad-output/screens/07-owner-settings.html"
  - "_bmad-output/screens/08-portal-login.html"
  - "_bmad-output/screens/09-portal-home.html"
  - "_bmad-output/screens/10-portal-earnings.html"
  - "_bmad-output/screens/11-portal-links.html"
  - "_bmad-output/screens/12-portal-account.html"
  - "_bmad-output/screens/13-admin-tenants.html"
  - "_bmad-output/screens/14-admin-tenant-detail.html"
  - "_bmad-output/screens/15-onboarding-saligpay.html"
  - "_bmad-output/screens/16-onboarding-campaign.html"
  - "_bmad-output/screens/17-onboarding-snippet.html"
  - "_bmad-output/screens/18-auth-login.html"
  - "_bmad-output/screens/19-auth-signup.html"
  - "_bmad-output/screens/20-marketing-landing.html"
---

# salig-affiliate - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for salig-affiliate, decomposing 89 functional requirements, 35 non-functional requirements, and 20 screen designs into 14 implementable epics with detailed user stories and acceptance criteria.

---

## Requirements Inventory

### Functional Requirements Summary

| Category | Count | FR Range |
|----------|-------|----------|
| Account & Tenant Management | 9 | FR1-FR9 |
| Campaign Management | 6 | FR10-FR15 |
| Referral Tracking | 6 | FR16-FR21 |
| Commission Engine | 8 | FR22-FR29 |
| Affiliate Management | 7 | FR30-FR36 |
| Affiliate Portal | 8 | FR37-FR44 |
| Payout Management | 6 | FR45-FR50 |
| Email Communications | 7 | FR51-FR57 |
| Reporting & Analytics | 5 | FR58-FR62 |
| Platform Administration | 6 | FR63-FR68 |
| Security & Access Control | 6 | FR69-FR74 |
| Marketing Page | 8 | FR75-FR82 |
| Subscription & Billing | 4 | FR83-FR86 |
| Mock Integration | 3 | FR87-FR89 |

**Total: 89 Functional Requirements**

### Non-Functional Requirements Summary

| Category | Count | NFR Range |
|----------|-------|-----------|
| Performance | 6 | NFR1-NFR6 |
| Security | 10 | NFR7-NFR16 |
| Scalability | 5 | NFR17-NFR21 |
| Reliability | 6 | NFR22-NFR27 |
| Integration | 6 | NFR28-NFR33 |
| Accessibility | 2 | NFR34-NFR35 |

**Total: 35 Non-Functional Requirements**

---

### FR Coverage Map

| FR | Epic | Description |
|----|------|-------------|
| FR1 | Epic 2 | User registration with email and password |
| FR2 | Epic 2 | User login/logout |
| FR3 | Epic 14 | Real SaligPay OAuth connection |
| FR4 | Epic 14 | Real SaligPay credential update |
| FR5 | Epic 3 | Subscription plan management |
| FR6 | Epic 2 | Team member invite by email |
| FR7 | Epic 2 | Team member removal |
| FR8 | Epic 2 | Team member invitation acceptance |
| FR9 | Epic 2 | Account profile and settings |
| FR10 | Epic 4 | Campaign creation |
| FR11 | Epic 4 | Commission structure configuration |
| FR12 | Epic 4 | Recurring commissions |
| FR13 | Epic 4 | Campaign edit/pause/archive |
| FR14 | Epic 4 | Commission approval thresholds |
| FR15 | Epic 4 | Affiliate commission rate overrides |
| FR16 | Epic 6 | Referral link generation |
| FR17 | Epic 6 | Click tracking with deduplication |
| FR18 | Epic 6 | Conversion attribution |
| FR19 | Epic 2 | JavaScript tracking snippet |
| FR20 | Epic 6 | Cookie-based attribution |
| FR21 | Epic 2 | SaligPay checkout attribution |
| FR22 | Epic 7 | Process payment.updated events |
| FR23 | Epic 7 | Subscription lifecycle events |
| FR24 | Epic 7 | Reject failed/pending payments |
| FR25 | Epic 7 | Commission reversal |
| FR26 | Epic 7 | Event deduplication |
| FR27 | Epic 7 | Raw event storage |
| FR28 | Epic 7 | Manual commission approval |
| FR29 | Epic 7 | Commission audit log |
| FR30 | Epic 5 | Affiliate registration |
| FR31 | Epic 5 | reCAPTCHA protection |
| FR32 | Epic 5 | Affiliate application review |
| FR33 | Epic 5 | Affiliate suspend/reactivate |
| FR34 | Epic 5 | Affiliate profile view |
| FR35 | Epic 5 | Self-referral detection |
| FR36 | Epic 5 | Fraud signals view |
| FR37 | Epic 8 | Affiliate portal login |
| FR38 | Epic 8 | Referral link copy/share |
| FR39 | Epic 8 | Real-time statistics |
| FR40 | Epic 8 | Commission history view |
| FR41 | Epic 8 | Payout balance view |
| FR42 | Epic 8 | Brand asset library |
| FR43 | Epic 8 | Portal brand configuration |
| FR44 | Epic 8 | Custom domain (Scale tier) |
| FR45 | Epic 13 | Payout batch generation |
| FR46 | Epic 13 | Payout batch CSV download |
| FR47 | Epic 13 | Mark payouts as paid |
| FR48 | Epic 13 | Payout notification email |
| FR49 | Epic 13 | Payout history view |
| FR50 | Epic 13 | Payout audit log |
| FR51 | Epic 10 | Welcome email |
| FR52 | Epic 10 | Commission confirmed email |
| FR53 | Epic 10 | Payout sent email |
| FR54 | Epic 10 | New referral alert email |
| FR55 | Epic 10 | Broadcast email |
| FR56 | Epic 10 | Broadcast email log |
| FR57 | Epic 10 | Email template customization |
| FR58 | Epic 9 | Dashboard overview |
| FR59 | Epic 9 | Campaign performance metrics |
| FR60 | Epic 9 | Affiliate performance metrics |
| FR61 | Epic 9 | Date range filtering |
| FR62 | Epic 9 | CSV export |
| FR63 | Epic 11 | Tenant search |
| FR64 | Epic 11 | Tenant account details |
| FR65 | Epic 11 | Tenant impersonation |
| FR66 | Epic 11 | Plan limit usage view |
| FR67 | Epic 11 | Tier limit override |
| FR68 | Epic 11 | Tier configuration |
| FR69 | Epic 1 | RBAC enforcement |
| FR70 | Epic 1 | Tenant data isolation |
| FR71 | Epic 14 | Webhook signature verification |
| FR72 | Epic 14 | Webhook rejection/quarantine |
| FR73 | Epic 14 | Credential encryption |
| FR74 | Epic 14 | Re-authentication prompt |
| FR75 | Epic 12 | Marketing page access |
| FR76 | Epic 12 | Pricing section |
| FR77 | Epic 12 | Features section |
| FR78 | Epic 12 | Social proof section |
| FR79 | Epic 12 | Navigation header |
| FR80 | Epic 12 | SEO optimization |
| FR81 | Epic 12 | Responsive load time |
| FR82 | Epic 12 | CTA routing |
| FR83 | Epic 3 | Subscribe to paid plan |
| FR84 | Epic 3 | Upgrade subscription |
| FR85 | Epic 3 | Payment details checkout |
| FR86 | Epic 3 | Cancel subscription |
| FR87 | Epic 6 | Mock payment webhook |
| FR88 | Epic 3 | Mock subscription checkout |
| FR89 | Epic 2 | Mock SaligPay OAuth |

---

## Epic List

### Epic 1: Foundation & Infrastructure
Establish multi-tenant architecture, Convex schema, dual authentication contexts, config-driven mock/real integration layer, RBAC enforcement, and tenant data isolation.
 **FRs covered:** FR69, FR70

### Epic 2: SaaS Owner Onboarding
Enable new SaaS owners to complete first-session setup: account registration, mock SaligPay OAuth connection, team member invites, account profile & settings, and tracking snippet installation guidance. **FRs covered:** FR1-FR9, FR19, FR21, FR89

 **Screens:** 18-auth-signup.html, 19-auth-login.html, 15-onboarding-saligpay.html, 17-onboarding-snippet.html

 07-owner-settings.html

### Epic 3: Subscription & Billing Management
Enable SaaS owners to manage their salig-affiliate subscription via mock checkout: trial-to-paid conversion, tier upgrades, downgrades, cancellations. **FRs covered:** FR5, FR83-FR86, FR88

 **Screens:** 07-owner-settings.html

### Epic 4: Campaign Management
Enable SaaS owners to create, configure, and manage affiliate campaigns with flexible commission structures: recurring commission support, approval thresholds, and per-affiliate rate overrides. **FRs covered:** FR10-FR15
 **Screens:** 05-owner-campaigns.html, 16-onboarding-campaign.html

 07-owner-settings.html

### Epic 5: Affiliate Acquisition & Management
Enable SaaS owners to recruit, approve, and manage affiliates with comprehensive fraud protection including bot-detection (reCAPTCHA), self-referral detection, and fraud signal monitoring. **FRs covered:** FR30-FR36
 **Screens:** 02-owner-affiliates.html

### Epic 6: Referral Tracking Engine
Track affiliate link clicks with deduplication, attribute conversions via cookie-based and server-side methods, process mock SaligPay webhooks, and provide mock webhook trigger for testing. **FRs covered:** FR16-FR18, FR20, FR87, **Screens:** 17-onboarding-snippet.html

### Epic 7: Commission Engine
Calculate, adjust, and manage commission records with complete audit trail, process billing events from mock SaligPay, handle subscription lifecycle changes, implement idempotency, support manual approval workflows. **FRs covered:** FR22-FR29
 **Screens:** 03-owner-commissions.html
### Epic 8: Affiliate Portal Experience
Provide affiliates a branded portal to manage links, view earnings, and track commissions with mobile-first design. **FRs covered:** FR37-FR44
 **Screens:** 08-portal-login.html, 09-portal-home.html, 10-portal-earnings.html, 11-portal-links.html, 12-portal-account.html

### Epic 9: Reporting & Analytics
Provide SaaS owners visibility into program, campaign, and affiliate performance with date range filtering and CSV export. **FRs covered:** FR58-FR62, **Screens:** 01-owner-dashboard.html, 06-owner-reports.html

### Epic 10: Email Communications
Send transactional and broadcast emails to affiliates and owners via Resend. **FRs covered:** FR51-FR57
 **Screens:** None (backend + email templates)

### Epic 11: Platform Administration
Enable platform admins to manage tenants, impersonate accounts, and configure tiers without code deployment. **FRs covered:** FR63-FR68
 **Screens:** 13-admin-tenants.html, 14-admin-tenant-detail.html

### Epic 12: Marketing & Authentication
Present public marketing page and handle authentication flows for returning users and new visitors. **FRs covered:** FR75-FR82
 **Screens:** 20-marketing-landing.html, 18-auth-login.html, 19-auth-signup.html

### Epic 13: Payout Management
Enable SaaS owners to generate payout batches, download CSVs, mark payments complete, and notify affiliates. **FRs covered:** FR45-FR50
 **Screens:** 04-owner-payouts.html

### Epic 14: SaligPay Real Integration
Replace mock implementations with real SaligPay OAuth, subscription checkout, and webhook processing with signature verification. **FRs covered:** FR3, FR4, FR71-FR74, **Screens:** 15-onboarding-saligpay.html

---

## Epic 1: Foundation & Infrastructure

### Goal
Establish multi-tenant architecture, Convex schema, dual authentication contexts, config-driven mock/real integration layer, RBAC enforcement, and tenant data isolation.

**FRs Covered:** FR69, FR70
 **NFRs Covered:** NFR7-21, NFR28-33

 **Primary User:** Platform (backend infrastructure)

---

### Story 1.1: Convex Schema Foundation

As a platform developer,
I I want a complete database schema with all tables, indexes, and relationships defined,
so that the development team can build features on a stable, well-documented data layer.

**Acceptance Criteria:**

**Given** the development environment is set up
**When**   the schema definition is executed
**Then**   the Convex schema file includes all tables: `tenants`, `users`, `teamInvitations`, `campaigns`, `affiliates`, `referralLinks`, `clicks`, `conversions`, `commissions`, `payouts`, `payoutBatches`, `auditLogs`, `rawWebhooks`, `emails`, `tierConfigs`
**And**   All indexes are defined per PRD requirements
**And**   System fields (`_id`, `_creationTime`) are present on all tables
**And**   Schema validates successfully with `npx convex dev`

---

### Story 1.2: Config-Driven Integration Layer

As a platform developer,
| I want a configurable integration layer that switches between mock and real SaligPay implementations,
so that the development team can test with mocks and production uses real integrations without code changes.

**Acceptance Criteria:**

**Given**   the integration layer is created at `src/lib/integrations/saligpay/`)
**When**   the environment is set to "development"
**Then**   all SaligPay calls use mock implementations
**And**   the config is stored in environment variables
**When**   the environment is set to "production"
**Then**   all SaligPay calls use real implementations
**And**   the switch is seamless with no code changes required
**And**   integration mode is accessible via `getIntegrationMode()` helper

---

### Story 1.3: SaaS Owner Authentication

As a platform developer,
| I want a secure authentication system for SaaS Owners using Better Auth,
so that tenants can register, log in, and manage their accounts with role-based permissions.

**Acceptance Criteria:**

**Given**   the Better Auth configuration is set up
**When**   a visitor registers as a SaaS Owner
**Then**   a tenant record is created in the database
**And**   the user is assigned the Owner role
**And**   session is created with httpOnly cookies
**When**   a SaaS Owner logs in
**Then**   session is validated and user can access protected routes
**And**   tenant context is loaded for all subsequent requests
**When**   a SaaS Owner logs out
**Then**   session is destroyed and user is redirected to login page

---

### Story 1.4: Affiliate Portal Authentication

As a platform developer,
| I want a separate authentication system for affiliates using Better Auth,
so that affiliates can access the branded portal without accessing SaaS Owner dashboard.

**Acceptance Criteria:**

**Given**   the affiliate auth configuration is set up
**When**   a visitor registers as an affiliate on a tenant's portal
**Then**   an affiliate record is created and linked to the tenant
**And**   session is created with httpOnly cookies
**And**   affiliate can only access affiliate portal routes
**When**   an affiliate attempts to access SaaS Owner dashboard routes
**Then**   access is denied (403)
**When**   an affiliate logs out
**Then**   session is destroyed and user is redirected to portal login page

---

### Story 1.5: Multi-Tenant Data Isolation

As a platform architect,
| I want every database query and mutation scoped to the authenticated tenant,
so that tenants can never access each other's data.

**Acceptance Criteria:**

**Given**   a tenant is authenticated
**When**   any query is executed
**Then**   results are filtered by `tenantId`
**And**   no cross-tenant data is returned
**Given**   a mutation is attempted on another tenant's data
**When**   the mutation is executed
**Then**   the operation fails with authorization error
**And**   no data is modified
**And**   the attempt is logged for security audit

---

### Story 1.6: RBAC Permission System

As a platform developer,
| I want role-based access control enforced on all sensitive operations,
so that users can only perform actions within their permission level.

**Acceptance Criteria:**

**Given**   a user with Viewer role
**When**   they attempt to create a campaign
**Then**   the operation is denied
**And**   an appropriate error message is displayed
**Given**   a user with Manager role
**When**   they attempt to approve a commission
**Then**   the operation succeeds
**Given**   a user with Manager role
**When**   they attempt to change billing settings
**Then**   the operation is denied
**And**   an appropriate error message is displayed
**Given**   a user with Owner role
**When**   they attempt any operation within their tenant
**Then**   the operation succeeds (subject to tenant limits)

---

### Story 1.7: Tier Configuration Service

As a platform developer,
| I want a centralized `getTierConfig()` service that returns plan limits for a tenant,
so that all tier enforcement is consistent and maintainable.

**Acceptance Criteria:**

**Given**   a tenant on the Starter plan
**When**   `getTierConfig(tenantId)` is called
**Then**   the correct limits are returned (maxAffiliates: 100, maxCampaigns: 3, etc.)
**And**   the limits are loaded from `tierConfigs` table, not hardcoded
**Given**   a tenant on the Growth plan
**When**   `getTierConfig(tenantId)` is called
**Then**   the correct limits are returned (maxAffiliates: 5000, maxCampaigns: 10, etc.)
**Given**   a tenant approaching a plan limit (80% threshold)
**When**   a limit check is performed
**Then**   the system returns a warning status
**And**   the tenant can still perform the action (soft limit)
**Given**   a tenant at 95% of plan limit
**When**   a limit check is performed
**Then**   the system returns a critical warning status
**And**   upgrade prompt is shown in UI

---

## Epic 2: SaaS Owner Onboarding

### Goal
Enable new SaaS owners to complete first-session setup: account registration, mock SaligPay OAuth connection, team member invites, account profile settings, and tracking snippet installation guidance.

**FRs Covered:** FR1-FR9, FR19, FR21, FR89
**Screens:** 18-auth-signup.html, 19-auth-login.html, 15-onboarding-saligpay.html, 17-onboarding-snippet.html, 07-owner-settings.html

**Primary User:** SaaS Owner (Alex)

---

### Story 2.1: SaaS Owner Registration

As a visitor,
| I want to register a SaaS Owner account with email and password,
so that I can set up my affiliate program.

**Acceptance Criteria:**

**Given**   the visitor is on the signup page
**When**   they submit valid email, password, and company name
**Then**   a new tenant record is created
**And**   a new user record is created with Owner role
**And**   the user is logged in automatically
**And**   the user is redirected to the onboarding flow
**Given**   the email is already registered
**When**   the visitor submits the form
**Then**   an error message is displayed
**And**   no duplicate records are created

---

### Story 2.2: SaaS Owner Login

As a SaaS Owner,
| I want to log in to my account securely,
so that I can access my dashboard and manage my affiliate program.

**Acceptance Criteria:**

**Given**   the SaaS Owner is on the login page
**When**   they submit valid email and password
**Then**   the session is created with httpOnly cookies
**And**   the user is redirected to the dashboard
**And**   tenant context is loaded for all subsequent requests
**Given**   invalid credentials are submitted
**When**   the login form is submitted
**Then**   a generic error message is displayed
**And**   no session is created
**And**   rate limiting is applied after 5 failed attempts

---

### Story 2.3: Mock SaligPay OAuth Connection

As a SaaS Owner,
| I want to connect a mock SaligPay account via simulated OAuth,
so that I can test the integration flow without real SaligPay credentials.

**Acceptance Criteria:**

**Given**   the SaaS Owner is in the onboarding flow
**When**   they click "Connect SaligPay"
**Then**   a mock OAuth flow is initiated
**And**   the mock OAuth returns a simulated authorization
**And**   mock credentials are stored in the database (encrypted)
**And**   the connection status shows "Connected (Mock Mode)"
**Given**   the mock connection is established
**When**   the SaaS Owner views their settings
**Then**   they can see the mock connection status
**And**   they can disconnect and reconnect

---

### Story 2.4: Team Member Invitation

As a SaaS Owner,
| I want to invite team members by email and assign them a role,
so that my team can help manage the affiliate program with appropriate permissions.

**Acceptance Criteria:**

**Given**   the SaaS Owner is on the Settings > Team page
**When**   they submit an email and select a role (Owner, Manager, Viewer)
**Then**   a team invitation record is created with a unique token
**And**   an invitation email is sent via Resend
**And**   the invitation appears in the pending invitations list
**Given**   the invitation limit for the tier is reached
**When**   the SaaS Owner attempts to invite another team member
**Then**   an error message is displayed
**And**   the invitation is not sent
**And**   an upgrade prompt is shown

---

### Story 2.5: Team Member Invitation Acceptance

As an invited team member,
| I want to accept an invitation and set up my account,
so that I can join the team and access the dashboard.

**Acceptance Criteria:**

**Given**   the team member receives an invitation email
**When**   they click the invitation link
**Then**   they are redirected to the signup page with email pre-filled
**And**   the invitation token is validated
**Given**   the team member completes signup
**When**   they submit the form
**Then**   a user record is created and linked to the tenant
**And**   the assigned role is applied
**And**   the invitation record is marked as accepted
**And**   the user is logged in and redirected to the dashboard
**Given**   an expired invitation link
**When**   the team member clicks the link
**Then**   an error message is displayed
**And**   they are offered to request a new invitation

---

### Story 2.6: Team Member Removal

As a SaaS Owner,
| I want to remove team members from my account,
so that I can revoke access when team members leave the organization.

**Acceptance Criteria:**

**Given**   the SaaS Owner is on the Settings > Team page
**When**   they click "Remove" on a team member
**Then**   a confirmation dialog is displayed
**Given**   the SaaS Owner confirms removal
**When**   the action is executed
**Then**   the user's access to the tenant is revoked
**And**   the user can no longer log in to this tenant
**And**   the action is logged in the audit trail
**And**   the removed team member receives an email notification

---

### Story 2.7: Account Profile Settings

As a SaaS Owner,
| I want to view and update my account profile and settings,
so that I can keep my information current and customize my experience.

**Acceptance Criteria:**

**Given**   the SaaS Owner is on the Settings page
**When**   they view their profile
**Then**   their name, email, and role are displayed
**And**   the tenant's company name and plan are displayed
**Given**   the SaaS Owner updates their profile
**When**   they save the changes
**Then**   the user record is updated
**And**   a success message is displayed
**And**   the change is reflected in the UI immediately

---

### Story 2.8: Tracking Snippet Installation Guide

As a SaaS Owner,
| I want guidance on installing the JavaScript tracking snippet on my website,
so that I can enable referral attribution for conversions.

**Acceptance Criteria:**

**Given**   the SaaS Owner is in the onboarding flow
**When**   they reach the tracking snippet step
**Then**   a personalized JavaScript snippet is displayed
**And**   the snippet includes their tenant ID
**And**   installation instructions are provided for common platforms (WordPress, custom HTML, etc.)
**Given**   the SaaS Owner copies the snippet
**When**   they click "Copy Snippet"
**Then**   the snippet is copied to clipboard
**And**   a success toast is displayed
**Given**   the SaaS Owner has installed the snippet
**When**   they click "Verify Installation"
**Then**   the system checks for a test click event
**And**   the verification status is updated

---

### Story 2.9: SaligPay Checkout Attribution Setup

As a SaaS Owner,
| I want to pass referral attribution metadata through SaligPay checkout sessions,
so that conversions can be attributed server-side.

**Acceptance Criteria:**

**Given**   the SaaS Owner is in the onboarding flow
**When**   they view the SaligPay integration instructions
**Then**   clear instructions are provided for passing metadata in checkout
**And**   code examples are provided for common integration patterns
**Given**   the SaaS Owner has configured checkout attribution
**When**   a referred customer completes checkout
**Then**   the referral metadata is passed to the webhook
**And**   the conversion can be attributed to the correct affiliate

---

## Epic 3: Subscription & Billing Management

### Goal
Enable SaaS owners to manage their salig-affiliate subscription via mock checkout: trial-to-paid conversion, tier upgrades, downgrades, and cancellations.

**FRs Covered:** FR5, FR83-FR86, FR88
 **Screens:** 07-owner-settings.html

**Primary User:** SaaS Owner (Alex)

---

### Story 3.1: Mock Subscription Checkout

As a SaaS Owner,
| I want to complete a mock subscription checkout,
so that I can test the billing flow without real payment processing.

**Acceptance Criteria:**

**Given**   the SaaS Owner is on a free trial
**When**   they initiate a subscription upgrade
**Then**   a mock checkout flow is initiated
**And**   mock payment details form is displayed
**When**   the mock checkout is completed
**Then**   the subscription is updated in the database
**And**   the trial end date is removed or extended based on the plan
**And**   the mock transaction is logged

---

### Story 3.2: Trial-to-Paid Conversion

As a SaaS Owner,
| I want to convert from free trial to paid subscription,
so that I can continue using salig-affiliate after the trial period.

**Acceptance Criteria:**

**Given**   the SaaS Owner's trial is ending soon
**When**   they view their subscription status
**Then**   a warning is displayed with upgrade options
**Given**   the SaaS Owner initiates trial-to-paid conversion
**When**   they complete the checkout
**Then**   the subscription is updated to the selected plan
**And**   the billing cycle is established
**And**   the trial end date is removed

---

### Story 3.3: Subscription Tier Upgrade

As a SaaS Owner,
| I want to upgrade my subscription tier at any time,
so that I can access more features and higher limits as my program grows.

**Acceptance Criteria:**

**Given**   the SaaS Owner is on the Growth plan
**When**   they initiate an upgrade to Scale
**Then**   the plan comparison is displayed
**And**   prorated features are highlighted
**Given**   the upgrade is confirmed
**When**   the checkout is completed
**Then**   the subscription is updated to Scale plan
**And**   new limits are immediately applied
**And**   the billing amount is updated
**And**   a confirmation email is sent

---

### Story 3.4: Subscription Downgrade

As a SaaS Owner,
| I want to downgrade my subscription tier,
so that I can reduce costs if I don't need all features.

**Acceptance Criteria:**

**Given**   the SaaS Owner is on the Scale plan
**When**   they initiate a downgrade to Growth
**Then**   a warning is displayed about lost features
**And**   current usage vs. new limits is shown
**Given**   the downgrade is confirmed
**When**   the change is processed
**Then**   the subscription is updated to Growth plan
**And**   new limits are immediately applied
**And**   any excess data (affiliates beyond limit) remains accessible but new additions are blocked

---

### Story 3.5: Subscription Cancellation

As a SaaS Owner,
| I want to cancel my subscription,
so that I can stop billing if I no longer need the service.

**Acceptance Criteria:**

**Given**   the SaaS Owner is on a paid plan
**When**   they initiate cancellation
**Then**   a confirmation dialog is displayed with data retention information
**Given**   the cancellation is confirmed
**When**   the action is processed
**Then**   the subscription is marked as cancelled
**And**   access continues until the end of the billing period
**And**   a cancellation confirmation email is sent
**And**   data is retained for 30 days before deletion

---

### Story 3.6: View Subscription Status

As a SaaS Owner,
| I want to view and manage my subscription plan and billing status,
so that I can understand my current plan and usage, and billing history.

**Acceptance Criteria:**

**Given**   the SaaS Owner is on the Settings > Billing page
**When**   they view their subscription
**Then**   the current plan name and price are displayed
**And**   the billing cycle dates are displayed
**And**   plan limits and usage are displayed (e.g., 47/5000 affiliates)
**And**   the billing history is displayed with dates and amounts

---

## Epic 4: Campaign Management

### Goal
Enable SaaS owners to create, configure, and manage affiliate campaigns with flexible commission structures: percentage or flat-fee, recurring commission support, approval thresholds, and per-affiliate rate overrides.

**FRs Covered:** FR10-FR15
 **Screens:** 05-owner-campaigns.html, 16-onboarding-campaign.html, 07-owner-settings.html

**Primary User:** SaaS Owner (Alex), Manager

---

### Story 4.1: Campaign Creation

As a SaaS Owner or Manager,
| I want to create an affiliate campaign with a name, description, and commission structure,
so that affiliates can promote my products and earn commissions.

**Acceptance Criteria:**

**Given**   the user is on the Campaigns page
**When**   they click "Create Campaign"
**Then**   the campaign creation form is displayed
**Given**   the user submits valid campaign details
 **When**   the form is submitted
**Then**   a new campaign record is created
**And**   the campaign is assigned a unique ID
**And**   the user is redirected to the campaign detail page
**Given**   the campaign limit for the tier is reached
**When**   the user attempts to create another campaign
**Then**   an error message is displayed
**And**   an upgrade prompt is shown

---

### Story 4.2: Percentage Commission Configuration

As a SaaS Owner,
| I want to configure commission structures as percentage-of-sale,
so that affiliates earn a percentage of each sale they generate.

**Acceptance Criteria:**

**Given**   the user is creating or editing a campaign
**When**   they select "Percentage" commission type
**Then**   a percentage field is displayed
**And**   a default percentage is suggested (e.g., 10%)
**Given**   the user sets a percentage (e.g., 15%)
**When**   the campaign is saved
**Then**   the percentage is stored in the campaign configuration
**And**   commissions are calculated as `saleAmount * percentage`

---

### Story 4.3: Flat-Fee Commission Configuration

As a SaaS Owner,
| I want to configure commission structures as flat-fee per conversion,
so that affiliates earn a fixed amount for each conversion regardless of sale amount.

**Acceptance Criteria:**

**Given**   the user is creating or editing a campaign
**When**   they select "Flat Fee" commission type
**Then**   a flat fee amount field is displayed
**Given**   the user sets a flat fee amount (e.g., ₱50)
**When**   the campaign is saved
**Then**   the flat fee is stored in the campaign configuration
**And**   commissions are calculated as the flat fee amount

---

### Story 4.4: Recurring Commission Support

As a SaaS Owner,
| I want to enable recurring commissions on a campaign,
so that affiliates earn on every renewal charge, not just the first payment.

**Acceptance Criteria:**

**Given**   the user is creating or editing a campaign
**When**   they enable "Recurring Commissions"
**Then**   a recurring commission configuration section is displayed
**And**   options for recurring rate (same as initial, reduced, custom) are shown
**Given**   recurring commissions are enabled
**When**   a subscription renewal is processed
**Then**   a commission is created for the renewal
**And**   the recurring rate is applied (e.g., same 10%, or reduced 5%)

---

### Story 4.5: Campaign Edit, Pause, Archive

As a SaaS Owner or Manager,
| I want to edit, pause, or archive an existing campaign,
so that I can manage campaign lifecycle and availability.

**Acceptance Criteria:**

**Given**   the user is viewing a campaign
**When**   they click "Edit"
**Then**   the campaign edit form is displayed with current values pre-filled
**Given**   the user pauses a campaign
**When**   the action is confirmed
**Then**   the campaign status is updated to "Paused"
**And**   referral links continue to work but no new commissions are created
**And**   existing pending commissions are preserved
**Given**   the user archives a campaign
**When**   the action is confirmed
**Then**   the campaign status is updated to "Archived"
**And**   referral links return 404 for visitors
**And**   the campaign is hidden from active campaigns list

---

### Story 4.6: Commission Approval Thresholds

As a SaaS Owner,
| I want to set per-campaign commission approval thresholds,
so that I can auto-approve small commissions and manually review large ones.

**Acceptance Criteria:**

**Given**   the user is configuring a campaign
**When**   they set an approval threshold (e.g., ₱1000)
**Then**   commissions below ₱1000 are auto-approved
**And**   commissions at or above ₱1000 require manual review
**Given**   the threshold is set to "Auto-approve all"
**When**   any commission is created
**Then**   the commission is automatically approved
**Given**   the threshold is set to "Manual review all"
**When**   any commission is created
**Then**   the commission is marked as pending review

---

### Story 4.7: Per-Affiliate Commission Rate Overrides

As a SaaS Owner,
| I want to apply individual commission rate overrides to specific affiliates,
so that I can reward high performers or negotiate custom rates.

**Acceptance Criteria:**

**Given**   the user is viewing an affiliate's detail page
**When**   they set a custom commission rate override
**Then**   the override is stored for that affiliate-campaign combination
**And**   all future commissions for this affiliate use the override rate
**Given**   an affiliate has a custom rate override
**When**   a commission is calculated
**Then**   the override rate is used instead of the campaign default
**Given**   the user removes the override
**When**   the action is confirmed
**Then**   the campaign default rate is restored for future commissions

---

## Epic 5: Affiliate Acquisition & Management

### Goal
Enable SaaS owners to recruit, approve, and manage affiliates with comprehensive fraud protection including bot-detection (reCAPTCHA), self-referral detection, and fraud signal monitoring.

**FRs Covered:** FR30-FR36
 **Screens:** 02-owner-affiliates.html

**Primary User:** SaaS Owner (Alex), Manager

---

### Story 5.1: Affiliate Registration on Portal

As a visitor,
| I want to register as an affiliate on a SaaS Owner's branded portal,
so that I can join their affiliate program and (FR30)

**Acceptance Criteria:**

**Given**   the visitor is on the tenant's affiliate portal
**When**   they click "Sign Up as Affiliate"
**Then**   a registration form is displayed with tenant's branding
**And**   required fields include name, email, password. and payout method
**Given**   the visitor submits valid registration details
**When**   the form is submitted
**Then**   an affiliate record is created with "Pending" status
**And**   the affiliate is linked to the tenant
**And**   the affiliate receives a welcome email
**And**   the SaaS Owner receives a notification of new affiliate application

---

### Story 5.2: reCAPTCHA Protection on Registration

As a platform security system,
| I want to protect affiliate portal registration with bot-detection verification,
so that malicious bots cannot create fake affiliate accounts. (FR31)

**Acceptance Criteria:**

**Given**   the visitor is on the affiliate registration page
**When**   the form is displayed
**Then**   a reCAPTCHA v3 widget is rendered
**Given**   the visitor completes the registration
**When**   the reCAPTCHA verification fails
**Then**   the registration is rejected
**And**   an error message is displayed
**And**   no affiliate record is created
**Given**   the visitor completes registration with valid reCAPTCHA
**When**   the form is submitted
**Then**   the registration proceeds normally

---

### Story 5.3: Affiliate Application Review

As a SaaS Owner or Manager,
| I want to review, approve, or reject pending affiliate applications,
so that I can control who joins my affiliate program. (FR32)

**Acceptance Criteria:**

**Given**   the user is on the Affiliates page
**When**   there are pending applications
**Then**   a "Pending Review" badge is shown with count
**And**   pending affiliates are listed with application details
**Given**   the user views a pending affiliate's details
**When**   they click "Approve"
**Then**   the affiliate status is updated to "Active"
**And**   the affiliate receives an approval email
**And**   the affiliate can now log in to the portal
**Given**   the user rejects an affiliate
**When**   they provide a rejection reason
**Then**   the affiliate status is updated to "Rejected"
**And**   the affiliate receives a rejection email

---

### Story 5.4: Affiliate Suspend/Reactivate

As a SaaS Owner or Manager,
| I want to suspend or reactivate an affiliate account,
so that I can temporarily or permanently control an affiliate's access. (FR33)

**Acceptance Criteria:**

**Given**   the user is viewing an active affiliate's details
**When**   they click "Suspend"
**Then**   a confirmation dialog is displayed with reason options
**Given**   the suspension is confirmed
**When**   the action is processed
**Then**   the affiliate status is updated to "Suspended"
**And**   the affiliate cannot log in to the portal
**And**   the affiliate's referral links return 404
**And**   pending commissions are preserved but not processed
**Given**   the user reactivates a suspended affiliate
**When**   the action is confirmed
**Then**   the affiliate status is updated to "Active"
**And**   the affiliate can log in again
**And**   referral links work again

---

### Story 5.5: Affiliate Profile and Activity View

As a SaaS Owner or Manager,
| I want to view an affiliate's profile, referral activity, commission history, and fraud signals,
so that I can assess affiliate performance and risk. (FR34)

**Acceptance Criteria:**

**Given**   the user clicks on an affiliate from the list
**When**   the affiliate detail page loads
**Then**   the affiliate's profile information is displayed
**And**   referral activity metrics are shown (clicks, conversions, conversion rate)
**And**   commission history is listed with status and amounts
**And**   fraud signals are displayed if any (self-referral, bot traffic, IP anomalies)
**And**   the affiliate's current status and join date are shown

---

### Story 5.6: Self-Referral Detection

As a platform security system,
| I want to detect self-referral attempts and flag the associated commission for review,
so that affiliates cannot earn commissions on their own purchases. (FR35)

**Acceptance Criteria:**

**Given**   an affiliate creates a referral link
**When**   a conversion is attributed to that link
**Then**   the system compares the affiliate's data with the customer's data
**And**   data compared includes email, IP address, device fingerprint, payment method
**Given**   a match is detected (self-referral)
**When**   the commission would be created
**Then**   the commission is flagged for review
**And**   a fraud signal is added to the affiliate's record
**And**   the SaaS Owner is notified
**And**   the affiliate is NOT automatically notified (to prevent tip-offs)

---

### Story 5.7: Fraud Signals Dashboard

As a SaaS Owner or Manager,
| I want to view and act on fraud signals for an affiliate,
so that I can identify and address suspicious activity. (FR36)

**Acceptance Criteria:**

**Given**   an affiliate has fraud signals
**When**   the user views the affiliate's detail page
**Then**   a "Fraud Signals" section is displayed
**And**   each signal shows type, severity, timestamp, and details
**Given**   the user views a fraud signal
**When**   they click "Dismiss"
**Then**   the signal is marked as reviewed
**And**   a note is added with the reviewer's name and timestamp
**Given**   the user views a fraud signal
**When**   they click "Suspend Affiliate"
**Then**   the affiliate is immediately suspended
**And**   the action is logged in the audit trail

---

## Epic 6: Referral Tracking Engine

### Goal
Track affiliate link clicks with deduplication, attribute conversions via cookie-based and server-side methods, process mock SaligPay webhooks, and provide mock webhook trigger for testing.

**FRs Covered:** FR16-FR18, FR20, FR87
 **NFRs Covered:** NFR3, NFR10

**Screens:** 17-onboarding-snippet.html

**Primary User:** System (backend), SaaS Owner

---

### Story 6.1: Referral Link Generation

As a SaaS Owner,
| I want to generate unique referral links for affiliates in multiple URL formats,
so that affiliates can share links in different contexts. (FR16)

**Acceptance Criteria:**

**Given**   an active affiliate exists
**When**   a referral link is generated
**Then**   a unique link is created with the affiliate's unique code
**And**   the link format is `https://{tenant-domain}/ref/{affiliate-code}`
**Given**   the SaaS Owner has configured multiple URL formats
**When**   an affiliate views their links
**Then**   multiple link formats are available (short URL, full URL, with campaign parameter)
**Given**   the affiliate wants a custom vanity URL
**When**   they request a vanity slug
**Then**   a custom link is created (if available)
**And**   the vanity slug is stored for the affiliate

---

### Story 6.2: Click Tracking with Deduplication

As a platform system,
| I want to track affiliate link clicks with deduplication by IP and cookie,
so that click counts are accurate and not inflated. (FR17)

**Acceptance Criteria:**

**Given**   a visitor clicks an affiliate link
**When**   the click is registered
**Then**   a click record is created with timestamp, IP, user agent, and referrer
**And**   a cookie is set with the affiliate's code
**Given**   the same visitor clicks the same link again
**When**   the click is registered
**Then**   no new click record is created (deduplicated)
**And**   the cookie is refreshed
**Given**   a visitor clicks from a different IP but has the cookie
**When**   the click is registered
**Then**   the click is attributed to the same affiliate (cookie takes precedence)

---

### Story 6.3: Conversion Attribution

As a platform system,
| I want to attribute a conversion to an affiliate when a referred visitor completes a tracked action,
so that affiliates are credited for their referrals. (FR18)

**Acceptance Criteria:**

**Given**   a visitor has an affiliate cookie
**When**   they complete a tracked action (signup, purchase)
**Then**   the conversion is attributed to the affiliate
**And**   a conversion record is created with the affiliate's code
**And**   the cookie attribution data is preserved
**Given**   no affiliate cookie exists
**When**   a conversion occurs
**Then**   the conversion is marked as organic (no affiliate credit)

---

### Story 6.4: Cookie-Based Attribution Window

As a platform system,
| I want to attribute conversions using cookie-based tracking within a configurable attribution window,
so that affiliates are credited for conversions within a reasonable time frame. (FR20)

**Acceptance Criteria:**

**Given**   a tenant has set a 30-day attribution window
**When**   a visitor clicks an affiliate link
**Then**   a cookie is set with 30-day expiration
**Given**   the visitor converts within 30 days
**When**   the conversion is processed
**Then**   the conversion is attributed to the affiliate
**Given**   the visitor converts after 30 days
**When**   the conversion is processed
**Then**   the conversion is NOT attributed to the affiliate (cookie expired)
**And**   the conversion is marked as organic

---

### Story 6.5: Mock Payment Webhook Processing

As a platform system,
| I want to process mock payment webhooks for the `BillingEvent` interface,
so that the commission flow can be tested without real SaligPay integration. (FR87)

**Acceptance Criteria:**

**Given**   a SaaS Owner triggers a mock webhook
**When**   the mock event is received
**Then**   the event is normalized to `BillingEvent` format
**And**   the event is stored in `rawWebhooks` table
**And**   the event is processed by the commission engine
**And**   the appropriate commission is created
**Given**   the mock webhook includes attribution data
**When**   the event is processed
**Then**   the conversion is attributed to the correct affiliate

---

### Story 6.6: Click Tracking Performance

As a platform system,
| I want click tracking to complete attribution recording within 3 seconds,
so that the user experience is not degraded. (NFR3)

**Acceptance Criteria:**

**Given**   a visitor clicks an affiliate link
**When**   the click event is processed
**Then**   the attribution is recorded within 3 seconds
**And**   the redirect to the destination happens immediately (before attribution is complete)
**And**   attribution processing happens asynchronously

---

## Epic 7: Commission Engine

### Goal
Calculate, adjust, and manage commission records with complete audit trail. Process billing events through the `BillingEvent` interface. handle subscription lifecycle changes, implement idempotency, support manual approval workflows. and maintain an immutable audit log.

**FRs Covered:** FR22-FR29
 **NFRs Covered:** NFR4, NFR24-25, NFR28

**Screens:** 03-owner-commissions.html

**Primary User:** System (backend), SaaS Owner, Manager

---

### Story 7.1: Payment Updated Event Processing

As a platform system,
| I want to process a `payment.updated` billing event and create a commission record for the attributed affiliate,
so that affiliates earn commissions on successful payments. (FR22)

**Acceptance Criteria:**

**Given**   a `payment.updated` event is received with attribution data
**When**   the event is processed
**Then**   the event is normalized to `BillingEvent` format
**And**   the commission is calculated based on campaign configuration
**And**   a commission record is created with status based on approval threshold
**And**   the raw event is stored in `rawWebhooks` table
**Given**   no attribution data exists
**When**   the event is processed
**Then**   no commission is created
**And**   the event is logged as organic

---

### Story 7.2: Subscription Lifecycle Event Processing

As a platform system,
| I want to process subscription billing lifecycle events and adjust commission records accordingly,
so that commissions accurately reflect subscription state changes. (FR23)

**Acceptance Criteria:**

**Given**   a subscription renewal event is received
**When**   the event is processed
**Then**   a new commission is created (if recurring commissions are enabled)
**Given**   an upgrade event is received
**When**   the event is processed
**Then**   the commission is adjusted to reflect the new plan value
**Given**   a downgrade event is received
**When**   the event is processed
**Then**   the commission is adjusted to reflect the new plan value
**Given**   a cancellation event is received
**When**   the event is processed
**Then**   no new commission is created for future renewals
**And**   existing pending commissions are preserved

---

### Story 7.3: Failed/Pending Payment Rejection

As a platform system,
| I want to detect and reject commission creation for payments with FAILED or PENDING status,
so that commissions are only created for confirmed payments. (FR24)

**Acceptance Criteria:**

**Given**   a payment event with FAILED status
**When**   the event is processed
**Then**   no commission is created
**And**   the event is logged with rejection reason
**Given**   a payment event with PENDING status
**When**   the event is processed
**Then**   no commission is created
**And**   the event is logged as pending
**Given**   a payment event with COMPLETED status
**When**   the event is processed
**Then**   a commission is created (subject to other validations)

---

### Story 7.4: Commission Reversal

As a platform system,
| I want to reverse a commission record when a refund or chargeback billing event is received,
so that affiliates are not paid for refunded transactions. (FR25)

**Acceptance Criteria:**

**Given**   a refund event is received for a commission
**When**   the event is processed
**Then**   the original commission is NOT deleted
**And**   a reversal record is created linking to the original commission
**And**   the commission status is updated to "Reversed"
**And**   the reversal is logged in the audit trail
**Given**   a chargeback event is received
**When**   the event is processed
**Then**   the same reversal process occurs
**And**   a fraud flag may be added to the affiliate

---

### Story 7.5: Event Deduplication

As a platform system,
| I want to deduplicate billing events by event ID,
so that double commission awards are prevented. (FR26)

**Acceptance Criteria:**

**Given**   a billing event with ID `evt_123` is processed
**When**   a second event with the same ID is received
**Then**   the second event is rejected as duplicate
**And**   no duplicate commission is created
**And**   the duplicate event is logged for audit
**Given**   an event ID has not been seen before
**When**   the event is processed
**Then**   the event ID is stored
**And**   normal processing continues

---

### Story 7.6: Raw Event Storage

As a platform system,
| I want to store every incoming billing event as a raw payload before processing,
so that no event data is ever lost. (FR27)

**Acceptance Criteria:**

**Given**   a billing event is received
**When**   the event is ingested
**Then**   the complete raw payload is stored in `rawWebhooks` table
**And**   the timestamp and source are recorded
**And**   the processing status is set to "Pending"
**Given**   processing succeeds
**When**   the event is fully processed
**Then**   the status is updated to "Processed"
**Given**   processing fails
**When**   an error occurs
**Then**   the status is updated to "Failed"
**And**   the error message is stored

---

### Story 7.7: Manual Commission Approval

As a SaaS Owner or Manager,
| I want to manually approve or decline a commission record that is pending review,
so that I can control which commissions are paid out. (FR28)

**Acceptance Criteria:**

**Given**   a commission is in "Pending Review" status
**When**   the user clicks "Approve"
**Then**   the commission status is updated to "Confirmed"
**And**   the action is logged in the audit trail
**And**   the affiliate can see the confirmed status
**Given**   a commission is in "Pending Review" status
**When**   the user clicks "Decline" with a reason
**Then**   the commission status is updated to "Declined"
**And**   the decline reason is stored
**And**   the action is logged in the audit trail
**And**   the affiliate sees the declined status (without reason)

---

### Story 7.8: Commission Audit Log

As a platform system,
| I want to write every commission event to an immutable audit log,
so that there is a complete record of all commission changes. (FR29)

**Acceptance Criteria:**

**Given**   a commission is created
**When**   the record is saved
**Then**   an audit log entry is created with action "CREATED"
**And**   the entry includes timestamp, commission ID, amount, affiliate ID, and actor
**Given**   a commission status changes
**When**   the change is processed
**Then**   an audit log entry is created with the appropriate action
**And**   the entry includes before and after values
**Given**   an audit log entry exists
**When**   any attempt is made to modify or delete it
**Then**   the operation fails
**And**   an error is logged

---

## Epic 8: Affiliate Portal Experience

### Goal
Provide affiliates a branded portal to manage links, view earnings, track commissions, access brand assets, and view payout balance with mobile-first design.

**FRs Covered:** FR37-FR44
 **NFRs Covered:** NFR1, NFR34
 **Screens:** 08-portal-login.html, 09-portal-home.html, 10-portal-earnings.html, 11-portal-links.html, 12-portal-account.html

**Primary User:** Affiliate (Jamie)

---

### Story 8.1: Affiliate Portal Login

As an approved affiliate,
| I want to log in to a branded affiliate portal with email and password,
so that I can access my affiliate dashboard and resources. (FR37)

**Acceptance Criteria:**

**Given**   the affiliate is on the portal login page
**When**   they submit valid email and password
**Then**   the session is created
**And**   the affiliate is redirected to the portal home
**And**   the portal displays the tenant's branding (logo, colors)
**Given**   the affiliate's account is suspended
**When**   they attempt to log in
**Then**   an error message is displayed
**And**   no session is created
**Given**   the affiliate's application is still pending
**When**   they attempt to log in
**Then**   a message is displayed indicating the application is under review

---

### Story 8.2: Referral Link Management

As an affiliate,
| I want to view my referral links and copy or share them from the portal,
so that I can easily promote the product. (FR38)

**Acceptance Criteria:**

**Given**   the affiliate is logged into the portal
**When**   they view the Links page
**Then**   their unique referral link is displayed prominently
**And**   a "Copy Link" button is available
**Given**   the affiliate clicks "Copy Link"
**When**   the action completes
**Then**   the link is copied to clipboard
**And**   a success toast is displayed
**Given**   the affiliate clicks "Share"
**When**   on a mobile device
**Then**   the native share sheet is opened with the link
**When**   on a desktop
**Then**   the link is copied with a toast notification

---

### Story 8.3: Real-Time Statistics Dashboard

As an affiliate,
| I want to view my click, conversion, and commission statistics in real time,
so that I can track my performance. (FR39)

**Acceptance Criteria:**

**Given**   the affiliate is on the portal home page
**When**   the page loads
**Then**   key metrics are displayed: total clicks, conversions, conversion rate, total earnings
**And**   the metrics update in real-time as new events occur
**Given**   the affiliate has activity in the current period
**When**   they view the statistics
**Then**   period-over-period comparison is shown (e.g., +12% vs last month)
**And**   a summary of recent activity is displayed

---

### Story 8.4: Commission History View

As an affiliate,
| I want to view the history and status of all my commissions,
so that I can track my earnings and understand my payout timeline. (FR40)

**Acceptance Criteria:**

**Given**   the affiliate is on the Earnings page
**When**   the page loads
**Then**   a list of all commissions is displayed
**And**   each commission shows amount, status, date, and customer context (plan type)
**Given**   the affiliate wants to filter commissions
**When**   they select a status filter
**Then**   the list is filtered to show only matching commissions
**Given**   a commission is pending
**When**   displayed
**Then**   the status badge shows "Pending" with appropriate styling
**And**   an explanation of the review process is available

---

### Story 8.5: Payout Balance View

As an affiliate,
| I want to view my pending and paid payout balance,
so that I know how much I've earned and what's been paid. (FR41)

**Acceptance Criteria:**

**Given**   the affiliate is on the Earnings page
**When**   the page loads
**Then**   a balance summary is displayed at the top
**And**   the summary shows: pending balance, confirmed balance, total paid out
**Given**   the affiliate has a pending payout
**When**   they view the balance
**Then**   the expected payout date or batch is shown if available

---

### Story 8.6: Brand Asset Library

As an affiliate,
| I want to access a brand asset library provided by the SaaS Owner,
so that I can use approved marketing materials. (FR42)

**Acceptance Criteria:**

**Given**   the affiliate is on the portal
**When**   they navigate to the Assets page
**Then**   brand assets uploaded by the SaaS Owner are displayed
**And**   assets include logos, banners, product images, and copy text
**Given**   the affiliate wants to use an asset
**When**   they click on an asset
**Then**   a download or copy option is available
**And**   usage guidelines are displayed

---

### Story 8.7: Portal Brand Configuration

As a SaaS Owner,
| I want to configure the affiliate portal with my brand identity,
so that affiliates see my branding, not salig-affiliate's. (FR43)

**Acceptance Criteria:**

**Given**   the SaaS Owner is on the Settings > Branding page
**When**   they upload a logo
**Then**   the logo is stored and displayed on the affiliate portal
**Given**   the SaaS Owner sets brand colors
**When**   the colors are saved
**Then**   the affiliate portal uses the new colors
**And**   WCAG contrast requirements are validated
**Given**   the SaaS Owner sets a portal name
**When**   the name is saved
**Then**   the portal header displays the custom name

---

### Story 8.8: Custom Domain (Scale Tier)

As a SaaS Owner on the Scale tier,
| I want to configure a custom domain for my affiliate portal,
so that affiliates see my domain, not a subdomain. (FR44)

**Acceptance Criteria:**

**Given**   the SaaS Owner is on the Scale tier
**When**   they navigate to Settings > Domain
**Then**   a custom domain configuration form is available
**Given**   the SaaS Owner enters a custom domain
**When**   they save the configuration
**Then**   DNS instructions are displayed
**And**   SSL provisioning is initiated
**Given**   DNS is configured correctly
**When**   SSL provisioning completes (within 24 hours)
**Then**   the custom domain is active
**And**   the portal is accessible via the custom domain

---

## Epic 9: Reporting & Analytics

### Goal
Provide SaaS owners visibility into program, campaign, and affiliate performance with date range filtering and CSV export capabilities.

**FRs Covered:** FR58-FR62
 **NFRs Covered:** NFR2, NFR5-6

 **Screens:** 01-owner-dashboard.html, 06-owner-reports.html

**Primary User:** SaaS Owner (Alex), Manager

---

### Story 9.1: Dashboard Overview

As a SaaS Owner or Manager,
| I want to view a dashboard overview of program performance,
so that I can quickly understand my program's health. (FR58)

**Acceptance Criteria:**

**Given**   the user is on the Dashboard page
**When**   the page loads
**Then**   key metrics are displayed: MRR influenced, active affiliates, pending commissions, total paid out
**And**   recent activity feed is shown
**And**   top affiliates are listed
**And**   quick actions are available

---

### Story 9.2: Campaign Performance Metrics

As a SaaS Owner or Manager,
| I want to view campaign-level performance metrics,
so that I can compare and optimize my campaigns. (FR59)

**Acceptance Criteria:**

**Given**   the user is on the Reports > Campaigns page
**When**   the page loads
**Then**   all campaigns are listed with performance metrics
**And**   metrics include: clicks, conversions, conversion rate, total commissions, active affiliates
**Given**   the user selects a specific campaign
**When**   they view campaign details
**Then**   detailed metrics are displayed
**And**   a trend chart is shown

---

### Story 9.3: Affiliate Performance Metrics

As a SaaS Owner or Manager,
| I want to view affiliate-level performance metrics,
so that I can identify top performers and underperformers. (FR60)

**Acceptance Criteria:**

**Given**   the user is on the Reports > Affiliates page
**When**   the page loads
**Then**   all affiliates are listed with performance metrics
**And**   metrics include: clicks, conversions, conversion rate, total commissions, status
**Given**   the user sorts by performance
**When**   they select a sort option
**Then**   the list is reordered accordingly
**And**   top performers are highlighted

---

### Story 9.4: Date Range Filtering

As a SaaS Owner or Manager,
| I want to filter all reports by date range,
so that I can analyze performance over specific periods. (FR61)

**Acceptance Criteria:**

**Given**   the user is on any Reports page
**When**   they click the date range selector
**Then**   a date picker is displayed
**And**   preset options are available (Last 7 days, Last 30 days, Last 90 days, Custom)
**Given**   the user selects a date range
**When**   the selection is applied
**Then**   all metrics on the page are filtered to the selected range
**And**   the URL is updated to preserve the selection

---

### Story 9.5: CSV Export

As a SaaS Owner or Manager,
| I want to export report data as CSV,
so that I can analyze data externally or share with stakeholders. (FR62)

**Acceptance Criteria:**

**Given**   the user is on a Reports page with data displayed
**When**   they click "Export CSV"
**Then**   a CSV file is generated with the current view's data
**And**   the CSV includes headers and all visible columns
**And**   the file is named with the report type and date
**Given**   a date range filter is applied
**When**   the user exports
**Then**   the CSV contains only data from the selected date range

---

## Epic 10: Email Communications

### Goal
Send transactional and broadcast emails to affiliates and owners via Resend, including welcome emails, commission confirmations, payout notifications, referral alerts, broadcast campaigns, and template customization.

**FRs Covered:** FR51-FR57
 **NFRs Covered:** NFR27, NFR31

**Screens:** None (backend + email templates)

**Primary User:** System (backend), SaaS Owner, Manager

---

### Story 10.1: Welcome Email

As a platform system,
| I want to send a transactional welcome email to a new affiliate upon registration,
so that affiliates feel welcomed and have next steps. (FR51)

**Acceptance Criteria:**

**Given**   a new affiliate registers on the portal
**When**   the registration is complete
**Then**   a welcome email is sent via Resend
**And**   the email includes the affiliate's name and referral link
**And**   the email uses the tenant's branding
**Given**   the email fails to send
**When**   a retry attempt is made
**Then**   exponential backoff is applied
**And**   the failure is logged

---

### Story 10.2: Commission Confirmed Email

As a platform system,
| I want to send a transactional commission confirmed email to an affiliate,
so that affiliates know when they've earned money. (FR52)

**Acceptance Criteria:**

**Given**   a commission is approved
**When**   the approval is processed
**Then**   an email is sent to the affiliate
**And**   the email includes the commission amount and customer context
**And**   the email is sent within 5 minutes of approval

---

### Story 10.3: Payout Sent Email

As a platform system,
| I want to send a transactional payout sent email to an affiliate,
so that affiliates know when to expect their payment. (FR53)

**Acceptance Criteria:**

**Given**   a payout is marked as paid
**When**   the action is processed
**Then**   an email is sent to the affiliate
**And**   the email includes the payout amount and payment reference
**And**   the email is sent immediately

---

### Story 10.4: New Referral Alert Email

As a platform system,
| I want to send a transactional new referral alert email to a SaaS Owner,
so that they're notified of new conversions. (FR54)

**Acceptance Criteria:**

**Given**   a new conversion is attributed to an affiliate
**When**   the conversion is processed
**Then**   an alert email is sent to the SaaS Owner
**And**   the email includes affiliate name, customer context, and commission amount
**And**   the email is sent within 5 minutes of conversion

---

### Story 10.5: Broadcast Email

As a SaaS Owner or Manager,
| I want to compose and send a broadcast email to all active affiliates,
so that I can communicate program updates or promotions. (FR55)

**Acceptance Criteria:**

**Given**   the user is on the Emails > Broadcast page
**When**   they compose a subject and body
**Then**   a preview is shown
**And**   recipient count is displayed
**Given**   the user sends the broadcast
**When**   the action is confirmed
**Then**   the email is sent to all active affiliates via Resend
**And**   a sent log entry is created
**And**   the user is notified of completion

---

### Story 10.6: Broadcast Email Log

As a SaaS Owner,
| I want to view the sent log of broadcast emails,
so that I can track what communications have been sent. (FR56)

**Acceptance Criteria:**

**Given**   the user is on the Emails > History page
**When**   the page loads
**Then**   all sent broadcast emails are listed
**And**   each entry shows subject, sent date, recipient count, and status
**Given**   the user clicks on a log entry
**When**   the detail view opens
**Then**   the full email content is displayed
**And**   delivery statistics are shown

---

### Story 10.7: Email Template Customization

As a SaaS Owner,
| I want to customize the subject lines and body content of affiliate-facing email templates,
so that emails match my brand voice. (FR57)

**Acceptance Criteria:**

**Given**   the user is on Settings > Email Templates
**When**   the page loads
**Then**   all customizable templates are listed
**And**   default templates are shown for each type
**Given**   the user edits a template
**When**   they save changes
**Then**   the custom template is stored
**And**   future emails use the custom template
**And**   variables (like `{{affiliate_name}}`) are preserved

---

## Epic 11: Platform Administration

### Goal
Enable platform admins to manage tenants, impersonate accounts, view plan usage, override tier limits, and configure tier definitions without code deployment.

**FRs Covered:** FR63-FR68
 **NFRs Covered:** NFR12-16

 **Screens:** 13-admin-tenants.html, 14-admin-tenant-detail.html

**Primary User:** Platform Admin

---

### Story 11.1: Tenant Search

As a Platform Admin,
| I want to search for and view any tenant account by email or identifier,
so that I can quickly find accounts for support. (FR63)

**Acceptance Criteria:**

**Given**   the Platform Admin is on the Admin > Tenants page
**When**   they enter a search query
**Then**   matching tenants are displayed
**And**   search matches email, company name, and tenant ID
**Given**   multiple results match
**When**   the results are displayed
**Then**   they are sorted by relevance or creation date

---

### Story 11.2: Tenant Account Details

As a Platform Admin,
| I want to view tenant account details including subscription plan, affiliate count, and payout history,
so that I can understand the tenant's account status. (FR64)

**Acceptance Criteria:**

**Given**   the Platform Admin selects a tenant
**When**   the tenant detail page loads
**Then**   account information is displayed: company name, email, plan, status, creation date
**And**   affiliate count and status breakdown is shown
**And**   recent payout history is displayed
**And**   current usage vs. plan limits is shown

---

### Story 11.3: Tenant Impersonation

As a Platform Admin,
| I want to impersonate a tenant account to see exactly what the SaaS Owner sees,
so that I can debug issues from the user's perspective. (FR65)

**Acceptance Criteria:**

**Given**   the Platform Admin is viewing a tenant detail page
**When**   they click "Impersonate"
**Then**   a confirmation dialog is displayed with audit warning
**Given**   the impersonation is confirmed
**When**   the action is processed
**Then**   a new session is created with the tenant's context
**And**   the Platform Admin is redirected to the tenant's dashboard
**And**   the impersonation start is logged in the audit trail
**Given**   the Platform Admin ends impersonation
**When**   they click "End Impersonation"
**Then**   the session is terminated
**And**   the impersonation end is logged with all mutations performed

---

### Story 11.4: Plan Limit Usage View

As a Platform Admin,
| I want to view a tenant's plan limit usage and proximity to tier limits,
so that I can identify accounts needing attention. (FR66)

**Acceptance Criteria:**

**Given**   the Platform Admin is viewing a tenant detail page
**When**   they scroll to the "Plan Usage" section
**Then**   current usage for all limits is displayed
**And**   percentage of limit used is shown with visual indicator
**And**   accounts at 80%+ are highlighted with a warning
**And**   accounts at 95%+ are highlighted with a critical warning

---

### Story 11.5: Tier Limit Override

As a Platform Admin,
| I want to manually override a tenant's tier limits for enterprise exceptions or support cases,
so that I can accommodate special situations. (FR67)

**Acceptance Criteria:**

**Given**   the Platform Admin is viewing a tenant detail page
**When**   they click "Override Limits"
**Then**   a form is displayed with current limits and override options
**Given**   the Platform Admin sets an override
**When**   they save the override
**Then**   the custom limit is stored for this tenant
**And**   the override is logged in the audit trail
**And**   an expiration date can be set for the override
**Given**   an override is active
**When**   the tenant's usage is checked
**Then**   the override limit is used instead of the plan default

---

### Story 11.6: Tier Configuration Management

As a Platform Admin,
| I want to configure platform-wide tier definitions including pricing, affiliate limits, campaign limits, and feature gates,
so that I can adjust plans without code deployment. (FR68)

**Acceptance Criteria:**

**Given**   the Platform Admin is on the Admin > Tier Config page
**When**   the page loads
**Then**   all tier definitions are displayed with current values
**Given**   the Platform Admin edits a tier definition
**When**   they save changes
**Then**   the new values are stored in the `tierConfigs` table
**And**   changes take effect immediately for new operations
**And**   existing tenants on the tier are notified of changes (if limits decreased)

---

## Epic 12: Marketing & Authentication

### Goal
Present public marketing page with value proposition, features, pricing, social proof, and CTAs. Handle authentication flows for returning users and new visitors.

**FRs Covered:** FR75-FR82
 **NFRs Covered:** NFR1, NFR35

 **Screens:** 20-marketing-landing.html, 18-auth-login.html, 19-auth-signup.html

**Primary User:** Visitor

---

### Story 12.1: Marketing Landing Page

As a visitor,
| I want to access a public marketing page at the root domain,
so that I can learn about salig-affiliate and decide to sign up. (FR75)

**Acceptance Criteria:**

**Given**   a visitor navigates to the root domain
**When**   the page loads
**Then**   a hero section is displayed with value proposition
**And**   a primary "Start free trial" CTA is prominent
**And**   the page loads in under 2 seconds on mobile

---

### Story 12.2: Pricing Section

As a visitor,
| I want to see a pricing section with all three subscription tiers,
so that I can choose the right plan for my needs. (FR76)

**Acceptance Criteria:**

**Given**   the visitor scrolls to the pricing section
**When**   the section is visible
**Then**   all three tiers are displayed (Starter, Growth, Scale)
**And**   each tier shows price, affiliate limit, campaign limit, and key features
**And**   a "Start free trial" CTA is available per tier

---

### Story 12.3: Features Section

As a visitor,
| I want to see a features section communicating core capabilities,
so that I understand what salig-affiliate can do. (FR77)

**Acceptance Criteria:**

**Given**   the visitor scrolls to the features section
**When**   the section is visible
**Then**   core capabilities are displayed with icons and descriptions
**And**   features include: SaligPay integration, automated commissions, branded portal, payouts, fraud detection, reporting

---

### Story 12.4: Social Proof Section

As a visitor,
| I want to see a social proof section with testimonials or usage stats,
so that I can trust the platform. (FR78)

**Acceptance Criteria:**

**Given**   the visitor scrolls to the social proof section
**When**   the section is visible
**Then**   placeholder testimonials or logos are displayed
**And**   usage stats are shown if available
**And**   the content is easily replaceable post-launch

---

### Story 12.5: Navigation Header

As a visitor,
| I want a navigation header with login link and trial CTA,
so that I can navigate easily. (FR79)

**Acceptance Criteria:**

**Given**   the visitor is on the marketing page
**When**   they view the header
**Then**   a "Log in" link is visible for returning users
**And**   a "Start free trial" CTA is prominent
**And**   the header is sticky on scroll

---

### Story 12.6: SEO Optimization

As a platform,
| I want the marketing page to be SEO-optimized with metadata and Open Graph tags,
so that search engines and social platforms display it correctly. (FR80)

**Acceptance Criteria:**

**Given**   the marketing page is rendered
**When**   the HTML is generated
**Then**   appropriate meta tags are included (title, description, keywords)
**And**   Open Graph tags are included for social sharing
**And**   structured data is included for search engines

---

### Story 12.7: Responsive Load Time

As a visitor on mobile,
| I want the marketing page to load quickly,
so that I don't abandon the page. (FR81)

**Acceptance Criteria:**

**Given**   a visitor on a mobile connection
**When**   they navigate to the marketing page
**Then**   the page loads to interactive state in under 2 seconds
**And**   images are optimized and lazy-loaded
**And**   critical CSS is inlined

---

### Story 12.8: CTA Routing to Signup

As a visitor,
| I want all "Start free trial" CTAs to route me to signup without requiring a credit card,
so that I can try the product risk-free. (FR82)

**Acceptance Criteria:**

**Given**   the visitor clicks any "Start free trial" CTA
**When**   the action is processed
**Then**   the visitor is redirected to the signup page
**And**   no credit card is required
**And**   a 14-day free trial is automatically started

---

## Epic 13: Payout Management

### Goal
Enable SaaS owners to generate payout batches, download CSVs, mark payments complete, notify affiliates, and maintain payout audit history.

**FRs Covered:** FR45-FR50
 **Screens:** 04-owner-payouts.html

**Primary User:** SaaS Owner (Alex)

---

### Story 13.1: Payout Batch Generation

As a SaaS Owner,
| I want to generate a payout batch summarizing all affiliates with pending commission balances,
so that I can see who needs to be paid. (FR45)

**Acceptance Criteria:**

**Given**   the SaaS Owner is on the Payouts page
**When**   they click "Generate Batch"
**Then**   all affiliates with confirmed, unpaid commissions are listed
**And**   each affiliate shows total pending amount
**And**   the batch total is displayed
**Given**   no affiliates have pending payouts
**When**   the batch is generated
**Then**   an empty state is displayed with explanation

---

### Story 13.2: Payout Batch CSV Download

As a SaaS Owner,
| I want to download a payout batch as a CSV,
so that I can process payments externally. (FR46)

**Acceptance Criteria:**

**Given**   a payout batch is generated
**When**   the SaaS Owner clicks "Download CSV"
**Then**   a CSV file is downloaded
**And**   the CSV includes: affiliate name, email, amount, payout method, notes
**And**   the file is named with the batch date

---

### Story 13.3: Mark Payouts as Paid

As a SaaS Owner,
| I want to mark individual payouts or an entire batch as paid,
so that affiliate balances are updated. (FR47)

**Acceptance Criteria:**

**Given**   the SaaS Owner has generated a batch
**When**   they click "Mark as Paid" on a single payout
**Then**   that payout status is updated to "Paid"
**And**   the affiliate's balance is updated
**And**   a payment reference can be added
**Given**   the SaaS Owner clicks "Mark All as Paid"
**When**   the action is confirmed
**Then**   all payouts in the batch are marked as paid
**And**   all affected affiliates' balances are updated

---

### Story 13.4: Payout Notification Email

As a platform system,
| I want to notify affiliates via email when their payout has been marked as paid,
so that affiliates know to expect payment. (FR48)

**Acceptance Criteria:**

**Given**   a payout is marked as paid
**When**   the action is processed
**Then**   an email is sent to the affiliate
**And**   the email includes the payout amount and payment reference
**And**   the email is sent immediately

---

### Story 13.5: Payout History View

As a SaaS Owner,
| I want to view the full payout history,
so that I can track all past payments. (FR49)

**Acceptance Criteria:**

**Given**   the SaaS Owner is on the Payouts > History page
**When**   the page loads
**Then**   all past payout batches are listed
**And**   each batch shows date, total amount, number of affiliates, status
**Given**   the SaaS Owner clicks on a batch
**When**   the detail view opens
**Then**   all individual payouts in the batch are displayed

---

### Story 13.6: Payout Audit Log

As a platform system,
| I want to write every payout action to an immutable audit log,
so that there is a complete record of all payout operations. (FR50)

**Acceptance Criteria:**

**Given**   a payout action occurs (created, marked paid, cancelled)
**When**   the action is processed
**Then**   an audit log entry is created
**And**   the entry includes timestamp, action type, actor, amounts, and affected affiliates
**Given**   an audit log entry exists
**When**   any attempt is made to modify or delete it
**Then**   the operation fails

---

## Epic 14: SaligPay Real Integration

### Goal
Replace mock implementations with real SaligPay OAuth, subscription checkout, and webhook processing with signature verification. Complete the `BillingEvent` seam with real data.

 **FRs Covered:** FR3-FR4, FR71-FR74
 **NFRs Covered:** NFR29-NFR30

 **Screens:** 15-onboarding-saligpay.html

**Primary User:** SaaS Owner (Alex), System

---

### Story 14.1: Real SaligPay OAuth Connection

As a SaaS Owner,
| I want to connect my real SaligPay credentials via OAuth,
so that salig-affiliate can access my billing data. (FR3)

**Acceptance Criteria:**

**Given**   the environment is set to "production"
**When**   the SaaS Owner clicks "Connect SaligPay"
**Then**   the real SaligPay OAuth flow is initiated
**And**   the SaaS Owner is redirected to SaligPay authorization
**Given**   the SaaS Owner authorizes on SaligPay
**When**   they are redirected back
**Then**   the OAuth tokens are stored securely (encrypted)
**And**   the connection status shows "Connected"
**And**   the integration is active

---

### Story 14.2: Real SaligPay Credential Update

As a SaaS Owner,
| I want to reconnect or update my SaligPay credentials when they expire or change,
so that the integration continues working. (FR4)

**Acceptance Criteria:**

**Given**   the SaaS Owner's SaligPay token is expired
**When**   they access a feature requiring SaligPay
**Then**   a re-authentication prompt is displayed
**Given**   the SaaS Owner initiates reconnection
**When**   the OAuth flow completes
**Then**   new tokens are stored
**And**   the integration is active again

---

### Story 14.3: Webhook Signature Verification

As a platform system,
| I want to verify HMAC-SHA256 signatures on all incoming SaligPay webhook events,
so that I can trust the authenticity of events. (FR71)

**Acceptance Criteria:**

**Given**   a webhook event is received from SaligPay
**When**   the event is processed
**Then**   the HMAC-SHA256 signature is verified using timing-safe comparison
**And**   verification happens before any payload processing
**Given**   signature verification fails
**When**   the event is processed
**Then**   the event is rejected
**And**   the event is logged with failure reason
**And**   no commission is created

---

### Story 14.4: Webhook Rejection and Quarantine

As a platform system,
| I want to reject or quarantine any webhook event that fails signature verification,
so that fraudulent or corrupted events are not processed. (FR72)

**Acceptance Criteria:**

**Given**   a webhook event fails signature verification
**When**   the rejection is processed
**Then**   the event is stored in `rawWebhooks` with status "Rejected"
**And**   no commission processing occurs
**And**   an alert is logged for Platform Admin review

---

### Story 14.5: Credential Encryption at Rest

As a platform system,
| I want SaligPay credentials stored encrypted at rest and never exposed client-side,
so that credentials are secure. (FR73)

**Acceptance Criteria:**

**Given**   SaligPay credentials are stored
**When**   they are saved to the database
**Then**   they are encrypted using a secure encryption method
**And**   the encryption key is stored securely (environment variable)
**Given**   a client request for tenant settings
**When**   the response is sent
**Then**   SaligPay credentials are NOT included in the response
**And**   only connection status is visible

---

### Story 14.6: Re-Authentication Prompt

As a platform system,
| I want to present a re-authentication prompt when the SaligPay token is expired or invalid,
so that the SaaS Owner knows action is needed. (FR74)

**Acceptance Criteria:**

**Given**   a SaligPay API call returns 401
**When**   the error is received
**Then**   the operation is halted gracefully
**And**   a re-authentication prompt is displayed to the SaaS Owner
**And**   the prompt includes a "Reconnect" button
**Given**   the SaaS Owner completes re-authentication
**When**   the OAuth flow completes
**Then**   the original operation can be retried

---

### Story 14.7: Automatic Token Refresh

As a platform system,
| I want SaligPay OAuth token to refresh automatically when within 60 seconds of expiry,
so that the SaaS Owner doesn't need to manually reconnect. (NFR29)

**Acceptance Criteria:**

**Given**   a SaligPay token is within 60 seconds of expiry
**When**   any SaligPay API call is made
**Then**   the token is refreshed automatically before the call
**And**   new tokens are stored
**And**   the API call proceeds with the new token

---

### Story 14.8: API 401 Graceful Handling

As a platform system,
| I want a SaligPay API 401 response to immediately surface a re-authentication prompt,
so that the SaaS Owner can take action. (NFR30)

**Acceptance Criteria:**

**Given**   a SaligPay API call returns 401
**When**   the error is received
**Then**   the affected operation is halted gracefully
**And**   no partial data is saved
**And**   a clear re-authentication prompt is shown
**And**   the SaaS Owner can reconnect and retry

---

## Summary

### Statistics

| Metric | Count |
|--------|-------|
| **Total Epics** | 14 |
| **Total Stories** | 86 |
| **Total FRs** | 89 |
| **Total NFRs** | 35 |

### Epic Story Count

| Epic | Stories |
|------|---------|
| 1. Foundation & Infrastructure | 7 |
| 2. SaaS Owner Onboarding | 9 |
| 3. Subscription & Billing Management | 6 |
| 4. Campaign Management | 7 |
| 5. Affiliate Acquisition & Management | 7 |
| 6. Referral Tracking Engine | 6 |
| 7. Commission Engine | 8 |
| 8. Affiliate Portal Experience | 8 |
| 9. Reporting & Analytics | 5 |
| 10. Email Communications | 7 |
| 11. Platform Administration | 6 |
| 12. Marketing & Authentication | 8 |
| 13. Payout Management | 6 |
| 14. SaligPay Real Integration | 8 |

### Implementation Order

```
Phase 1: Foundation
├── Epic 1: Foundation & Infrastructure (7 stories)

Phase 2: Core SaaS Owner Experience
├── Epic 2: SaaS Owner Onboarding (9 stories)
├── Epic 3: Subscription & Billing Management (6 stories)
├── Epic 4: Campaign Management (7 stories)

Phase 3: Affiliate Management
├── Epic 5: Affiliate Acquisition & Management (7 stories)

Phase 4: Core Engine
├── Epic 6: Referral Tracking Engine (6 stories)
├── Epic 7: Commission Engine (8 stories)

Phase 5: Affiliate Experience
├── Epic 8: Affiliate Portal Experience (8 stories)

Phase 6: Insights & Communication
├── Epic 9: Reporting & Analytics (5 stories)
├── Epic 10: Email Communications (7 stories)

Phase 7: Platform Management
├── Epic 11: Platform Administration (6 stories)
├── Epic 12: Marketing & Authentication (8 stories)

Phase 8: Financial Operations
├── Epic 13: Payout Management (6 stories)

Phase 9: Real Integration
└── Epic 14: SaligPay Real Integration (8 stories)
```

---

## Document Complete

This epic breakdown document is ready for implementation planning. All 89 functional requirements and 35 non-functional requirements are mapped to 86 user stories across 14 epics.

**Next Step:** Proceed to Implementation Readiness Check or Sprint Planning to begin development.
