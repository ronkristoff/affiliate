"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Plan = "starter" | "growth" | "scale";

interface PlanInfo {
  name: string;
  monthly: string;
  annual: string;
  monthlyNote: string;
  annualNote: string;
  features: string[];
  limit: string;
}

const plans: Record<Plan, PlanInfo> = {
  starter: {
    name: "Starter",
    monthly: "₱1,999",
    annual: "₱1,659",
    monthlyNote: "Free for 14 days, then ₱1,999/mo",
    annualNote: "Free for 14 days, then ₱1,659/mo (billed ₱19,908/yr)",
    features: [
      "Commission tracking + auto-detection",
      "Manual payouts + CSV export",
      "Standard email templates",
      "White-labeled affiliate portal",
    ],
    limit: "Up to 1,000 affiliates · 3 campaigns",
  },
  growth: {
    name: "Growth",
    monthly: "₱4,499",
    annual: "₱3,734",
    monthlyNote: "Free for 14 days, then ₱4,499/mo",
    annualNote: "Free for 14 days, then ₱3,734/mo (billed ₱44,808/yr)",
    features: [
      "Everything in Starter",
      "Advanced reports + analytics",
      "Custom email templates",
      "Priority support",
    ],
    limit: "Up to 5,000 affiliates · 10 campaigns",
  },
  scale: {
    name: "Scale",
    monthly: "₱8,999",
    annual: "₱7,469",
    monthlyNote: "Free for 14 days, then ₱8,999/mo",
    annualNote: "Free for 14 days, then ₱7,469/mo (billed ₱89,628/yr)",
    features: [
      "Everything in Growth",
      "Custom domain + SSL",
      "API access (v2)",
      "Dedicated onboarding",
    ],
    limit: "Unlimited affiliates & campaigns",
  },
};

