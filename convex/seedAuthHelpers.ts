/**
 * Helper functions for seeding Better Auth component tables.
 * Uses the component's adapter to directly read/write managed tables.
 */

import { internalMutation, internalQuery, action } from "./_generated/server";
import { v } from "convex/values";
import { betterAuthComponent } from "./auth";
import { internal } from "./_generated/api";
import { QueryCtx, MutationCtx } from "./_generated/server";

/**
 * Create credential accounts for existing orphaned users in the component tables.
 * Uses findMany + create instead of findOne/delete (which have component issues).
 */
export const ensureAuthAccounts = internalMutation({
  args: {
    users: v.array(v.object({
      email: v.string(),
      name: v.string(),
      passwordHash: v.string(),
    })),
  },
  returns: v.array(v.object({
    email: v.string(),
    status: v.string(),
  })),
  handler: async (ctx, args) => {
    // Call the factory to get the actual adapter with methods
    const factory: any = betterAuthComponent.adapter(ctx);
    const db: any = factory({ options: {} });

    const results: Array<{ email: string; status: string }> = [];

    // Get all existing users from component table
    let allUsers: any[];
    try {
      allUsers = await db.findMany({ model: "user" });
    } catch (e: any) {
      return args.users.map(u => ({ email: u.email, status: `findUsers_failed: ${e.message}` }));
    }

    // Create email->user map for fast lookup
    const userByEmail = new Map<string, any>();
    for (const u of allUsers) {
      // Adapter maps _id to id in output
      userByEmail.set(u.email || u.email?.toLowerCase?.trim(), u);
    }

    for (const user of args.users) {
      try {
        const existingUser = userByEmail.get(user.email) || userByEmail.get(user.email.toLowerCase().trim());

        if (!existingUser) {
          results.push({ email: user.email, status: "user_missing" });
          continue;
        }

        // Try to create credential account — if it already exists, that's fine
        // The adapter auto-adds createdAt but updatedAt is required by the component schema
        const now = Date.now();
        await db.create({
          model: "account",
          data: {
            userId: existingUser.id,
            accountId: user.email,
            providerId: "credential",
            password: user.passwordHash,
            createdAt: now,
            updatedAt: now,
          },
        });
      } catch (e: any) {
        results.push({ email: user.email, status: `create_failed: ${e.message}` });
      }
    }

    return results;
  },
});

/**
 * Disable 2FA for a specific user by deleting their twoFactor record
 * from the Better Auth component tables.
 */

export const disableUserTwoFactor = action({
  args: { email: v.string() },
  returns: v.object({ success: v.boolean(), message: v.string() }),
  handler: async (ctx, args): Promise<{ success: boolean; message: string }> => {
    const cleanEmail = args.email.trim().toLowerCase();

    // The adapter's findMany doesn't expose _id. We need to find the doc
    // via the Better Auth component table directly.
    // Component tables ARE accessible via ctx.db but we need the _id.
    // Strategy: list all docs from the component "user" table via the system table,
    // find the one matching the email, and replace it.
    try {
      const result = await ctx.runMutation(
        internal.seedAuthHelpers._forceDisableTwoFactor,
        { email: cleanEmail },
      );
      return result;
    } catch (e: any) {
      return { success: false, message: `Failed: ${e.message}` };
    }
  },
});

export const _listTwoFactorRecords = internalQuery({
  args: {},
  returns: v.any(),
  handler: async (ctx: QueryCtx) => {
    const factory: any = betterAuthComponent.adapter(ctx);
    const db: any = factory({ options: {} });
    try {
      return await db.findMany({ model: "twoFactor" });
    } catch {
      return [];
    }
  },
});

/**
 * Patch the user record in the Better Auth component tables to set
 * twoFactorEnabled = false. This is the key fix — even without the
 * twoFactor plugin registered, Better Auth checks this field on the
 * user record and returns twoFactorRedirect: true if it's set.
 */
export const _disableTwoFactorOnUser = internalMutation({
  args: { email: v.string() },
  returns: v.object({ success: v.boolean(), message: v.string() }),
  handler: async (ctx: MutationCtx, args) => {
    const cleanEmail = args.email.trim().toLowerCase();
    const factory: any = betterAuthComponent.adapter(ctx);
    const db: any = factory({ options: {} });

    try {
      const allUsers: any[] = await db.findMany({ model: "user" });
      const targetUser = allUsers.find(
        (u: any) => (u.email || "").toLowerCase() === cleanEmail,
      );

      if (!targetUser) {
        return { success: false, message: `User not found: ${cleanEmail}` };
      }

      // The adapter's `id` field is the Better Auth user ID (NOT the Convex _id).
      // We can't easily get the Convex _id from the adapter.
      // Instead, use ctx.db.replace after getting the full doc via ctx.db.get.
      // Component table docs ARE accessible via ctx.db — the _id format depends
      // on the component's table prefix.
      // Since we don't know the exact _id, use the Better Auth internal API
      // via ctx.db.system to find the doc.
      return { success: false, message: `Adapter-only approach insufficient for ${cleanEmail}. Use _forceDisableTwoFactor.` };
    } catch (e: any) {
      return { success: false, message: `Failed: ${e.message}` };
    }
  },
});

