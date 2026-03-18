import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { fetchAction } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

// Export affiliate performance data as CSV
export async function POST(request: NextRequest) {
  try {
    // Get session token from request
    const sessionCookie = getSessionCookie(request);
    
    if (!sessionCookie) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { tenantId, dateRange, campaignId } = body;

    if (!tenantId) {
      return NextResponse.json(
        { error: "Tenant ID is required" },
        { status: 400 }
      );
    }

    // Call the Convex action
    const base64Data = await fetchAction(
      api.reports.exportAffiliatePerformanceCSV,
      {
        tenantId,
        dateRange,
        campaignId,
      },
      { token: sessionCookie }
    );

    return new NextResponse(base64Data, {
      status: 200,
      headers: {
        "Content-Type": "text/plain",
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: "Export failed" },
      { status: 500 }
    );
  }
}
