"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from "@/components/ui/input-otp";
import { Loader2, Mail, ArrowLeft } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useRouter, useSearchParams } from "next/navigation";

export default function TwoFactorVerification() {
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");
  const hasSentInitial = useRef(false);

  // Auto-send OTP on mount
  useEffect(() => {
    if (hasSentInitial.current) return;
    hasSentInitial.current = true;

    const sendInitialOtp = async () => {
      setSendingEmail(true);
      setError(null);
      const result = await authClient.twoFactor.sendOtp();
      if (result.error) {
        setSendingEmail(false);
        setError(result.error.message || "Failed to send verification code.");
      } else {
        setSuccess(true);
        setSendingEmail(false);
        startCooldown();
        // Clear success message after 3s
        setTimeout(() => setSuccess(false), 3000);
      }
    };

    sendInitialOtp();
  }, []);

  // Cooldown timer
  const startCooldown = useCallback(() => {
    setResendCooldown(60);
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;

    const timer = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleResend = async () => {
    if (resendCooldown > 0 || loading) return;
    setLoading(true);
    setError(null);
    const result = await authClient.twoFactor.sendOtp();
    if (result.error) {
      setLoading(false);
      setError(result.error.message || "Failed to resend verification code.");
      return;
    }
    setSuccess(true);
    startCooldown();
    setLoading(false);
    // Clear success message after 3s
    setTimeout(() => setSuccess(false), 3000);
    // Clear current OTP so user enters fresh code
    setOtp("");
  };

  const handleVerify = async () => {
    if (otp.length !== 6 || !/^[0-9]+$/.test(otp)) {
      setError("Enter a valid 6-digit code");
      return;
    }
    setVerifying(true);
    setError(null);
    const result = await authClient.twoFactor.verifyOtp({ code: otp });
    if (result.error) {
      setVerifying(false);
      setError(result.error.message || "Invalid code. Please try again.");
      return;
    }
    // Soft navigate — ConvexBetterAuthProvider is already mounted in root layout
    router.push(callbackUrl || "/dashboard");
  };

  // Auto-submit when all 6 digits are entered
  useEffect(() => {
    if (otp.length === 6 && /^[0-9]+$/.test(otp)) {
      handleVerify();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

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
        <div className="space-y-5">
          {/* Status messages */}
          {error && (
            <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800 rounded-lg p-3">
              <p className="text-sm text-green-600 dark:text-green-400">
                Verification code sent to your email.
              </p>
            </div>
          )}

          {sendingEmail && (
            <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
              <Loader2 size={18} className="animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Sending verification code to your email...
              </p>
            </div>
          )}

          {/* OTP Input */}
          {!sendingEmail && (
            <>
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail size={16} />
                  <span>Enter the 6-digit code from your email</span>
                </div>

                <InputOTP
                  maxLength={6}
                  value={otp}
                  onChange={setOtp}
                  disabled={verifying}
                  autoFocus
                  onComplete={handleVerify}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup>
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>

                {verifying && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 size={14} className="animate-spin" />
                    <span>Verifying...</span>
                  </div>
                )}
              </div>

              {/* Resend */}
              <div className="text-center">
                {resendCooldown > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Resend available in {resendCooldown}s
                  </p>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-[#1c2260] hover:text-[#1c2260]"
                    disabled={loading || verifying}
                    onClick={handleResend}
                  >
                    {loading ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : null}
                    Resend verification code
                  </Button>
                )}
              </div>
            </>
          )}

          {/* Cancel */}
          <Button
            type="button"
            className="w-full"
            variant="outline"
            disabled={sendingEmail || verifying}
            onClick={() => router.push("/sign-in")}
          >
            <ArrowLeft size={16} />
            Back to Sign In
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