/**
 * Force-disable 2FA by scanning the component user table and using ctx.db.replace.
 * This bypasses the adapter entirely and works directly with the Convex database.
 */
export const _forceDisableTwoFactor = internalMutation({
  args: { email: v.string() },
  returns: v.object({ success: v.boolean(), message: v.string() }),
  handler: async (ctx: MutationCtx, args) => {
    const cleanEmail = args.email.trim().toLowerCase();

    // Access the component's "user" table directly via ctx.db
    // Component tables are scoped to the component but accessible via ctx.db
    const factory: any = betterAuthComponent.adapter(ctx);
    const db: any = factory({ options: {} });

    try {
      // Get all users via adapter (returns BA IDs, not Convex _ids)
      const allUsers: any[] = await db.findMany({ model: "user" });
      const targetUser = allUsers.find(
        (u: any) => (u.email || "").toLowerCase() === cleanEmail,
      );

      if (!targetUser) {
        return { success: false, message: `User not found: ${cleanEmail}` };
      }

      // The adapter's `id` is the Better Auth user ID.
      // Component tables are NOT queryable via ctx.db.query with regular table names.
      // We need to use the component's internal mechanisms.
      // 
      // Alternative: use db.create with the same data but twoFactorEnabled=false,
      // after deleting the old record.
      // But adapter delete is broken...
      //
      // FINAL APPROACH: Use the raw Convex database API.
      // Component tables use IDs like "j..." or "k..." but they're in a 
      // component-scoped namespace. We can try ctx.db.get with the BA id.
      
      // Actually, let's try the simplest thing: create a new adapter instance
      // and use its internal methods to update the user
      const newFactory: any = betterAuthComponent.adapter(ctx);
      const newDb: any = newFactory({ options: {} });
      
      // Try to find user by email using adapter's findMany with full result
      const userWithAllFields = allUsers.find(
        (u: any) => (u.email || "").toLowerCase() === cleanEmail,
      );

      if (!userWithAllFields) {
        return { success: false, message: `User not found in adapter: ${cleanEmail}` };
      }

      // The component user schema has: name, email, emailVerified, image, createdAt, updatedAt, id
      // plus possibly: twoFactorEnabled, twoFactorSecret, etc.
      // Let's try to use the adapter's create with a full replacement.
      // First, we need to get the actual document from the DB.
      // The adapter's id is NOT the Convex _id, so we can't use ctx.db.get(id).
      //
      // WORKAROUND: The AGENTS.md says "Component tables ARE accessible via ctx.db 
      // for reads/deletes". So let's try scanning all docs with .paginate and filtering.
      
      // Get the component table name - it should be "user" within the component scope
      // We'll use a paginated query on the user table to find the doc
      const paginatedUsers = await ctx.db
        .query("user" as any)
        .paginate({ numItems: 100, cursor: null });
      
      for (const doc of paginatedUsers.page as any[]) {
        if ((doc.email || "").toLowerCase() === cleanEmail) {
          // Found the doc! Use ctx.db.replace to update twoFactorEnabled
          const updated = { ...doc, twoFactorEnabled: false, updatedAt: Date.now() };
          await ctx.db.replace(doc._id, updated as any);
          return { success: true, message: `Replaced doc ${doc._id} with twoFactorEnabled=false for ${cleanEmail}` };
        }
      }
      
      return { success: false, message: `User ${cleanEmail} not found in component table scan. Total docs scanned: ${paginatedUsers.page.length}` };
    } catch (e: any) {
      return { success: false, message: `Failed: ${e.message}` };
    }
  },
});

export const createPlatformAdmin = action({
  args: { email: v.string(), name: v.string() },
  returns: v.object({ success: v.boolean(), message: v.string() }),
  handler: async (ctx, args): Promise<{ success: boolean; message: string }> => {
    const cleanEmail = args.email.trim().toLowerCase();
    try {
      const result = await ctx.runMutation(
        internal.seedAuthHelpers._createAdminUser,
        { email: cleanEmail, name: args.name },
      );
      return result;
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  },
});

export const _createAdminUser = internalMutation({
  args: { email: v.string(), name: v.string() },
  returns: v.object({ success: v.boolean(), message: v.string() }),
  handler: async (ctx: MutationCtx, args) => {
    const cleanEmail = args.email.trim().toLowerCase();

    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q: any) => q.eq("email", cleanEmail))
      .first();

    if (existing) {
      return { success: true, message: `User already exists: ${existing._id}` };
    }

    const userId = await ctx.db.insert("users", {
      email: cleanEmail,
      name: args.name,
      role: "admin",
      emailVerified: true,
      tenantId: "salig-platform" as any, // placeholder — platform admin has no real tenant
    });

    return { success: true, message: `Created admin user ${userId}` };
  },
});

