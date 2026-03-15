import { Heading, Text, Link, Hr } from "@react-email/components";
import React from "react";
import { BaseEmail, styles } from "./components/BaseEmail";

interface AffiliateSuspensionEmailProps {
  affiliateName: string;
  portalName: string;
  brandLogoUrl?: string;
  brandPrimaryColor?: string;
  reason?: string;
  contactEmail?: string;
}

export default function AffiliateSuspensionEmail({
  affiliateName,
  portalName,
  brandLogoUrl,
  brandPrimaryColor = "#10409a",
  reason,
  contactEmail,
}: AffiliateSuspensionEmailProps) {
  const reasonLabels: Record<string, string> = {
    "Policy Violation": "Policy Violation",
    "Inactivity": "Inactivity",
    "Performance": "Performance",
    "Other": "Other",
  };

  return (
    <BaseEmail
      previewText={`Your ${portalName} affiliate account has been suspended`}
      brandName={portalName}
      brandLogoUrl={brandLogoUrl}
    >
      <Heading style={styles.h1}>Hello, {affiliateName}</Heading>

      <Text style={styles.text}>
        We regret to inform you that your affiliate account with{" "}
        <strong>{portalName}</strong> has been suspended.
      </Text>

      {reason && (
        <>
          <Hr style={{ margin: "24px 0" }} />

          <Text style={styles.text}>
            <strong>Reason for suspension:</strong>
          </Text>

          <div
            style={{
              ...styles.code,
              backgroundColor: "#FEF3C7",
              borderColor: "#F59E0B",
              borderLeft: "4px solid #F59E0B",
            }}
          >
            <Text style={{ ...styles.text, margin: "8px 0" }}>
              {reasonLabels[reason] || reason}
            </Text>
          </div>
        </>
      )}

      <Hr style={{ margin: "24px 0" }} />

      <Text style={styles.text}>
        While your account is suspended:
      </Text>

      <ul style={{ ...styles.text, paddingLeft: "24px" }}>
        <li>You cannot log in to the affiliate portal</li>
        <li>Your referral links are temporarily disabled</li>
        <li>Pending commissions are preserved but will not be processed</li>
      </ul>

      <Text style={styles.text}>
        If you believe this suspension was made in error, or if you would like to
        discuss reactivating your account, please contact the program administrator.
      </Text>

      {contactEmail && (
        <Text style={styles.text}>
          Contact: <Link href={`mailto:${contactEmail}`}>{contactEmail}</Link>
        </Text>
      )}

      <Text style={{ ...styles.text, marginTop: "32px", color: "#898989" }}>
        We appreciate your understanding.
      </Text>

      <Text style={{ ...styles.text, color: "#898989" }}>
        The {portalName} Team
      </Text>
    </BaseEmail>
  );
}
