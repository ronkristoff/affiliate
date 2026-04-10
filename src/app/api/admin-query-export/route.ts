import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { fetchAction } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

/**
 * API route: Export admin query builder results as CSV.
 * Wraps api.admin.queryBuilderExport.exportAdminQueryBuilderCSV (Node.js action).
 * Auth: session cookie required (action enforces admin RBAC + audit logging).
 */
export async function POST(request: NextRequest) {
  try {
    const sessionCookie = getSessionCookie(request);
    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { columns, rows, queryInfo } = body;

    if (!columns || !Array.isArray(columns) || !rows || !Array.isArray(rows)) {
      return NextResponse.json(
        { error: "columns and rows arrays are required" },
        { status: 400 }
      );
    }

    const result = await fetchAction(
      api.admin.queryBuilderExport.exportAdminQueryBuilderCSV,
      {
        columns,
        rows,
        queryInfo: queryInfo ?? undefined,
      },
      { token: sessionCookie }
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("[admin-query-export] Error:", error);
    const message = error instanceof Error ? error.message : "Export failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
