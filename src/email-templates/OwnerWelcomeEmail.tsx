import { Heading, Text, Link, Hr, Button } from "@react-email/components";
import React from "react";
import { BaseEmail, styles } from "./components/BaseEmail";

interface OwnerWelcomeEmailProps {
  ownerName: string;
  companyName: string;
  plan: string;
  dashboardUrl: string;
  trialDays?: number;
}

export default function OwnerWelcomeEmail({
  ownerName,
  companyName,
  plan,
  dashboardUrl,
  trialDays = 14,
}: OwnerWelcomeEmailProps) {
  const siteUrl = process.env.SITE_URL || "http://localhost:3000";

  return (
    <BaseEmail
      previewText={`Welcome to Salig Affiliate — your ${companyName} account is ready!`}
      brandName="Salig Affiliate"
    >
      <Heading style={styles.h1}>Welcome to Salig Affiliate!</Heading>

      <Text style={styles.text}>
        Hey <strong>{ownerName}</strong>, your account for <strong>{companyName}</strong> is all set.
        You&apos;re now on the <strong>{plan.charAt(0).toUpperCase() + plan.slice(1)} plan</strong> with a
        <strong> {trialDays}-day free trial</strong> — no credit card required to start.
      </Text>

      <Hr style={{ margin: "24px 0" }} />

      <Text style={styles.text}>
        <strong>Here&apos;s what you can do right away:</strong>
      </Text>

      <ul style={{ ...styles.text, paddingLeft: "20px" }}>
        <li><strong>Set up your tracking</strong> — Add your website domain and install the tracking script to start capturing referrals.</li>
        <li><strong>Create campaigns</strong> — Define commission structures and share your affiliate program link.</li>
        <li><strong>Recruit affiliates</strong> — Review applications, approve partners, and grow your network.</li>
        <li><strong>Track performance</strong> — Monitor clicks, conversions, and commissions in real time.</li>
      </ul>

      <Hr style={{ margin: "24px 0" }} />

      <div style={{ textAlign: "center", margin: "32px 0" }}>
        <Button href={dashboardUrl} style={styles.button}>
          Go to Your Dashboard
        </Button>
      </div>

      <Text style={{ ...styles.text, fontSize: "13px", color: "#666" }}>
        If you need help getting started, check out our docs or reach out to support at{" "}
        <Link href="mailto:support@microsource.com.ph">support@microsource.com.ph</Link>.
      </Text>

      <Text style={{ ...styles.text, marginTop: "32px", color: "#898989" }}>
        Good luck building your affiliate program!
      </Text>
    </BaseEmail>
  );
}
