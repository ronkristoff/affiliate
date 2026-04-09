import { Heading, Text, Section } from "@react-email/components";
import { BaseEmail, styles } from "./components/BaseEmail";
import React from "react";

interface PasswordChangedEmailProps {
  brandName?: string;
  brandTagline?: string;
  brandLogoUrl?: string;
}

export default function PasswordChangedEmail({
  brandName,
  brandTagline,
  brandLogoUrl,
}: PasswordChangedEmailProps) {
  return (
    <BaseEmail
      previewText="Your password has been successfully changed"
      brandName={brandName}
      brandTagline={brandTagline}
      brandLogoUrl={brandLogoUrl}
    >
      <Section style={{ padding: "40px 0 20px 0", textAlign: "center" as const }}>
        <Heading style={{ ...styles.h1, fontSize: "28px", color: "#1c2260" }}>
          Password Successfully Changed
        </Heading>
      </Section>

      <Text style={{ ...styles.text, fontSize: "16px", lineHeight: "1.6" }}>
        Your password was successfully updated. If you made this change, no
        further action is required.
      </Text>

      <Section style={{ marginTop: "32px", paddingTop: "20px", borderTop: "1px solid #e5e7eb" }}>
        <Text
          style={{
            ...styles.text,
            color: "#dc2626",
            fontSize: "14px",
            lineHeight: "1.6",
            fontWeight: "600",
          }}
        >
          If you did not change your password, your account may be
          compromised. Please contact support immediately and change your
          password again.
        </Text>
      </Section>
    </BaseEmail>
  );
}
