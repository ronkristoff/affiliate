/**
 * QA Platform Admin Seeder
 *
 * Seeds ONLY the platform admin access for QA and production environments.
 * Does NOT create test tenants, affiliates, campaigns, or other dev data.
 *
 * Usage:
 *   pnpm convex run qaSeed:seedQaPlatformAdmins --env-file .env.qa --typecheck=disable --push
 *
 * This creates:
 * 1. Better Auth component user + credential account (for sign-in)
 * 2. App-level user record with role="admin" (for platform admin access)
 *
 * Password for seeded admins: "TestPass123!"
 */

import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

const QA_ADMINS: Array<{ email: string; name: string }> = [
  { email: "ron.kristoff.e.reyes@live.com.ph", name: "Ron Kristoff Reyes" },
  { email: "support@microsource.com.ph", name: "Microsource Support" },
];

const TEST_PASSWORD = "TestPass123!";
const TEST_PASSWORD_HASH = "b1fb84d0f1c6feb781d661faecc3eeb6:4840a3170ce388473977f0fef10160e603fc9d95a74f55b2bfbf7626d0879e545a1fe515d12b36f0230bce85f6d4f6de3cf8f98f9a1daca3deeefd06e76a2000";

export const seedQaPlatformAdmins = action({
  args: {},
  returns: v.object({
    success: v.boolean(),
    results: v.array(v.object({
      email: v.string(),
      ok: v.boolean(),
      message: v.string(),
    })),
  }),
  handler: async (ctx) => {
    const siteUrl = process.env.SITE_URL;
    const results: Array<{ email: string; ok: boolean; message: string }> = [];

    for (const admin of QA_ADMINS) {
      try {
        // Strategy 1: Try HTTP signup endpoint (creates both auth + app user via hook)
        if (siteUrl) {
          try {
            const res = await fetch(`${siteUrl}/api/auth/sign-up/email`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Origin": siteUrl,
              },
              body: JSON.stringify({
                email: admin.email,
                password: TEST_PASSWORD,
                name: admin.name,
              }),
            });
            const data = await res.json() as any;

            if (data.user?.id || data.token) {
              // Signup succeeded — hook should have created app user.
              // Verify the app user exists and has admin role.
              const appUser = await ctx.runQuery(
                internal.qaSeedInternal._verifyAdminUser,
                { email: admin.email },
              );

              if (appUser.exists && appUser.role === "admin") {
                results.push({
                  email: admin.email,
                  ok: true,
                  message: "Created via HTTP signup and verified as admin",
                });
                continue;
              }

              // Auth user exists but app user missing or wrong role — fix it
              await ctx.runMutation(
                internal.qaSeedInternal._ensureAdminAppUser,
                { email: admin.email, name: admin.name },
              );
              results.push({
                email: admin.email,
                ok: true,
                message: "Created via HTTP signup, app user patched to admin",
              });
              continue;
            }
          } catch (httpErr) {
            // HTTP signup failed — fall through to adapter approach
          }
        }

        // Strategy 2: Use adapter to create auth user + account, then create app user
        const adapterResult = await ctx.runMutation(
          internal.qaSeedInternal._createAdminViaAdapter,
          { email: admin.email, name: admin.name },
        );

        results.push({
          email: admin.email,
          ok: adapterResult.success,
          message: adapterResult.message,
        });
      } catch (err) {
        results.push({
          email: admin.email,
          ok: false,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const allOk = results.every(r => r.ok);
    return { success: allOk, results };
  },
});
