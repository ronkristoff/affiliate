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

interface GracePeriodWarningEmailProps {
  tenantName: string;
  brandName: string;
}

export default function GracePeriodWarningEmail({ tenantName, brandName }: GracePeriodWarningEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Final warning — 3 days until cancellation</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Final Warning</Heading>

          <Text style={text}>
            Hi {tenantName},
          </Text>

          <Text style={text}>
            Your {brandName} account will be <strong>cancelled in 3 days</strong> due
            to overdue payment. All campaigns will be paused and your account will
            become read-only.
          </Text>

          <Section style={alertBox}>
            <Heading style={alertTitle}>Action Required</Heading>
            <Text style={alertText}>
              Update your payment method now to prevent cancellation and data loss.
              After cancellation, your data will be preserved but you won&apos;t be
              able to create new content.
            </Text>
          </Section>

          <Button style={button} href={`${process.env.NEXT_PUBLIC_APP_URL}/settings/billing`}>
            Update Payment Now
          </Button>

          <Text style={footer}>
            Please act immediately to avoid service interruption.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: "#f6f9fc",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif',
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "20px 0 48px",
  marginBottom: "64px",
};

const h1 = {
  color: "#dc2626",
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
  border: "1px solid #dc2626",
  padding: "16px",
  borderRadius: "8px",
  margin: "20px",
};

const alertTitle = {
  color: "#dc2626",
  fontSize: "18px",
  fontWeight: "bold",
  marginBottom: "8px",
};

const alertText = {
  color: "#991b1b",
  fontSize: "16px",
  lineHeight: "24px",
};

const button = {
  backgroundColor: "#dc2626",
  borderRadius: "8px",
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: "bold",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "block",
  width: "fit-content",
  padding: "12px 24px",
  margin: "20px auto",
};

const footer = {
  color: "#9ca3af",
  fontSize: "14px",
  lineHeight: "20px",
  padding: "20px 20px 0",
};
