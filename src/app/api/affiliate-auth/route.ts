import { NextRequest, NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import { convexServer } from "@/lib/convex-server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...data } = body;

    if (action === "login") {
      // Call the login mutation
      const result = await convexServer.mutation(api.affiliateAuth.loginAffiliate, {
        tenantSlug: data.tenantSlug,
        email: data.email,
        password: data.password,
      });

      if (!result.success || !result.session) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 401 }
        );
      }

      // Create response with httpOnly cookie
      const response = NextResponse.json({
        success: true,
        session: {
          affiliateId: result.session.affiliateId,
          tenantId: result.session.tenantId,
          email: result.session.email,
          name: result.session.name,
          uniqueCode: result.session.uniqueCode,
          status: result.session.status,
        },
      });

      // Set httpOnly cookie with session token
      response.cookies.set("affiliate_session", result.session.sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60, // 7 days
      });

      return response;
    }

    if (action === "logout") {
      const sessionToken = request.cookies.get("affiliate_session")?.value;

      if (sessionToken) {
        await convexServer.mutation(api.affiliateAuth.logoutAffiliate, {
          sessionToken,
        });
      }

      const response = NextResponse.json({ success: true });
      
      // Clear the cookie
      response.cookies.set("affiliate_session", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });

      return response;
    }

    return NextResponse.json(
      { success: false, error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Affiliate auth error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
