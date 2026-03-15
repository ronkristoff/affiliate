"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Loader2, CheckCircle2, Users, TrendingUp } from "lucide-react";

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
      // Execute reCAPTCHA verification
      let recaptchaToken: string | null = null;
      
      if (executeRecaptcha) {
        try {
          recaptchaToken = await executeRecaptcha("affiliate_registration");
        } catch (recaptchaError) {
          console.error("reCAPTCHA execution failed:", recaptchaError);
          setError("Unable to verify - please check your connection and try again");
          setIsLoading(false);
          return;
        }
      }

      if (!recaptchaToken) {
        setError("Verification failed - please try again");
        setIsLoading(false);
        return;
      }

      const result = await signUp({ 
        ...data, 
        tenantSlug,
        promotionChannel: data.promotionChannel,
        recaptchaToken,
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
  }, [executeRecaptcha, signUp, tenantSlug]);

  // Show success state - pending approval overlay
  if (success) {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-4">
          <div 
            className="mx-auto w-16 h-16 rounded-full flex items-center justify-center"
            style={{ backgroundColor: `${primaryColor}15` }}
          >
            <CheckCircle2 
              className="w-8 h-8" 
              style={{ color: primaryColor }}
            />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Application Submitted!</h3>
            <p className="text-sm text-muted-foreground">
              Your application to join {portalName} has been submitted successfully.
            </p>
          </div>
        </div>
        
        <div 
          className="rounded-lg p-4 text-center space-y-2"
          style={{ backgroundColor: `${primaryColor}08` }}
        >
          <p className="text-sm font-medium" style={{ color: primaryColor }}>
            Pending Approval
          </p>
          <p className="text-xs text-muted-foreground">
            Typically takes 1-2 business days. You&apos;ll receive an email once your application is approved.
          </p>
        </div>
        
        <div className="text-center text-xs text-muted-foreground">
          {/* TODO: Add contactEmail to tenant branding schema and display here */}
          <p>Questions? Contact the merchant directly.</p>
        </div>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <Button 
          type="submit" 
          className="w-full" 
          disabled={isLoading}
          style={{ backgroundColor: primaryColor }}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating Account...
            </>
          ) : (
            "Apply to Join"
          )}
        </Button>

        {/* Trust Signals - Sample data for demonstration purposes only */}
        <div className="pt-4 border-t space-y-3">
          <p className="text-xs text-muted-foreground text-center italic">
            *Sample data for demonstration
          </p>
          <div className="flex justify-center items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              <span>Join our growing affiliate community</span>
            </div>
          </div>
        </div>

        {/* Terms and Privacy - TODO: Implement actual Terms and Privacy pages */}
        <div className="text-xs text-muted-foreground text-center">
          <p>
            By applying, you agree to receive communications about your affiliate application.
            {/* TODO: Add links to actual Terms of Service and Privacy Policy pages when implemented */}
          </p>
        </div>
      </form>
    </Form>
  );
}
