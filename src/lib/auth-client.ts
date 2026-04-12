import {
  twoFactorClient,
  magicLinkClient,
  emailOTPClient,
  genericOAuthClient,
  anonymousClient,
  inferAdditionalFields,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { convexClient } from "@convex-dev/better-auth/client/plugins";
import type { authWithoutCtx } from "@/lib/auth";

// Keep twoFactorClient import available for conditional use above
void twoFactorClient;

export const authClient = createAuthClient({
  plugins: [
    inferAdditionalFields<typeof authWithoutCtx>(),
    anonymousClient(),
    magicLinkClient(),
    emailOTPClient(),
    // Only include twoFactor client plugin when enabled
    ...(process.env.NEXT_PUBLIC_TWO_FACTOR_ENABLED === "true"
      ? [twoFactorClient()]
      : []),
    genericOAuthClient(),
    convexClient(),
  ],
});
