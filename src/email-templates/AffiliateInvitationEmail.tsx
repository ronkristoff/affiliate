import { Heading, Text, Link, Hr } from "@react-email/components";
import React from "react";
import { BaseEmail, styles } from "./components/BaseEmail";

interface AffiliateInvitationEmailProps {
  affiliateName: string;
  uniqueCode: string;
  portalName: string;
  referralUrl: string;
  brandLogoUrl?: string;
  brandPrimaryColor?: string;
  contactEmail?: string;
  portalLoginUrl?: string;
}

export default function AffiliateInvitationEmail({
  affiliateName,
  uniqueCode,
  portalName,
  referralUrl,
  brandLogoUrl,
  brandPrimaryColor = "#1c2260",
  contactEmail,
  portalLoginUrl,
}: AffiliateInvitationEmailProps) {
  const primaryColor = brandPrimaryColor;

  return (
    <BaseEmail
      previewText={`You've been invited to join ${portalName}!`}
      brandName={portalName}
      brandLogoUrl={brandLogoUrl}
    >
      <Heading style={styles.h1}>You've Been Invited, {affiliateName}!</Heading>
      
      <Text style={styles.text}>
        <strong>{portalName}</strong> has invited you to join their affiliate program!
        You can now start promoting and earning commissions.
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
        Save this code and link! You'll need them to track your referrals.
      </Text>

      <Hr style={{ margin: "24px 0" }} />

      <Text style={styles.text}>
        <strong>Next Steps:</strong>
      </Text>
      
      <ul style={{ ...styles.text, paddingLeft: "20px" }}>
        <li>Log in to your affiliate portal to start promoting</li>
        <li>Share your referral link with your audience</li>
        <li>Track your commissions and earnings in real-time</li>
      </ul>

      {portalLoginUrl && (
        <>
          <Hr style={{ margin: "24px 0" }} />
          <Text style={styles.text}>
            <Link href={portalLoginUrl} style={styles.button}>
              Log in to Your Affiliate Portal
            </Link>
          </Text>
        </>
      )}

      <Hr style={{ margin: "24px 0" }} />

      <Text style={styles.text}>
        If you have any questions about the affiliate program or your account, please contact the merchant directly.
      </Text>

      {contactEmail && (
        <Text style={styles.text}>
          Contact: <Link href={`mailto:${contactEmail}`}>{contactEmail}</Link>
        </Text>
      )}

      <Text style={{ ...styles.text, marginTop: "32px", color: "#898989" }}>
        Welcome to {portalName}!
      </Text>
    </BaseEmail>
  );
}
