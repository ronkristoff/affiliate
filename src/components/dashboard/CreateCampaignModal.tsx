"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { AccordionSection } from "@/components/ui/accordion-section";
import {
  Loader2,
  AlertTriangle,
  TrendingUp,
  Repeat,
  Shield,
  Percent,
  Banknote,
  CheckCircle2,
  Megaphone,
} from "lucide-react";
import { DEFAULT_REDUCED_RATE_PERCENTAGE } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────

interface CreateCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

// ─── Zod Schema ─────────────────────────────────────────────────────

const createCampaignSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100, "Name must be less than 100 characters"),
  description: z.string().optional(),
  commissionType: z.enum(["percentage", "flatFee"]),
  commissionRate: z.string().min(1, "Commission rate is required").refine((val) => !isNaN(Number(val)), {
    message: "Must be a number",
  }),
  cookieDuration: z.string().refine((val) => {
    if (!val) return true;
    const d = Number(val);
    return !isNaN(d) && d >= 1 && d <= 365;
  }, { message: "Must be between 1 and 365 days" }).optional().or(z.literal("")),
  recurringCommissions: z.boolean(),
  recurringRateType: z.enum(["same", "reduced", "custom"]).optional(),
  recurringRate: z.string().optional(),
  autoApproveCommissions: z.boolean(),
  approvalThreshold: z.string().optional(),
});

type CreateCampaignFormData = z.infer<typeof createCampaignSchema>;

// ─── Helpers ─────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// ─── Stagger Variants ────────────────────────────────────────────────

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 28, mass: 0.8 },
  },
} as const;

// ─── Component ───────────────────────────────────────────────────────

