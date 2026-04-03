import { Heading, Text, Link, Hr } from "@react-email/components";
import React from "react";
import { BaseEmail, styles } from "./components/BaseEmail";

interface AffiliateWelcomeEmailProps {
  affiliateName: string;
  affiliateEmail: string;
  uniqueCode: string;
  portalName: string;
  referralUrl: string;
  brandLogoUrl?: string;
  brandPrimaryColor?: string;
  approvalTimeframe?: string;
  contactEmail?: string;
}

export default function AffiliateWelcomeEmail({
  affiliateName,
  affiliateEmail,
  uniqueCode,
  portalName,
  referralUrl,
  brandLogoUrl,
  brandPrimaryColor = "#1c2260",
  approvalTimeframe = "1-2 business days",
  contactEmail,
}: AffiliateWelcomeEmailProps) {
  const primaryColor = brandPrimaryColor;

  return (
    <BaseEmail
      previewText={`Welcome to ${portalName}!`}
      brandName={portalName}
      brandLogoUrl={brandLogoUrl}
    >
      <Heading style={styles.h1}>Welcome, {affiliateName}!</Heading>
      
      <Text style={styles.text}>
        Your application to join <strong>{portalName}</strong> has been received. 
        Thank you for your interest in becoming an affiliate!
      </Text>

      <Hr style={{ margin: "24px 0" }} />

      <Text style={styles.text}>
        <strong>What happens next?</strong>
      </Text>
      
      <Text style={styles.text}>
        Your application is currently <strong>pending approval</strong>. 
        The merchant will review your application within <strong>{approvalTimeframe}</strong>. 
        You&apos;ll receive an email notification once your application is approved.
      </Text>

      <Hr style={{ margin: "24px 0" }} />

      <Text style={styles.text}>
        <strong>Your Affiliate Details:</strong>
      </Text>
      
      <div style={{
        ...styles.code,
        backgroundColor: `${primaryColor}10`,
        borderColor: primaryColor,
      }}>
        <Text style={{ ...styles.text, margin: "8px 0", fontWeight: 600 }}>
          Referral Code: <span style={{ fontSize: "18px" }}>{uniqueCode}</span>
        </Text>
        <Text style={{ ...styles.text, margin: "8px 0", fontSize: "14px" }}>
          Your referral link: <Link href={referralUrl}>{referralUrl}</Link>
        </Text>
      </div>

      <Text style={{ ...styles.text, fontSize: "12px", color: "#666" }}>
        Save this code and link! You&apos;ll need them to track your referrals once approved.
      </Text>

      <Hr style={{ margin: "24px 0" }} />

      <Text style={styles.text}>
        In the meantime, you can prepare for success by:
      </Text>
      
      <ul style={{ ...styles.text, paddingLeft: "20px" }}>
        <li>Exploring the merchant&apos;s products and services</li>
        <li>Planning your promotional strategies</li>
        <li>Setting up your content channels</li>
      </ul>

      <Hr style={{ margin: "24px 0" }} />

      <Text style={styles.text}>
        If you have any questions about your application or the affiliate program, 
        please contact the merchant directly.
      </Text>

      {contactEmail && (
        <Text style={styles.text}>
          Contact: <Link href={`mailto:${contactEmail}`}>{contactEmail}</Link>
        </Text>
      )}

      <Text style={{ ...styles.text, marginTop: "32px", color: "#898989" }}>
        Thank you for your interest in {portalName}!
      </Text>
    </BaseEmail>
  );
}
