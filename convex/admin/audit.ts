/**
 * Platform-wide audit log queries for the admin panel.
 *
 * Lists all audit log entries across tenants with optional filters
 * for action type, entity type, and specific actor.
 *
 * Uses page-based pagination (page + numItems) to match the pattern
 * used by listAffiliatesFiltered, listCommissionsFiltered, etc.
 */

import { query, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { requireAdmin } from "./_helpers";
import { Id } from "../_generated/dataModel";

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
    actionFilter: v.optional(v.array(v.string())),
    entityTypeFilter: v.optional(v.array(v.string())),
    actorIdFilter: v.optional(v.array(v.string())),
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
    if (args.actionFilter && args.actionFilter.length > 0) {
      queryBuilder = queryBuilder.filter((q) =>
        q.or(...args.actionFilter!.map((a) => q.eq(q.field("action"), a)))
      );
    }
    if (args.entityTypeFilter && args.entityTypeFilter.length > 0) {
      queryBuilder = queryBuilder.filter((q) =>
        q.or(...args.entityTypeFilter!.map((t) => q.eq(q.field("entityType"), t)))
      );
    }
    if (args.actorIdFilter && args.actorIdFilter.length > 0) {
      queryBuilder = queryBuilder.filter((q) =>
        q.or(...args.actorIdFilter!.map((a) => q.eq(q.field("actorId"), a)))
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

// =============================================================================
// Fraud Radar (Platform Admin)
// =============================================================================

/**
 * Get platform-wide fraud summary.
 * Queries tenantStats where commissionsFlagged > 0, joins with tenants for name.
 * Used by the Fraud Radar section on the /audit admin page.
 */
export const getPlatformFraudSummary = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(v.object({
      tenantId: v.id("tenants"),
      tenantName: v.string(),
      commissionsFlagged: v.number(),
      commissionsConfirmedThisMonth: v.number(),
      commissionsPendingCount: v.number(),
      fraudRate: v.number(),
    })),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
    pageStatus: v.optional(v.union(v.string(), v.null())),
    splitCursor: v.optional(v.union(v.string(), v.null())),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const results = await ctx.db
      .query("tenantStats")
      .withIndex("by_tenant")
      .order("desc")
      .paginate(args.paginationOpts);

    const fraudTenants = [];
    for (const stats of results.page) {
      if ((stats.commissionsFlagged ?? 0) <= 0) continue;

      const tenant = await ctx.db.get(stats.tenantId);
      if (!tenant) continue;

      const confirmed = (stats.commissionsConfirmedThisMonth ?? 0) +
        (stats.commissionsConfirmedLastMonth ?? 0);
      const total = confirmed + (stats.commissionsPendingCount ?? 0);
      const fraudRate = total > 0 ? stats.commissionsFlagged / total : 0;

      fraudTenants.push({
        tenantId: stats.tenantId,
        tenantName: tenant.name,
        commissionsFlagged: stats.commissionsFlagged,
        commissionsConfirmedThisMonth: confirmed,
        commissionsPendingCount: stats.commissionsPendingCount ?? 0,
        fraudRate: Math.round(fraudRate * 10000) / 10000, // 4 decimal places
      });
    }

    // Sort by fraud rate descending
    fraudTenants.sort((a, b) => b.fraudRate - a.fraudRate);

    return {
      page: fraudTenants,
      isDone: results.isDone,
      continueCursor: results.continueCursor,
    };
  },
});

// =============================================================================
// User Timeline (Story 15.5)
// =============================================================================

/**
 * Cross-tenant user search by name or email (partial match).
 * Platform admin types a query and sees matching users AND affiliates
 * across ALL tenants with enriched data (tenant name, role, affiliate info).
 *
 * Returns a discriminated union where each result is either a "user" or "affiliate".
 * Scan-based since Convex indexes don't support partial string matching.
 */
