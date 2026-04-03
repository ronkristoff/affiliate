import { Heading, Text, Link, Hr, Button } from "@react-email/components";
import React from "react";
import { BaseEmail, styles } from "./components/BaseEmail";

interface AffiliateApprovalEmailProps {
  affiliateName: string;
  affiliateEmail: string;
  portalName: string;
  brandLogoUrl?: string;
  brandPrimaryColor?: string;
  portalLoginUrl?: string;
  contactEmail?: string;
}

export default function AffiliateApprovalEmail({
  affiliateName,
  portalName,
  brandLogoUrl,
  brandPrimaryColor = "#1c2260",
  portalLoginUrl,
  contactEmail,
}: AffiliateApprovalEmailProps) {
  const primaryColor = brandPrimaryColor;

  return (
    <BaseEmail
      previewText={`Your application to ${portalName} has been approved!`}
      brandName={portalName}
      brandLogoUrl={brandLogoUrl}
    >
      <Heading style={styles.h1}>Congratulations, {affiliateName}!</Heading>

      <Text style={styles.text}>
        Great news! Your application to join <strong>{portalName}</strong> has been
        <span style={{ color: "#10B981", fontWeight: 600 }}> approved</span>.
      </Text>

      <Text style={styles.text}>
        You can now log in to your affiliate portal and start promoting. Track your
        referrals, view your commissions, and access marketing materials all in one place.
      </Text>

      {portalLoginUrl && (
        <>
          <div style={{ textAlign: "center", margin: "32px 0" }}>
            <Button
              href={portalLoginUrl}
              style={{
                backgroundColor: primaryColor,
                color: "#ffffff",
                padding: "12px 24px",
                borderRadius: "6px",
                textDecoration: "none",
                fontSize: "16px",
                fontWeight: 600,
                display: "inline-block",
              }}
            >
              Log In to Your Portal
            </Button>
          </div>

          <Text style={{ ...styles.text, fontSize: "12px", color: "#666", textAlign: "center" }}>
            Or copy this link: {portalLoginUrl}
          </Text>
        </>
      )}

      <Hr style={{ margin: "24px 0" }} />

      <Text style={styles.text}>
        <strong>What&apos;s next?</strong>
      </Text>

      <ul style={{ ...styles.text, paddingLeft: "20px" }}>
        <li>Log in to your affiliate portal</li>
        <li>Explore available campaigns and commission structures</li>
        <li>Get your unique referral links</li>
        <li>Start promoting and earning commissions!</li>
      </ul>

      <Hr style={{ margin: "24px 0" }} />

      <Text style={styles.text}>
        If you have any questions or need assistance, feel free to reach out to the merchant.
      </Text>

      {contactEmail && (
        <Text style={styles.text}>
          Contact: <Link href={`mailto:${contactEmail}`}>{contactEmail}</Link>
        </Text>
      )}

      <Text style={{ ...styles.text, marginTop: "32px", color: "#898989" }}>
        Welcome to the {portalName} affiliate program!
      </Text>
    </BaseEmail>
  );
}
