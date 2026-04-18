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

interface CancellationConfirmationEmailProps {
  previousPlan: string;
  accessEndDate: number;
  deletionDate?: number;
}

export default function CancellationConfirmationEmail({
  previousPlan,
  accessEndDate,
}: CancellationConfirmationEmailProps) {
  const accessDate = new Date(accessEndDate).toLocaleDateString();

  return (
    <Html>
      <Head />
      <Preview>Your Subscription Has Been Cancelled</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Subscription Cancelled</Heading>

          <Text style={text}>
            Your subscription has been successfully cancelled.
          </Text>

          <Section style={alertBox}>
            <Heading style={alertTitle}>Subscription Details</Heading>
            <ul style={list}>
              <li style={listItem}>
                <strong>Previous Plan:</strong> {previousPlan.toUpperCase()}
              </li>
              <li style={listItem}>
                <strong>Access Ends:</strong> {accessDate}
              </li>
            </ul>
          </Section>

          <Text style={highlightBox}>
            Your account is now read-only. You can reactivate at any time to restore full access.
          </Text>

          <Text style={text}>
            <strong>What happens next:</strong>
          </Text>
          <ul style={bulletList}>
            <li>Your account is in read-only mode — no new data can be created or modified</li>
            <li>Billing has stopped — no further charges</li>
            <li>All your data is preserved and accessible</li>
            <li>You can reactivate your subscription at any time to restore full access</li>
          </ul>

          <Text style={text}>
            Need help or want to reactivate?
          </Text>

          <Button style={button} href={`${process.env.NEXT_PUBLIC_APP_URL}/settings/billing`}>
            Reactivate Subscription
          </Button>
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
  backgroundColor: "#fef2f2",
  padding: "16px",
  borderRadius: "8px",
  margin: "20px",
};

const alertTitle = {
  color: "#dc2626",
  fontSize: "18px",
  fontWeight: "bold",
  marginBottom: "12px",
};

const list = {
  padding: 0,
  margin: 0,
};

const listItem = {
  fontSize: "16px",
  lineHeight: "1.6",
  marginBottom: "8px",
  listStyle: "none",
};

const bulletList = {
  color: "#525f7f",
  fontSize: "16px",
  lineHeight: "24px",
  padding: "0 20px",
  marginBottom: "20px",
};

const highlightBox = {
  color: "#1c2260",
  fontSize: "16px",
  lineHeight: "24px",
  padding: "16px 20px",
  backgroundColor: "#f0f4ff",
  borderRadius: "8px",
  margin: "20px",
  fontWeight: "bold",
};

const button = {
  backgroundColor: "#1c2260",
  borderRadius: "8px",
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: "bold",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "block",
  width: "200px",
  padding: "12px 0",
  margin: "20px auto",
};
