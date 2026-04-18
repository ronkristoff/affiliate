import { Heading, Link, Text, Button } from "@react-email/components";
import React from "react";
import { BaseEmail, styles } from "./components/BaseEmail";

export interface TeamInvitationEmailProps {
  inviteeEmail: string;
  inviterName: string;
  tenantName: string;
  role: string;
  invitationLink: string;
  expiresInDays?: number;
  brandName?: string;
  brandTagline?: string;
  brandLogoUrl?: string;
  primaryColor?: string;
}

export default function TeamInvitationEmail({
  inviteeEmail,
  inviterName,
  tenantName,
  role,
  invitationLink,
  expiresInDays = 7,
  brandName,
  brandTagline,
  brandLogoUrl,
  primaryColor = "#1c2260",
}: TeamInvitationEmailProps) {
  const roleDisplayName = role.charAt(0).toUpperCase() + role.slice(1);

  return (
    <BaseEmail
      previewText={`You're invited to join ${tenantName} as a ${role}`}
      brandName={brandName}
      brandTagline={brandTagline}
      brandLogoUrl={brandLogoUrl}
    >
      <Heading style={styles.h1}>You're invited!</Heading>

      <Text style={styles.text}>
        <strong>{inviterName}</strong> from <strong>{tenantName}</strong> has invited you 
        to join their team as a <strong>{roleDisplayName}</strong>.
      </Text>

      <div style={{ margin: "32px 0" }}>
        <Button
          href={invitationLink}
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
          Accept Invitation
        </Button>
      </div>

      <Text style={styles.text}>
        This invitation will expire in <strong>{expiresInDays} days</strong>.
      </Text>

      <Text
        style={{
          ...styles.text,
          color: "#ababab",
          marginTop: "14px",
        }}
      >
        If you don't want to join this team, you can safely ignore this email.
      </Text>

      <Text
        style={{
          ...styles.text,
          color: "#ababab",
          fontSize: "12px",
        }}
      >
        Invitation link: {invitationLink}
      </Text>
    </BaseEmail>
  );
}

// Helper function to generate the email content for Resend
export async function renderTeamInvitationEmail(props: TeamInvitationEmailProps): Promise<React.ReactElement> {
  return React.createElement(TeamInvitationEmail, props);
}