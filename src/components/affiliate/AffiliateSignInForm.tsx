"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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

interface AffiliateSignInFormProps {
  tenantSlug: string;
  redirectUrl?: string;
}

export function AffiliateSignInForm({ tenantSlug, redirectUrl = "/portal/home" }: AffiliateSignInFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<"pending" | "suspended" | "rejected" | "invalid" | null>(null);

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
      // Call API route which sets httpOnly cookie server-side
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

        // Determine error type based on message
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

      // Session is now stored in httpOnly cookie - no localStorage needed
      // Redirect to portal home
      router.push(redirectUrl);
      router.refresh();
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
      setErrorType("invalid");
    } finally {
      setIsLoading(false);
    }
  };

  // Render error message with appropriate styling
  const renderError = () => {
    if (!error) return null;

    const baseClasses = "p-3 text-sm rounded flex items-start gap-2";
    
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {renderError()}

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-semibold text-gray-900">Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  disabled={isLoading}
                  className="border-gray-300 focus:border-brand focus:ring-brand"
                  {...field}
                />
              </FormControl>
              <FormMessage className="text-xs" />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel className="text-sm font-semibold text-gray-900">Password</FormLabel>
                <a 
                  href="#" 
                  className="text-xs text-brand hover:underline"
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
                  placeholder="••••••••"
                  disabled={isLoading}
                  className="border-gray-300 focus:border-brand focus:ring-brand"
                  {...field}
                />
              </FormControl>
              <FormMessage className="text-xs" />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-3"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing in...
            </>
          ) : (
            "Sign In"
          )}
        </Button>

        <div className="text-xs text-gray-500 text-center">
          By signing in, you agree to our{" "}
          <a href="#" className="text-brand hover:underline">Terms of Service</a>
          {" "}and{" "}
          <a href="#" className="text-brand hover:underline">Privacy Policy</a>
        </div>
      </form>
    </Form>
  );
}