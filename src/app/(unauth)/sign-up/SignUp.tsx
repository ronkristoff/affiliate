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
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Logo } from "@/components/shared/Logo";
import { SidebarNetwork } from "@/components/shared/SidebarNetwork";

type PlanKey = "starter" | "growth" | "scale";

interface PlanInfo {
  name: string;
  monthly: string;
  annual: string;
  monthlyNote: string;
  annualNote: string;
  features: string[];
  limit: string;
}

function formatLimit(value: number): string {
  if (value === -1) return "Unlimited";
  return value.toLocaleString();
}

function formatPrice(price: number): string {
  if (price === 0) return "Free";
  return `₱${price.toLocaleString()}`;
}

export default function SignUp() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [domain, setDomain] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);

  const [selectedPlan, setSelectedPlan] = useState<PlanKey>("growth");
  const [isAnnual, setIsAnnual] = useState(false);

  const allTiers = useQuery(api.tierConfig.getAllTierConfigs);
  const completeSignUp = useMutation(api.users.completeSignUp);

  if (allTiers === undefined) {
    return (
      <div className="flex min-h-screen">
        <div className="hidden lg:flex lg:w-[480px] lg:flex-col lg:justify-between lg:p-12 bg-[#022232] relative overflow-hidden">
          <div className="relative z-10">
            <Logo href="/" variant="light" />
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center bg-white">
          <Loader2 className="h-8 w-8 animate-spin text-[#10409a]" />
        </div>
      </div>
    );
  }

  const getPlanInfo = (tier: typeof allTiers[number]): PlanInfo => {
    const tierName = tier.tier.charAt(0).toUpperCase() + tier.tier.slice(1);
    const monthlyPrice = tier.price;
    const annualPrice = Math.round(monthlyPrice * 10);

    const baseFeatures: string[] = [];
    if (tier.maxAffiliates > 0) {
      baseFeatures.push(`${formatLimit(tier.maxAffiliates)} affiliates`);
    }
    if (tier.maxCampaigns > 0) {
      baseFeatures.push(`${formatLimit(tier.maxCampaigns)} campaign${tier.maxCampaigns !== 1 ? "s" : ""}`);
    }
    if (tier.features.advancedAnalytics) {
      baseFeatures.push("Advanced analytics");
    }
    if (tier.features.prioritySupport) {
      baseFeatures.push("Priority support");
    }

    return {
      name: tierName,
      monthly: formatPrice(monthlyPrice),
      annual: formatPrice(annualPrice),
      monthlyNote: monthlyPrice === 0
        ? "Free forever"
        : `Free for 14 days, then ${formatPrice(monthlyPrice)}/mo`,
      annualNote: monthlyPrice === 0
        ? "Free forever"
        : `Free for 14 days, then ${formatPrice(annualPrice)}/mo (billed ${formatPrice(annualPrice * 12)}/yr)`,
      features: baseFeatures,
      limit: tier.maxAffiliates === -1
        ? "Unlimited affiliates & campaigns"
        : `Up to ${formatLimit(tier.maxAffiliates)} affiliates · ${formatLimit(tier.maxCampaigns)} campaigns`,
    };
  };

  const tierByName = allTiers.reduce((acc, tier) => {
    acc[tier.tier as PlanKey] = getPlanInfo(tier);
    return acc;
  }, {} as Record<PlanKey, PlanInfo>);

  const plans: Record<PlanKey, PlanInfo> = tierByName;

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

  // Helper to clean domain input (strip protocol, www, trailing slashes)
  const cleanDomain = (input: string): string | null => {
    if (!input) return null;

    let cleaned = input.toLowerCase().trim();

    // Strip protocol
    cleaned = cleaned.replace(/^https?:\/\//, "");

    // Strip www.
    cleaned = cleaned.replace(/^www\./, "");

    // Strip trailing slashes and path
    cleaned = cleaned.split("/")[0];

    // Strip port if present
    cleaned = cleaned.split(":")[0];

    // Basic validation
    if (!cleaned || cleaned.length < 3) return null;

    return cleaned;
  };

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
    if (!domain.trim()) {
      toast.error("Please enter your website URL");
      return;
    }
    // Domain validation
    const cleanedDomain = cleanDomain(domain.trim());
    if (!cleanedDomain) {
      toast.error("Please enter a valid website URL (e.g., yourcompany.com)");
      return;
    }
    if (cleanedDomain === "localhost" || cleanedDomain.includes("localhost")) {
      toast.error("localhost is not allowed. Please enter your production domain");
      return;
    }
    // Check for IP addresses
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipRegex.test(cleanedDomain)) {
      toast.error("IP addresses are not allowed. Please enter a domain name");
      return;
    }
    // Basic domain format check
    const domainRegex = /^[a-z0-9.-]+\.[a-z]{2,}$/i;
    if (!domainRegex.test(cleanedDomain)) {
      toast.error("Please enter a valid domain (e.g., yourcompany.com)");
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
      // Step 1: Create auth user via Better Auth (email, password, name only).
      // We cannot pass companyName/domain through Better Auth's additionalFields
      // because the @convex-dev/better-auth component schema doesn't include them,
      // causing a 422 error when the adapter tries to insert unknown fields.
      const { data, error } = await authClient.signUp.email({
        email,
        password,
        name: `${firstName} ${lastName}`,
      });

      if (error) {
        toast.error(error.message || "Sign up failed");
        setLoading(false);
        return;
      }

      // Step 2: Create tenant + user record in app tables via Convex mutation
      try {
        await completeSignUp({
          email: email.trim(),
          name: `${firstName} ${lastName}`,
          companyName: companyName.trim(),
          domain: cleanedDomain,
          plan: selectedPlan,
        });
      } catch (err: any) {
        // If tenant/user creation fails, the auth user still exists.
        // They can sign in and complete onboarding later.
        setLoading(false);
        toast.error(err.message || "Account created but setup failed. Please contact support.");
        return;
      }

      setLoading(false);
      toast.success("Account created successfully!");
      router.push("/onboarding");
    } catch (err) {
      setLoading(false);
      toast.error("An unexpected error occurred. Please try again.");
    }
  };

  const getPrice = () => {
    return isAnnual ? currentPlan.annual : currentPlan.monthly;
  };

  const getPriceNote = () => {
    return isAnnual ? currentPlan.annualNote : currentPlan.monthlyNote;
  };

  return (
    <div className="flex min-h-screen">
      {/* ── Left Panel — Brand ── */}
      <div className="hidden lg:flex lg:w-[480px] lg:flex-col lg:pt-12 lg:px-12 lg:pb-12 bg-[#022232] relative overflow-hidden">
        {/* Animated Network Constellation */}
        <SidebarNetwork />

        {/* Subtle radial vignette for depth */}
        <div className="absolute top-[-120px] right-[-120px] w-[400px] h-[400px] rounded-full bg-[radial-gradient(circle,rgba(22,89,214,0.12)_0%,transparent_70%)] pointer-events-none" />

        {/* Logo */}
        <div className="relative z-10 mb-10 sidebar-content-enter">
          <Logo href="/" variant="light" />
        </div>

        {/* Hero */}
        <div className="flex flex-col relative z-10 mb-10 sidebar-enter-delay-1">
          <div className="inline-flex items-center gap-1.5 bg-white/7 border border-white/10 rounded-full px-3.5 py-1 text-[12px] font-semibold text-white/80 mb-5 w-fit">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-3 h-3 text-[#7dd3fc]"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            14-day free trial — no credit card required
          </div>
          <h1 className="font-[family-name:var(--font-passion)] text-[42px] font-bold text-white leading-[1.1] tracking-tight mb-5">
            Launch your<br />affiliate<br /><span className="text-[#7dd3fc]">empire.</span>
          </h1>
          <p className="text-[15px] text-white/65 leading-relaxed max-w-[340px]">
            Full access to commission tracking, payout management, and a branded affiliate portal —
            integrated natively with SaligPay.
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
            <div className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0 icon-breathe">
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
            <div className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0 icon-breathe">
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

      {/* ── Right Panel — Form ── */}
      <div className="flex-1 flex flex-col items-center bg-white overflow-y-auto">
        {/* Mobile header */}
        <div className="lg:hidden w-full flex items-center justify-between px-6 h-[60px] border-b border-[#e5e7eb] flex-shrink-0">
          <Logo href="/" />
          <div className="text-[13px] text-[#6b7280]">
            Already have an account?{" "}
            <Link href="/sign-in" className="text-[#10409a] font-semibold no-underline hover:underline">
              Sign in
            </Link>
          </div>
        </div>

        <div className="w-full max-w-[460px] px-6 py-10 pb-12">
          {/* Desktop header */}
          <div className="hidden lg:block mb-8">
            <h2 className="text-[26px] font-bold text-[#333] tracking-tight mb-2">Create your account</h2>
            <p className="text-sm text-[#6b7280] leading-relaxed">
              Already using salig-affiliate?{" "}
              <Link href="/sign-in" className="text-[#10409a] font-semibold no-underline hover:underline">
                Sign in →
              </Link>
            </p>
          </div>

          {/* ── Plan Selector ── */}
          <div className="mb-6">
            {/* Billing Toggle */}
            <div className="flex items-center justify-center gap-3 mb-4">
              <span className={`text-[13px] font-medium transition-colors ${!isAnnual ? "text-[#333] font-semibold" : "text-[#6b7280]"}`}>
                Monthly
              </span>
              <button
                type="button"
                onClick={() => setIsAnnual(!isAnnual)}
                className={`w-[42px] h-[22px] rounded-full relative cursor-pointer transition-colors border-none ${
                  isAnnual ? "bg-[#10409a]" : "bg-[#d1d5db]"
                }`}
                aria-label="Toggle billing period"
              >
                <div
                  className={`absolute w-[18px] h-[18px] bg-white rounded-full top-[2px] transition-all shadow-sm ${
                    isAnnual ? "left-[22px]" : "left-[2px]"
                  }`}
                />
              </button>
              <span className={`text-[13px] font-medium transition-colors ${isAnnual ? "text-[#333] font-semibold" : "text-[#6b7280]"}`}>
                Annual
              </span>
              <span className="bg-green-50 text-green-700 text-[11px] font-bold rounded-full px-2.5 py-0.5 border border-green-200">
                Save 17%
              </span>
            </div>

            {/* Plan Cards */}
            <div className="grid grid-cols-3 gap-2.5">
              {(Object.keys(plans) as PlanKey[]).map((planKey) => {
                const plan = plans[planKey]!;
                const isSelected = selectedPlan === planKey;
                const isPopular = planKey === "growth";

                return (
                  <button
                    key={planKey}
                    type="button"
                    onClick={() => setSelectedPlan(planKey)}
                    className={`relative rounded-xl p-3.5 text-left transition-all border-2 ${
                      isSelected
                        ? "border-[#10409a] bg-[#f0f5ff] shadow-[0_0_0_3px_rgba(16,64,154,0.1)]"
                        : "border-[#e5e7eb] bg-white hover:border-[#c7d5f0] hover:bg-[#fafbff]"
                    }`}
                  >
                    {isPopular && (
                      <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-[#10409a] text-white text-[9px] font-bold uppercase tracking-wider rounded-full px-2.5 py-[2px] whitespace-nowrap leading-tight">
                        Popular
                      </div>
                    )}
                    <div className="text-[13px] font-bold text-[#333] mb-1">{plan.name}</div>
                    <div className="mb-0.5">
                      <span className="text-[20px] font-extrabold text-[#022232] tracking-tight leading-none">
                        {isAnnual ? plan.annual : plan.monthly}
                      </span>
                      <span className="text-[11px] text-[#6b7280]">/mo</span>
                    </div>
                    <div className="text-[10px] text-[#6b7280] leading-snug mt-1">
                      {plan.limit}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Price note */}
            <p className="text-[11px] font-medium text-green-600 text-center mt-2">
              {getPriceNote()}
            </p>
          </div>

          {/* ── Form ── */}
          <form onSubmit={handleSignUp}>
            {/* Name row */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <Label htmlFor="first-name" className="text-[13px] font-semibold text-[#333] block mb-1.5">
                  First name
                </Label>
                <div className="relative">
                  <svg
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-[15px] h-[15px] text-[#6b7280] pointer-events-none"
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
                    className="w-full h-11 rounded-lg pl-9 pr-3 text-sm border-[#e5e7eb] focus:border-[#10409a] focus:shadow-[0_0_0_3px_rgba(16,64,154,0.1)]"
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
                  className="w-full h-11 rounded-lg px-3 text-sm border-[#e5e7eb] focus:border-[#10409a] focus:shadow-[0_0_0_3px_rgba(16,64,154,0.1)]"
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
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-[15px] h-[15px] text-[#6b7280] pointer-events-none"
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
                  className="w-full h-11 rounded-lg pl-9 pr-3 text-sm border-[#e5e7eb] focus:border-[#10409a] focus:shadow-[0_0_0_3px_rgba(16,64,154,0.1)]"
                  placeholder="My SaaS Co."
                  autoComplete="organization"
                  required
                />
              </div>
            </div>

            {/* Domain */}
            <div className="mb-4">
              <Label htmlFor="domain" className="text-[13px] font-semibold text-[#333] block mb-1.5">
                Website URL
              </Label>
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-[15px] h-[15px] text-[#6b7280] pointer-events-none"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
                <Input
                  type="text"
                  id="domain"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  className="w-full h-11 rounded-lg pl-9 pr-3 text-sm border-[#e5e7eb] focus:border-[#10409a] focus:shadow-[0_0_0_3px_rgba(16,64,154,0.1)]"
                  placeholder="yourcompany.com"
                  autoComplete="url"
                  required
                />
              </div>
              <p className="text-[11px] text-[#6b7280] mt-1">
                Where customers buy your product
              </p>
            </div>

            {/* Email */}
            <div className="mb-4">
              <Label htmlFor="email" className="text-[13px] font-semibold text-[#333] block mb-1.5">
                Work email
              </Label>
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b7280] pointer-events-none"
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
                  className="w-full h-11 rounded-lg pl-10 pr-3 text-sm border-[#e5e7eb] focus:border-[#10409a] focus:shadow-[0_0_0_3px_rgba(16,64,154,0.1)]"
                  placeholder="alex@yourcompany.com"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="mb-5">
              <Label htmlFor="password" className="text-[13px] font-semibold text-[#333] block mb-1.5">
                Password
              </Label>
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b7280] pointer-events-none"
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
                  className="w-full h-11 rounded-lg pl-10 pr-10 text-sm border-[#e5e7eb] focus:border-[#10409a] focus:shadow-[0_0_0_3px_rgba(16,64,154,0.1)]"
                  placeholder="Min. 8 characters"
                  autoComplete="new-password"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#6b7280] hover:text-[#474747] h-auto w-auto size-auto"
                  onClick={() => setShowPassword(!showPassword)}
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
                </Button>
              </div>

              {/* Password Strength */}
              <div className="mt-2 flex items-center gap-2.5">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={`w-7 h-1 rounded-full transition-colors ${
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
              <div className="mt-2 text-[11px] text-[#6b7280] space-y-0.5">
                <ul className="space-y-0">
                  <li className={password.length >= 8 ? "text-green-600" : ""}>
                    {password.length >= 8 ? "✓" : "·"} 8+ characters
                    <span className="inline-block w-4" />
                    {/[A-Z]/.test(password) ? <span className="text-green-600">✓</span> : <span>·</span>} Uppercase
                    <span className="inline-block w-4" />
                    {/[0-9]/.test(password) ? <span className="text-green-600">✓</span> : <span>·</span>} Number
                    <span className="inline-block w-4" />
                    {/[^A-Za-z0-9]/.test(password) ? <span className="text-green-600">✓</span> : <span>·</span>} Special
                  </li>
                </ul>
              </div>
            </div>

            {/* Terms */}
            <div className="flex items-start gap-2.5 mb-6">
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
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-[46px] bg-[#10409a] text-white text-sm font-semibold rounded-lg hover:bg-[#1659d6] hover:shadow-[0_4px_14px_rgba(16,64,154,0.3)] disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/35 border-t-white rounded-full animate-spin" />
                  Creating account...
                </>
              ) : (
                <>
                  Start free trial — {getPrice()}/mo
                </>
              )}
            </Button>

            <div className="flex items-center justify-center gap-1.5 text-[12px] text-[#6b7280] mt-3">
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

          {/* Desktop divider + footer */}
          <div className="hidden lg:block mt-8 pt-6 border-t border-[#e5e7eb]">
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
              {[
                "Native SaligPay integration",
                "White-labeled portal",
                "Live in under 15 minutes",
                "WCAG 2.1 AA",
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[12px] text-[#6b7280]">
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
                  {item}
                </div>
              ))}
            </div>
            <p className="text-[11px] text-[#6b7280] text-center mt-4 leading-relaxed">
              By signing up, you agree to our{" "}
              <a href="#" className="text-[#10409a] no-underline hover:underline">Terms of Service</a> and{" "}
              <a href="#" className="text-[#10409a] no-underline hover:underline">Privacy Policy</a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
