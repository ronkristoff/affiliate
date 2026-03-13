/**
 * Affiliate Authentication Client
 * 
 * This module provides authentication for the affiliate portal.
 * Affiliates use a separate authentication context from SaaS Owners.
 * 
 * Key differences from SaaS Owner auth:
 * - Affiliates authenticate against the `affiliates` table, not `users`
 * - Sessions are stored separately with a different cookie name
 * - Affiliates can only access affiliate portal routes, not owner dashboard
 */

import { useState, useEffect, useCallback } from "react";

// Session storage key for affiliate auth
const AFFILIATE_SESSION_KEY = "affiliate_session";

// Session data structure
export interface AffiliateSession {
  affiliateId: string;
  tenantId: string;
  email: string;
  name: string;
  uniqueCode: string;
  status: string;
}

// Registration data
export interface AffiliateRegistrationData {
  tenantId: string;
  email: string;
  name: string;
  password: string;
  confirmPassword: string;
}

// Login data
export interface AffiliateLoginData {
  tenantId: string;
  email: string;
  password: string;
}

/**
 * Hash password using SHA-256.
 * In production, use a proper password hashing library on the server side.
 * This is a client-side hash for transport; server should re-hash.
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Get the current affiliate session from localStorage.
 * Note: In production, this should use httpOnly cookies set by the server.
 */
export function getAffiliateSession(): AffiliateSession | null {
  if (typeof window === "undefined") {
    return null;
  }
  
  const sessionJson = localStorage.getItem(AFFILIATE_SESSION_KEY);
  if (!sessionJson) {
    return null;
  }
  
  try {
    return JSON.parse(sessionJson) as AffiliateSession;
  } catch {
    localStorage.removeItem(AFFILIATE_SESSION_KEY);
    return null;
  }
}

/**
 * Save affiliate session to localStorage.
 */
export function setAffiliateSession(session: AffiliateSession): void {
  localStorage.setItem(AFFILIATE_SESSION_KEY, JSON.stringify(session));
}

/**
 * Clear affiliate session from localStorage.
 */
export function clearAffiliateSession(): void {
  localStorage.removeItem(AFFILIATE_SESSION_KEY);
}

/**
 * React hook for affiliate authentication.
 */
export function useAffiliateAuth() {
  const [session, setSession] = useState<AffiliateSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load session on mount
  useEffect(() => {
    const storedSession = getAffiliateSession();
    setSession(storedSession);
    setIsLoading(false);
  }, []);

  // Login function
  const login = useCallback(async (data: AffiliateLoginData): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      // Hash password for transport
      const passwordHash = await hashPassword(data.password);
      
      // The actual authentication will be handled by the login page via Convex
      // This hook provides session management, not direct authentication
      
      return { success: false, error: "Use the login page for authentication" };
    } catch (error) {
      return { success: false, error: "An unexpected error occurred" };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Logout function
  const logout = useCallback(async () => {
    clearAffiliateSession();
    setSession(null);
  }, []);

  // Check if affiliate is authenticated
  const isAuthenticated = session !== null && session.status === "active";

  // Check if affiliate is pending approval
  const isPending = session !== null && session.status === "pending";

  return {
    session,
    isLoading,
    isAuthenticated,
    isPending,
    login,
    logout,
  };
}

/**
 * Check if current route is an affiliate portal route.
 */
export function isAffiliateRoute(pathname: string): boolean {
  return pathname.startsWith("/portal/");
}

/**
 * Check if current route is an auth route for affiliates.
 */
export function isAffiliateAuthRoute(pathname: string): boolean {
  return pathname === "/portal/login" || pathname === "/portal/register";
}