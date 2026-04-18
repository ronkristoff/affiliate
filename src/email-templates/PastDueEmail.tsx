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

interface PastDueEmailProps {
  tenantName: string;
  brandName: string;
}

export default function PastDueEmail({ tenantName, brandName }: PastDueEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Payment overdue — action required</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Payment Overdue</Heading>

          <Text style={text}>
            Hi {tenantName},
          </Text>

          <Text style={text}>
            Your subscription payment for {brandName} is overdue. Please update your
            payment method to avoid cancellation of your account.
          </Text>

          <Section style={alertBox}>
            <Text style={alertText}>
              Your account will be cancelled if payment is not received within 7 days.
            </Text>
          </Section>

          <Button style={button} href={`${process.env.NEXT_PUBLIC_APP_URL}/settings/billing`}>
            Update Payment Method
          </Button>

          <Text style={footer}>
            If you have questions, please contact our support team.
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
  backgroundColor: "#fffbeb",
  border: "1px solid #f59e0b",
  padding: "16px",
  borderRadius: "8px",
  margin: "20px",
};

const alertText = {
  color: "#92400e",
  fontSize: "16px",
  lineHeight: "24px",
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
