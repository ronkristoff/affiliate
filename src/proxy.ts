import { isAuthenticated as checkIsAuthenticated } from "@/lib/auth-server";
import { NextRequest, NextResponse } from "next/server";

// Public routes that don't require authentication (SaaS Owner)
const publicRoutes = [
  "/sign-in",
  "/sign-up",
  "/verify-2fa",
  "/reset-password",
  "/forgot-password",
];

// Webhook routes - must be publicly accessible
const webhookRoutes = [
  "/api/webhooks/",
  "/api/stripe/",
];

// Marketing/public pages
const marketingRoutes = ["/", "/about", "/pricing", "/features"];

// Affiliate portal routes (public - login/register)
const affiliatePublicRoutes = [
  "/portal/login",
  "/portal/register",
  "/portal/forgot-password",
  "/portal/reset-password",
];

// Platform admin routes (require owner session + admin role)
const adminRoutes = ["/tenants", "/tiers", "/revenue", "/audit", "/admin-settings", "/query-builder", "/cron-jobs", "/user-timeline"];

// Affiliate portal protected routes
const affiliateProtectedRoutes = [
  "/portal/home",
  "/portal/earnings",
  "/portal/links",
  "/portal/account",
  "/portal/assets",
];

/**
 * Check if the pathname matches an affiliate route pattern.
 */
function isAffiliateRoute(pathname: string): boolean {
  return pathname.startsWith("/portal/");
}

/**
 * Route protection middleware for both SaaS Owner and Affiliate authentication.
 * 
 * - (auth)/* routes: Require SaaS Owner authentication
 * - (unauth)/* routes: Accessible to unauthenticated users only
 * - /portal/* routes: Affiliate portal routes with separate authentication
 * - Public routes: Accessible to everyone
 * 
 * Multi-tenant isolation is enforced at the Convex layer, not in middleware.
 */
export default async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // ALLOW WEBHOOK ROUTES FIRST - before any auth checks
  // Webhook routes must be publicly accessible (Stripe, SaligPay)
  const isWebhookRoute = webhookRoutes.some(route => pathname.startsWith(route));
  if (isWebhookRoute) {
    return NextResponse.next();
  }

  // Both owners and affiliates authenticate through Better Auth.
  // Role-based access (owner vs affiliate) is enforced at the Convex layer.
  const isAuthed = await checkIsAuthenticated();

  // Check if route is admin (platform admin)
  const isAdminRoute = adminRoutes.some(route => pathname.startsWith(route));

  // Check if route is public (SaaS Owner)
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));
  const isMarketingRoute = marketingRoutes.includes(pathname);

  // Check if route is affiliate-related
  const isAffiliatePublicRoute = affiliatePublicRoutes.some(route => pathname === route || pathname.startsWith(route));
  const isAffiliateProtectedRoute = affiliateProtectedRoutes.some(route => pathname.startsWith(route));
  const isAffiliatePath = isAffiliateRoute(pathname);

  // Clean up legacy affiliate_session cookie from browsers
  if (isAffiliatePath) {
    const affiliateSessionCookie = request.cookies.get("affiliate_session");
    if (affiliateSessionCookie) {
      const response = isAuthed ? NextResponse.next() : NextResponse.redirect(
        new URL("/portal/login", request.url)
      );
      response.cookies.set("affiliate_session", "", {
        path: "/",
        maxAge: 0,
      });
      return response;
    }
  }

  // Handle admin routes — require authentication; role verified at Convex layer
  if (isAdminRoute) {
    if (!isAuthed) {
      const signInUrl = new URL("/sign-in", request.url);
      signInUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(signInUrl);
    }
    return NextResponse.next();
  }

  // Handle affiliate routes
  if (isAffiliatePath) {
    // Affiliate public routes (login, register)
    if (isAffiliatePublicRoute) {
      return NextResponse.next();
    }

    // Affiliate protected routes
    if (isAffiliateProtectedRoute || (isAffiliatePath && !isAffiliatePublicRoute)) {
      // Require authentication (role verified at Convex layer)
      if (!isAuthed) {
        const loginUrl = new URL("/portal/login", request.url);
        loginUrl.searchParams.set("callbackUrl", pathname);
        return NextResponse.redirect(loginUrl);
      }
      return NextResponse.next();
    }
  }

  // Allow public and marketing routes
  if (isPublicRoute || isMarketingRoute) {
    // If authenticated and trying to access auth pages, redirect to dashboard
    // Exception: /verify-2fa must remain accessible for authenticated users
    // who need to complete OTP verification.
    const isVerify2fa = pathname.startsWith("/verify-2fa");
    if (isAuthed && !isVerify2fa && publicRoutes.some(route => pathname.startsWith(route))) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  // Protected routes require authentication
  if (!isAuthed) {
    // Store the intended URL to redirect back after login
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  // SaaS Owner is authenticated, allow access to protected routes
  // Tenant context loading and RBAC is handled at the Convex layer
  return NextResponse.next();
}

export const config = {
  // Run middleware on all routes
  matcher: [
    "/(.*)",
  ],
};
