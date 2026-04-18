import { Heading, Link, Text, Section, Button, Row, Column } from "@react-email/components";
import { BaseEmail, styles } from "./components/BaseEmail";
import React from "react";

interface ResetPasswordEmailProps {
  url: string;
  brandName?: string;
  brandTagline?: string;
  brandLogoUrl?: string;
}

export default function ResetPasswordEmail({
  url,
  brandName,
  brandTagline,
  brandLogoUrl,
}: ResetPasswordEmailProps) {
  return (
    <BaseEmail
      previewText="Reset your password"
      brandName={brandName}
      brandTagline={brandTagline}
      brandLogoUrl={brandLogoUrl}
    >
      <Section style={{ padding: "40px 0 20px 0", textAlign: "center" as const }}>
        <Heading style={{ ...styles.h1, fontSize: "28px", color: "#1c2260" }}>
          Reset Your Password
        </Heading>
      </Section>

      <Text style={{ ...styles.text, fontSize: "16px", lineHeight: "1.6" }}>
        We received a request to reset the password for your account. Click the
        button below to choose a new password. This link will expire in 1 hour
        for security.
      </Text>

      <Section style={{ textAlign: "center" as const, padding: "24px 0" }}>
        <Button
          href={url}
          style={{
            ...styles.button,
            backgroundColor: "#1c2260",
            borderRadius: "8px",
            fontSize: "16px",
            fontWeight: "600",
            padding: "14px 32px",
            display: "inline-block",
          }}
        >
          Reset Password
        </Button>
      </Section>

      <Text style={{ ...styles.text, fontSize: "14px", lineHeight: "1.6" }}>
        If the button above doesn&apos;t work, copy and paste the following URL
        into your browser:
      </Text>

      <Text
        style={{
          ...styles.text,
          fontSize: "13px",
          wordBreak: "break-all" as const,
          color: "#555",
          backgroundColor: "#f7f7f8",
          padding: "12px 16px",
          borderRadius: "6px",
          border: "1px solid #e5e7eb",
        }}
      >
        {url}
      </Text>

      <Section style={{ marginTop: "32px", paddingTop: "20px", borderTop: "1px solid #e5e7eb" }}>
        <Text
          style={{
            ...styles.text,
            color: "#888",
            fontSize: "13px",
            margin: "0",
          }}
        >
          If you didn&apos;t request a password reset, you can safely ignore this
          email. Your password will remain unchanged.
        </Text>
      </Section>
    </BaseEmail>
  );
}
