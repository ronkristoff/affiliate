import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";
import { NextRequest, NextResponse } from "next/server";

const { handler } = convexBetterAuthNextJs({
  convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL!,
  convexSiteUrl: process.env.NEXT_PUBLIC_CONVEX_SITE_URL!,
});

/**
 * Sign-out interceptor.
 *
 * The Convex site's sign-out handler can fail with
 * "Unexpected end of JSON input" when the request body is empty
 * (known issue with the @convex-dev/better-auth proxy layer).
 *
 * Instead of relying on the proxied Convex response to clear cookies,
 * we clear all Better Auth cookies directly in the Next.js response.
 * The server-side session is still invalidated by Better Auth's
 * session token validation on the next request.
 */
function clearAuthCookies(response: NextResponse) {
  const cookieOptions = {
    path: "/",
    maxAge: 0,
    // Match the Secure flag that was used to set the cookies
    secure: process.env.NODE_ENV === "production",
  };

  response.cookies.set("better-auth.session_token", "", cookieOptions);
  response.cookies.set("better-auth.session_data", "", cookieOptions);
  response.cookies.set(
    "__Secure-better-auth.session_token",
    "",
    { ...cookieOptions, secure: true },
  );
  response.cookies.set(
    "__Secure-better-auth.session_data",
    "",
    { ...cookieOptions, secure: true },
  );
  // Convex JWT managed by the ConvexBetterAuthProvider
  response.cookies.set(
    "__Secure-better-auth.convex_jwt",
    "",
    { ...cookieOptions, secure: true },
  );
  response.cookies.set(
    "better-auth.convex_jwt",
    "",
    cookieOptions,
  );
}

export async function GET(request: NextRequest) {
  // Let sign-out pass through so the session is invalidated server-side,
  // but override the response to ensure cookies are cleared.
  const response = await handler.GET(request);
  if (request.nextUrl.pathname === "/api/auth/sign-out") {
    const wrapped = NextResponse.json({}, { status: 200 });
    clearAuthCookies(wrapped);
    return wrapped;
  }
  return response;
}

export async function POST(request: NextRequest) {
  // Intercept sign-out — clear cookies directly instead of proxying
  // to the Convex site (which can fail with JSON parse errors).
  if (request.nextUrl.pathname === "/api/auth/sign-out") {
    // Still forward to Convex to invalidate the server-side session
    // (best-effort — don't let its failure block cookie clearing).
    try {
      await handler.POST(request);
    } catch {
      // Convex site may return 500 — that's fine, we clear cookies below.
    }
    const response = NextResponse.json({}, { status: 200 });
    clearAuthCookies(response);
    return response;
  }
  return handler.POST(request);
}
