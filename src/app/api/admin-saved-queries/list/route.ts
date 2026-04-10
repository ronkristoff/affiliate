import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

/**
 * API route: List admin saved queries.
 * Wraps api.admin.queryBuilder.listSavedQueries.
 * Auth: session cookie required (Convex query layer enforces admin RBAC).
 *
 * NOTE: The admin QB page currently uses useQuery(api.admin.queryBuilder.listSavedQueries)
 * directly for real-time reactivity. This route exists as a fallback for scenarios
 * where fetch-based access is needed (e.g., server components or non-Convex contexts).
 */
export async function GET(request: NextRequest) {
  try {
    const sessionCookie = getSessionCookie(request);
    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const queries = await fetchQuery(
      api.admin.queryBuilder.listSavedQueries,
      {},
      { token: sessionCookie }
    );

    return NextResponse.json(queries);
  } catch (error) {
    console.error("[admin-saved-queries/list] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to list queries";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
