import { convexAdapter } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { anonymous, genericOAuth, twoFactor } from "better-auth/plugins";
import { emailOTP } from "better-auth/plugins";
import {
  sendMagicLink,
  sendOTPVerification,
  sendEmailVerification,
  sendResetPassword,
} from "../../convex/email"; // This resolves to email.tsx
import { magicLink } from "better-auth/plugins";
import { betterAuth, BetterAuthOptions } from "better-auth";
import { betterAuthComponent } from "../../convex/auth";
import { requireMutationCtx } from "@convex-dev/better-auth/utils";
import authConfig from "../../convex/auth.config";
import {
  QueryCtx,
  MutationCtx,
  ActionCtx,
} from "../../convex/_generated/server";
import { internal } from "../../convex/_generated/api";

type GenericCtx = QueryCtx | MutationCtx | ActionCtx;
import { asyncMap } from "convex-helpers";
import { Id } from "../../convex/_generated/dataModel";

const siteUrl = process.env.SITE_URL;
if (!siteUrl) {
  throw new Error("SITE_URL environment variable is required");
}

// Split out options so they can be passed to the convex plugin
const createOptions = (ctx: GenericCtx) =>
  ({
    baseURL: siteUrl,
    database: betterAuthComponent.adapter(ctx as any),
    secret: process.env.BETTER_AUTH_SECRET,
    advanced: {
      disableCSRFCheck: false,
      useSecureCookies: process.env.NODE_ENV === "production",
    },
    session: {
      // Session expires in 7 days (604800 seconds)
      expiresIn: 60 * 60 * 24 * 7, // 7 days in seconds
      // Update the session age every day to keep it fresh
      updateAge: 60 * 60 * 24, // 24 hours in seconds
      // Cookie cache settings for performance
      cookieCache: {
        enabled: true,
        maxAge: 60 * 5, // 5 minutes
      },
    },
    account: {
      accountLinking: {
        enabled: true,
        allowDifferentEmails: true,
      },
    },
    emailVerification: {
      sendVerificationEmail: async ({ user, url }) => {
        if ("runAction" in ctx) {
          // Action context — use sendAuthEmail action (supports Postmark)
          await (ctx as any).runAction(internal.email.sendAuthEmail, {
            type: "verifyEmail",
            to: user.email,
            url,
          });
        } else {
          // Mutation context — use direct sendEmailFromMutation (Resend only)
          await sendEmailVerification(requireMutationCtx(ctx) as any, {
            to: user.email,
            url,
          });
        }
      },
    },
    emailAndPassword: {
      enabled: true,
      // TODO: Set to true once RESEND_API_KEY is configured in Convex
      // pnpm convex env set RESEND_API_KEY your-api-key
      requireEmailVerification: false,
      sendResetPassword: async ({ user, url }) => {
        if ("runAction" in ctx) {
          await (ctx as any).runAction(internal.email.sendAuthEmail, {
            type: "resetPassword",
            to: user.email,
            url,
          });
        } else {
          await sendResetPassword(requireMutationCtx(ctx) as any, {
            to: user.email,
            url,
          });
        }
      },
    },
    socialProviders: {
      github: {
        clientId: process.env.GITHUB_CLIENT_ID as string,
        clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
      },
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID as string,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
        accessType: "offline",
        prompt: "select_account consent",
      },
    },
    user: {
      // Store company name and domain for tenant creation
      additionalFields: {
        companyName: {
          type: "string",
          required: false,
          input: true, // Allow passing during registration
        },
        domain: {
          type: "string",
          required: false,
          input: true, // Allow passing during registration
        },
      },
      deleteUser: {
        enabled: true,
      },
    },
    plugins: [
      anonymous(),
      magicLink({
        sendMagicLink: async ({ email, url }) => {
          if ("runAction" in ctx) {
            await (ctx as any).runAction(internal.email.sendAuthEmail, {
              type: "magicLink",
              to: email,
              url,
            });
          } else {
            await sendMagicLink(requireMutationCtx(ctx) as any, {
              to: email,
              url,
            });
          }
        },
      }),
      emailOTP({
        async sendVerificationOTP({ email, otp }) {
          if ("runAction" in ctx) {
            await (ctx as any).runAction(internal.email.sendAuthEmail, {
              type: "otp",
              to: email,
              otp,
            });
          } else {
            await sendOTPVerification(requireMutationCtx(ctx) as any, {
              to: email,
              code: otp,
            });
          }
        },
      }),
      twoFactor(),
      genericOAuth({
        config: [
          {
            providerId: "slack",
            clientId: process.env.SLACK_CLIENT_ID as string,
            clientSecret: process.env.SLACK_CLIENT_SECRET as string,
            discoveryUrl: "https://slack.com/.well-known/openid-configuration",
            scopes: ["openid", "email", "profile"],
          },
        ],
      }),
    ],
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            if ("runMutation" in ctx) {
              try {
                await ctx.runMutation(internal.users.syncUserCreation, {
                  email: user.email,
                  name: user.name || undefined,
                  companyName: (user as any).companyName || undefined,
                  domain: (user as any).domain || undefined,
                  authId: user.id, // Better Auth's unique user identifier
                });
              } catch (err) {
                // Log but don't throw — user creation in auth tables should succeed
                // even if app-level user record creation fails (e.g., missing domain during seeding)
                console.error("[Better Auth] syncUserCreation failed (non-fatal):", err);
              }
            }
          },
        },
        delete: {
          after: async (user) => {
            if ("runMutation" in ctx) {
              await ctx.runMutation(internal.users.syncUserDeletion, {
                email: user.email,
              });
            }
          },
        },
      },
    },
  } satisfies BetterAuthOptions);

export const createAuth = (ctx: GenericCtx) => {
  const options = createOptions(ctx);
  return betterAuth({
    ...options,
    plugins: [
      ...options.plugins,
      convex({ authConfig }),
    ],
  });
};

// Mostly for inferring types from Better Auth options
export const authWithoutCtx = createAuth({} as any);
