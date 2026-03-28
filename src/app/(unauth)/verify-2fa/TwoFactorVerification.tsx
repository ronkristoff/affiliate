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
import { Checkbox } from "@/components/ui/checkbox";
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
import { useRouter } from "next/navigation";

type VerificationMethod = "totp" | "otp" | "backup";

const baseSchema = z.object({
  code: z.string().min(1, "Code is required"),
  trustDevice: z.boolean().optional(),
});

type FormData = z.infer<typeof baseSchema>;

export default function TwoFactorVerification() {
  const [method, setMethod] = useState<VerificationMethod>("totp");
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const form = useForm<FormData>({
    resolver: zodResolver(baseSchema),
    defaultValues: {
      code: "",
      trustDevice: false,
    },
  });

  const validateCode = (code: string): string | null => {
    if (method === "backup") {
      if (!code || code.length < 1) return "Enter your backup code";
      if (!/^[0-9a-zA-Z-]+$/.test(code)) return "Enter a valid backup code format";
      return null;
    }
    
    // TOTP or OTP
    if (!code || code.length !== 6) return "Enter the 6-digit code";
    if (!/^[0-9]+$/.test(code)) return "Enter a valid 6-digit code";
    return null;
  };

  const handleTotpVerify = async (code: string, trustDevice: boolean) => {
    try {
      setLoading(true);
      setError(null);
      await authClient.twoFactor.verifyTotp({
        code,
        trustDevice,
        fetchOptions: {
          onRequest: () => {
            setLoading(true);
          },
          onSuccess: () => {
            setLoading(false);
            router.push("/");
          },
          onError: (ctx) => {
            setLoading(false);
            setError(ctx.error.message || "Invalid code. Please try again.");
          },
        },
      });
    } catch {
      setLoading(false);
      setError("Failed to verify code. Please try again.");
    }
  };

  const handleOtpSend = async () => {
    try {
      setLoading(true);
      setError(null);
      await authClient.twoFactor.sendOtp();
      setOtpSent(true);
    } catch {
      setLoading(false);
      setError("Failed to send verification code. Please try again.");
    }
  };

  const handleOtpVerify = async (code: string, trustDevice: boolean) => {
    try {
      setLoading(true);
      setError(null);
      await authClient.twoFactor.verifyOtp({
        code,
        trustDevice,
      });
      // Redirect will happen automatically on success
    } catch {
      setLoading(false);
      setError("Failed to verify code. Please try again.");
    }
  };

  const handleBackupCodeVerify = async (code: string) => {
    try {
      setLoading(true);
      setError(null);
      await authClient.twoFactor.verifyBackupCode({
        code,
      });
      // Redirect will happen automatically on success
    } catch {
      setLoading(false);
      setError("Invalid backup code. Please try again.");
    }
  };

  const onSubmit = (data: FormData) => {
    const codeError = validateCode(data.code);
    if (codeError) {
      form.setError("code", { message: codeError });
      return;
    }

    if (method === "totp") {
      handleTotpVerify(data.code, data.trustDevice || false);
    } else if (method === "otp") {
      if (otpSent) {
        handleOtpVerify(data.code, data.trustDevice || false);
      } else {
        handleOtpSend();
      }
    } else {
      handleBackupCodeVerify(data.code);
    }
  };

  const handleMethodChange = (newMethod: VerificationMethod) => {
    setMethod(newMethod);
    setOtpSent(false);
    setError(null);
    form.reset({ code: "", trustDevice: false });
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
        <div className="flex gap-2 mb-4">
          <Button
            type="button"
            variant={method === "totp" ? "default" : "outline"}
            onClick={() => handleMethodChange("totp")}
          >
            Authenticator App
          </Button>
          <Button
            type="button"
            variant={method === "otp" ? "default" : "outline"}
            onClick={() => handleMethodChange("otp")}
          >
            Email Code
          </Button>
          <Button
            type="button"
            variant={method === "backup" ? "default" : "outline"}
            onClick={() => handleMethodChange("backup")}
          >
            Backup Code
          </Button>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {method === "otp" && !otpSent && (
              <div className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg">
                <p>Click below to receive a verification code via email</p>
              </div>
            )}

            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {method === "totp"
                      ? "Authenticator Code"
                      : method === "otp"
                        ? "Email Verification Code"
                        : "Backup Code"}
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      placeholder={
                        method === "backup" ? "xxxx-xxxx-xxxx" : "Enter 6-digit code"
                      }
                      disabled={loading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {method !== "backup" && (
              <FormField
                control={form.control}
                name="trustDevice"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value ?? false}
                        onCheckedChange={field.onChange}
                        disabled={loading}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>
                        Trust this device for 60 days
                      </FormLabel>
                    </div>
                  </FormItem>
                )}
              />
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : method === "otp" && !otpSent ? (
                "Send Verification Code"
              ) : (
                "Verify"
              )}
            </Button>
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
