import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

/**
 * API route: Delete an admin saved query.
 * Wraps api.admin.queryBuilder.deleteSavedQuery.
 * Auth: session cookie required (Convex mutation layer enforces admin RBAC + ownership check).
 */
export async function POST(request: NextRequest) {
  try {
    const sessionCookie = getSessionCookie(request);
    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { queryId } = body;

    if (!queryId) {
      return NextResponse.json(
        { error: "queryId is required" },
        { status: 400 }
      );
    }

    await fetchMutation(
      api.admin.queryBuilder.deleteSavedQuery,
      { queryId },
      { token: sessionCookie }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin-saved-queries/delete] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to delete query";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
