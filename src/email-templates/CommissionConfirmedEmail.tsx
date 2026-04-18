import { Heading, Text, Link, Hr } from "@react-email/components";
import React from "react";
import { BaseEmail, styles } from "./components/BaseEmail";

interface CommissionConfirmedEmailProps {
  affiliateName: string;
  commissionAmount: number;
  campaignName: string;
  conversionDate: number;
  transactionId?: string;
  customerPlanType?: string;
  portalName: string;
  brandLogoUrl?: string;
  brandPrimaryColor?: string;
  portalEarningsUrl?: string;
  contactEmail?: string;
  currency?: string; // Tenant's configured currency (default: PHP)
}

export default function CommissionConfirmedEmail({
  affiliateName,
  commissionAmount,
  campaignName,
  conversionDate,
  transactionId,
  customerPlanType,
  portalName,
  brandLogoUrl,
  brandPrimaryColor = "#1c2260",
  portalEarningsUrl,
  contactEmail,
  currency = "PHP",
}: CommissionConfirmedEmailProps) {
  const primaryColor = brandPrimaryColor;
  const formattedAmount = commissionAmount.toLocaleString("en-US", {
    style: "currency",
    currency,
  });
  const formattedDate = new Date(conversionDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <BaseEmail
      previewText={`Commission Confirmed: ${formattedAmount} earned!`}
      brandName={portalName}
      brandLogoUrl={brandLogoUrl}
    >
      <Heading style={styles.h1}>Congratulations, {affiliateName}! 🎉</Heading>

      <Text style={styles.text}>
        Your commission has been confirmed and added to your earnings!
      </Text>

      <Hr style={{ margin: "24px 0" }} />

      <Text style={styles.text}>
        <strong>Commission Details:</strong>
      </Text>

      <div style={{
        ...styles.code,
        backgroundColor: `${primaryColor}10`,
        borderColor: primaryColor,
      }}>
        <Text style={{ ...styles.text, margin: "8px 0", fontSize: "18px", fontWeight: 600 }}>
          Amount: <span style={{ color: primaryColor }}>{formattedAmount}</span>
        </Text>
        <Text style={{ ...styles.text, margin: "8px 0" }}>
          Campaign: <strong>{campaignName}</strong>
        </Text>
        <Text style={{ ...styles.text, margin: "8px 0" }}>
          Date: {formattedDate}
        </Text>
        {transactionId && (
          <Text style={{ ...styles.text, margin: "8px 0", fontSize: "12px", color: "#666" }}>
            Transaction ID: {transactionId}
          </Text>
        )}
        {customerPlanType && (
          <Text style={{ ...styles.text, margin: "8px 0" }}>
            Customer Plan: {customerPlanType}
          </Text>
        )}
      </div>

      <Hr style={{ margin: "24px 0" }} />

      <Text style={styles.text}>
        This commission will be included in your next payout batch once it meets the minimum payout threshold.
      </Text>

      {portalEarningsUrl && (
        <Link href={portalEarningsUrl} style={{
          ...styles.button,
          backgroundColor: primaryColor,
        }}>
          View Your Earnings
        </Link>
      )}

      <Text style={{ ...styles.text, marginTop: "32px", color: "#898989" }}>
        Thank you for being an affiliate with {portalName}!
      </Text>

      {contactEmail && (
        <Text style={{ ...styles.text, fontSize: "12px", color: "#898989" }}>
          Questions? Contact us at <Link href={`mailto:${contactEmail}`}>{contactEmail}</Link>
        </Text>
      )}
    </BaseEmail>
  );
}
