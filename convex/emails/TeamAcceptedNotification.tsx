import { Heading, Text, Button } from "@react-email/components";
import React from "react";
import { BaseEmail, styles } from "./components/BaseEmail";

export interface TeamAcceptedNotificationEmailProps {
  ownerEmail: string;
  newMemberName: string;
  newMemberEmail: string;
  newMemberRole: string;
  tenantName: string;
  teamSettingsUrl: string;
  brandName?: string;
  brandTagline?: string;
  brandLogoUrl?: string;
  primaryColor?: string;
}

export default function TeamAcceptedNotificationEmail({
  ownerEmail,
  newMemberName,
  newMemberEmail,
  newMemberRole,
  tenantName,
  teamSettingsUrl,
  brandName,
  brandTagline,
  brandLogoUrl,
  primaryColor = "#10409a",
}: TeamAcceptedNotificationEmailProps) {
  const roleDisplayName = newMemberRole.charAt(0).toUpperCase() + newMemberRole.slice(1);

  return (
    <BaseEmail
      previewText={`${newMemberName} has joined your team on ${tenantName}`}
      brandName={brandName}
      brandTagline={brandTagline}
      brandLogoUrl={brandLogoUrl}
    >
      <Heading style={styles.h1}>New Team Member</Heading>

      <Text style={styles.text}>
        Hi there,
      </Text>

      <Text style={styles.text}>
        <strong>{newMemberName}</strong> ({newMemberEmail}) has accepted your invitation and joined your team on <strong>{tenantName}</strong>.
      </Text>

      <Text style={styles.text}>
        <strong>Role:</strong> {roleDisplayName}
      </Text>

      <div style={{ margin: "32px 0" }}>
        <Button
          href={teamSettingsUrl}
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
          Manage Team Members
        </Button>
      </div>

      <Text
        style={{
          ...styles.text,
          color: "#ababab",
          marginTop: "24px",
          fontSize: "12px",
        }}
      >
        You can manage team members and their permissions from your team settings.
      </Text>
    </BaseEmail>
  );
}

// Helper function to generate the email content for Resend
export async function renderTeamAcceptedNotificationEmail(props: TeamAcceptedNotificationEmailProps): Promise<React.ReactElement> {
  return React.createElement(TeamAcceptedNotificationEmail, props);
}