export const searchUsersAcrossTenants = query({
  args: { query: v.string() },
  returns: v.array(v.object({
    /** Discriminator: "user" for SaaS owners/team, "affiliate" for affiliates */
    type: v.union(v.literal("user"), v.literal("affiliate")),
    userId: v.optional(v.id("users")),
    affiliateId: v.optional(v.id("affiliates")),
    email: v.string(),
    name: v.optional(v.string()),
    tenantId: v.id("tenants"),
    tenantName: v.string(),
    role: v.optional(v.string()),
    affiliateCode: v.optional(v.string()),
    affiliateStatus: v.optional(v.string()),
  })),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const search = args.query.trim().toLowerCase();
    if (search.length < 2) return [];

    const results: Array<{
      type: "user" | "affiliate";
      userId?: Id<"users">;
      affiliateId?: Id<"affiliates">;
      email: string;
      name?: string;
      tenantId: Id<"tenants">;
      tenantName: string;
      role?: string;
      affiliateCode?: string;
      affiliateStatus?: string;
    }> = [];

    // ── 1. Search users table (SaaS owners + team members) ─────────────
    const allUsers = await ctx.db.query("users").take(200);
    const matchedUsers = allUsers.filter(
      (u) =>
        u.email.toLowerCase().includes(search) ||
        (u.name?.toLowerCase().includes(search) ?? false),
    );

    if (matchedUsers.length > 0) {
      const tenantIds = [...new Set(matchedUsers.map((u) => u.tenantId))];
      const tenants = await Promise.all(tenantIds.map((id) => ctx.db.get(id)));
      const tenantMap = new Map(
        tenants.filter(Boolean).map((t: any) => [t._id, t]),
      );

      for (const user of matchedUsers.slice(0, 20)) {
        const tenant = tenantMap.get(user.tenantId);
        if (!tenant) continue;

        // Check if user also has an affiliate record
        let affiliateId: Id<"affiliates"> | undefined;
        let affiliateCode: string | undefined;
        let affiliateStatus: string | undefined;
        try {
          const affiliate = await ctx.db
            .query("affiliates")
            .withIndex("by_email", (q: any) => q.eq("email", user.email))
            .filter((q: any) => q.eq(q.field("tenantId"), user.tenantId))
            .first();
          if (affiliate) {
            affiliateId = affiliate._id;
            affiliateCode = affiliate.uniqueCode;
            affiliateStatus = affiliate.status;
          }
        } catch {
          // Index lookup may fail
        }

        results.push({
          type: "user",
          userId: user._id,
          affiliateId,
          email: user.email,
          name: user.name,
          tenantId: user.tenantId,
          tenantName: (tenant as any).name,
          role: user.role,
          affiliateCode,
          affiliateStatus,
        });
      }
    }

    // ── 2. Search affiliates table ─────────────────────────────────────
    const allAffiliates = await ctx.db.query("affiliates").take(500);
    // Deduplicate: skip affiliates already found as users (matched by email+tenant)
    const userEmailTenantSet = new Set(
      results.map((r) => `${r.email}::${r.tenantId}`),
    );

    const matchedAffiliates = allAffiliates.filter(
      (a) =>
        (a.email.toLowerCase().includes(search) ||
          a.name.toLowerCase().includes(search) ||
          a.uniqueCode.toLowerCase().includes(search)) &&
        !userEmailTenantSet.has(`${a.email}::${a.tenantId}`),
    );

    if (matchedAffiliates.length > 0) {
      const affTenantIds = [...new Set(matchedAffiliates.map((a) => a.tenantId))];
      const tenants = await Promise.all(affTenantIds.map((id) => ctx.db.get(id)));
      const tenantMap = new Map(
        tenants.filter(Boolean).map((t: any) => [t._id, t]),
      );

      for (const affiliate of matchedAffiliates.slice(0, 20)) {
        const tenant = tenantMap.get(affiliate.tenantId);
        if (!tenant) continue;

        // Check if affiliate also has a users record
        let userId: Id<"users"> | undefined;
        let role: string | undefined;
        try {
          const user = await ctx.db
            .query("users")
            .withIndex("by_email", (q: any) => q.eq("email", affiliate.email))
            .first();
          if (user) {
            userId = user._id;
            role = user.role;
          }
        } catch {
          // Index lookup may fail
        }

        results.push({
          type: "affiliate",
          userId,
          affiliateId: affiliate._id,
          email: affiliate.email,
          name: affiliate.name,
          tenantId: affiliate.tenantId,
          tenantName: (tenant as any).name,
          role,
          affiliateCode: affiliate.uniqueCode,
          affiliateStatus: affiliate.status,
        });
      }
    }

    // Sort by relevance: exact email match first, then name match
    results.sort((a, b) => {
      const aEmailExact = a.email.toLowerCase() === search ? 0 : 1;
      const bEmailExact = b.email.toLowerCase() === search ? 0 : 1;
      if (aEmailExact !== bEmailExact) return aEmailExact - bEmailExact;
      return (a.name ?? a.email).localeCompare(b.name ?? b.email);
    });

    return results.slice(0, 20);
  },
});

