import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { fetchQuery } from "convex/nextjs";
import { api, internal } from "@/convex/_generated/api";
import { paginationOptsValidator } from "convex/server";

/**
 * API route: Execute an admin query builder query.
 * Wraps api.admin.queryBuilder.executeQuery for client-side fetch() calls.
 * Auth: session cookie required (Convex query layer enforces admin RBAC).
 */
export async function POST(request: NextRequest) {
  try {
    const sessionCookie = getSessionCookie(request);
    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Build paginationOpts from body (or use defaults)
    const paginationOpts = {
      numItems: body.rowLimit ?? 100,
      cursor: null as string | null,
    };

    const result = await fetchQuery(
      api.admin.queryBuilder.executeQuery,
      {
        tables: body.tables ?? [],
        columns: body.columns ?? [],
        filters: body.filters,
        filterLogic: body.filterLogic,
        joins: body.joins,
        aggregations: body.aggregations,
        groupBy: body.groupBy,
        dateRange: body.dateRange,
        rowLimit: body.rowLimit,
        paginationOpts,
      },
      { token: sessionCookie }
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("[admin-query-execute] Error:", error);
    const message = error instanceof Error ? error.message : "Query execution failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
