/**
 * Thin type re-export file for src/ consumers.
 *
 * The createAuth factory and betterAuthComponent now live in
 * convex/auth.ts — this file exists only to bridge the Convex/Next.js
 * boundary for TypeScript types that client code needs.
 */

export type { authWithoutCtx } from "../../convex/auth";
