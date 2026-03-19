import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Debug: Update seeded user to match API-created format
 */
export const fixSeededUser = mutation({
  args: {
    email: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    try {
      // Find the user
      const users = await (ctx.db as any).query("user").collect();
      const user = users.find((u: any) => u.email === args.email);
      
      if (!user) {
        return { success: false, error: "User not found" };
      }
      
      // Update user to match API format
      await (ctx.db as any).patch(user._id, {
        emailVerified: false,  // API users have emailVerified: false
        updatedAt: Date.now(),
      });
      
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
});

/**
 * Debug: Check user details
 */
export const getUserDetails = query({
  args: {
    email: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    try {
      const users = await (ctx.db as any).query("user").collect();
      const user = users.find((u: any) => u.email === args.email);
      
      if (!user) {
        return { error: "User not found" };
      }
      
      // Get account
      const accounts = await (ctx.db as any).query("account").collect();
      const account = accounts.find((a: any) => a.userId === user._id);
      
      return {
        user: {
          ...user,
        },
        account: account ? {
          ...account,
          password: account.password ? `${account.password.substring(0, 30)}...` : null,
        } : null,
      };
    } catch (error) {
      return { error: String(error) };
    }
  },
});