export default function SignUp() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [selectedPlan, setSelectedPlan] = useState<Plan>("growth");
  const [isAnnual, setIsAnnual] = useState(false);

  const currentPlan = plans[selectedPlan];

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

  const strength = getPasswordStrength(password);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!firstName.trim() || !lastName.trim()) {
      toast.error("Please enter your first and last name");
      return;
    }
    if (!companyName.trim()) {
      toast.error("Please enter your company name");
      return;
    }
    if (companyName.trim().length < 2) {
      toast.error("Company name must be at least 2 characters");
      return;
    }
    if (companyName.trim().length > 100) {
      toast.error("Company name must be less than 100 characters");
      return;
    }
    if (!email.trim()) {
      toast.error("Please enter your email");
      return;
    }
    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      toast.error("Please enter a valid email address");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (!agreedToTerms) {
      toast.error("Please agree to the Terms of Service and Privacy Policy");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await authClient.signUp.email(
        {
          email,
          password,
          name: `${firstName} ${lastName}`,
          companyName: companyName.trim(),
        },
        {
          onRequest: () => {
            setLoading(true);
          },
          onSuccess: () => {
            setLoading(false);
            toast.success("Account created successfully!");
            router.push("/onboarding");
          },
          onError: (ctx) => {
            setLoading(false);
            toast.error(ctx.error.message || "Sign up failed");
          },
        }
      );

      if (error) {
        toast.error(error.message || "Sign up failed");
      }
    } catch (err) {
      setLoading(false);
      toast.error("An unexpected error occurred. Please try again.");
    }
  };

  const updatePlanSummary = () => {
    const plan = plans[selectedPlan];
    return isAnnual ? `${plan.annual}/mo (annual)` : `${plan.monthly}/mo`;
  };

  return (
    <div className="min-h-screen bg-[#f2f2f2]">
      {/* Topbar */}
      <header className="bg-white border-b border-[#e5e7eb] px-8 h-[60px] flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-[#10409a] rounded-lg flex items-center justify-center">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-[18px] h-[18px] text-white"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="text-base font-extrabold text-[#022232] tracking-tight">salig-affiliate</span>
        </div>
        <div className="text-[13px] text-[#6b7280]">
          Already have an account?{" "}
          <Link href="/sign-in" className="text-[#10409a] font-semibold no-underline hover:underline">
            Sign in
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center px-6 py-10 pb-16">
        {/* Hero */}
        <div className="text-center max-w-[540px] mb-9">
          <div className="inline-flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-full px-3.5 py-1 text-[12px] font-semibold text-green-700 mb-4">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-3 h-3 text-green-600"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            14-day free trial — no credit card required
          </div>
          <h1 className="text-[30px] font-bold text-[#333] tracking-tight leading-tight mb-2.5">
            Launch your affiliate program today
          </h1>
          <p className="text-sm text-[#6b7280] leading-relaxed">
            Full access to all features during your trial. Choose the plan that fits you best — you
            can change anytime.
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="flex items-center gap-3 mb-[18px]">
          <span className={`text-[13px] font-medium ${!isAnnual ? "text-[#333] font-semibold" : "text-[#6b7280]"}`}>
            Monthly
          </span>
          <button
            onClick={() => setIsAnnual(!isAnnual)}
            className={`w-[42px] h-6 rounded-full relative cursor-pointer transition-colors border-none ${
              isAnnual ? "bg-[#10409a]" : "bg-[#e5e7eb]"
            }`}
            aria-label="Toggle billing period"
          >
            <div
              className={`absolute w-[18px] h-[18px] bg-white rounded-full top-0.5 transition-all shadow-sm ${
                isAnnual ? "left-5" : "left-0.5"
              }`}
            />
          </button>
          <span className={`text-[13px] font-medium ${isAnnual ? "text-[#333] font-semibold" : "text-[#6b7280]"}`}>
            Annual
          </span>
          <span className="bg-green-50 text-green-700 text-[11px] font-bold rounded px-2 py-0.5">
            Save 17%
          </span>
        </div>

        {/* Plan Selector */}
        <div className="w-full max-w-[780px] mb-8">
          <p className="text-[13px] font-semibold text-[#333] mb-3.5 text-center">
            Choose your plan <span className="text-[#6b7280] font-normal">— all plans include a 14-day free trial</span>
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {(Object.keys(plans) as Plan[]).map((planKey) => {
              const plan = plans[planKey];
              const isSelected = selectedPlan === planKey;
              const isPopular = planKey === "growth";

              return (
                <div
                  key={planKey}
                  onClick={() => setSelectedPlan(planKey)}
                  className={`bg-white border-2 rounded-[14px] p-5 cursor-pointer transition-all hover:border-blue-300 hover:shadow-[0_4px_16px_rgba(16,64,154,0.08)] hover:-translate-y-1 ${
                    isSelected
                      ? "border-[#10409a] shadow-[0_0_0_4px_rgba(16,64,154,0.1),0_4px_16px_rgba(16,64,154,0.12)]"
                      : "border-[#e5e7eb]"
                  } ${isPopular && !isSelected ? "border-[#10409a]" : ""} relative`}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#10409a] text-white text-[10px] font-bold uppercase tracking-wider rounded-full px-3 py-0.5 whitespace-nowrap">
                      Most Popular
                    </div>
                  )}
                  <div className="flex items-center gap-2.5 mb-3.5">
                    <input
                      type="radio"
                      name="plan"
                      checked={isSelected}
                      onChange={() => setSelectedPlan(planKey)}
                      className="w-[18px] h-[18px] accent-[#10409a] cursor-pointer"
                    />
                    <span className="text-[15px] font-bold text-[#333]">{plan.name}</span>
                  </div>
                  <div className="mb-1.5">
                    <span className="text-[26px] font-extrabold text-[#022232] tracking-tight">
                      {isAnnual ? plan.annual : plan.monthly}
                    </span>
                    <span className="text-[13px] text-[#6b7280]">/mo</span>
                  </div>
                  <p className="text-[11px] font-semibold text-green-600 mb-4">
                    {isAnnual ? plan.annualNote : plan.monthlyNote}
                  </p>
                  <ul className="list-none flex flex-col gap-2">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2 text-[12px] text-[#474747] leading-snug">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="w-3 h-3 text-[#10b981] flex-shrink-0 mt-px"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <div className="inline-block text-[11px] font-semibold text-[#6b7280] bg-[#f2f2f2] border border-[#e5e7eb] rounded px-1.5 py-0.5 mt-3">
                    {plan.limit}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Signup Form Card */}
        <div className="bg-white border border-[#e5e7eb] rounded-2xl p-8 w-full max-w-[480px] shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
          <h2 className="text-[17px] font-bold text-[#333] mb-1.5">Create your account</h2>
          <p className="text-[13px] text-[#6b7280] mb-6 leading-relaxed">
            You won&apos;t be charged until after your 14-day trial ends.
          </p>

          {/* Plan Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg py-2.5 px-3.5 flex items-center justify-between mb-5">
            <div className="text-[13px] text-blue-800">
              Selected: <strong>{currentPlan.name}</strong> — <span>{updatePlanSummary()}</span>
            </div>
            <button
              type="button"
              onClick={() => document.querySelector(".grid")?.scrollIntoView({ behavior: "smooth" })}
              className="text-[12px] text-[#10409a] font-semibold no-underline hover:underline cursor-pointer bg-transparent border-none"
            >
              Change plan
            </button>
          </div>

          <form onSubmit={handleSignUp}>
            {/* Name row */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <Label htmlFor="first-name" className="text-[13px] font-semibold text-[#333] block mb-1.5">
                  First name
                </Label>
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
                  <Input
                    type="text"
                    id="first-name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full h-[42px] rounded-lg pl-9 pr-3 text-sm"
                    placeholder="Alex"
                    autoComplete="given-name"
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="last-name" className="text-[13px] font-semibold text-[#333] block mb-1.5">
                  Last name
                </Label>
                <Input
                  type="text"
                  id="last-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full h-[42px] rounded-lg px-3 text-sm"
                  placeholder="Reyes"
                  autoComplete="family-name"
                  required
                />
              </div>
            </div>

            {/* Company */}
            <div className="mb-4">
              <Label htmlFor="company" className="text-[13px] font-semibold text-[#333] block mb-1.5">
                Company / SaaS name
              </Label>
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
                  <rect x="2" y="7" width="20" height="14" rx="2" />
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                </svg>
                <Input
                  type="text"
                  id="company"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full h-[42px] rounded-lg pl-9 pr-3 text-sm"
                  placeholder="My SaaS Co."
                  autoComplete="organization"
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div className="mb-4">
              <Label htmlFor="email" className="text-[13px] font-semibold text-[#333] block mb-1.5">
                Work email
              </Label>
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
                <Input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-[42px] rounded-lg pl-9 pr-3 text-sm"
                  placeholder="alex@yourcompany.com"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="mb-4">
              <Label htmlFor="password" className="text-[13px] font-semibold text-[#333] block mb-1.5">
                Password
              </Label>
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
                <Input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-[42px] rounded-lg pl-9 pr-10 text-sm"
                  placeholder="Min. 8 characters"
                  autoComplete="new-password"
                  required
                />
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
                  <li className={password.length >= 8 ? "text-green-600" : ""}>
                    {password.length >= 8 ? "✓" : "•"} At least 8 characters
                  </li>
                  <li className={/[A-Z]/.test(password) ? "text-green-600" : ""}>
                    {/[A-Z]/.test(password) ? "✓" : "•"} One uppercase letter
                  </li>
                  <li className={/[0-9]/.test(password) ? "text-green-600" : ""}>
                    {/[0-9]/.test(password) ? "✓" : "•"} One number
                  </li>
                  <li className={/[^A-Za-z0-9]/.test(password) ? "text-green-600" : ""}>
                    {/[^A-Za-z0-9]/.test(password) ? "✓" : "•"} One special character
                  </li>
                </ul>
              </div>
            </div>

            {/* Terms */}
            <div className="flex items-start gap-2.5 mb-5">
              <input
                type="checkbox"
                id="terms"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="w-4 h-4 accent-[#10409a] cursor-pointer flex-shrink-0 mt-0.5"
              />
              <label htmlFor="terms" className="text-[12px] text-[#6b7280] leading-relaxed cursor-pointer">
                I agree to the{" "}
                <Link href="/terms" className="text-[#10409a] font-medium no-underline hover:underline">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="text-[#10409a] font-medium no-underline hover:underline">
                  Privacy Policy
                </Link>
                . I understand salig-affiliate processes affiliate personal data on my behalf as a data
                processor under the Philippine Data Privacy Act.
              </label>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-[46px] bg-[#10409a] text-white text-sm font-semibold rounded-lg cursor-pointer transition-all hover:bg-[#1659d6] hover:shadow-[0_4px_14px_rgba(16,64,154,0.3)] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 mb-3"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/35 border-t-white rounded-full animate-spin" />
                  Creating account...
                </>
              ) : (
                "Start free trial →"
              )}
            </button>

            <div className="flex items-center justify-center gap-1.5 text-[12px] text-[#6b7280]">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-3 h-3 text-[#10b981]"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              No credit card required. Cancel anytime during trial.
            </div>
          </form>
        </div>

        {/* Trust Strip */}
        <div className="flex items-center justify-center gap-6 mt-8 flex-wrap">
          {[
            "Native SaligPay integration",
            "White-labeled affiliate portal",
            "Live in under 15 minutes",
            "WCAG 2.1 AA compliant",
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-1.5 text-[12px] text-[#6b7280]">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-3.5 h-3.5 text-[#10b981]"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {item}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
