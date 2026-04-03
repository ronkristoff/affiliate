"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState, useEffect } from "react";
import { authClient } from "@/lib/auth-client";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { ConvexHttpClient } from "convex/browser";
import { Logo } from "@/components/shared/Logo";
import { SidebarNetwork } from "@/components/shared/SidebarNetwork";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";

const signInSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Enter a valid email address like name@company.com"),
  password: z.string().min(1, "Password is required"),
});

const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Enter a valid email address like name@company.com"),
});

type SignInFormValues = z.infer<typeof signInSchema>;
type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export default function SignIn() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lockoutEndTime, setLockoutEndTime] = useState<number | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number>(5);

  const form = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
    mode: "onBlur",
  });

  // Forgot password modal state
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState(false);

  const forgotPasswordForm = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
    mode: "onBlur",
  });

  const email = form.watch("email");

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

  const onSubmit = async (values: SignInFormValues) => {
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
          email: values.email,
          password: values.password,
        },
        {
          onRequest: () => {
            setLoading(true);
          },
          onSuccess: async (ctx) => {
            setLoading(false);
            // Clear failed attempts on successful login
            await clearFailedAttempts({ email: values.email });
            if (ctx.data.twoFactorRedirect) {
              router.push("/verify-2fa");
            } else {
              // If callbackUrl is present, use it (e.g. /tenants when admin accessed it directly)
              if (callbackUrl) {
                router.push(callbackUrl);
                return;
              }
              // Determine user type to route to the correct dashboard
              const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || window.location.origin;
              const convex = new ConvexHttpClient(convexUrl);
              try {
                const userType = await convex.query(api.auth.getUserTypeByEmail, {
                  email: values.email,
                });
                if (userType?.type === "affiliate") {
                  // Affiliate users belong in the affiliate portal
                  router.push(`/portal/login?tenant=${userType.tenantSlug}`);
                  return;
                }
                if (userType?.type === "owner") {
                  // Check if owner is a platform admin — redirect to /tenants
                  const userRole = await convex.query(api.auth.getUserRole, {});
                  if (userRole?.role === "admin") {
                    router.push("/tenants");
                    return;
                  }
                }
              } catch (e) {
                console.error("Failed to determine user type:", e);
              }
              router.push("/dashboard");
            }
          },
          onError: async (ctx) => {
            setLoading(false);
            // Record failed attempt with IP
            const result = await recordFailedAttempt({ email: values.email, ipAddress });
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

  const handleForgotPassword = async (values: ForgotPasswordFormValues) => {
    setForgotPasswordLoading(true);

    try {
      const { error } = await authClient.forgetPassword.emailOtp({
        email: values.email,
      });

      if (error) {
        toast.error("Failed to send reset link", {
          description: error.message || "Please try again later.",
        });
        return;
      }

      setForgotPasswordSuccess(true);
      toast.success("Reset link sent!", {
        description: "Check your email for the password reset instructions.",
      });
    } catch (err) {
      toast.error("An unexpected error occurred", {
        description: "Failed to send reset password link. Please try again.",
      });
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  const openForgotPasswordModal = () => {
    // Pre-fill email from sign-in form if available
    const currentEmail = form.getValues("email");
    if (currentEmail) {
      forgotPasswordForm.setValue("email", currentEmail);
    }
    setForgotPasswordSuccess(false);
    setIsForgotPasswordOpen(true);
  };

  const closeForgotPasswordModal = () => {
    setIsForgotPasswordOpen(false);
    setForgotPasswordSuccess(false);
    forgotPasswordForm.reset();
  };

  return (
    <div className="flex min-h-screen">
      {/* Left Panel - Brand */}
      <div className="hidden lg:flex lg:w-[480px] lg:flex-col lg:justify-between lg:p-12 bg-[#0e1333] relative overflow-hidden">
        {/* Animated Network Constellation */}
        <SidebarNetwork />

        {/* Subtle radial vignette for depth */}
        <div className="absolute top-[-120px] right-[-120px] w-[400px] h-[400px] rounded-full bg-[radial-gradient(circle,rgba(22,89,214,0.12)_0%,transparent_70%)] pointer-events-none" />

        {/* Logo */}
        <div className="relative z-10 sidebar-content-enter">
          <Logo href="/" variant="light" />
        </div>

        {/* Hero */}
        <div className="flex flex-col justify-center relative z-10 py-8 sidebar-enter-delay-1">
          <h1 className="font-[family-name:var(--font-passion)] text-[42px] font-bold text-white leading-[1.1] tracking-tight mb-5">
            Your affiliate<br />program,<br /><span className="text-[#1fb5a5]">on autopilot.</span>
          </h1>
          <p className="text-[15px] text-white/65 leading-relaxed max-w-[340px]">
            Commission tracking, payout management, and a branded affiliate portal — all natively
            integrated with SaligPay.
          </p>
        </div>

        {/* Stats */}
        <div className="flex flex-col gap-3.5 relative z-10 sidebar-enter-delay-2">
          <div className="flex items-center gap-3.5 bg-white/7 border border-white/10 rounded-xl p-3.5">
            <div className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0 icon-breathe">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-[18px] h-[18px] text-[#1fb5a5]"
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
            <div className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0 icon-breathe">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-[18px] h-[18px] text-[#1fb5a5]"
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
            <div className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0 icon-breathe">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-[18px] h-[18px] text-[#1fb5a5]"
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
              Sign in to your Affilio account. New here?{" "}
              <Link href="/sign-up" className="text-[#1c2260] font-semibold no-underline hover:underline">
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
                  <Button
                    type="button"
                    variant="link"
                    className="text-red-800 font-semibold no-underline h-auto p-0 ml-1"
                    onClick={() => {
                      // Let user retry after cooldown
                    }}
                  >
                    Try again later
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
              {/* Email */}
              <div className="mb-[18px]">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[13px] font-semibold text-[#333]">
                        Email address
                      </FormLabel>
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
                        <FormControl>
                          <Input
                            {...field}
                            type="email"
                            className="w-full h-11 border border-[#e5e7eb] rounded-lg pl-10 pr-3 text-sm text-[#333] bg-white focus:border-[#1c2260] focus:shadow-[0_0_0_3px_rgba(28,34,96,0.1)] focus:outline-none transition-all"
                            placeholder="alex@yourcompany.com"
                            autoComplete="email"
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Password */}
              <div className="mb-[18px]">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[13px] font-semibold text-[#333]">
                    Password
                  </label>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="text-[12px] h-auto p-0 text-[#1c2260] font-medium no-underline"
                    onClick={openForgotPasswordModal}
                  >
                    Forgot password?
                  </Button>
                </div>
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
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
                        <FormControl>
                          <Input
                            {...field}
                            type={showPassword ? "text" : "password"}
                            className="w-full h-11 border border-[#e5e7eb] rounded-lg pl-10 pr-10 text-sm text-[#333] bg-white focus:border-[#1c2260] focus:shadow-[0_0_0_3px_rgba(28,34,96,0.1)] focus:outline-none transition-all"
                            placeholder="Enter your password"
                            autoComplete="current-password"
                          />
                        </FormControl>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#6b7280] hover:text-[#474747] h-auto w-auto size-auto"
                          onClick={() => setShowPassword(!showPassword)}
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
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Submit */}
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-[46px] bg-[#1c2260] text-white text-sm font-semibold rounded-lg hover:bg-[#1fb5a5] hover:shadow-[0_4px_14px_rgba(28,34,96,0.3)] disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/35 border-t-white rounded-full animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign in to dashboard"
                )}
              </Button>
            </form>
          </Form>

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
              <Link href="/sign-up" className="text-[#1c2260] font-semibold no-underline hover:underline">
                Start free trial — no credit card required
              </Link>
            </p>
          </div>

          {/* Terms */}
          <p className="text-[11px] text-[#6b7280] text-center mt-4 leading-relaxed">
            By signing in, you agree to our{" "}
            <a href="#" className="text-[#1c2260] no-underline hover:underline">Terms of Service</a> and{" "}
            <a href="#" className="text-[#1c2260] no-underline hover:underline">Privacy Policy</a>.
          </p>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <Dialog open={isForgotPasswordOpen} onOpenChange={(open) => {
        if (!open) closeForgotPasswordModal();
      }}>
        <DialogContent className="sm:max-w-[440px] p-0 overflow-hidden" showCloseButton={false}>
          {/* Visual Header - Dark sidebar aesthetic with network animation */}
          <div className="relative bg-[#0e1333] px-5 pt-5 pb-4 overflow-hidden">
            {/* Animated Network Constellation - smaller */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              preserveAspectRatio="none"
              viewBox="0 0 440 140"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              {/* Connection Lines */}
              <line x1="50" y1="30" x2="120" y2="70" className="sidebar-network-lines" stroke="rgba(22,89,214,0.2)" strokeWidth="1" />
              <line x1="120" y1="70" x2="220" y2="40" className="sidebar-network-lines-slow" stroke="rgba(22,89,214,0.15)" strokeWidth="1" />
              <line x1="120" y1="70" x2="80" y2="110" className="sidebar-network-lines" stroke="rgba(22,89,214,0.18)" strokeWidth="1" />
              <line x1="220" y1="40" x2="300" y2="80" className="sidebar-network-lines-reverse" stroke="rgba(22,89,214,0.12)" strokeWidth="1" />
              <line x1="80" y1="110" x2="160" y2="100" className="sidebar-network-lines-slow" stroke="rgba(22,89,214,0.14)" strokeWidth="1" />
              <line x1="300" y1="80" x2="260" y2="120" className="sidebar-network-lines" stroke="rgba(22,89,214,0.1)" strokeWidth="1" />
              
              {/* Nodes */}
              <circle cx="50" cy="30" r="2" fill="rgba(125,211,252,0.7)" className="sidebar-node-pulse" />
              <circle cx="120" cy="70" r="2.5" fill="rgba(125,211,252,0.8)" />
              <circle cx="220" cy="40" r="1.5" fill="rgba(125,211,252,0.5)" className="sidebar-node-pulse-delay" />
              <circle cx="300" cy="80" r="1.5" fill="rgba(125,211,252,0.4)" className="sidebar-node-pulse" />
              <circle cx="80" cy="110" r="2" fill="rgba(125,211,252,0.6)" className="sidebar-node-pulse-delay" />
              <circle cx="160" cy="100" r="1.5" fill="rgba(125,211,252,0.5)" />
              <circle cx="260" cy="120" r="1.5" fill="rgba(125,211,252,0.4)" className="sidebar-node-pulse" />
              
              {/* Glow rings */}
              <circle cx="120" cy="70" r="2.5" fill="none" stroke="rgba(125,211,252,0.3)" strokeWidth="1" className="sidebar-node-glow" />
            </svg>
            
            {/* Radial vignette for depth */}
            <div className="absolute top-[-40px] right-[-40px] w-[150px] h-[150px] rounded-full bg-[radial-gradient(circle,rgba(22,89,214,0.15)_0%,transparent_70%)] pointer-events-none" />
            
            {/* Main Icon */}
            <div className="relative z-10 flex items-center justify-center w-10 h-10 mx-auto mb-2 bg-white/10 backdrop-blur-sm rounded-lg border border-white/15">
              {forgotPasswordSuccess ? (
                <svg
                  className="w-5 h-5 text-white animate-bounce"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5 text-white animate-iconBreathe"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  <circle cx="12" cy="16" r="1" fill="currentColor" />
                </svg>
              )}
            </div>
            
            {/* Title */}
            <DialogHeader className="relative z-10 text-center">
              <DialogTitle className="text-lg font-bold text-white tracking-tight">
                {forgotPasswordSuccess ? "Check your email" : "Forgot your password?"}
              </DialogTitle>
              <DialogDescription className="text-[13px] text-white/65">
                {forgotPasswordSuccess
                  ? "We've sent password reset instructions to your inbox."
                  : "Enter your email and we'll send you a link to reset your password."
                }
              </DialogDescription>
            </DialogHeader>
          </div>

          {/* Close button - positioned in header area */}
          <button
            type="button"
            className="absolute top-2 right-2 z-20 w-7 h-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            onClick={closeForgotPasswordModal}
            aria-label="Close"
          >
            <svg
              className="w-3.5 h-3.5 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          
          {/* Form Content */}
          <div className="px-6 pb-6 pt-4">
            {!forgotPasswordSuccess ? (
              <Form {...forgotPasswordForm}>
                <form onSubmit={forgotPasswordForm.handleSubmit(handleForgotPassword)} noValidate>
                  <div className="mb-5">
                    <FormField
                      control={forgotPasswordForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[13px] font-semibold text-[#333]">
                            Email address
                          </FormLabel>
                          <div className="relative group">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9ca3af] group-focus-within:text-[#1c2260] transition-colors">
                              <svg
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
                            </div>
                            <FormControl>
                              <Input
                                {...field}
                                type="email"
                                className="w-full h-12 text-[15px] border-2 border-[#e5e7eb] rounded-xl pl-11 pr-4 text-[#1f2937] bg-[#f9fafb] focus:border-[#1c2260] focus:bg-white focus:shadow-[0_0_0_4px_rgba(28,34,96,0.1)] focus:outline-none transition-all font-medium"
                                placeholder="alex@yourcompany.com"
                                autoComplete="email"
                              />
                            </FormControl>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 h-11 border border-[#e5e7eb] text-[#333] font-medium"
                      onClick={closeForgotPasswordModal}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={forgotPasswordLoading}
                      className="flex-1 h-11 bg-[#1c2260] text-white text-sm font-semibold rounded-lg hover:bg-[#1fb5a5] hover:shadow-[0_4px_14px_rgba(28,34,96,0.3)] disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {forgotPasswordLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/35 border-t-white rounded-full animate-spin mr-2" />
                          Sending...
                        </>
                      ) : (
                        <span className="flex items-center gap-2">
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13" />
                            <polygon points="22 2 15 22 11 13 2 9 22 2" />
                          </svg>
                          Send reset link
                        </span>
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            ) : (
              <div className="flex flex-col gap-5">
                {/* Success icon with glow effect */}
                <div className="flex items-center justify-center">
                  <div className="relative">
                    <div className="absolute inset-0 bg-green-400/30 blur-xl rounded-full animate-pulse" />
                    <div className="relative flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-400 to-green-500 rounded-full shadow-[0_8px_30px_rgba(34,197,94,0.35)]">
                      <svg
                        className="w-8 h-8 text-white animate-bounce"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  </div>
                </div>
                
                {/* Help text */}
                <div className="text-center px-2">
                  <p className="text-[14px] text-[#6b7280] leading-relaxed">
                    Didn't receive the email? Check your spam folder, or{" "}
                    <button
                      type="button"
                      className="text-[#1c2260] font-bold no-underline hover:underline underline-offset-2"
                      onClick={() => setForgotPasswordSuccess(false)}
                    >
                      try sending it again
                    </button>
                  </p>
                </div>
                
                <Button
                  type="button"
                  className="w-full h-11 bg-[#f3f4f6] text-[#374151] text-sm font-semibold rounded-lg hover:bg-[#e5e7eb] transition-colors"
                  onClick={closeForgotPasswordModal}
                >
                  Back to sign in
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
