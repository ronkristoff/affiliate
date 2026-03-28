"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import { useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, CheckCircle2 } from "lucide-react";

const signUpSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
  promotionChannel: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type SignUpFormData = z.infer<typeof signUpSchema>;

interface TenantBranding {
  portalName: string;
  primaryColor: string;
  logoUrl?: string;
}

interface AffiliateSignUpFormProps {
  tenantSlug: string;
  redirectUrl?: string;
  tenantBranding?: TenantBranding;
  campaignSlug?: string;
  campaignName?: string;
  campaignId?: string;
}

const PROMOTION_CHANNELS = [
  { value: "newsletter", label: "Newsletter" },
  { value: "youtube", label: "YouTube" },
  { value: "social_media", label: "Social Media (Facebook, Instagram, TikTok)" },
  { value: "telegram_discord", label: "Telegram/Discord Community" },
  { value: "podcast", label: "Podcast" },
  { value: "blog", label: "Blog/Website" },
  { value: "other", label: "Other" },
] as const;

export function AffiliateSignUpForm({
  tenantSlug,
  redirectUrl = "/portal/login",
  tenantBranding,
  campaignSlug,
  campaignName,
}: AffiliateSignUpFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const primaryColor = tenantBranding?.primaryColor || "#10409a";
  const portalName = tenantBranding?.portalName || "our affiliate program";

  const form = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      promotionChannel: "",
    },
  });

  const signUp = useAction(api.affiliateAuth.registerAffiliateAccount);
  const { executeRecaptcha } = useGoogleReCaptcha();

  const onSubmit = useCallback(async (data: SignUpFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      let recaptchaToken: string | null = null;

      if (executeRecaptcha) {
        try {
          recaptchaToken = await executeRecaptcha("affiliate_registration");
        } catch (recaptchaError) {
          console.error("reCAPTCHA execution failed:", recaptchaError);
          setError("Unable to verify — please check your connection and try again");
          setIsLoading(false);
          return;
        }
      }

      if (!recaptchaToken) {
        setError("Verification failed — please try again");
        setIsLoading(false);
        return;
      }

      const result = await signUp({
        ...data,
        tenantSlug,
        promotionChannel: data.promotionChannel,
        recaptchaToken,
        campaignSlug,
      });

      if (result.success) {
        setSuccess(true);
      } else {
        setError(result.error || "Failed to create account");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account");
    } finally {
      setIsLoading(false);
    }
  }, [executeRecaptcha, signUp, tenantSlug, campaignSlug]);

  /* ── Success State ── */
  if (success) {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-4">
          <div
            className="mx-auto w-20 h-20 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: `${primaryColor}12` }}
          >
            <CheckCircle2
              className="w-10 h-10"
              style={{ color: primaryColor }}
            />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-heading">Application Submitted</h3>
            <p className="text-sm text-muted-foreground">
              {campaignName
                ? `Your application to join the ${campaignName} campaign has been submitted.`
                : `Your application to join ${portalName} has been submitted.`}
            </p>
          </div>
        </div>

        <div
          className="rounded-xl p-5 space-y-3"
          style={{
            backgroundColor: `${primaryColor}06`,
            border: `1px solid ${primaryColor}14`,
          }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ backgroundColor: primaryColor }}
            />
            <p className="text-sm font-semibold" style={{ color: primaryColor }}>
              Pending Approval
            </p>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Typically reviewed within 1–2 business days. You&apos;ll receive an
            email once your application is approved.
          </p>
          {campaignName && (
            <p className="text-sm text-muted-foreground leading-relaxed">
              Upon approval, you&apos;ll get your referral link to start
              promoting {campaignName}.
            </p>
          )}
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Questions? Contact the merchant directly.
        </p>
      </div>
    );
  }

  /* ── Form State ── */
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full Name</FormLabel>
              <FormControl>
                <Input
                  type="text"
                  placeholder="John Doe"
                  disabled={isLoading}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email Address</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  disabled={isLoading}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="Min. 8 characters"
                  disabled={isLoading}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirm Password</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="Re-enter password"
                  disabled={isLoading}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="promotionChannel"
          render={({ field }) => (
            <FormItem>
              <FormLabel>How will you promote us?</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your primary channel" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {PROMOTION_CHANNELS.map((channel) => (
                    <SelectItem key={channel.value} value={channel.value}>
                      {channel.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <Button
          type="submit"
          className="w-full h-11"
          disabled={isLoading}
          style={{ backgroundColor: primaryColor }}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating Account…
            </>
          ) : (
            "Apply to Join"
          )}
        </Button>
      </form>
    </Form>
  );
}
