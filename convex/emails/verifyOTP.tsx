import React from "react";
import { Heading, Text, Section } from "@react-email/components";
import { BaseEmail, styles } from "./components/BaseEmail";

interface VerifyOTPProps {
  code: string;
  brandName?: string;
  brandTagline?: string;
  brandLogoUrl?: string;
  /** Context for why the OTP was sent */
  purpose?: "email-verification" | "sign-in" | "forget-password" | "2fa";
}

export default function VerifyOTP({
  code,
  brandName,
  brandTagline,
  brandLogoUrl,
  purpose = "email-verification",
}: VerifyOTPProps) {
  const isForgotPassword = purpose === "forget-password";
  const isSignIn = purpose === "sign-in";
  const is2fa = purpose === "2fa";

  const headingText = isForgotPassword
    ? "Reset Your Password"
    : isSignIn
      ? "Sign In to Your Account"
      : is2fa
        ? "Two-Factor Authentication"
        : "Verify Your Email";

  const bodyText = isForgotPassword
    ? "We received a request to reset the password for your account. Use the verification code below to proceed. This code will expire in 5 minutes for security."
    : isSignIn
      ? "Use the verification code below to sign in to your account. This code will expire in 5 minutes."
      : is2fa
        ? "Use the verification code below to complete your sign-in. This code will expire in 5 minutes."
        : "Use the verification code below to verify your email address. This code will expire in 5 minutes.";

  const disclaimerText = isForgotPassword
    ? "If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged."
    : isSignIn
      ? "If you didn't attempt to sign in, you can safely ignore this email."
      : is2fa
        ? "If you didn't attempt to sign in, you can safely ignore this email."
        : "If you didn't create an account, you can safely ignore this email.";

  return (
    <BaseEmail
      previewText={isForgotPassword ? "Reset your password" : is2fa ? "Your verification code" : "Your verification code"}
      brandName={brandName}
      brandTagline={brandTagline}
      brandLogoUrl={brandLogoUrl}
    >
      <Section style={{ padding: "40px 0 20px 0", textAlign: "center" as const }}>
        <Heading style={{ ...styles.h1, fontSize: "28px", color: "#1c2260" }}>
          {headingText}
        </Heading>
      </Section>

      <Text style={{ ...styles.text, fontSize: "16px", lineHeight: "1.6" }}>
        {bodyText}
      </Text>

      <Section style={{ textAlign: "center" as const, padding: "24px 0" }}>
        <code
          style={{
            ...styles.code,
            fontSize: "32px",
            fontWeight: "700",
            letterSpacing: "8px",
            textAlign: "center" as const,
            color: "#1c2260",
            backgroundColor: "#f7f7f8",
            border: "2px solid #e5e7eb",
            borderRadius: "8px",
            padding: "20px 40px",
            display: "inline-block",
          }}
        >
          {code}
        </code>
      </Section>

      <Section style={{ marginTop: "32px", paddingTop: "20px", borderTop: "1px solid #e5e7eb" }}>
        <Text
          style={{
            ...styles.text,
            color: "#888",
            fontSize: "13px",
            margin: "0",
          }}
        >
          {disclaimerText}
        </Text>
      </Section>
    </BaseEmail>
  );
}
