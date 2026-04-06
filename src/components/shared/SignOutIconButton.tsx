"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { authClient } from "@/lib/auth-client";

/**
 * Compact sign-out button used in dark sidebars.
 *
 * Features:
 * - LogOut icon with hover rotation micro-animation
 * - Loading / disabled state while signing out
 * - Consistent styling across SaaS Owner and Platform Admin sidebars
 */
export function SignOutIconButton({
  onSignOut,
}: {
  /** Optional callback fired after the auth sign-out succeeds. */
  onSignOut?: () => void;
}) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = useCallback(async () => {
    setIsSigningOut(true);
    try {
      await authClient.signOut();
      onSignOut?.();
      router.push("/sign-in");
      router.refresh();
    } catch (error) {
      console.error("Sign out failed:", error);
    } finally {
      setIsSigningOut(false);
    }
  }, [router, onSignOut]);

  return (
    <button
      onClick={handleSignOut}
      disabled={isSigningOut}
      className="shrink-0 p-2 rounded-lg text-white/[0.3] hover:text-white hover:bg-white/[0.1] transition-all duration-150 disabled:opacity-50 group"
      title="Sign out"
    >
      <svg
        className="w-4 h-4 group-hover:rotate-12 transition-transform duration-200"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.75"
          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
        />
      </svg>
    </button>
  );
}
