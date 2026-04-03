import { Heading, Text, Hr } from "@react-email/components";
import React from "react";
import { BaseEmail, styles } from "./components/BaseEmail";

interface DomainChangeNotificationEmailProps {
  affiliateName: string;
  tenantName: string;
  oldDomain: string;
  newDomain: string;
}

export default function DomainChangeNotificationEmail({
  affiliateName,
  tenantName,
  oldDomain,
  newDomain,
}: DomainChangeNotificationEmailProps) {
  return (
    <BaseEmail
      previewText={`${tenantName} has updated their website domain`}
      brandName={tenantName}
    >
      <Heading style={styles.h1}>Website Domain Updated</Heading>

      <Text style={styles.text}>
        Hello {affiliateName},
      </Text>

      <Text style={styles.text}>
        {tenantName} has updated the website domain used for their affiliate program. This may affect your referral links.
      </Text>

      <Hr style={{ margin: "24px 0" }} />

      <div style={{
        backgroundColor: "#f8f9fa",
        padding: "20px",
        borderRadius: "8px",
        marginBottom: "24px",
      }}>
        <Text style={{ ...styles.text, margin: "8px 0", fontWeight: 600 }}>
          Domain Change:
        </Text>

        <Text style={{ ...styles.text, margin: "8px 0" }}>
          <span style={{ textDecoration: "line-through", color: "#999" }}>{oldDomain}</span>
          {" → "}
          <span style={{ fontWeight: 600, color: "#1c2260" }}>{newDomain}</span>
        </Text>
      </div>

      <Text style={styles.text}>
        <strong>What this means for you:</strong>
      </Text>

      <ul style={{ ...styles.text, paddingLeft: "20px", marginBottom: "24px" }}>
        <li>Your existing referral links have been updated automatically to use the new domain.</li>
        <li>If you share any previously copied links, they may no longer work. Always use the links from your affiliate dashboard.</li>
        <li>The tracking snippet on {tenantName}&apos;s website needs to be reinstalled on the new domain before tracking resumes.</li>
      </ul>

      <Text style={styles.text}>
        If you have any questions, please reach out to {tenantName}&apos;s support team.
      </Text>

      <Hr style={{ margin: "24px 0" }} />

      <Text style={{ ...styles.text, color: "#898989", fontSize: "12px" }}>
        This is an automated notification from {tenantName}&apos;s affiliate program.
        Please do not reply directly to this email.
      </Text>
    </BaseEmail>
  );
}