/**
 * Get user/affiliate timeline — paginated audit log entries for a specific user or affiliate.
 *
 * Supports three lookup modes:
 * 1. **By userId** (Convex doc ID from users table) — SaaS owners/team
 * 2. **By affiliateId** (Convex doc ID from affiliates table) — pure affiliates
 * 3. **By email** (fallback) — when neither doc ID is available, matches entityId
 *
 * Uses the by_actor index for efficient chronological queries
 * (Convex auto-appends _creationTime to all indexes).
 * Also scans by entityId and by_affiliate index to catch affiliate-related events
 * that don't have the affiliate's ID as actorId (e.g., system-generated events).
 */
export const getUserTimeline = query({
  args: {
    userId: v.optional(v.id("users")),
    affiliateId: v.optional(v.id("affiliates")),
    email: v.optional(v.string()), // For deep-link or email-only lookup
    authId: v.optional(v.string()), // Better Auth user ID (for auth events)
    paginationOpts: paginationOptsValidator,
    startDate: v.optional(v.number()), // _creationTime lower bound (inclusive)
    endDate: v.optional(v.number()), // _creationTime upper bound (exclusive)
  },
  returns: v.object({
    page: v.array(v.object({
      _id: v.id("auditLogs"),
      _creationTime: v.number(),
      tenantId: v.optional(v.id("tenants")),
      action: v.string(),
      entityType: v.string(),
      entityId: v.string(),
      actorId: v.optional(v.string()),
      actorType: v.string(),
      previousValue: v.optional(v.any()),
      newValue: v.optional(v.any()),
      metadata: v.optional(v.any()),
      affiliateId: v.optional(v.id("affiliates")),
      tenantName: v.optional(v.string()),
      actorName: v.optional(v.string()),
    })),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
    pageStatus: v.optional(v.union(v.string(), v.null())),
    splitCursor: v.optional(v.union(v.string(), v.null())),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    // Resolve the user's email for additional lookups
    let resolvedEmail = args.email?.trim().toLowerCase();

    // If userId is provided, resolve the email from the users table
    if (args.userId && !resolvedEmail) {
      const user = await ctx.db.get(args.userId);
      if (user) resolvedEmail = user.email?.toLowerCase();
    }

    // If affiliateId is provided, resolve the email from the affiliates table
    if (args.affiliateId && !resolvedEmail) {
      const affiliate = await ctx.db.get(args.affiliateId);
      if (affiliate) resolvedEmail = affiliate.email?.toLowerCase();
    }

    // Build the set of IDs to search across multiple indexes
    const searchIds: string[] = [];
    if (args.userId) searchIds.push(args.userId);
    if (args.authId && args.authId !== args.userId) searchIds.push(args.authId);
    if (resolvedEmail) searchIds.push(resolvedEmail);
    // Deduplicate
    const uniqueSearchIds = [...new Set(searchIds)];

    // ── Collect audit entries from multiple sources ────────────────────
    const allLogs: Map<string, any> = new Map(); // dedup by _id

    // 1. by_actor index — matches actorId (userId or authId)
    if (args.userId) {
      let actorQuery = ctx.db
        .query("auditLogs")
        .withIndex("by_actor", (q) => q.eq("actorId", args.userId))
        .order("desc");

      if (args.startDate !== undefined) {
        actorQuery = actorQuery.filter((q) => q.gte(q.field("_creationTime"), args.startDate!));
      }
      if (args.endDate !== undefined) {
        actorQuery = actorQuery.filter((q) => q.lt(q.field("_creationTime"), args.endDate!));
      }

      const actorLogs = await actorQuery.take(200);
      for (const log of actorLogs) allLogs.set(log._id, log);

      // Also search by authId if different
      if (args.authId && args.authId !== args.userId) {
        let authIdQuery = ctx.db
          .query("auditLogs")
          .withIndex("by_actor", (q) => q.eq("actorId", args.authId!))
          .order("desc");
        if (args.startDate !== undefined) {
          authIdQuery = authIdQuery.filter((q) => q.gte(q.field("_creationTime"), args.startDate!));
        }
        if (args.endDate !== undefined) {
          authIdQuery = authIdQuery.filter((q) => q.lt(q.field("_creationTime"), args.endDate!));
        }
        const authIdLogs = await authIdQuery.take(200);
        for (const log of authIdLogs) allLogs.set(log._id, log);
      }
    }

    // 2. by_affiliate index — matches affiliateId field on audit logs
    if (args.affiliateId) {
      let affQuery = ctx.db
        .query("auditLogs")
        .withIndex("by_affiliate", (q) => q.eq("affiliateId", args.affiliateId!))
        .order("desc");

      if (args.startDate !== undefined) {
        affQuery = affQuery.filter((q) => q.gte(q.field("_creationTime"), args.startDate!));
      }
      if (args.endDate !== undefined) {
        affQuery = affQuery.filter((q) => q.lt(q.field("_creationTime"), args.endDate!));
      }

      const affLogs = await affQuery.take(200);
      for (const log of affLogs) allLogs.set(log._id, log);
    }

    // 3. Email-based search — matches entityId where it's an email (auth events, etc.)
    if (resolvedEmail) {
      let emailQuery = ctx.db
        .query("auditLogs")
        .withIndex("by_actor", (q) => q.eq("actorId", resolvedEmail))
        .order("desc");

      if (args.startDate !== undefined) {
        emailQuery = emailQuery.filter((q) => q.gte(q.field("_creationTime"), args.startDate!));
      }
      if (args.endDate !== undefined) {
        emailQuery = emailQuery.filter((q) => q.lt(q.field("_creationTime"), args.endDate!));
      }

      const emailLogs = await emailQuery.take(200);
      for (const log of emailLogs) allLogs.set(log._id, log);
    }

    // Sort all collected logs by creation time descending
    const sortedLogs = Array.from(allLogs.values()).sort(
      (a, b) => b._creationTime - a._creationTime,
    );

    // Paginate manually (we already have all matching logs from the index scans)
    const numItems = args.paginationOpts.numItems ?? 25;
    const cursor = args.paginationOpts.cursor;
    let startIndex = 0;
    if (cursor) {
      const cursorIdx = sortedLogs.findIndex((log) => log._id === cursor);
      if (cursorIdx >= 0) startIndex = cursorIdx + 1;
    }
    const pageLogs = sortedLogs.slice(startIndex, startIndex + numItems);
    const isDone = startIndex + numItems >= sortedLogs.length;
    const continueCursor = isDone ? null : (pageLogs[pageLogs.length - 1]?._id ?? null);

    // ── Batch enrichment ────────────────────────────────────────────────
    const tenantIds = [...new Set(
      pageLogs.map((log) => log.tenantId).filter(Boolean) as string[]
    )];
    const tenants = await Promise.all(
      tenantIds.map((id) => ctx.db.get(id as any))
    );
    const tenantMap = new Map(
      tenants.filter(Boolean).map((t: any) => [t._id, t])
    );

    // Batch fetch actor names — resolve from users table AND affiliates table
    const actorIdSet = [...new Set(
      pageLogs.map((log) => log.actorId).filter(Boolean) as string[]
    )];
    const actorNameMap = new Map<string, string>();

    const actorDocs = await Promise.all(
      actorIdSet.map(async (id): Promise<{ id: string; name?: string }> => {
        // Try as Convex doc ID first (users table)
        if (id.startsWith("j") || id.startsWith("k")) {
          try {
            const user = await ctx.db.get(id as any);
            if (user && (user as any).name) return { id, name: (user as any).name };
          } catch {
            // Not a valid doc ID
          }
          // Try as affiliates table
          try {
            const affiliate = await ctx.db.get(id as any);
            if (affiliate && (affiliate as any).name) return { id, name: (affiliate as any).name };
          } catch {
            // Not a valid doc ID
          }
        }
        // Try by_email in users table
        try {
          const user = await ctx.db
            .query("users")
            .withIndex("by_email", (q: any) => q.eq("email", id))
            .first();
          if (user) return { id, name: user.name ?? user.email };
        } catch {
          // Index not found
        }
        // Try by_email in affiliates table
        try {
          const affiliate = await ctx.db
            .query("affiliates")
            .withIndex("by_email", (q: any) => q.eq("email", id))
            .first();
          if (affiliate) return { id, name: affiliate.name ?? affiliate.email };
        } catch {
          // Index not found
        }
        return { id };
      })
    );
    for (const doc of actorDocs) {
      if (doc.name) actorNameMap.set(doc.id, doc.name);
    }

    // Enrich with tenant and actor names
    const enrichedPage = pageLogs.map((log) => ({
      ...log,
      tenantName: log.tenantId ? (tenantMap.get(log.tenantId) as any)?.name : undefined,
      actorName: log.actorId ? actorNameMap.get(log.actorId) : undefined,
    }));

    return {
      page: enrichedPage,
      isDone,
      continueCursor,
    };
  },
});

// =============================================================================
// Login Attempts for User Timeline (Story 15.6)
// =============================================================================

/**
 * Get recent login attempts for a user by email.
 * Returns failed login attempts from the loginAttempts table,
 * enriched with lockout status. Used in the User Timeline to show
 * login failures inline with audit log events.
 */
export const getUserLoginAttempts = query({
  args: {
    email: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.object({
    _id: v.id("loginAttempts"),
    _creationTime: v.number(),
    email: v.string(),
    ipAddress: v.optional(v.string()),
    failedAt: v.number(),
    lockedUntil: v.optional(v.number()),
    isLocked: v.boolean(),
    remainingLockMs: v.optional(v.number()),
  })),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const cleanEmail = args.email.trim().toLowerCase();
    const limit = Math.min(args.limit ?? 50, 50);
    const now = Date.now();

    const attempts = await ctx.db
      .query("loginAttempts")
      .withIndex("by_email", (q) => q.eq("email", cleanEmail))
      .order("desc")
      .take(limit);

    return attempts.map((a) => ({
      ...a,
      isLocked: a.lockedUntil !== undefined && a.lockedUntil > now,
      remainingLockMs: a.lockedUntil !== undefined && a.lockedUntil > now
        ? a.lockedUntil - now
        : undefined,
    }));
  },
});

