import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * One-time migration: Update all commissions with status "confirmed" to "approved".
 * 
 * Background: The epics specified "Confirmed" but the implementation standardized
 * on "approved" to match the UI button label. This migrates any existing database
 * records from "confirmed" to "approved".
 * 
 * Run once via: npx convex run migrations:migrateConfirmedToApproved
 */
export const migrateConfirmedToApproved = mutation({
  args: {},
  returns: v.object({
    updated: v.number(),
    total: v.number(),
  }),
  handler: async (ctx, _args) => {
    // Find all commissions with status "confirmed"
    const confirmedCommissions = await ctx.db
      .query("commissions")
      .filter((q) => q.eq(q.field("status"), "confirmed"))
      .collect();

    let updated = 0;
    for (const commission of confirmedCommissions) {
      await ctx.db.patch(commission._id, { status: "approved" });
      updated++;
    }

    console.log(`Migration complete: Updated ${updated} commissions from "confirmed" to "approved"`);

    return { updated, total: confirmedCommissions.length };
  },
});
