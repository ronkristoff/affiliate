import { Heading, Text, Link, Hr, Button } from "@react-email/components";
import React from "react";
import { BaseEmail, styles } from "./components/BaseEmail";

interface NewAffiliateNotificationEmailProps {
  affiliateName: string;
  affiliateEmail: string;
  promotionChannel?: string;
  uniqueCode: string;
  merchantName: string;
  portalName: string;
  brandLogoUrl?: string;
  brandPrimaryColor?: string;
  dashboardUrl?: string;
}

const PROMOTION_CHANNEL_LABELS: Record<string, string> = {
  newsletter: "Newsletter",
  youtube: "YouTube",
  social_media: "Social Media",
  telegram_discord: "Telegram/Discord",
  podcast: "Podcast",
  blog: "Blog/Website",
  other: "Other",
};

export default function NewAffiliateNotificationEmail({
  affiliateName,
  affiliateEmail,
  promotionChannel,
  uniqueCode,
  merchantName,
  portalName,
  brandLogoUrl,
  brandPrimaryColor = "#10409a",
  dashboardUrl,
}: NewAffiliateNotificationEmailProps) {
  const primaryColor = brandPrimaryColor;
  const approvalUrl = dashboardUrl || "#";

  return (
    <BaseEmail
      previewText={`New Affiliate Application from ${affiliateName}`}
      brandName={portalName}
      brandLogoUrl={brandLogoUrl}
    >
      <Heading style={styles.h1}>New Affiliate Application</Heading>
      
      <Text style={styles.text}>
        Hello {merchantName},
      </Text>

      <Text style={styles.text}>
        You have a new affiliate application that requires your review.
      </Text>

      <Hr style={{ margin: "24px 0" }} />

      <div style={{ 
        backgroundColor: "#f8f9fa", 
        padding: "20px", 
        borderRadius: "8px",
        marginBottom: "24px"
      }}>
        <Text style={{ ...styles.text, margin: "8px 0", fontWeight: 600 }}>
          Applicant Details:
        </Text>
        
        <Text style={{ ...styles.text, margin: "8px 0" }}>
          <strong>Name:</strong> {affiliateName}
        </Text>
        
        <Text style={{ ...styles.text, margin: "8px 0" }}>
          <strong>Email:</strong> {affiliateEmail}
        </Text>
        
        {promotionChannel && (
          <Text style={{ ...styles.text, margin: "8px 0" }}>
            <strong>Promotion Channel:</strong> {PROMOTION_CHANNEL_LABELS[promotionChannel] || promotionChannel}
          </Text>
        )}
        
        <Text style={{ ...styles.text, margin: "8px 0" }}>
          <strong>Referral Code:</strong> {uniqueCode}
        </Text>
      </div>

      <Text style={styles.text}>
        <strong>Next Steps:</strong>
      </Text>
      
      <ul style={{ ...styles.text, paddingLeft: "20px", marginBottom: "24px" }}>
        <li>Review the applicant&apos;s information</li>
        <li>Decide to approve or reject the application</li>
        <li>The affiliate will be notified of your decision</li>
      </ul>

      <div style={{ textAlign: "center", margin: "32px 0" }}>
        <Button
          href={approvalUrl}
          style={{
            backgroundColor: primaryColor,
            color: "#ffffff",
            padding: "12px 24px",
            borderRadius: "6px",
            textDecoration: "none",
            display: "inline-block",
            fontWeight: "600",
          }}
        >
          Review Application
        </Button>
      </div>

      <Text style={{ ...styles.text, fontSize: "12px", color: "#666" }}>
        You can manage your affiliates from your {portalName} dashboard.
      </Text>

      <Hr style={{ margin: "24px 0" }} />

      <Text style={{ ...styles.text, color: "#898989", fontSize: "12px" }}>
        This is an automated notification from {portalName}. 
        Please do not reply directly to this email.
      </Text>
    </BaseEmail>
  );
}
