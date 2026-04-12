"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useRouter, useSearchParams } from "next/navigation";

const codeSchema = z.object({
  code: z.string().min(1, "Code is required"),
});

type CodeFormData = z.infer<typeof codeSchema>;

export default function TwoFactorVerification() {
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");

  const form = useForm<CodeFormData>({
    resolver: zodResolver(codeSchema),
    defaultValues: {
      code: "",
    },
  });

  // Resend cooldown timer
  const startCooldown = () => {
    setResendCooldown(30);
    const interval = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleOtpSend = async () => {
    setLoading(true);
    setError(null);
    const result = await authClient.twoFactor.sendOtp();
    if (result.error) {
      setLoading(false);
      setError(result.error.message || "Failed to send verification code.");
      return;
    }
    setOtpSent(true);
    startCooldown();
    setLoading(false);
  };

  const handleOtpVerify = async (code: string) => {
    setLoading(true);
    setError(null);
    const result = await authClient.twoFactor.verifyOtp({ code });
    if (result.error) {
      setLoading(false);
      setError(result.error.message || "Invalid code. Please try again.");
      return;
    }
    // Soft navigate — ConvexBetterAuthProvider is already mounted in root layout,
    // so it picks up the session update from verifyOtp without reinitializing.
    router.push(callbackUrl || "/dashboard");
  };

  // Submit handler: only called when OTP has been sent and user enters code
  const onSubmit = (data: CodeFormData) => {
    if (!data.code || data.code.length !== 6 || !/^[0-9]+$/.test(data.code)) {
      form.setError("code", { message: "Enter a valid 6-digit code" });
      return;
    }
    handleOtpVerify(data.code);
  };

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle className="text-lg md:text-xl">
          Two-Factor Authentication
        </CardTitle>
        <CardDescription className="text-xs md:text-sm">
          Verify your identity to continue
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {error && (
              <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {!otpSent && (
              <div className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg">
                <p>Click below to receive a verification code via email.</p>
              </div>
            )}

            {otpSent && (
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Verification Code</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="Enter 6-digit code"
                        disabled={loading}
                        inputMode="numeric"
                        maxLength={6}
                        autoFocus
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {!otpSent ? (
              <Button
                type="button"
                className="w-full"
                disabled={loading}
                onClick={handleOtpSend}
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : "Send Verification Code"}
              </Button>
            ) : (
              <>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 size={16} className="animate-spin" /> : "Verify"}
                </Button>

                <div className="text-center">
                  {resendCooldown > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Resend available in {resendCooldown}s
                    </p>
                  ) : (
                    <button
                      type="button"
                      className="text-xs text-[#1c2260] font-medium hover:underline disabled:opacity-50"
                      disabled={loading}
                      onClick={handleOtpSend}
                    >
                      Resend verification code
                    </button>
                  )}
                </div>
              </>
            )}

            <Button
              type="button"
              className="w-full"
              variant="outline"
              disabled={loading}
              onClick={() => router.push("/sign-in")}
            >
              Cancel
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
