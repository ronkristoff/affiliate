/**
 * Platform-wide audit log queries for the admin panel.
 *
 * Lists all audit log entries across tenants with optional filters
 * for action type, entity type, and specific actor.
 *
 * Uses page-based pagination (page + numItems) to match the pattern
 * used by listAffiliatesFiltered, listCommissionsFiltered, etc.
 */

import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./_helpers";

// Maximum number of audit log entries we'll scan in a single query.
// .take() on auditLogs must be capped — see AGENTS.md scalability guidelines.
const MAX_AUDIT_SCAN = 1000;

/**
 * List all audit log entries across all tenants.
 * Platform admin only — collects entries, applies filters, enriches
 * with tenant/actor names, then slices for page-based pagination.
 */
export const listAllAuditLogs = query({
  args: {
    page: v.number(),
    numItems: v.number(),
    actionFilter: v.optional(v.string()),
    entityTypeFilter: v.optional(v.string()),
    actorIdFilter: v.optional(v.string()),
  },
  returns: v.object({
    page: v.array(v.object({
      _id: v.id("auditLogs"),
      _creationTime: v.number(),
      tenantId: v.optional(v.id("tenants")),
      action: v.string(),
      entityType: v.string(),
      entityId: v.string(),
      targetId: v.optional(v.string()),
      actorId: v.optional(v.string()),
      actorName: v.optional(v.string()),
      actorType: v.string(),
      previousValue: v.optional(v.any()),
      newValue: v.optional(v.any()),
      metadata: v.optional(v.any()),
      affiliateId: v.optional(v.id("affiliates")),
      tenantName: v.optional(v.string()),
    })),
    total: v.number(),
    hasMore: v.boolean(),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const numItems = Math.min(args.numItems, 100);

    // Build base query — cross-tenant scan, ordered by most recent first
    let queryBuilder = ctx.db
      .query("auditLogs")
      .order("desc");

    // Apply optional filters via .filter()
    if (args.actionFilter) {
      queryBuilder = queryBuilder.filter((q) =>
        q.eq(q.field("action"), args.actionFilter!)
      );
    }
    if (args.entityTypeFilter) {
      queryBuilder = queryBuilder.filter((q) =>
        q.eq(q.field("entityType"), args.entityTypeFilter!)
      );
    }
    if (args.actorIdFilter) {
      queryBuilder = queryBuilder.filter((q) =>
        q.eq(q.field("actorId"), args.actorIdFilter!)
      );
    }

    // Scan up to MAX_AUDIT_SCAN entries for this query
    const allLogs = await queryBuilder.take(MAX_AUDIT_SCAN);
    const total = allLogs.length;

    // Client-side slicing for page-based pagination
    const startIndex = (args.page - 1) * numItems;
    const endIndex = startIndex + numItems;
    const hasMore = endIndex < total;

    if (startIndex >= total) {
      return { page: [], total, hasMore: false };
    }

    const pageLogs = allLogs.slice(startIndex, endIndex);

    // ── Batch enrichment ───────────────────────────────────────────────

    const tenantIds = [...new Set(
      pageLogs.map((log) => log.tenantId).filter(Boolean) as string[]
    )];
    const actorIds = [...new Set(
      pageLogs.map((log) => log.actorId).filter(Boolean) as string[]
    )];

    // Batch fetch tenants
    const tenants = await Promise.all(
      tenantIds.map((id) => ctx.db.get(id as any))
    );
    const tenantMap = new Map(
      tenants.filter(Boolean).map((t: any) => [t._id, t])
    );

    // Batch fetch actor users.
    // actorId can be a Convex user doc ID (Id<"users">) or an auth ID string.
    // Try doc lookup first, then fall back to by_auth_id index.
    const actorResults = await Promise.all(
      actorIds.map(async (id) => {
        // Try as Convex doc ID (admin._id pattern)
        try {
          const user = await ctx.db.get(id as any);
          if (user) return { id, name: (user as any).name ?? (user as any).email };
        } catch {
          // Not a valid doc ID format
        }

        // Try by_auth_id index (admin.authId pattern)
        try {
          const user = await ctx.db
            .query("users")
            .withIndex("by_auth_id", (q: any) => q.eq("authId", id))
            .first();
          if (user) return { id, name: (user as any).name ?? (user as any).email };
        } catch {
          // Index may not match
        }

        return null;
      })
    );
    const actorMap = new Map(
      actorResults.filter(Boolean).map((a: any) => [a.id, a.name])
    );

    // ── Enrich and return ──────────────────────────────────────────────

    const enrichedPage = pageLogs.map((log) => {
      const tenant = log.tenantId ? tenantMap.get(log.tenantId) : undefined;
      let actorName: string | undefined;
      if (log.actorId) {
        actorName = actorMap.get(log.actorId);
      }

      return {
        _id: log._id,
        _creationTime: log._creationTime,
        tenantId: log.tenantId,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        targetId: log.targetId,
        actorId: log.actorId,
        actorName,
        actorType: log.actorType,
        previousValue: log.previousValue,
        newValue: log.newValue,
        metadata: log.metadata,
        affiliateId: log.affiliateId,
        tenantName: (tenant as any)?.name,
      };
    });

    return { page: enrichedPage, total, hasMore };
  },
});

/**
 * Get distinct action types available in audit logs.
 * Used for filter dropdowns.
 */
export const getAuditActionTypes = query({
  args: {},
  returns: v.array(v.string()),
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const recentLogs = await ctx.db
      .query("auditLogs")
      .order("desc")
      .take(500);

    const actionTypes = [...new Set(recentLogs.map((log) => log.action))];
    return actionTypes.sort();
  },
});

