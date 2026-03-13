"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lockoutEndTime, setLockoutEndTime] = useState<number | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number>(5);

  // Check rate limit status
  const rateLimitStatus = useQuery(
    api.rateLimit.checkRateLimit,
    email ? { email } : "skip"
  );

  // Record failed attempt mutation
  const recordFailedAttempt = useMutation(api.rateLimit.recordFailedAttempt);
  
  // Clear failed attempts mutation
  const clearFailedAttempts = useMutation(api.rateLimit.clearFailedAttempts);

  // Update rate limit state when query result changes
  useEffect(() => {
    if (rateLimitStatus) {
      if (rateLimitStatus.isLocked && rateLimitStatus.lockedUntil) {
        setLockoutEndTime(rateLimitStatus.lockedUntil);
        setRemainingAttempts(0);
      } else {
        setLockoutEndTime(null);
        setRemainingAttempts(rateLimitStatus.remainingAttempts);
      }
    }
  }, [rateLimitStatus]);

  // Countdown timer for lockout
  useEffect(() => {
    if (!lockoutEndTime) return;

    const interval = setInterval(() => {
      const now = Date.now();
      if (now >= lockoutEndTime) {
        setLockoutEndTime(null);
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lockoutEndTime]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Check if currently locked out
    if (lockoutEndTime) {
      const remainingSeconds = Math.ceil((lockoutEndTime - Date.now()) / 1000);
      setError(`Too many failed attempts. Please try again in ${Math.floor(remainingSeconds / 60)} minutes ${remainingSeconds % 60} seconds.`);
      return;
    }

    setLoading(true);

    // Capture IP address for security audit
    let ipAddress: string | undefined;
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      ipAddress = data.ip;
    } catch {
      // IP detection failed, continue without it
      ipAddress = undefined;
    }

    try {
      const { data, error: authError } = await authClient.signIn.email(
        {
          email,
          password,
          rememberMe,
        },
        {
          onRequest: () => {
            setLoading(true);
          },
          onSuccess: async (ctx) => {
            setLoading(false);
            // Clear failed attempts on successful login
            await clearFailedAttempts({ email });
            if (ctx.data.twoFactorRedirect) {
              router.push("/verify-2fa");
            } else {
              router.push("/dashboard");
            }
          },
          onError: async (ctx) => {
            setLoading(false);
            // Record failed attempt with IP
            const result = await recordFailedAttempt({ email, ipAddress });
            if (result.isLocked) {
              setLockoutEndTime(result.lockedUntil ?? null);
              setError("Too many failed login attempts. Your account has been temporarily locked for 15 minutes.");
            } else {
              setError(ctx.error.message || "Authentication failed");
              setRemainingAttempts(result.remainingAttempts);
            }
          },
        }
      );

      if (authError) {
        setError(authError.message || "Authentication failed");
      }
    } catch (err) {
      setLoading(false);
      setError("An unexpected error occurred");
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Please enter your email address first");
      return;
    }
    try {
      await authClient.forgetPassword.emailOtp({
        email,
      });
      alert("Check your email for the reset password link!");
    } catch {
      alert("Failed to send reset password link. Please try again.");
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left Panel - Brand */}
      <div className="hidden lg:flex lg:w-[480px] lg:flex-col lg:justify-between lg:p-12 bg-[#022232] relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute top-[-120px] right-[-120px] w-[400px] h-[400px] rounded-full bg-[radial-gradient(circle,rgba(22,89,214,0.25)_0%,transparent_70%)] pointer-events-none" />
        <div className="absolute bottom-[-80px] left-[-80px] w-[320px] h-[320px] rounded-full bg-[radial-gradient(circle,rgba(16,64,154,0.3)_0%,transparent_70%)] pointer-events-none" />

        {/* Logo */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-10 h-10 bg-[#10409a] rounded-[10px] flex items-center justify-center shadow-[0_4px_16px_rgba(16,64,154,0.5)]">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-[22px] h-[22px] text-white"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="text-xl font-extrabold text-white tracking-tight">salig-affiliate</span>
        </div>

        {/* Hero */}
        <div className="flex flex-col justify-center relative z-10 py-8">
          <h1 className="font-[family-name:var(--font-passion)] text-[42px] font-bold text-white leading-[1.1] tracking-tight mb-5">
            Your affiliate<br />program,<br /><span className="text-[#7dd3fc]">on autopilot.</span>
          </h1>
          <p className="text-[15px] text-white/65 leading-relaxed max-w-[340px]">
            Commission tracking, payout management, and a branded affiliate portal — all natively
            integrated with SaligPay.
          </p>
        </div>

        {/* Stats */}
        <div className="flex flex-col gap-3.5 relative z-10">
          <div className="flex items-center gap-3.5 bg-white/7 border border-white/10 rounded-xl p-3.5">
            <div className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-[18px] h-[18px] text-[#7dd3fc]"
              >
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                <polyline points="17 6 23 6 23 12" />
              </svg>
            </div>
            <div>
              <div className="text-[11px] text-white/50 font-medium uppercase tracking-wider">Commissions tracked</div>
              <div className="text-sm text-white font-semibold mt-px">Zero-latency SaligPay integration</div>
            </div>
          </div>
          <div className="flex items-center gap-3.5 bg-white/7 border border-white/10 rounded-xl p-3.5">
            <div className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-[18px] h-[18px] text-[#7dd3fc]"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
            </div>
            <div>
              <div className="text-[11px] text-white/50 font-medium uppercase tracking-wider">Setup time</div>
              <div className="text-sm text-white font-semibold mt-px">First campaign live in under 15 minutes</div>
            </div>
          </div>
          <div className="flex items-center gap-3.5 bg-white/7 border border-white/10 rounded-xl p-3.5">
            <div className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-[18px] h-[18px] text-[#7dd3fc]"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div>
              <div className="text-[11px] text-white/50 font-medium uppercase tracking-wider">White-labeled portal</div>
              <div className="text-sm text-white font-semibold mt-px">Your brand. Your affiliates. Zero salig marks.</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white">
        <div className="w-full max-w-[400px]">
          {/* Header */}
          <div className="mb-9">
            <h2 className="text-[26px] font-bold text-[#333] tracking-tight mb-2">Welcome back</h2>
            <p className="text-sm text-[#6b7280] leading-relaxed">
              Sign in to your salig-affiliate account. New here?{" "}
              <Link href="/sign-up" className="text-[#10409a] font-semibold no-underline hover:underline">
                Start your free 14-day trial →
              </Link>
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl p-3 mb-5">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-4 h-4 text-red-500 flex-shrink-0 mt-px"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <div className="text-[13px] text-red-800 leading-relaxed">
                {error}
                {!lockoutEndTime && remainingAttempts < 5 && remainingAttempts > 0 && (
                  <span className="block mt-1 text-[12px]">
                    You have {remainingAttempts} attempt{remainingAttempts !== 1 ? "s" : ""} remaining before your account is locked.
                  </span>
                )}
                {lockoutEndTime && (
                  <button
                    type="button"
                    onClick={() => {
                      // Let user retry after cooldown
                    }}
                    className="text-red-800 font-semibold bg-transparent border-none cursor-pointer ml-1"
                  >
                    Try again later
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSignIn}>
            {/* Email */}
            <div className="mb-[18px]">
              <label htmlFor="email" className="text-[13px] font-semibold text-[#333] block mb-1.5">
                Email address
              </label>
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b7280]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-11 border border-[#e5e7eb] rounded-lg pl-10 pr-3 text-sm text-[#333] bg-white focus:border-[#10409a] focus:shadow-[0_0_0_3px_rgba(16,64,154,0.1)] focus:outline-none transition-all"
                  placeholder="alex@yourcompany.com"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="mb-[18px]">
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="text-[13px] font-semibold text-[#333]">
                  Password
                </label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-[12px] text-[#10409a] font-medium no-underline hover:underline bg-transparent border-none cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b7280]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-11 border border-[#e5e7eb] rounded-lg pl-10 pr-10 text-sm text-[#333] bg-white focus:border-[#10409a] focus:shadow-[0_0_0_3px_rgba(16,64,154,0.1)] focus:outline-none transition-all"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer p-1 text-[#6b7280] hover:text-[#474747]"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-4 h-4"
                    >
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-4 h-4"
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center gap-2.5 mb-6">
              <input
                type="checkbox"
                id="remember"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 accent-[#10409a] cursor-pointer flex-shrink-0"
              />
              <label htmlFor="remember" className="text-[13px] text-[#6b7280] cursor-pointer">
                Keep me signed in for 30 days
              </label>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-[46px] bg-[#10409a] text-white text-sm font-semibold rounded-lg cursor-pointer transition-all hover:bg-[#1659d6] hover:shadow-[0_4px_14px_rgba(16,64,154,0.3)] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/35 border-t-white rounded-full animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign in to dashboard"
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3.5 my-6">
            <div className="flex-1 h-px bg-[#e5e7eb]" />
            <span className="text-[12px] text-[#6b7280] whitespace-nowrap">or</span>
            <div className="flex-1 h-px bg-[#e5e7eb]" />
          </div>

          {/* Footer */}
          <div className="text-center pt-6 border-t border-[#e5e7eb]">
            <p className="text-[13px] text-[#6b7280]">
              Don&apos;t have an account?{" "}
              <Link href="/sign-up" className="text-[#10409a] font-semibold no-underline hover:underline">
                Start free trial — no credit card required
              </Link>
            </p>
          </div>

          {/* Terms */}
          <p className="text-[11px] text-[#6b7280] text-center mt-4 leading-relaxed">
            By signing in, you agree to our{" "}
            <a href="#" className="text-[#10409a] no-underline hover:underline">Terms of Service</a> and{" "}
            <a href="#" className="text-[#10409a] no-underline hover:underline">Privacy Policy</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
