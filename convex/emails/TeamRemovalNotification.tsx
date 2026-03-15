import { Heading, Text, Section } from "@react-email/components";
import React from "react";
import { BaseEmail, styles } from "./components/BaseEmail";

export interface TeamRemovalEmailProps {
  userEmail: string;
  userName?: string;
  tenantName: string;
  removedByEmail: string;
  removedAt: string;
  reason?: string;
  brandName?: string;
  brandTagline?: string;
  brandLogoUrl?: string;
}

export default function TeamRemovalEmail({
  userEmail,
  userName,
  tenantName,
  removedByEmail,
  removedAt,
  reason,
  brandName,
  brandTagline,
  brandLogoUrl,
}: TeamRemovalEmailProps) {
  const formattedDate = new Date(removedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const displayName = userName || userEmail.split("@")[0];

  return (
    <BaseEmail
      previewText={`You've been removed from ${tenantName}`}
      brandName={brandName}
      brandTagline={brandTagline}
      brandLogoUrl={brandLogoUrl}
    >
      <Heading style={styles.h1}>Access Removed</Heading>

      <Text style={styles.text}>
        Hello {displayName},
      </Text>

      <Text style={styles.text}>
        This email confirms that your access to <strong>{tenantName}</strong> has been removed by{" "}
        <strong>{removedByEmail}</strong> on <strong>{formattedDate}</strong>.
      </Text>

      <Section
        style={{
          backgroundColor: "#f4f4f4",
          padding: "16px",
          borderRadius: "8px",
          margin: "24px 0",
        }}
      >
        <Text style={{ ...styles.text, margin: "0 0 8px 0", fontWeight: "bold" }}>
          Team Details:
        </Text>
        <Text style={{ ...styles.text, margin: "4px 0" }}>
          Organization: {tenantName}
        </Text>
        <Text style={{ ...styles.text, margin: "4px 0" }}>
          Removed by: {removedByEmail}
        </Text>
        <Text style={{ ...styles.text, margin: "4px 0" }}>
          Date: {formattedDate}
        </Text>
        {reason && (
          <Text style={{ ...styles.text, margin: "4px 0" }}>
            Reason: {reason}
          </Text>
        )}
      </Section>

      <Text style={styles.text}>
        You will no longer be able to access this organization's account or any associated data. If you believe this was done in error, please contact the person who removed you or reach out to the organization directly.
      </Text>

      <Text
        style={{
          ...styles.text,
          color: "#898989",
          fontSize: "12px",
          marginTop: "32px",
        }}
      >
        This is an automated notification. Please do not reply to this email.
      </Text>
    </BaseEmail>
  );
}
