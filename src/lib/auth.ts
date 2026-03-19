import { convexAdapter } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { anonymous, genericOAuth, twoFactor } from "better-auth/plugins";
import { emailOTP } from "better-auth/plugins";
import {
  sendMagicLink,
  sendOTPVerification,
  sendEmailVerification,
  sendResetPassword,
} from "../../convex/email";
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
    account: {
      accountLinking: {
        enabled: true,
        allowDifferentEmails: true,
      },
    },
    emailVerification: {
      sendVerificationEmail: async ({ user, url }) => {
        await sendEmailVerification(requireMutationCtx(ctx) as any, {
          to: user.email,
          url,
        });
      },
    },
    emailAndPassword: {
      enabled: true,
      // TODO: Set to true once RESEND_API_KEY is configured in Convex
      // pnpm convex env set RESEND_API_KEY your-api-key
      requireEmailVerification: false,
      sendResetPassword: async ({ user, url }) => {
        await sendResetPassword(requireMutationCtx(ctx) as any, {
          to: user.email,
          url,
        });
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
      // Store company name for tenant creation
      additionalFields: {
        companyName: {
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
          await sendMagicLink(requireMutationCtx(ctx) as any, {
            to: email,
            url,
          });
        },
      }),
      emailOTP({
        async sendVerificationOTP({ email, otp }) {
          await sendOTPVerification(requireMutationCtx(ctx) as any, {
            to: email,
            code: otp,
          });
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
              // Use the new syncUserCreation with tenant creation
              // Pass authId to link Better Auth user to app user record
              await ctx.runMutation(internal.users.syncUserCreation, {
                email: user.email,
                name: user.name || undefined,
                companyName: (user as any).companyName || undefined,
                authId: user.id, // Better Auth's unique user identifier
              });
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
