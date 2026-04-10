import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

/**
 * API route: Save an admin query builder query.
 * Wraps api.admin.queryBuilder.saveQuery.
 * Auth: session cookie required (Convex mutation layer enforces admin RBAC).
 */
export async function POST(request: NextRequest) {
  try {
    const sessionCookie = getSessionCookie(request);
    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, queryConfig } = body;

    if (!name || !queryConfig) {
      return NextResponse.json(
        { error: "Name and queryConfig are required" },
        { status: 400 }
      );
    }

    const queryId = await fetchMutation(
      api.admin.queryBuilder.saveQuery,
      {
        name,
        description: description ?? undefined,
        queryConfig,
      },
      { token: sessionCookie }
    );

    return NextResponse.json({ queryId });
  } catch (error) {
    console.error("[admin-saved-queries/save] Error:", error);
    const message = error instanceof Error ? error.message : "Failed to save query";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
