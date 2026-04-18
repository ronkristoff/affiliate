import React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
  Button,
} from "@react-email/components";

interface FraudAlertEmailProps {
  brandName: string;
  brandLogoUrl?: string;
  brandPrimaryColor?: string;
  affiliateName: string;
  affiliateEmail: string;
  affiliateId: string;
  commissionAmount: number;
  commissionId: string;
  matchedIndicators: string[];
  dashboardUrl?: string;
}

export default function FraudAlertEmail({
  brandName,
  brandLogoUrl,
  brandPrimaryColor = "#1c2260",
  affiliateName,
  affiliateEmail,
  affiliateId,
  commissionAmount,
  commissionId,
  matchedIndicators,
  dashboardUrl,
}: FraudAlertEmailProps) {
  const indicatorLabels: Record<string, string> = {
    email_match: "Email Address Match",
    ip_match: "IP Address Match",
    ip_subnet_match: "IP Subnet Match",
    device_match: "Device Fingerprint Match",
    payment_method_match: "Payment Method Match (Last 4 Digits)",
    payment_processor_match: "Payment Processor Match",
  };

  const formattedIndicators = matchedIndicators.map(
    (indicator) => indicatorLabels[indicator] || indicator
  );

  return (
    <Html>
      <Head />
      <Preview>🚨 Fraud Alert: Self-Referral Detected</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header with Logo */}
          <Section style={header}>
            {brandLogoUrl ? (
              <Img
                src={brandLogoUrl}
                width="120"
                height="40"
                alt={brandName}
                style={logo}
              />
            ) : (
              <Heading style={{ ...heading, color: brandPrimaryColor }}>
                {brandName}
              </Heading>
            )}
          </Section>

          {/* Alert Banner */}
          <Section style={{ ...alertBanner, borderLeftColor: brandPrimaryColor }}>
            <Text style={alertTitle}>🚨 Self-Referral Fraud Detected</Text>
            <Text style={alertText}>
              A self-referral attempt has been detected and flagged for your review.
            </Text>
          </Section>

          {/* Affiliate Information */}
          <Section style={section}>
            <Heading style={subheading}>Affiliate Information</Heading>
            <Text style={text}>
              <strong>Name:</strong> {affiliateName}
            </Text>
            <Text style={text}>
              <strong>Email:</strong> {affiliateEmail}
            </Text>
            <Text style={text}>
              <strong>Affiliate ID:</strong> {affiliateId}
            </Text>
          </Section>

          {/* Commission Details */}
          <Section style={section}>
            <Heading style={subheading}>Commission Details</Heading>
            <Text style={text}>
              <strong>Amount:</strong> ${commissionAmount.toFixed(2)}
            </Text>
            <Text style={text}>
              <strong>Commission ID:</strong> {commissionId}
            </Text>
            <Text style={text}>
              <strong>Status:</strong> Pending Review (Flagged)
            </Text>
          </Section>

          {/* Matched Indicators */}
          <Section style={section}>
            <Heading style={subheading}>Matched Fraud Indicators</Heading>
            <Text style={text}>
              The following indicators matched between the affiliate and the customer:
            </Text>
            <ul style={list}>
              {formattedIndicators.map((indicator, index) => (
                <li key={index} style={listItem}>
                  ⚠️ {indicator}
                </li>
              ))}
            </ul>
          </Section>

          {/* Action Required */}
          <Section style={section}>
            <Heading style={subheading}>Action Required</Heading>
            <Text style={text}>
              Please review this commission in your dashboard and decide whether to approve or decline it.
              This affiliate has been flagged with a fraud signal for attempting to earn commission on their own purchase.
            </Text>
            {dashboardUrl && (
              <Button
                href={dashboardUrl}
                style={{ ...button, backgroundColor: brandPrimaryColor }}
              >
                Review Commission
              </Button>
            )}
          </Section>

          {/* Links */}
          <Section style={section}>
            <Text style={linkText}>
              <Link
                href={`/affiliates/${affiliateId}`}
                style={{ ...link, color: brandPrimaryColor }}
              >
                View Affiliate Profile →
              </Link>
            </Text>
            <Text style={linkText}>
              <Link
                href={`/commissions/${commissionId}`}
                style={{ ...link, color: brandPrimaryColor }}
              >
                View Commission Details →
              </Link>
            </Text>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              This is an automated security alert from {brandName}.
            </Text>
            <Text style={footerText}>
              Please do not reply to this email. For support, contact your system administrator.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// Styles
const main = {
  backgroundColor: "#f6f9fc",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "24px",
  maxWidth: "600px",
  borderRadius: "8px",
  boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
};

const header = {
  marginBottom: "24px",
  textAlign: "center" as const,
};

const logo = {
  margin: "0 auto",
};

const heading = {
  fontSize: "24px",
  fontWeight: "bold",
  margin: "0",
};

const alertBanner = {
  backgroundColor: "#fef2f2",
  border: "1px solid #fecaca",
  borderLeft: "4px solid",
  borderRadius: "6px",
  padding: "16px",
  marginBottom: "24px",
};

const alertTitle = {
  fontSize: "18px",
  fontWeight: "bold",
  color: "#dc2626",
  margin: "0 0 8px 0",
};

const alertText = {
  fontSize: "14px",
  color: "#7f1d1d",
  margin: "0",
};

const section = {
  marginBottom: "24px",
};

const subheading = {
  fontSize: "16px",
  fontWeight: "bold",
  color: "#111827",
  margin: "0 0 12px 0",
  borderBottom: "1px solid #e5e7eb",
  paddingBottom: "8px",
};

const text = {
  fontSize: "14px",
  color: "#374151",
  lineHeight: "1.6",
  margin: "0 0 8px 0",
};

const list = {
  paddingLeft: "20px",
  margin: "12px 0",
};

const listItem = {
  fontSize: "14px",
  color: "#374151",
  marginBottom: "8px",
  lineHeight: "1.5",
};

const button = {
  display: "inline-block",
  padding: "12px 24px",
  borderRadius: "6px",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: "bold",
  textDecoration: "none",
  textAlign: "center" as const,
  marginTop: "16px",
};

const linkText = {
  margin: "8px 0",
};

const link = {
  fontSize: "14px",
  textDecoration: "none",
  fontWeight: "500",
};

const footer = {
  borderTop: "1px solid #e5e7eb",
  paddingTop: "24px",
  marginTop: "32px",
};

const footerText = {
  fontSize: "12px",
  color: "#6b7280",
  textAlign: "center" as const,
  margin: "0 0 4px 0",
};