export function CreateCampaignModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateCampaignModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // React Hook Form
  const form = useForm<CreateCampaignFormData>({
    resolver: zodResolver(createCampaignSchema),
    defaultValues: {
      name: "",
      description: "",
      commissionType: "percentage",
      commissionRate: "10",
      cookieDuration: "30",
      recurringCommissions: false,
      recurringRateType: "same",
      recurringRate: "",
      autoApproveCommissions: true,
      approvalThreshold: "",
    },
  });

  const { register, watch, setValue, formState: { errors }, reset } = form;
  
  // Watch form values for calculations
  const commissionType = watch("commissionType");
  const commissionRate = watch("commissionRate");
  const cookieDuration = watch("cookieDuration");
  const recurringCommissions = watch("recurringCommissions");
  const recurringRateType = watch("recurringRateType");
  const recurringRate = watch("recurringRate");
  const autoApproveCommissions = watch("autoApproveCommissions");
  const approvalThreshold = watch("approvalThreshold");

  // Queries & mutations
  const campaignLimit = useQuery(api.campaigns.checkCampaignLimit);
  const createCampaign = useMutation(api.campaigns.createCampaign);

  // ─── Commission calculation ──────────────────────────────────────

  const exampleAmount = 1000;
  const rate = Number(commissionRate) || 0;
  const commission =
    commissionType === "percentage"
      ? exampleAmount * (rate / 100)
      : rate;

  const effectiveRecurringRate =
    recurringCommissions && recurringRateType === "reduced"
      ? rate * (DEFAULT_REDUCED_RATE_PERCENTAGE / 100)
      : recurringCommissions && recurringRateType === "custom"
        ? Number(recurringRate) || rate
        : rate;

  const recurringCommission =
    commissionType === "percentage"
      ? exampleAmount * (effectiveRecurringRate / 100)
      : rate;

  // ─── Reset on open ──────────────────────────────────────────────

  useEffect(() => {
    if (isOpen) {
      reset({
        name: "",
        description: "",
        commissionType: "percentage",
        commissionRate: "10",
        cookieDuration: "30",
        recurringCommissions: false,
        recurringRateType: "same",
        recurringRate: "",
        autoApproveCommissions: true,
        approvalThreshold: "",
      });
    }
  }, [isOpen, reset]);

  // ─── Commission type change defaults ─────────────────────────────

  useEffect(() => {
    if (commissionType === "percentage") {
      const current = Number(commissionRate);
      if (!commissionRate || current > 100) setValue("commissionRate", "10");
    }
    if (commissionType === "flatFee") {
      const current = Number(commissionRate);
      if (!commissionRate || current < 0) setValue("commissionRate", "50");
    }
  }, [commissionType, commissionRate, setValue]);

  // ─── Recurring rate defaults ─────────────────────────────────────

  useEffect(() => {
    if (recurringCommissions && recurringRateType === "reduced") {
      const initial = Number(commissionRate) || 0;
      const reduced =
        Math.round(initial * (DEFAULT_REDUCED_RATE_PERCENTAGE / 100) * 100) / 100;
      if (reduced > 0) setValue("recurringRate", String(reduced));
    }
  }, [recurringRateType, recurringCommissions, commissionRate, setValue]);

  // ─── Submit ──────────────────────────────────────────────────────

  const onSubmit = async (data: CreateCampaignFormData) => {
    setLoading(true);

    try {
      const result = await createCampaign({
        name: data.name,
        description: data.description || undefined,
        commissionType: data.commissionType,
        commissionRate: Number(data.commissionRate),
        cookieDuration: Number(data.cookieDuration) || 30,
        recurringCommissions: data.recurringCommissions,
        recurringRate:
          data.recurringCommissions && data.recurringRate && data.recurringRateType !== "same"
            ? Number(data.recurringRate)
            : undefined,
        recurringRateType: data.recurringCommissions ? data.recurringRateType : undefined,
        autoApproveCommissions: data.autoApproveCommissions,
        approvalThreshold: data.approvalThreshold
          ? Number(data.approvalThreshold)
          : undefined,
      });

      toast.success("Campaign created successfully!");
      onClose();
      onSuccess?.();
      router.push(`/campaigns/${result}`);
      router.refresh();
    } catch (error) {
      console.error("Failed to create campaign:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create campaign"
      );
    } finally {
      setLoading(false);
    }
  };

  // ─── Limit checks ───────────────────────────────────────────────

  const isLimitReached = campaignLimit?.allowed === false;
  const isCritical = campaignLimit && campaignLimit.status === "critical";

  // ─── Render ──────────────────────────────────────────────────────

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-[520px] sm:max-w-[520px] p-0 flex flex-col"
      >
        {/* ── Header ──────────────────────────────────────────────── */}
        <SheetHeader className="px-6 py-5 border-b border-[#e5e7eb]">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[var(--brand-primary)] flex items-center justify-center shrink-0">
              <Megaphone className="h-5 w-5 text-white" />
            </div>
            <div className="text-left">
              <SheetTitle className="text-base font-bold text-[#333]">
                Create New Campaign
              </SheetTitle>
              <SheetDescription>
                Set commission rules for this affiliate program
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* ── Scrollable Body ─────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {/* ── Limit Warning ─────────────────────────────────────── */}
          {campaignLimit !== undefined && (isLimitReached || isCritical) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mx-6 mt-4"
            >
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-center gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <div>
                  <span className="font-medium">Campaign limit reached</span>{" "}
                  ({campaignLimit.current}/{campaignLimit.limit})
                  <p className="text-xs mt-0.5 text-red-600">
                    Upgrade your plan to create more campaigns.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          <form onSubmit={form.handleSubmit(onSubmit)}>
            <motion.div
              className="px-6 py-5 space-y-5"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              {/* ── Section 1: Identity ────────────────────────────── */}
              <motion.div variants={itemVariants} className="space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-6 h-6 rounded-full bg-[#1c2260] text-white text-[11px] font-bold flex items-center justify-center">
                    1
                  </span>
                  <span className="text-sm font-semibold text-gray-800">
                    Campaign Identity
                  </span>
                </div>

                {/* Name */}
                <div className="space-y-1.5">
                  <Label
                    htmlFor="campaign-name"
                    className="text-[13px] font-medium text-gray-700"
                  >
                    Campaign Name *
                  </Label>
                  <Input
                    id="campaign-name"
                    placeholder="e.g. Main Affiliate Program"
                    {...register("name")}
                    className={`h-10 text-sm transition-all duration-200 ${
                      errors.name
                        ? "border-rose-500 ring-1 ring-rose-100"
                        : "border-gray-200 focus:border-[#1fb5a5] focus:ring-1 focus:ring-blue-100"
                    }`}
                  />
                  <AnimatePresence mode="wait">
                    {errors.name ? (
                      <motion.p
                        key="error"
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="text-xs text-rose-500"
                      >
                        {errors.name.message}
                      </motion.p>
                    ) : (
                      <motion.p
                        key="hint"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-xs text-gray-400"
                      >
                        Internal name — not visible to affiliates
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <Label
                    htmlFor="campaign-desc"
                    className="text-[13px] font-medium text-gray-700"
                  >
                    Description{" "}
                    <span className="text-gray-400 font-normal">(optional)</span>
                  </Label>
                  <Textarea
                    id="campaign-desc"
                    placeholder="What's this campaign about?"
                    {...register("description")}
                    rows={2}
                    className="text-sm border-gray-200 resize-none focus:border-[#1fb5a5] focus:ring-1 focus:ring-blue-100 transition-all duration-200"
                  />
                </div>
              </motion.div>

              {/* ── Section 2: Commission (THE CENTERPIECE) ────────── */}
              <motion.div variants={itemVariants} className="space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-6 h-6 rounded-full bg-[#1c2260] text-white text-[11px] font-bold flex items-center justify-center">
                    2
                  </span>
                  <span className="text-sm font-semibold text-gray-800">
                    Commission Structure
                  </span>
                </div>

                {/* Commission Type Cards */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setValue("commissionType", "percentage")}
                    className={`relative rounded-xl p-4 text-left transition-all duration-200 border-2 ${
                      commissionType === "percentage"
                        ? "border-[#1c2260] bg-blue-50/60 shadow-sm"
                        : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
                    }`}
                  >
                    {commissionType === "percentage" && (
                      <motion.div
                        layoutId="commission-type-indicator"
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#1c2260] flex items-center justify-center"
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 25,
                        }}
                      >
                        <CheckCircle2 className="w-3 h-3 text-white" />
                      </motion.div>
                    )}
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg transition-colors duration-200 ${
                          commissionType === "percentage"
                            ? "bg-[#1c2260]/10 text-[#1c2260]"
                            : "bg-gray-100 text-gray-400"
                        }`}
                      >
                        <Percent className="w-5 h-5" />
                      </span>
                      <div>
                        <div className="text-sm font-semibold text-gray-800">
                          Recurring %
                        </div>
                        <div className="text-[11px] text-gray-500 mt-0.5">
                          % of each payment — best for SaaS
                        </div>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setValue("commissionType", "flatFee")}
                    className={`relative rounded-xl p-4 text-left transition-all duration-200 border-2 ${
                      commissionType === "flatFee"
                        ? "border-[#1c2260] bg-blue-50/60 shadow-sm"
                        : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
                    }`}
                  >
                    {commissionType === "flatFee" && (
                      <motion.div
                        layoutId="commission-type-indicator"
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#1c2260] flex items-center justify-center"
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 25,
                        }}
                      >
                        <CheckCircle2 className="w-3 h-3 text-white" />
                      </motion.div>
                    )}
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg transition-colors duration-200 ${
                          commissionType === "flatFee"
                            ? "bg-[#1c2260]/10 text-[#1c2260]"
                            : "bg-gray-100 text-gray-400"
                        }`}
                      >
                        <Banknote className="w-5 h-5" />
                      </span>
                      <div>
                        <div className="text-sm font-semibold text-gray-800">
                          Flat Fee
                        </div>
                        <div className="text-[11px] text-gray-500 mt-0.5">
                          Fixed amount per referral
                        </div>
                      </div>
                    </div>
                  </button>
                </div>

                {/* Rate Input + Live Preview */}
                <div className="space-y-3">
                  {/* Rate input */}
                  <div className="space-y-1.5">
                    <Label className="text-[13px] font-medium text-gray-700">
                      {commissionType === "percentage"
                        ? "Commission Rate *"
                        : "Fee Amount *"}
                    </Label>
                    <div className="relative">
                      <Input
                        type="number"
                        placeholder={commissionType === "percentage" ? "20" : "500"}
                        {...register("commissionRate")}
                        className={`h-10 text-sm pr-8 transition-all duration-200 ${
                          errors.commissionRate
                            ? "border-rose-500 ring-1 ring-rose-100"
                            : "border-gray-200 focus:border-[#1fb5a5] focus:ring-1 focus:ring-blue-100"
                        }`}
                        min={commissionType === "percentage" ? 1 : 0}
                        max={
                          commissionType === "percentage" ? 100 : undefined
                        }
                        step={commissionType === "percentage" ? 0.01 : 1}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
                        {commissionType === "percentage" ? "%" : "₱"}
                      </span>
                    </div>
                    <AnimatePresence mode="wait">
                      {errors.commissionRate ? (
                        <motion.p
                          key="error"
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          className="text-xs text-rose-500"
                        >
                          {errors.commissionRate.message}
                        </motion.p>
                      ) : null}
                    </AnimatePresence>
                  </div>

                  {/* Live Preview */}
                  <div>
                    <Label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5 block">
                      Live Preview
                    </Label>
                    <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-green-50/50 border border-emerald-200/60 p-4">
                      <div className="flex items-start gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-lg font-bold text-emerald-800 tabular-nums leading-tight">
                            <AnimatedNumber
                              value={commission}
                              format={(v) => formatCurrency(v)}
                              springConfig={{
                                stiffness: 100,
                                damping: 18,
                                mass: 0.6,
                              }}
                            />
                          </div>
                          <div className="text-[11px] text-emerald-600 mt-0.5">
                            per{" "}
                            {commissionType === "percentage"
                              ? `₱1,000 sale`
                              : "referral"}
                          </div>
                          <div className="text-[10px] text-emerald-500/80 mt-1 font-mono">
                            {commissionType === "percentage"
                              ? `₱1,000 × ${rate || 0}%`
                              : `₱${rate || 0} flat`}
                          </div>

                          {/* Recurring sub-preview */}
                          <AnimatePresence>
                            {recurringCommissions && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mt-2 pt-2 border-t border-emerald-200/50"
                              >
                                <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-medium">
                                  <Repeat className="w-3 h-3" />
                                  <AnimatedNumber
                                    value={recurringCommission}
                                    format={(v) => formatCurrency(v)}
                                    springConfig={{
                                      stiffness: 100,
                                      damping: 18,
                                      mass: 0.6,
                                    }}
                                  />
                                  <span className="text-emerald-500 font-normal">
                                    /renewal
                                  </span>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* ── Section 3: Tracking (Accordion) ────────────────── */}
              <motion.div variants={itemVariants}>
                <AccordionSection
                  title="Tracking & Cookie"
                  description="How long to track referrals after a click"
                  icon={<TrendingUp className="w-4 h-4" />}
                  defaultOpen={false}
                >
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="cookie-duration"
                      className="text-[13px] font-medium text-gray-700"
                    >
                      Cookie Duration (days)
                    </Label>
                    <Input
                      id="cookie-duration"
                      type="number"
                      {...register("cookieDuration")}
                      className={`h-10 text-sm transition-all duration-200 ${
                        errors.cookieDuration
                          ? "border-rose-500 ring-1 ring-rose-100"
                          : "border-gray-200 focus:border-[#1fb5a5] focus:ring-1 focus:ring-blue-100"
                      }`}
                      min={1}
                      max={365}
                    />
                    {errors.cookieDuration ? (
                      <p className="text-xs text-rose-500">
                        {errors.cookieDuration.message}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400">
                        1–365 days. Default: 30
                      </p>
                    )}
                  </div>
                </AccordionSection>
              </motion.div>

              {/* ── Section 4: Recurring (Accordion) ───────────────── */}
              <motion.div variants={itemVariants}>
                <AccordionSection
                  title="Recurring Commissions"
                  description="Earn on subscription renewals"
                  icon={<Repeat className="w-4 h-4" />}
                  defaultOpen={false}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-[13px] font-medium text-gray-700">
                          Enable Recurring
                        </Label>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Affiliates earn on every billing cycle
                        </p>
                      </div>
                      <Switch
                        checked={recurringCommissions}
                        className="data-[state=unchecked]:bg-gray-300 data-[state=unchecked]:border-gray-300"
                        onCheckedChange={(checked) => {
                          setValue("recurringCommissions", checked);
                          if (!checked) {
                            setValue("recurringRateType", "same");
                            setValue("recurringRate", "");
                          }
                        }}
                      />
                    </div>

                    <AnimatePresence>
                      {recurringCommissions && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-3 overflow-hidden"
                        >
                          <div className="space-y-1.5">
                            <Label className="text-[13px] font-medium text-gray-700">
                              Rate Type
                            </Label>
                            <Select
                              value={recurringRateType}
                              onValueChange={(
                                value: "same" | "reduced" | "custom"
                              ) => {
                                setValue("recurringRateType", value);
                                if (value === "same") setValue("recurringRate", "");
                              }}
                            >
                              <SelectTrigger className="h-10 text-sm border-gray-200">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="same">
                                  Same as Initial
                                </SelectItem>
                                <SelectItem value="reduced">
                                  Reduced Rate
                                </SelectItem>
                                <SelectItem value="custom">
                                  Custom Rate
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {(recurringRateType === "reduced" ||
                            recurringRateType === "custom") && (
                            <div className="space-y-1.5">
                              <Label className="text-[13px] font-medium text-gray-700">
                                {recurringRateType === "reduced"
                                  ? "Reduced Rate (%)"
                                  : "Custom Rate (%)"}
                              </Label>
                              <div className="relative">
                                <Input
                                  type="number"
                                  placeholder={
                                    recurringRateType === "reduced" ? "5" : "10"
                                  }
                                  {...register("recurringRate")}
                                  className={`h-10 text-sm pr-8 transition-all duration-200 ${
                                    errors.recurringRate
                                      ? "border-rose-500 ring-1 ring-rose-100"
                                      : "border-gray-200 focus:border-[#1fb5a5] focus:ring-1 focus:ring-blue-100"
                                  }`}
                                  min={1}
                                  max={100}
                                  step={0.01}
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
                                  %
                                </span>
                              </div>
                              {errors.recurringRate ? (
                                <p className="text-xs text-rose-500">
                                  {errors.recurringRate.message}
                                </p>
                              ) : recurringRateType === "reduced" ? (
                                <p className="text-xs text-gray-400">
                                  {DEFAULT_REDUCED_RATE_PERCENTAGE}% of initial ={" "}
                                  {(
                                    (Number(commissionRate) || 0) *
                                    (DEFAULT_REDUCED_RATE_PERCENTAGE / 100)
                                  ).toFixed(1)}
                                  %
                                </p>
                              ) : null}
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </AccordionSection>
              </motion.div>

              {/* ── Section 5: Auto-Approve (Accordion) ────────────── */}
              <motion.div variants={itemVariants}>
                <AccordionSection
                  title="Approval Rules"
                  description="Automate commission approvals"
                  icon={<Shield className="w-4 h-4" />}
                  defaultOpen={false}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-[13px] font-medium text-gray-700">
                          Auto-approve Commissions
                        </Label>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Skip manual review for qualifying commissions
                        </p>
                      </div>
                      <Switch
                        checked={autoApproveCommissions}
                        className="data-[state=unchecked]:bg-gray-300 data-[state=unchecked]:border-gray-300"
                        onCheckedChange={(checked) => setValue("autoApproveCommissions", checked)}
                      />
                    </div>

                    <AnimatePresence>
                      {autoApproveCommissions && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-1.5 overflow-hidden"
                        >
                          <Label
                            htmlFor="approval-threshold"
                            className="text-[13px] font-medium text-gray-700"
                          >
                            Threshold (₱){" "}
                            <span className="text-gray-400 font-normal">
                              (optional)
                            </span>
                          </Label>
                          <Input
                            id="approval-threshold"
                            type="number"
                            placeholder="e.g. 500"
                            {...register("approvalThreshold")}
                            className={`h-10 text-sm transition-all duration-200 ${
                              errors.approvalThreshold
                                ? "border-rose-500 ring-1 ring-rose-100"
                                : "border-gray-200 focus:border-[#1fb5a5] focus:ring-1 focus:ring-blue-100"
                            }`}
                            min={0}
                            max={10000000}
                          />
                          {errors.approvalThreshold ? (
                            <p className="text-xs text-rose-500">
                              {errors.approvalThreshold.message}
                            </p>
                          ) : (
                            <p className="text-xs text-gray-400">
                              Leave empty to auto-approve all
                            </p>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </AccordionSection>
              </motion.div>
            </motion.div>

            {/* ── Footer ──────────────────────────────────────────── */}
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="h-10 px-5 text-sm border-gray-200"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading || isLimitReached}
                className="h-10 px-5 text-sm bg-[#1c2260] hover:bg-[#1fb5a5]"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Campaign"
                )}
              </Button>
            </div>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