/**
 * Get distinct entity types available in audit logs.
 * Used for filter dropdowns.
 */
export const getAuditEntityTypes = query({
  args: {},
  returns: v.array(v.string()),
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const recentLogs = await ctx.db
      .query("auditLogs")
      .order("desc")
      .take(500);

    const entityTypes = [...new Set(recentLogs.map((log) => log.entityType))];
    return entityTypes.sort();
  },
});

/**
 * Get distinct actors from audit logs, enriched with user names.
 * Used for the actor filter dropdown so admins can pick a specific person.
 *
 * Returns actorId + actorName pairs, sorted by name for the dropdown.
 */
export const getAuditActors = query({
  args: {},
  returns: v.array(v.object({
    actorId: v.string(),
    actorName: v.string(),
    actorType: v.string(),
  })),
  handler: async (ctx) => {
    await requireAdmin(ctx);

    // Scan recent logs to collect unique actor IDs
    const recentLogs = await ctx.db
      .query("auditLogs")
      .order("desc")
      .take(500);

    const uniqueActorIds = [...new Set(
      recentLogs
        .map((log) => log.actorId)
        .filter(Boolean) as string[]
    )];

    if (uniqueActorIds.length === 0) {
      return [];
    }

    // Resolve each actor ID to a name
    const actors = await Promise.all(
      uniqueActorIds.map(async (id) => {
        let name: string | undefined;
        let actorType = "unknown";

        // Try as Convex doc ID
        try {
          const user = await ctx.db.get(id as any);
          if (user) {
            name = (user as any).name ?? (user as any).email;
            // Find the actorType from any log entry for this actor
            const matchingLog = recentLogs.find((log) => log.actorId === id);
            actorType = matchingLog?.actorType ?? "user";
          }
        } catch {
          // Not a valid doc ID format
        }

        // Try by_auth_id index
        if (!name) {
          try {
            const user = await ctx.db
              .query("users")
              .withIndex("by_auth_id", (q: any) => q.eq("authId", id))
              .first();
            if (user) {
              name = (user as any).name ?? (user as any).email;
              const matchingLog = recentLogs.find((log) => log.actorId === id);
              actorType = matchingLog?.actorType ?? "user";
            }
          } catch {
            // Index not found
          }
        }

        if (!name) return null;
        return { actorId: id, actorName: name, actorType };
      })
    );

    return (actors.filter((a): a is NonNullable<typeof a> => a !== null))
      .sort((a, b) => a.actorName.localeCompare(b.actorName));
  },
});
