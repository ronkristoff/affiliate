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

/**
 * One-time migration: Backfill slug field for all existing campaigns.
 * 
 * Generates a URL-safe slug from the campaign name with a random suffix
 * for uniqueness. Existing campaigns without a slug will get one auto-generated.
 * 
 * Run once via: npx convex run migrations:backfillCampaignSlugs
 */
export const backfillCampaignSlugs = mutation({
  args: {},
  returns: v.object({
    updated: v.number(),
    total: v.number(),
  }),
  handler: async (ctx, _args) => {
    // Find all campaigns (paginated to avoid unbounded collect)
    const allCampaigns: Array<{ _id: any; name: string; slug?: string; tenantId: any }> = [];
    let cursor: string | null = null;
    let hasMore = true;

    while (hasMore) {
      const paginationOpts = { numItems: 100, cursor };
      const page = await ctx.db
        .query("campaigns")
        .paginate(paginationOpts);
      
      for (const campaign of page.page) {
        allCampaigns.push(campaign as any);
      }

      hasMore = !page.isDone;
      cursor = page.isDone ? null : (page.continueCursor ?? null);
    }

    let updated = 0;

    for (const campaign of allCampaigns) {
      // Skip if slug already exists
      if ((campaign as any).slug) continue;

      // Generate slug from campaign name
      const base = (campaign as any).name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 60);

      // Append random suffix for uniqueness
      const suffix = Array.from(crypto.getRandomValues(new Uint8Array(3)))
        .map((b) => "abcdefghijklmnopqrstuvwxyz0123456789".charAt(b % 36))
        .join("");

      const slug = `${base}-${suffix}`;

      await ctx.db.patch(campaign._id, { slug });
      updated++;
    }

    console.log(`Migration complete: Added slugs to ${updated} campaigns out of ${allCampaigns.length} total`);

    return { updated, total: allCampaigns.length };
  },
});
