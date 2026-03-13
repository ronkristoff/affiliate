import { ConvexHttpClient } from "convex/browser";

// Create a server-side Convex client for API routes
// This should only be used in server contexts (API routes, Server Actions)
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || "http://localhost:3000";

if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
  console.warn("NEXT_PUBLIC_CONVEX_URL not set, using default:", convexUrl);
}

export const convexServer = new ConvexHttpClient(convexUrl);
