import { Heading, Text, Link, Hr } from "@react-email/components";
import React from "react";
import { BaseEmail, styles } from "./components/BaseEmail";

interface AffiliateRejectionEmailProps {
  affiliateName: string;
  portalName: string;
  brandLogoUrl?: string;
  brandPrimaryColor?: string;
  reason?: string;
  contactEmail?: string;
}

export default function AffiliateRejectionEmail({
  affiliateName,
  portalName,
  brandLogoUrl,
  brandPrimaryColor = "#10409a",
  reason,
  contactEmail,
}: AffiliateRejectionEmailProps) {
  return (
    <BaseEmail
      previewText={`Update on your ${portalName} affiliate application`}
      brandName={portalName}
      brandLogoUrl={brandLogoUrl}
    >
      <Heading style={styles.h1}>Hello, {affiliateName}</Heading>

      <Text style={styles.text}>
        Thank you for your interest in the <strong>{portalName}</strong> affiliate program.
        We appreciate the time you took to submit your application.
      </Text>

      <Text style={styles.text}>
        After careful review, we regret to inform you that your application has not been
        approved at this time.
      </Text>

      {reason && (
        <>
          <Hr style={{ margin: "24px 0" }} />

          <Text style={styles.text}>
            <strong>Reason:</strong>
          </Text>

          <div
            style={{
              ...styles.code,
              backgroundColor: "#FEF3C7",
              borderColor: "#F59E0B",
              borderLeft: "4px solid #F59E0B",
            }}
          >
            <Text style={{ ...styles.text, margin: "8px 0" }}>{reason}</Text>
          </div>
        </>
      )}

      <Hr style={{ margin: "24px 0" }} />

      <Text style={styles.text}>
        This decision does not reflect on your qualifications as a marketer. Our program
        may have specific criteria or capacity limitations that affected this decision.
      </Text>

      <Text style={styles.text}>
        If you believe this decision was made in error, or if you have any questions,
        please don&apos;t hesitate to reach out.
      </Text>

      {contactEmail && (
        <Text style={styles.text}>
          Contact: <Link href={`mailto:${contactEmail}`}>{contactEmail}</Link>
        </Text>
      )}

      <Text style={{ ...styles.text, marginTop: "32px", color: "#898989" }}>
        We wish you the best in your future endeavors.
      </Text>

      <Text style={{ ...styles.text, color: "#898989" }}>
        The {portalName} Team
      </Text>
    </BaseEmail>
  );
}
