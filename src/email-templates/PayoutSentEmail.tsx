import { Heading, Text, Link, Hr } from "@react-email/components";
import React from "react";
import { BaseEmail, styles } from "./components/BaseEmail";

interface PayoutSentEmailProps {
  affiliateName: string;
  payoutAmount: number;
  paymentReference?: string;
  paidAt: number;
  currency?: string; // Default: "PHP"
  portalName: string;
  brandLogoUrl?: string;
  brandPrimaryColor?: string;
  portalEarningsUrl?: string;
  contactEmail?: string;
  batchGeneratedAt?: number;
}

export default function PayoutSentEmail({
  affiliateName,
  payoutAmount,
  paymentReference,
  paidAt,
  currency = "PHP",
  portalName,
  brandLogoUrl,
  brandPrimaryColor = "#1c2260",
  portalEarningsUrl,
  contactEmail,
  batchGeneratedAt,
}: PayoutSentEmailProps) {
  const primaryColor = brandPrimaryColor;
  const formattedAmount = payoutAmount.toLocaleString("en-US", {
    style: "currency",
    currency,
  });
  const formattedDate = new Date(paidAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <BaseEmail
      previewText={`Payout of ${formattedAmount} has been sent!`}
      brandName={portalName}
      brandLogoUrl={brandLogoUrl}
    >
      <Heading style={styles.h1}>Good news, {affiliateName}! 💸</Heading>

      <Text style={styles.text}>
        Your payout has been processed and sent. Here are the details:
      </Text>

      <Hr style={{ margin: "24px 0" }} />

      <Text style={styles.text}>
        <strong>Payout Details:</strong>
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
          Paid on: {formattedDate}
        </Text>
        {paymentReference && (
          <Text style={{ ...styles.text, margin: "8px 0" }}>
            Reference: <strong>{paymentReference}</strong>
          </Text>
        )}
        {batchGeneratedAt && (
          <Text style={{ ...styles.text, margin: "8px 0", fontSize: "12px", color: "#666" }}>
            Batch Generated: {new Date(batchGeneratedAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </Text>
        )}
      </div>

      <Hr style={{ margin: "24px 0" }} />

      <Text style={styles.text}>
        The funds should now be available in your designated payout method.
      </Text>

      {portalEarningsUrl && (
        <>
          <Link href={portalEarningsUrl} style={{
            ...styles.button,
            backgroundColor: primaryColor,
          }}>
            View Your Earnings History
          </Link>
          <Text style={{ ...styles.text, fontSize: "12px", marginTop: "8px" }}>
            Or visit: <Link href={portalEarningsUrl}>{portalEarningsUrl}</Link>
          </Text>
        </>
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
