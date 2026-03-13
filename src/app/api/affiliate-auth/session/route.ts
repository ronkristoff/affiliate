import { NextRequest, NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import { convexServer } from "@/lib/convex-server";

export async function GET(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get("affiliate_session")?.value;

    if (!sessionToken) {
      return NextResponse.json({ session: null });
    }

    // Validate session token via Convex query
    const session = await convexServer.query(api.affiliateAuth.validateAffiliateSession, {
      sessionToken,
    });

    if (!session) {
      return NextResponse.json({ session: null });
    }

    // Return session data (without the token)
    return NextResponse.json({
      session: {
        affiliateId: session.affiliateId,
        tenantId: session.tenantId,
        email: session.email,
        name: session.name,
        uniqueCode: session.uniqueCode,
        status: session.status,
      },
    });
  } catch (error) {
    console.error("Session fetch error:", error);
    return NextResponse.json({ session: null });
  }
}
