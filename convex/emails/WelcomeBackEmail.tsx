import React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface WelcomeBackEmailProps {
  tenantName: string;
  brandName: string;
}

export default function WelcomeBackEmail({ tenantName, brandName }: WelcomeBackEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Welcome back! Payment received.</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Welcome Back!</Heading>

          <Text style={text}>
            Hi {tenantName},
          </Text>

          <Text style={text}>
            We&apos;ve received your payment for {brandName}. Your account is fully active
            again — all features have been restored.
          </Text>

          <Section style={successBox}>
            <Text style={successText}>
              Your subscription is active and all campaigns have been resumed.
            </Text>
          </Section>

          <Text style={footer}>
            Thank you for your continued partnership.
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

const successBox = {
  backgroundColor: "#f0fdf4",
  border: "1px solid #22c55e",
  padding: "16px",
  borderRadius: "8px",
  margin: "20px",
};

const successText = {
  color: "#166534",
  fontSize: "16px",
  lineHeight: "24px",
};

const footer = {
  color: "#9ca3af",
  fontSize: "14px",
  lineHeight: "20px",
  padding: "20px 20px 0",
};
