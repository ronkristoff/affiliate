import { Heading, Text, Link, Hr, Button } from "@react-email/components";
import React from "react";
import { BaseEmail, styles } from "./components/BaseEmail";

interface AffiliateReactivationEmailProps {
  affiliateName: string;
  portalName: string;
  brandLogoUrl?: string;
  brandPrimaryColor?: string;
  portalLoginUrl?: string;
  contactEmail?: string;
}

export default function AffiliateReactivationEmail({
  affiliateName,
  portalName,
  brandLogoUrl,
  brandPrimaryColor = "#1c2260",
  portalLoginUrl,
  contactEmail,
}: AffiliateReactivationEmailProps) {
  return (
    <BaseEmail
      previewText={`Your ${portalName} affiliate account has been reactivated!`}
      brandName={portalName}
      brandLogoUrl={brandLogoUrl}
    >
      <Heading style={styles.h1}>Welcome back, {affiliateName}!</Heading>

      <Text style={styles.text}>
        Great news! Your affiliate account with <strong>{portalName}</strong> has been
        reactivated and is now fully operational.
      </Text>

      <Hr style={{ margin: "24px 0" }} />

      <Text style={styles.text}>
        Your account is now:
      </Text>

      <ul style={{ ...styles.text, paddingLeft: "24px" }}>
        <li>Active and ready for you to log in</li>
        <li>Your referral links are working again</li>
        <li>You can continue earning commissions</li>
      </ul>

      {portalLoginUrl && (
        <>
          <Text style={styles.text}>
            You can log in to your affiliate portal here:
          </Text>

          <Button
            href={portalLoginUrl}
            style={{
              ...styles.button,
              backgroundColor: brandPrimaryColor,
            }}
          >
            Log In to Affiliate Portal
          </Button>
        </>
      )}

      <Hr style={{ margin: "24px 0" }} />

      <Text style={styles.text}>
        Thank you for your patience. We look forward to seeing your continued success
        as a valued affiliate partner.
      </Text>

      {contactEmail && (
        <Text style={styles.text}>
          If you have any questions, please contact us at:{" "}
          <Link href={`mailto:${contactEmail}`}>{contactEmail}</Link>
        </Text>
      )}

      <Text style={{ ...styles.text, marginTop: "32px", color: "#898989" }}>
        Welcome back to the team!
      </Text>

      <Text style={{ ...styles.text, color: "#898989" }}>
        The {portalName} Team
      </Text>
    </BaseEmail>
  );
}