// =============================================================================
// Email Events for User Timeline (Story 15.6)
// =============================================================================

/**
 * Get recent email events for a user by recipient email.
 * Returns email send records from the emails table with delivery status.
 * Used in the User Timeline to show email delivery chains inline with audit events.
 */
export const getUserEmailEvents = query({
  args: {
    email: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.object({
    _id: v.id("emails"),
    _creationTime: v.number(),
    tenantId: v.id("tenants"),
    type: v.string(),
    recipientEmail: v.string(),
    subject: v.string(),
    status: v.string(),
    provider: v.optional(v.string()),
    deliveryStatus: v.optional(v.string()),
    sentAt: v.optional(v.number()),
    deliveredAt: v.optional(v.number()),
    openedAt: v.optional(v.number()),
    bounceReason: v.optional(v.string()),
    complaintReason: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    tenantName: v.optional(v.string()),
  })),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const cleanEmail = args.email.trim().toLowerCase();
    const limit = Math.min(args.limit ?? 50, 50);

    const emails = await ctx.db
      .query("emails")
      .withIndex("by_recipient", (q) => q.eq("recipientEmail", cleanEmail))
      .order("desc")
      .take(limit);

    // Batch fetch tenant names
    const tenantIds = [...new Set(emails.map((e) => e.tenantId))];
    const tenants = await Promise.all(tenantIds.map((id) => ctx.db.get(id)));
    const tenantMap = new Map(
      tenants.filter(Boolean).map((t: any) => [t._id, t]),
    );

    return emails.map((e) => ({
      _id: e._id,
      _creationTime: e._creationTime,
      tenantId: e.tenantId,
      type: e.type,
      recipientEmail: e.recipientEmail,
      subject: e.subject,
      status: e.status,
      provider: e.provider as string | undefined,
      deliveryStatus: e.deliveryStatus as string | undefined,
      sentAt: e.sentAt,
      deliveredAt: e.deliveredAt,
      openedAt: e.openedAt,
      bounceReason: e.bounceReason,
      complaintReason: e.complaintReason,
      errorMessage: e.errorMessage,
      tenantName: (tenantMap.get(e.tenantId) as any)?.name,
    }));
  },
});
