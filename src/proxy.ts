/* eslint-disable @typescript-eslint/no-unused-vars */
import { getSessionCookie } from "better-auth/cookies";
import { createAuth } from "./lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { betterFetch } from "@better-fetch/fetch";

type Session = ReturnType<typeof createAuth>["$Infer"]["Session"];

const getSession = async (request: NextRequest) => {
  const { data: session } = await betterFetch<Session>(
    "/api/auth/get-session",
    {
      baseURL: request.nextUrl.origin,
      headers: {
        cookie: request.headers.get("cookie") ?? "",
        origin: request.nextUrl.origin,
      },
    },
  );
  return session;
};

// Public routes that don't require authentication (SaaS Owner)
const publicRoutes = [
  "/sign-in",
  "/sign-up",
  "/verify-2fa",
  "/reset-password",
  "/forgot-password",
];

// Marketing/public pages
const marketingRoutes = ["/", "/about", "/pricing", "/features"];

// Affiliate portal routes (public - login/register)
const affiliatePublicRoutes = [
  "/portal/login",
  "/portal/register",
  "/portal/forgot-password",
];

// Platform admin routes (require owner session + admin role)
const adminRoutes = ["/tenants", "/tiers", "/revenue", "/audit", "/health", "/admin-settings"];

// Affiliate portal protected routes
const affiliateProtectedRoutes = [
  "/portal/home",
  "/portal/earnings",
  "/portal/links",
  "/portal/account",
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
  const ownerSessionCookie = getSessionCookie(request);
  const pathname = request.nextUrl.pathname;
  
  // Both owners and affiliates authenticate through Better Auth now.
  // Role-based access (owner vs affiliate) is enforced at the Convex layer.
  // The proxy only needs to know whether ANY valid session exists.
  const isAuthenticated = !!ownerSessionCookie;

  // Check if route is admin (platform admin)
  const isAdminRoute = adminRoutes.some(route => pathname.startsWith(route));

  // Check if route is public (SaaS Owner)
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));
  const isMarketingRoute = marketingRoutes.includes(pathname);
  
  // Check if route is affiliate-related
  const isAffiliatePublicRoute = affiliatePublicRoutes.some(route => pathname === route || pathname.startsWith(route));
  const isAffiliateProtectedRoute = affiliateProtectedRoutes.some(route => pathname.startsWith(route));
  const isAffiliatePath = isAffiliateRoute(pathname);

  // Handle admin routes — require authentication; role verified at Convex layer
  if (isAdminRoute) {
    if (!isAuthenticated) {
      const signInUrl = new URL("/sign-in", request.url);
      signInUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(signInUrl);
    }
    return NextResponse.next();
  }

  // Handle affiliate routes
  if (isAffiliatePath) {
    // Affiliate public routes (login, register)
    // Don't auto-redirect authenticated users away — we can't distinguish
    // owner vs affiliate from cookies alone. The client-side components
    // (ResolvePortalTenant, getCurrentAffiliate) handle that.
    if (isAffiliatePublicRoute) {
      return NextResponse.next();
    }
    
    // Affiliate protected routes
    if (isAffiliateProtectedRoute || (isAffiliatePath && !isAffiliatePublicRoute)) {
      // Require authentication (role verified at Convex layer)
      if (!isAuthenticated) {
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
    if (isAuthenticated && publicRoutes.some(route => pathname.startsWith(route))) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  // Protected routes require authentication
  if (!isAuthenticated) {
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
  // Run middleware on all routes except static assets and api routes
  matcher: ["/((?!.*\\..*|_next|api/auth).*)", "/", "/trpc(.*)"],
};