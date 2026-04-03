"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { Loader2, AlertCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const signInSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type SignInFormData = {
  email: string;
  password: string;
};

interface TenantBranding {
  portalName: string;
  primaryColor: string;
  logoUrl?: string;
}

interface AffiliateSignInFormProps {
  tenantSlug: string;
  redirectUrl?: string;
  tenantBranding?: TenantBranding;
}

export function AffiliateSignInForm({
  tenantSlug,
  redirectUrl = "/portal/home",
  tenantBranding,
}: AffiliateSignInFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<"pending" | "suspended" | "rejected" | "invalid" | null>(null);

  const primaryColor = tenantBranding?.primaryColor || "#1c2260";

  const form = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: SignInFormData) => {
    setIsLoading(true);
    setError(null);
    setErrorType(null);

    try {
      const response = await fetch("/api/affiliate-auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "login",
          tenantSlug,
          email: data.email,
          password: data.password,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        const errorMessage = result.error || "Invalid email or password";
        setError(errorMessage);

        if (errorMessage.includes("pending approval")) {
          setErrorType("pending");
        } else if (errorMessage.includes("suspended")) {
          setErrorType("suspended");
        } else if (errorMessage.includes("rejected")) {
          setErrorType("rejected");
        } else {
          setErrorType("invalid");
        }

        return;
      }

      router.push(redirectUrl);
      router.refresh();
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
      setErrorType("invalid");
    } finally {
      setIsLoading(false);
    }
  };

  const renderError = () => {
    if (!error) return null;

    const baseClasses = "p-3 text-sm rounded-lg flex items-start gap-2";

    if (errorType === "pending") {
      return (
        <div className={cn(baseClasses, "bg-amber-50 border border-amber-200 text-amber-800")}>
          <Clock className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Account Pending Approval</p>
            <p className="text-xs mt-1">{error}</p>
          </div>
        </div>
      );
    }

    if (errorType === "suspended" || errorType === "rejected") {
      return (
        <div className={cn(baseClasses, "bg-red-50 border border-red-200 text-red-800")}>
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">
              {errorType === "suspended" ? "Account Suspended" : "Application Rejected"}
            </p>
            <p className="text-xs mt-1">{error}</p>
            {errorType === "suspended" && (
              <p className="text-xs mt-1">Please contact support for assistance.</p>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className={cn(baseClasses, "bg-red-50 border border-red-200 text-red-600")}>
        <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <p>{error}</p>
      </div>
    );
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {renderError()}

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
              <div className="flex items-center justify-between">
                <FormLabel>Password</FormLabel>
                <a
                  href="#"
                  className="text-xs font-medium hover:underline"
                  style={{ color: primaryColor }}
                  onClick={(e) => {
                    e.preventDefault();
                    // TODO: Implement password reset flow
                  }}
                >
                  Forgot password?
                </a>
              </div>
              <FormControl>
                <Input
                  type="password"
                  placeholder="Enter your password"
                  disabled={isLoading}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className="w-full h-11"
          disabled={isLoading}
          style={{ backgroundColor: primaryColor }}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing in…
            </>
          ) : (
            "Sign In"
          )}
        </Button>
      </form>
    </Form>
  );
}
