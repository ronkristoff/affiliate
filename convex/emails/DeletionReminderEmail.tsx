import React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface DeletionReminderEmailProps {
  deletionDate: string;
  daysUntilDeletion: number;
}

export default function DeletionReminderEmail({
  deletionDate,
  daysUntilDeletion,
}: DeletionReminderEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Urgent: Your account will be deleted in {daysUntilDeletion.toString()} days</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Account Deletion Reminder</Heading>

          <Section style={alertBox}>
            <Heading style={alertTitle}>⚠️ Action Required</Heading>
            <Text style={alertText}>
              Your account and all data will be permanently deleted in{" "}
              <strong>{daysUntilDeletion} days</strong> on <strong>{deletionDate}</strong>.
            </Text>
          </Section>

          <Text style={text}>
            Your subscription was cancelled and your data retention period is ending soon.
          </Text>

          <Text style={text}>
            <strong>What happens on {deletionDate}:</strong>
          </Text>
          <ul style={bulletList}>
            <li>All your account data will be permanently deleted</li>
            <li>Affiliate records, campaigns, and commission data will be removed</li>
            <li>This action cannot be undone</li>
          </ul>

          <Text style={text}>
            <strong>Want to keep your data?</strong>
          </Text>
          <Text style={text}>
            Reactivate your subscription now to prevent deletion and continue using the platform.
          </Text>

          <Button style={button} href={`${process.env.NEXT_PUBLIC_APP_URL}/settings/billing`}>
            Reactivate Subscription
          </Button>

          <Text style={footer}>
            If you do not reactivate by {deletionDate}, your account will be permanently deleted.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif',
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "20px 0 48px",
  marginBottom: "64px",
};

const h1 = {
  color: "#1f2937",
  fontSize: "24px",
  fontWeight: "bold",
  margin: "40px 0",
  padding: "0 20px",
  textAlign: "center" as const,
};

const text = {
  color: "#525f7f",
  fontSize: "16px",
  lineHeight: "24px",
  padding: "0 20px",
};

const alertBox = {
  backgroundColor: "#fef3c7",
  border: "1px solid #f59e0b",
  padding: "20px",
  borderRadius: "8px",
  margin: "20px",
};

const alertTitle = {
  color: "#92400e",
  fontSize: "20px",
  fontWeight: "bold",
  marginBottom: "12px",
  textAlign: "center" as const,
};

const alertText = {
  color: "#92400e",
  fontSize: "16px",
  lineHeight: "24px",
  textAlign: "center" as const,
};

const bulletList = {
  color: "#525f7f",
  fontSize: "16px",
  lineHeight: "24px",
  padding: "0 20px 0 40px",
  marginBottom: "20px",
};

const button = {
  backgroundColor: "#10409a",
  borderRadius: "8px",
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: "bold",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "block",
  width: "220px",
  padding: "14px 0",
  margin: "24px auto",
};

const footer = {
  color: "#6b7280",
  fontSize: "14px",
  lineHeight: "20px",
  padding: "0 20px",
  textAlign: "center" as const,
  marginTop: "32px",
};
