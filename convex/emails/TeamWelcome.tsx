import { Heading, Text, Button } from "@react-email/components";
import React from "react";
import { BaseEmail, styles } from "./components/BaseEmail";

export interface TeamWelcomeEmailProps {
  name: string;
  tenantName: string;
  role: string;
  loginUrl: string;
  brandName?: string;
  brandTagline?: string;
  brandLogoUrl?: string;
  primaryColor?: string;
}

export default function TeamWelcomeEmail({
  name,
  tenantName,
  role,
  loginUrl,
  brandName,
  brandTagline,
  brandLogoUrl,
  primaryColor = "#10409a",
}: TeamWelcomeEmailProps) {
  const roleDisplayName = role.charAt(0).toUpperCase() + role.slice(1);

  return (
    <BaseEmail
      previewText={`Welcome to ${tenantName}! Your team membership is now active.`}
      brandName={brandName}
      brandTagline={brandTagline}
      brandLogoUrl={brandLogoUrl}
    >
      <Heading style={styles.h1}>Welcome to the team, {name}!</Heading>

      <Text style={styles.text}>
        Your invitation to join <strong>{tenantName}</strong> has been accepted, and your account is now active.
      </Text>

      <Text style={styles.text}>
        You have been assigned the role of <strong>{roleDisplayName}</strong>.
      </Text>

      <div style={{ margin: "32px 0" }}>
        <Button
          href={loginUrl}
          style={{
            backgroundColor: primaryColor,
            color: "#ffffff",
            padding: "12px 24px",
            borderRadius: "6px",
            fontWeight: 600,
            textDecoration: "none",
            display: "inline-block",
          }}
        >
          Sign In to Your Account
        </Button>
      </div>

      <Text style={styles.text}>
        You can now access the team dashboard and start collaborating with your team members.
      </Text>

      <Text
        style={{
          ...styles.text,
          color: "#ababab",
          marginTop: "24px",
          fontSize: "12px",
        }}
      >
        If you have any questions or need assistance, please contact your team administrator.
      </Text>
    </BaseEmail>
  );
}

// Helper function to generate the email content for Resend
export async function renderTeamWelcomeEmail(props: TeamWelcomeEmailProps): Promise<React.ReactElement> {
  return React.createElement(TeamWelcomeEmail, props);
}
