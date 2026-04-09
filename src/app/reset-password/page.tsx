"use client";

import { useState, Suspense } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
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
import { Loader2, Lock, CheckCircle2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/shared/Logo";

const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter (A-Z)")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter (a-z)")
    .regex(/[0-9]/, "Password must contain at least one number (0-9)"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match — please try again",
  path: ["confirmPassword"],
});

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

function PasswordCheckItem({ label, valid }: { label: string; valid: boolean }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <div
        className={`w-4 h-4 rounded-full flex items-center justify-center transition-colors ${
          valid ? "bg-emerald-500 text-white" : "bg-[#e5e7eb] text-gray-400"
        }`}
      >
        {valid && <CheckCircle2 className="w-3 h-3" />}
      </div>
      <span className={valid ? "text-emerald-600" : "text-[#6b7280]"}>{label}</span>
    </div>
  );
}

function ErrorCard({
  icon,
  iconBg,
  iconColor,
  title,
  description,
  helpText,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
  helpText: string;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Left panel — brand */}
      <div className="hidden lg:flex lg:w-[480px] lg:flex-col lg:justify-between lg:p-12 bg-[#0e1333] relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#1fb5a5]/20 via-transparent to-transparent" />
        <div className="relative z-10">
          <Logo href="/" variant="light" />
        </div>
        <div className="relative z-10 space-y-4">
          <h2
            className="text-[42px] font-[family-name:var(--font-passion)] leading-tight text-white"
          >
            Affiliate management{" "}
            <span className="text-[#1fb5a5]">made simple.</span>
          </h2>
          <p className="text-white/60 text-sm leading-relaxed max-w-[320px]">
            Track commissions, manage payouts, and grow your affiliate program
            — all in one place.
          </p>
        </div>
        <div className="relative z-10 text-white/30 text-xs">
          © {new Date().getFullYear()} Microsource. All rights reserved.
        </div>
      </div>

      {/* Right panel — error */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white">
        <div className="w-full max-w-[400px] text-center">
          <div className={`mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-5 ${iconBg}`}>
            {icon}
          </div>
          <h1 className="text-[26px] font-bold text-[#333] mb-2">{title}</h1>
          <p className="text-sm text-[#6b7280] mb-2">{description}</p>
          <p className="text-sm text-[#6b7280] mb-8">{helpText}</p>
          <Button asChild variant="outline" className="w-full h-11 border-[#e5e7eb] text-[#333] font-medium rounded-lg">
            <Link href="/sign-in">Back to Sign In</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function ResetPasswordForm() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const errorCode = searchParams.get("error");

  const form = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const passwordValue = form.watch("password");
  const checks = [
    { label: "At least 8 characters", valid: passwordValue.length >= 8 },
    { label: "One uppercase letter", valid: /[A-Z]/.test(passwordValue) },
    { label: "One lowercase letter", valid: /[a-z]/.test(passwordValue) },
    { label: "One number", valid: /[0-9]/.test(passwordValue) },
  ];
  const allValid = checks.every((c) => c.valid);

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!token) return;
    setLoading(true);

    try {
      await authClient.resetPassword(
        { token, newPassword: data.password },
        {
          onRequest: () => setLoading(true),
          onSuccess: () => {
            setLoading(false);
            setSuccess(true);
          },
          onError: (ctx) => {
            setLoading(false);
            form.setError("root", {
              message: ctx.error.message || "Failed to reset password. The link may have expired.",
            });
          },
        }
      );
    } catch {
      setLoading(false);
      form.setError("root", {
        message: "An unexpected error occurred. Please try again.",
      });
    }
  };

  // ── Error states ──────────────────────────────────────────────────────────
  if (!token) {
    const isExpired = errorCode === "INVALID_TOKEN";
    return (
      <ErrorCard
        icon={
          isExpired ? (
            <svg className={`w-6 h-6 ${isExpired ? "text-amber-500" : "text-red-500"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          ) : (
            <svg className="w-6 h-6 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          )
        }
        iconBg={isExpired ? "bg-amber-50" : "bg-red-50"}
        iconColor={isExpired ? "text-amber-500" : "text-red-500"}
        title={isExpired ? "Link Expired" : "Invalid Link"}
        description={isExpired
          ? "This password reset link has expired or was already used."
          : "This password reset link is invalid."}
        helpText={isExpired
          ? "For security, reset links expire after 1 hour and can only be used once. Please request a new one from the sign-in page."
          : "The link may have been copied incorrectly or modified. Please request a new one from the sign-in page."}
      />
    );
  }

  // ── Success state ─────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="flex min-h-screen">
        {/* Left panel — brand */}
        <div className="hidden lg:flex lg:w-[480px] lg:flex-col lg:justify-between lg:p-12 bg-[#0e1333] relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#1fb5a5]/20 via-transparent to-transparent" />
          <div className="relative z-10">
            <Logo href="/" variant="light" />
          </div>
          <div className="relative z-10 space-y-4">
            <h2
              className="text-[42px] font-[family-name:var(--font-passion)] leading-tight text-white"
            >
              Affiliate management{" "}
              <span className="text-[#1fb5a5]">made simple.</span>
            </h2>
            <p className="text-white/60 text-sm leading-relaxed max-w-[320px]">
              Track commissions, manage payouts, and grow your affiliate program
              — all in one place.
            </p>
          </div>
          <div className="relative z-10 text-white/30 text-xs">
            © {new Date().getFullYear()} Microsource. All rights reserved.
          </div>
        </div>

        {/* Right panel — success */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white">
          <div className="w-full max-w-[400px] text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mb-5">
              <CheckCircle2 className="w-7 h-7 text-emerald-500" />
            </div>
            <h1 className="text-[26px] font-bold text-[#333] mb-2">Password Reset</h1>
            <p className="text-sm text-[#6b7280] mb-1">
              Your password has been changed successfully.
            </p>
            <p className="text-sm text-[#6b7280] mb-8">
              You can now sign in with your new password.
            </p>
            <Button asChild className="w-full h-11 font-semibold text-sm rounded-lg">
              <Link href="/sign-in">Sign In</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main reset form ──────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen">
      {/* Left panel — brand */}
      <div className="hidden lg:flex lg:w-[480px] lg:flex-col lg:justify-between lg:p-12 bg-[#0e1333] relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#1fb5a5]/20 via-transparent to-transparent" />
        <div className="relative z-10">
          <Logo href="/" variant="light" />
        </div>
        <div className="relative z-10 space-y-4">
          <h2
            className="text-[42px] font-[family-name:var(--font-passion)] leading-tight text-white"
          >
            Affiliate management{" "}
            <span className="text-[#1fb5a5]">made simple.</span>
          </h2>
          <p className="text-white/60 text-sm leading-relaxed max-w-[320px]">
            Track commissions, manage payouts, and grow your affiliate program
            — all in one place.
          </p>
        </div>
        <div className="relative z-10 text-white/30 text-xs">
          © {new Date().getFullYear()} Microsource. All rights reserved.
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white">
        <div className="w-full max-w-[400px]">
          {/* Header */}
          <div className="mb-8">
            <div className="w-10 h-10 rounded-xl bg-[#1c2260] flex items-center justify-center mb-4">
              <Lock className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-[26px] font-bold text-[#333]">Reset Your Password</h1>
            <p className="text-sm text-[#6b7280] mt-1">Enter your new password below</p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
              {form.formState.errors.root && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-600">
                    {form.formState.errors.root.message}
                  </p>
                </div>
              )}

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-[#333]">New Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Create a secure password"
                        disabled={loading}
                        className="h-11 border border-[#e5e7eb] rounded-lg focus:border-[#1c2260] focus:ring-[#1c2260]/20 focus:outline-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Password strength indicators */}
              {passwordValue.length > 0 && (
                <div className="grid grid-cols-2 gap-1.5 px-1 pb-1">
                  {checks.map((check) => (
                    <PasswordCheckItem key={check.label} {...check} />
                  ))}
                </div>
              )}

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-[#333]">Confirm Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Re-enter your password"
                        disabled={loading}
                        className="h-11 border border-[#e5e7eb] rounded-lg focus:border-[#1c2260] focus:ring-[#1c2260]/20 focus:outline-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full h-11 font-semibold text-sm rounded-lg"
                disabled={loading || !allValid}
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  "Reset Password"
                )}
              </Button>
            </form>
          </Form>

          {/* Footer */}
          <div className="text-center pt-6 mt-6 border-t border-[#e5e7eb]">
            <Link
              href="/sign-in"
              className="text-sm font-medium text-[#1c2260] hover:underline"
            >
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResetPassword() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen">
          <div className="hidden lg:flex lg:w-[480px] lg:flex-col lg:justify-between lg:p-12 bg-[#0e1333]">
            <div />
            <div />
          </div>
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white">
            <p className="text-[#6b7280] text-sm">Loading...</p>
          </div>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
