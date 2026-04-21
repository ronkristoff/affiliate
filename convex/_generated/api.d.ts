/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin__helpers from "../admin/_helpers.js";
import type * as admin_audit from "../admin/audit.js";
import type * as admin_impersonation from "../admin/impersonation.js";
import type * as admin_platformStats from "../admin/platformStats.js";
import type * as admin_queryBuilder from "../admin/queryBuilder.js";
import type * as admin_queryBuilderExport from "../admin/queryBuilderExport.js";
import type * as admin_subscriptions from "../admin/subscriptions.js";
import type * as admin_tenants from "../admin/tenants.js";
import type * as admin_tier_configs from "../admin/tier_configs.js";
import type * as admin_tier_overrides from "../admin/tier_overrides.js";
import type * as affiliateAuth from "../affiliateAuth.js";
import type * as affiliatePortalReports from "../affiliatePortalReports.js";
import type * as affiliateProviderOnboarding from "../affiliateProviderOnboarding.js";
import type * as affiliateProviderOnboardingActions from "../affiliateProviderOnboardingActions.js";
import type * as affiliates from "../affiliates.js";
import type * as aggregates from "../aggregates.js";
import type * as audit from "../audit.js";
import type * as auth from "../auth.js";
import type * as backfillIndex from "../backfillIndex.js";
import type * as billingLifecycle from "../billingLifecycle.js";
import type * as brandAssets from "../brandAssets.js";
import type * as branding from "../branding.js";
import type * as broadcasts from "../broadcasts.js";
import type * as campaigns from "../campaigns.js";
import type * as circuitBreakers from "../circuitBreakers.js";
import type * as clicks from "../clicks.js";
import type * as commissionEngine from "../commissionEngine.js";
import type * as commissions from "../commissions.js";
import type * as conversions from "../conversions.js";
import type * as couponCodes from "../couponCodes.js";
import type * as couponCodesBackfill from "../couponCodesBackfill.js";
import type * as cronAdmin from "../cronAdmin.js";
import type * as cronDispatcher from "../cronDispatcher.js";
import type * as cronDispatcherHelpers from "../cronDispatcherHelpers.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as dashboardExport from "../dashboardExport.js";
import type * as debugAuth from "../debugAuth.js";
import type * as email from "../email.js";
import type * as emailNormalization from "../emailNormalization.js";
import type * as emailService from "../emailService.js";
import type * as emailServiceMutation from "../emailServiceMutation.js";
import type * as emails from "../emails.js";
import type * as encryption from "../encryption.js";
import type * as errorLogs from "../errorLogs.js";
import type * as fraudDetection from "../fraudDetection.js";
import type * as fraudDetectionMigration from "../fraudDetectionMigration.js";
import type * as fraudDetectionMigrationAction from "../fraudDetectionMigrationAction.js";
import type * as fraudSignals from "../fraudSignals.js";
import type * as http from "../http.js";
import type * as lib_circuitBreaker from "../lib/circuitBreaker.js";
import type * as lib_errorClassification from "../lib/errorClassification.js";
import type * as lib_gracefulDegradation from "../lib/gracefulDegradation.js";
import type * as lib_payoutProvider from "../lib/payoutProvider.js";
import type * as lib_providers_stripeConnectAdapter from "../lib/providers/stripeConnectAdapter.js";
import type * as lib_rateLimiter from "../lib/rateLimiter.js";
import type * as lib_validators from "../lib/validators.js";
import type * as migrations from "../migrations.js";
import type * as notifications from "../notifications.js";
import type * as payouts from "../payouts.js";
import type * as performance from "../performance.js";
import type * as permissions from "../permissions.js";
import type * as platformBilling from "../platformBilling.js";
import type * as platformBillingInternal from "../platformBillingInternal.js";
import type * as platformBillingWebhook from "../platformBillingWebhook.js";
import type * as platformSettings from "../platformSettings.js";
import type * as platformTemplates from "../platformTemplates.js";
import type * as providerConnectWebhook from "../providerConnectWebhook.js";
import type * as queryBuilder from "../queryBuilder.js";
import type * as queryBuilder__utils from "../queryBuilder/_utils.js";
import type * as queryBuilderExport from "../queryBuilderExport.js";
import type * as rateLimit from "../rateLimit.js";
import type * as rateLimits from "../rateLimits.js";
import type * as referralLeads from "../referralLeads.js";
import type * as referralLinks from "../referralLinks.js";
import type * as reports from "../reports.js";
import type * as reports_affiliates from "../reports/affiliates.js";
import type * as reports_campaigns from "../reports/campaigns.js";
import type * as reports_commissions from "../reports/commissions.js";
import type * as reports_fraud from "../reports/fraud.js";
import type * as reports_funnel from "../reports/funnel.js";
import type * as reports_index from "../reports/index.js";
import type * as reports_payouts from "../reports/payouts.js";
import type * as reports_summary from "../reports/summary.js";
import type * as reportsExport from "../reportsExport.js";
import type * as scheduledPayouts from "../scheduledPayouts.js";
import type * as scheduledPayoutsQueries from "../scheduledPayoutsQueries.js";
import type * as seedAuthHelpers from "../seedAuthHelpers.js";
import type * as seedAuthUsers from "../seedAuthUsers.js";
import type * as seedBulkData from "../seedBulkData.js";
import type * as seedTechFlowComprehensive from "../seedTechFlowComprehensive.js";
import type * as sessions from "../sessions.js";
import type * as stripeTierSync from "../stripeTierSync.js";
import type * as stripeWebhookManagement from "../stripeWebhookManagement.js";
import type * as subscriptions from "../subscriptions.js";
import type * as teamInvitations from "../teamInvitations.js";
import type * as templates from "../templates.js";
import type * as tenantContext from "../tenantContext.js";
import type * as tenantStats from "../tenantStats.js";
import type * as tenants from "../tenants.js";
import type * as testData from "../testData.js";
import type * as tierConfig from "../tierConfig.js";
import type * as tierConfigActions from "../tierConfigActions.js";
import type * as tracking from "../tracking.js";
import type * as triggers from "../triggers.js";
import type * as users from "../users.js";
import type * as util from "../util.js";
import type * as verifyDomainDns from "../verifyDomainDns.js";
import type * as webhooks from "../webhooks.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "admin/_helpers": typeof admin__helpers;
  "admin/audit": typeof admin_audit;
  "admin/impersonation": typeof admin_impersonation;
  "admin/platformStats": typeof admin_platformStats;
  "admin/queryBuilder": typeof admin_queryBuilder;
  "admin/queryBuilderExport": typeof admin_queryBuilderExport;
  "admin/subscriptions": typeof admin_subscriptions;
  "admin/tenants": typeof admin_tenants;
  "admin/tier_configs": typeof admin_tier_configs;
  "admin/tier_overrides": typeof admin_tier_overrides;
  affiliateAuth: typeof affiliateAuth;
  affiliatePortalReports: typeof affiliatePortalReports;
  affiliateProviderOnboarding: typeof affiliateProviderOnboarding;
  affiliateProviderOnboardingActions: typeof affiliateProviderOnboardingActions;
  affiliates: typeof affiliates;
  aggregates: typeof aggregates;
  audit: typeof audit;
  auth: typeof auth;
  backfillIndex: typeof backfillIndex;
  billingLifecycle: typeof billingLifecycle;
  brandAssets: typeof brandAssets;
  branding: typeof branding;
  broadcasts: typeof broadcasts;
  campaigns: typeof campaigns;
  circuitBreakers: typeof circuitBreakers;
  clicks: typeof clicks;
  commissionEngine: typeof commissionEngine;
  commissions: typeof commissions;
  conversions: typeof conversions;
  couponCodes: typeof couponCodes;
  couponCodesBackfill: typeof couponCodesBackfill;
  cronAdmin: typeof cronAdmin;
  cronDispatcher: typeof cronDispatcher;
  cronDispatcherHelpers: typeof cronDispatcherHelpers;
  crons: typeof crons;
  dashboard: typeof dashboard;
  dashboardExport: typeof dashboardExport;
  debugAuth: typeof debugAuth;
  email: typeof email;
  emailNormalization: typeof emailNormalization;
  emailService: typeof emailService;
  emailServiceMutation: typeof emailServiceMutation;
  emails: typeof emails;
  encryption: typeof encryption;
  errorLogs: typeof errorLogs;
  fraudDetection: typeof fraudDetection;
  fraudDetectionMigration: typeof fraudDetectionMigration;
  fraudDetectionMigrationAction: typeof fraudDetectionMigrationAction;
  fraudSignals: typeof fraudSignals;
  http: typeof http;
  "lib/circuitBreaker": typeof lib_circuitBreaker;
  "lib/errorClassification": typeof lib_errorClassification;
  "lib/gracefulDegradation": typeof lib_gracefulDegradation;
  "lib/payoutProvider": typeof lib_payoutProvider;
  "lib/providers/stripeConnectAdapter": typeof lib_providers_stripeConnectAdapter;
  "lib/rateLimiter": typeof lib_rateLimiter;
  "lib/validators": typeof lib_validators;
  migrations: typeof migrations;
  notifications: typeof notifications;
  payouts: typeof payouts;
  performance: typeof performance;
  permissions: typeof permissions;
  platformBilling: typeof platformBilling;
  platformBillingInternal: typeof platformBillingInternal;
  platformBillingWebhook: typeof platformBillingWebhook;
  platformSettings: typeof platformSettings;
  platformTemplates: typeof platformTemplates;
  providerConnectWebhook: typeof providerConnectWebhook;
  queryBuilder: typeof queryBuilder;
  "queryBuilder/_utils": typeof queryBuilder__utils;
  queryBuilderExport: typeof queryBuilderExport;
  rateLimit: typeof rateLimit;
  rateLimits: typeof rateLimits;
  referralLeads: typeof referralLeads;
  referralLinks: typeof referralLinks;
  reports: typeof reports;
  "reports/affiliates": typeof reports_affiliates;
  "reports/campaigns": typeof reports_campaigns;
  "reports/commissions": typeof reports_commissions;
  "reports/fraud": typeof reports_fraud;
  "reports/funnel": typeof reports_funnel;
  "reports/index": typeof reports_index;
  "reports/payouts": typeof reports_payouts;
  "reports/summary": typeof reports_summary;
  reportsExport: typeof reportsExport;
  scheduledPayouts: typeof scheduledPayouts;
  scheduledPayoutsQueries: typeof scheduledPayoutsQueries;
  seedAuthHelpers: typeof seedAuthHelpers;
  seedAuthUsers: typeof seedAuthUsers;
  seedBulkData: typeof seedBulkData;
  seedTechFlowComprehensive: typeof seedTechFlowComprehensive;
  sessions: typeof sessions;
  stripeTierSync: typeof stripeTierSync;
  stripeWebhookManagement: typeof stripeWebhookManagement;
  subscriptions: typeof subscriptions;
  teamInvitations: typeof teamInvitations;
  templates: typeof templates;
  tenantContext: typeof tenantContext;
  tenantStats: typeof tenantStats;
  tenants: typeof tenants;
  testData: typeof testData;
  tierConfig: typeof tierConfig;
  tierConfigActions: typeof tierConfigActions;
  tracking: typeof tracking;
  triggers: typeof triggers;
  users: typeof users;
  util: typeof util;
  verifyDomainDns: typeof verifyDomainDns;
  webhooks: typeof webhooks;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
  resend: import("@convex-dev/resend/_generated/component.js").ComponentApi<"resend">;
  stripe: import("@convex-dev/stripe/_generated/component.js").ComponentApi<"stripe">;
  aggregate: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"aggregate">;
  affiliateByStatus: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"affiliateByStatus">;
  commissionByStatus: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"commissionByStatus">;
  leadByStatus: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"leadByStatus">;
  payoutByStatus: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"payoutByStatus">;
  apiCalls: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"apiCalls">;
  degradation: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"degradation">;
  affiliates: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"affiliates">;
  referralLinks: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"referralLinks">;
  clicks: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"clicks">;
  conversions: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"conversions">;
  commissions: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"commissions">;
  payouts: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"payouts">;
  cronExecutionsByStatus: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"cronExecutionsByStatus">;
};
