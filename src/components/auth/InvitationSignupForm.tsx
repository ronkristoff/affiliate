"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
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
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Logo } from "@/components/shared/Logo";

const invitationSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be less than 100 characters"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter (A-Z)")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter (a-z)")
    .regex(/[0-9]/, "Password must contain at least one number (0-9)"),
});

type InvitationFormData = z.infer<typeof invitationSchema>;

interface InvitationSignupFormProps {
  token?: string;
}

export default function InvitationSignupForm({ token }: InvitationSignupFormProps) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch invitation details
  const invitation = useQuery(
    api.teamInvitations.getInvitationByToken,
    token ? { token } : "skip"
  );

  // Complete invitation acceptance mutation
  const completeAcceptance = useMutation(api.teamInvitations.completeInvitationAcceptance);

  const form = useForm<InvitationFormData>({
    resolver: zodResolver(invitationSchema),
    defaultValues: {
      name: "",
      password: "",
    },
  });

  // Handle loading state
  if (invitation === undefined && token) {
    return (
      <div className="min-h-screen bg-[#f2f2f2] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#1c2260]" />
          <p className="text-[#6b7280]">Validating invitation...</p>
        </div>
      </div>
    );
  }

  // Handle invalid/expired token
  if (!invitation && token) {
    return <InvitationError errorType="invalid" />;
  }

  // Handle missing token
  if (!token) {
    return <InvitationError errorType="missing" />;
  }

  const password = form.watch("password");

  const getPasswordStrength = (pwd: string): { score: number; label: string } => {
    if (!pwd) return { score: 0, label: "Enter a password" };
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd) && /[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    const labels = ["Too short", "Weak", "Fair", "Good", "Strong"];
    return { score, label: labels[Math.min(score - 1, 4)] || "Too short" };
  };

  const strength = getPasswordStrength(password || "");

  const onSubmit = async (data: InvitationFormData) => {
    setLoading(true);

    try {
      // Step 1: Create user with Better Auth
      const { data: authData, error: authError } = await authClient.signUp.email(
        {
          email: invitation!.email,
          password: data.password,
          name: data.name,
        },
        {
          onRequest: () => setLoading(true),
          onError: (ctx) => {
            setLoading(false);
            toast.error(ctx.error.message || "Failed to create account");
          },
        }
      );

      if (authError) {
        toast.error(authError.message || "Failed to create account");
        setLoading(false);
        return;
      }

      if (!authData || !authData.user) {
        toast.error("Account creation failed");
        setLoading(false);
        return;
      }

      // Step 2: Complete invitation acceptance in Convex
      const result = await completeAcceptance({
        token: token!,
        authUserId: authData.user.id,
        name: data.name,
      });

      if (!result.success) {
        toast.error(result.error || "Failed to complete invitation acceptance");
        setLoading(false);
        return;
      }

      // Success!
      toast.success("Welcome to the team!");
      router.push("/dashboard");
    } catch (error) {
      console.error("Error accepting invitation:", error);
      toast.error("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f2f2f2]">
      {/* Topbar */}
      <header className="bg-white border-b border-[#e5e7eb] px-8 h-[60px] flex items-center justify-between flex-shrink-0">
        <Logo href="/" />
        <div className="text-[13px] text-[#6b7280]">
          Already have an account?{" "}
          <Link href="/sign-in" className="text-[#1c2260] font-semibold no-underline hover:underline">
            Sign in
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center px-6 py-10 pb-16">
        {/* Hero */}
        <div className="text-center max-w-[540px] mb-9">
          <h1 className="text-[30px] font-bold text-[#333] tracking-tight leading-tight mb-2.5">
            Join Your Team
          </h1>
          <p className="text-sm text-[#6b7280] leading-relaxed">
            You&apos;ve been invited to join <strong>{invitation?.tenantName}</strong> as a{" "}
            <strong>{invitation?.role.charAt(0).toUpperCase()}{invitation?.role.slice(1)}</strong>
          </p>
        </div>

        {/* Signup Form Card */}
        <div className="bg-white border border-[#e5e7eb] rounded-2xl p-8 w-full max-w-[480px] shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              {/* Email (Readonly) */}
              <div className="mb-4">
                <label htmlFor="email" className="text-[13px] font-semibold text-[#333] block mb-1.5">
                  Email
                </label>
                <div className="relative">
                  <svg
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-[15px] h-[15px] text-[#6b7280]"
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
                    value={invitation?.email}
                    readOnly
                    className="w-full h-[42px] border border-[#e5e7eb] rounded-lg pl-9 pr-3 text-sm text-[#6b7280] bg-[#f9fafb] focus:outline-none cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Name */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="mb-4">
                    <FormLabel className="text-[13px] font-semibold text-[#333]">Full Name</FormLabel>
                    <div className="relative">
                      <svg
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-[15px] h-[15px] text-[#6b7280]"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder="Your full name"
                          disabled={loading}
                          className="w-full h-[42px] border border-[#e5e7eb] rounded-lg pl-9 pr-3 text-sm text-[#333] bg-white focus:border-[#1c2260] focus:shadow-[0_0_0_3px_rgba(28,34,96,0.1)] focus:outline-none transition-all"
                          autoComplete="name"
                          {...field}
                        />
                      </FormControl>
                    </div>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              {/* Password */}
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem className="mb-4">
                    <FormLabel className="text-[13px] font-semibold text-[#333]">Password</FormLabel>
                    <div className="relative">
                      <svg
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-[15px] h-[15px] text-[#6b7280]"
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
                          type={showPassword ? "text" : "password"}
                          placeholder="Create a secure password"
                          disabled={loading}
                          className="w-full h-[42px] border border-[#e5e7eb] rounded-lg pl-9 pr-10 text-sm text-[#333] bg-white focus:border-[#1c2260] focus:shadow-[0_0_0_3px_rgba(28,34,96,0.1)] focus:outline-none transition-all"
                          autoComplete="new-password"
                          {...field}
                        />
                      </FormControl>
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer p-1 text-[#6b7280] hover:text-[#474747]"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[15px] h-[15px]">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[15px] h-[15px]">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>
                    {/* Password Strength */}
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map((i) => (
                          <div
                            key={i}
                            className={`w-7 h-1 rounded-sm transition-colors ${
                              strength.score >= i
                                ? strength.score <= 1
                                  ? "bg-red-500"
                                  : strength.score === 2
                                  ? "bg-amber-500"
                                  : "bg-green-500"
                                : "bg-[#e5e7eb]"
                            }`}
                          />
                        ))}
                      </div>
                      <span
                        className="text-[11px]"
                        style={{
                          color:
                            strength.score === 0
                              ? "#6b7280"
                              : strength.score === 1
                              ? "#EF4444"
                              : strength.score === 2
                              ? "#F59E0B"
                              : "#10B981",
                        }}
                      >
                        {strength.label}
                      </span>
                    </div>
                    {/* Password Requirements */}
                    <div className="mt-2 text-[11px] text-[#6b7280] space-y-1">
                      <p>Password must have:</p>
                      <ul className="space-y-0.5 ml-4">
                        <li className={password?.length >= 8 ? "text-green-600" : ""}>
                          {password?.length >= 8 ? "✓" : "•"} At least 8 characters
                        </li>
                        <li className={/[A-Z]/.test(password || "") ? "text-green-600" : ""}>
                          {/[A-Z]/.test(password || "") ? "✓" : "•"} One uppercase letter
                        </li>
                        <li className={/[a-z]/.test(password || "") ? "text-green-600" : ""}>
                          {/[a-z]/.test(password || "") ? "✓" : "•"} One lowercase letter
                        </li>
                        <li className={/[0-9]/.test(password || "") ? "text-green-600" : ""}>
                          {/[0-9]/.test(password || "") ? "✓" : "•"} One number
                        </li>
                      </ul>
                    </div>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              {/* Submit */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  asChild
                  className="flex-1 h-[46px] text-sm font-semibold"
                >
                  <Link href="/sign-in">Cancel</Link>
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1 h-[46px] text-sm font-semibold gap-2"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/35 border-t-white rounded-full animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    "Create Account"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </main>
    </div>
  );
}

// Invitation Error Component
function InvitationError({ errorType }: { errorType: "invalid" | "expired" | "missing" }) {
  const titles = {
    invalid: "Invalid Invitation",
    expired: "Invitation Expired",
    missing: "Invitation Required",
  };

  const messages = {
    invalid: "This invitation link is invalid or has already been used. Please contact your team administrator to request a new invitation.",
    expired: "This invitation link has expired. Invitations are valid for 7 days. Please contact your team administrator to request a new invitation.",
    missing: "An invitation token is required. Please use the link from your invitation email.",
  };

  return (
    <div className="min-h-screen bg-[#f2f2f2]">
      {/* Topbar */}
      <header className="bg-white border-b border-[#e5e7eb] px-8 h-[60px] flex items-center justify-between flex-shrink-0">
        <Logo href="/" />
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-10 min-h-[calc(100vh-60px)]">
        <div className="bg-white border border-[#e5e7eb] rounded-2xl p-8 w-full max-w-[480px] shadow-[0_2px_12px_rgba(0,0,0,0.04)] text-center">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="w-8 h-8 text-red-500"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          
          <h1 className="text-[22px] font-bold text-[#333] tracking-tight mb-3">
            {titles[errorType]}
          </h1>
          
          <p className="text-[14px] text-[#6b7280] mb-6 leading-relaxed">
            {messages[errorType]}
          </p>

          <div className="flex flex-col gap-3">
            <Button
              asChild
              className="w-full h-[46px] text-sm font-semibold"
            >
              <Link href="/sign-in">
                Go to Sign In
              </Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