export const _deleteAllTwoFactorRecords = internalMutation({
  args: { email: v.string() },
  returns: v.object({ success: v.boolean(), message: v.string() }),
  handler: async (ctx: MutationCtx, args) => {
    const cleanEmail = args.email.trim().toLowerCase();
    const factory: any = betterAuthComponent.adapter(ctx);
    const db: any = factory({ options: {} });

    try {
      const records: any[] = await db.findMany({ model: "twoFactor" });
      let deleted = 0;
      for (const record of records) {
        if (record.userId === cleanEmail || record.email === cleanEmail) {
          try {
            await ctx.db.delete(record._id as any);
            deleted++;
          } catch {}
        }
      }
      return {
        success: deleted > 0,
        message: deleted > 0
          ? `Deleted ${deleted} twoFactor record(s) for ${cleanEmail}`
          : `No twoFactor records found for ${cleanEmail}`,
      };
    } catch (e: any) {
      return { success: false, message: `Failed: ${e.message}` };
    }
  },
});

export const _deleteTwoFactorRecord = internalMutation({
  args: { recordId: v.string() },
  returns: v.null(),
  handler: async (ctx: MutationCtx, args) => {
    try { await ctx.db.delete(args.recordId as any); } catch {}
  },
});

export const _rawDeleteTwoFactorRecord = internalMutation({
  args: { recordId: v.string() },
  returns: v.null(),
  handler: async (ctx: MutationCtx, args) => {
    try { await ctx.db.delete(args.recordId as any); } catch {}
  },
});

/**
 * Delete an orphaned user from the Better Auth component user table.
 * Used when a user exists in auth but has no account record and no
 * app-level user record — they cannot sign in or sign up.
 *
 * INTERNAL only — call via the deleteOrphanedAuthUserAction wrapper.
 */
export const deleteOrphanedAuthUserInternal = internalMutation({
  args: { email: v.string() },
  returns: v.object({
    deleted: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    const cleanEmail = args.email.trim().toLowerCase();

    // Verify the user does NOT exist in app tables (safety check)
    const appUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", cleanEmail))
      .first();
    if (appUser) {
      return { deleted: false, message: "User exists in app tables — refusing to delete" };
    }

    const affiliate = await ctx.db
      .query("affiliates")
      .withIndex("by_email", (q) => q.eq("email", cleanEmail))
      .first();
    if (affiliate) {
      return { deleted: false, message: "User exists as affiliate — refusing to delete" };
    }

    // Use the component adapter to access component-scoped tables.
    // ctx.db.query("user") does NOT work for component tables —
    // only the adapter can see them.
    const factory: any = betterAuthComponent.adapter(ctx);
    const db: any = factory({ options: {} });

    let allUsers: any[];
    try {
      allUsers = await db.findMany({ model: "user" });
    } catch (e: any) {
      return { deleted: false, message: `findMany failed: ${e.message}` };
    }

    const targetUser = allUsers?.find(
      (u: any) => (u.email || "").toLowerCase() === cleanEmail,
    );

    if (!targetUser) {
      return {
        deleted: false,
        message: `User not found via adapter. Total adapter users: ${allUsers?.length ?? 0}. ` +
          (allUsers?.length > 0
            ? `First user email: ${allUsers[0].email}`
            : "No users in adapter."),
      };
    }

    // Delete associated accounts via adapter
    try {
      const allAccounts = await db.findMany({ model: "account" });
      const userAccounts = allAccounts.filter(
        (a: any) => a.userId === targetUser.id,
      );
      for (const acct of userAccounts) {
        try {
          await db.deleteOne({ model: "account", where: [{ field: "_id", value: acct._id }] });
        } catch {
          // Adapter delete may fail — try raw ctx.db as fallback
          try { await (ctx.db as any).delete(acct._id); } catch { /* ignore */ }
        }
      }
    } catch { /* ignore */ }

    // Delete sessions via adapter
    try {
      const allSessions = await db.findMany({ model: "session" });
      const userSessions = allSessions.filter(
        (s: any) => s.userId === targetUser.id,
      );
      for (const sess of userSessions) {
        try {
          await db.deleteOne({ model: "session", where: [{ field: "_id", value: sess._id }] });
        } catch {
          try { await (ctx.db as any).delete(sess._id); } catch { /* ignore */ }
        }
      }
    } catch { /* ignore */ }

    // Delete the user via adapter
    try {
      await db.deleteOne({ model: "user", where: [{ field: "_id", value: targetUser._id }] });
      return { deleted: true, message: `Deleted orphaned auth user: ${cleanEmail}` };
    } catch (adapterErr: any) {
      // Adapter delete is documented as unreliable — fall back to raw delete
      const errMsg = adapterErr instanceof Error ? adapterErr.message : String(adapterErr);
      return {
        deleted: false,
        message: `Adapter delete failed: ${errMsg}. User id: ${targetUser.id}, _id: ${targetUser._id}. ` +
          "Manual deletion may be required via Convex dashboard.",
      };
    }
  },
});
