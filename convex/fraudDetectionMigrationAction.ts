"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

/**
 * Generate a unique signal ID for fraud signals.
 * Duplicated from fraudDetection.ts — this file runs in Node.js runtime (actions only)
 * while fraudDetection.ts runs in V8 (queries/mutations).
 */
function generateSignalId(): string {
  return `sig_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * One-time migration action to assign signalIds to legacy fraud signals
 * that were created before the signalId field was added.
 * 
 * Idempotent: skips signals that already have a signalId.
 * Run per-tenant for large deployments to avoid action timeouts.
 * 
 * Usage: npx convex run fraudDetectionMigrationAction:migrateFraudSignalIds
 * Per-tenant: npx convex run fraudDetectionMigrationAction:migrateFraudSignalIds --args '{"tenantId":"..."}'
 */
export const migrateFraudSignalIds = internalAction({
  args: { tenantId: v.optional(v.id("tenants")) },
  returns: v.object({ migrated: v.number(), skipped: v.number(), tenantsProcessed: v.number() }),
  handler: async (ctx, args) => {
    let migrated = 0;
    let skipped = 0;
    let tenantsProcessed = 0;
    let processedCount = 0;
    const MAX_ITERATIONS = 10000; // Safety limit to prevent infinite loops on corrupted data

    // Process affiliates in batches until no more with legacy signals
    let iterations = 0;
    while (iterations++ < MAX_ITERATIONS) {
      const batch = await ctx.runQuery(
        internal.fraudDetectionMigration.getAffiliatesWithLegacySignals,
        { tenantId: args.tenantId }
      );

      if (batch.length === 0) {
        break;
      }

      for (const affiliate of batch) {
        const fraudSignals = affiliate.fraudSignals || [];
        let hasChanges = false;

        for (const signal of fraudSignals) {
          // Idempotency guard: only assign signalId if missing
          if (!(signal as any).signalId) {
            (signal as any).signalId = generateSignalId();
            hasChanges = true;
            migrated++;
          } else {
            skipped++;
          }
        }

        if (hasChanges) {
          await ctx.runMutation(
            internal.fraudDetectionMigration.patchAffiliateFraudSignals,
            { affiliateId: affiliate._id, fraudSignals }
          );
        }
      }

      processedCount += batch.length;

      if (processedCount % 100 === 0) {
        console.log(`Migration progress: ${processedCount} affiliates processed, ${migrated} signals migrated, ${skipped} skipped`);
      }
    }

    // Count as 1 tenant processed if tenantId specified, otherwise count distinct tenants
    tenantsProcessed = args.tenantId ? 1 : 0;

    console.log(`Migration complete: ${migrated} signals migrated, ${skipped} skipped`);

    return { migrated, skipped, tenantsProcessed };
  },
});
