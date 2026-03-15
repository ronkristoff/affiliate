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
import { BaseEmail } from "./components/BaseEmail";

interface UpgradeConfirmationEmailProps {
  previousPlan: string;
  newPlan: string;
  proratedAmount: number;
  effectiveDate: number;
  newBillingAmount: number;
}

export function UpgradeConfirmationEmail({
  previousPlan,
  newPlan,
  proratedAmount,
  effectiveDate,
  newBillingAmount,
}: UpgradeConfirmationEmailProps) {
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 0,
    }).format(price);
  };

  const previewText = `Your subscription has been upgraded to ${newPlan}!`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={{ backgroundColor: "#ffffff", margin: 0, padding: 0 }}>
        <Container style={{ padding: "20px", margin: "0 auto" }}>
          <Heading
            style={{
              fontSize: "24px",
              fontWeight: "bold",
              marginBottom: "20px",
              color: "#333",
            }}
          >
            Subscription Upgrade Confirmation
          </Heading>

          <Text style={{ fontSize: "16px", lineHeight: "24px", color: "#333" }}>
            Your subscription has been successfully upgraded!
          </Text>

          <Section
            style={{
              backgroundColor: "#f4f4f4",
              padding: "20px",
              borderRadius: "8px",
              marginTop: "20px",
              marginBottom: "20px",
            }}
          >
            <Heading
              as="h2"
              style={{
                fontSize: "18px",
                fontWeight: "bold",
                marginBottom: "16px",
                color: "#333",
              }}
            >
              Upgrade Details
            </Heading>

            <Text style={{ margin: "8px 0", fontSize: "14px" }}>
              <strong>Previous Plan:</strong>{" "}
              <span style={{ textTransform: "capitalize" }}>{previousPlan}</span>
            </Text>

            <Text style={{ margin: "8px 0", fontSize: "14px" }}>
              <strong>New Plan:</strong>{" "}
              <span style={{ textTransform: "capitalize" }}>{newPlan}</span>
            </Text>

            <Text style={{ margin: "8px 0", fontSize: "14px" }}>
              <strong>Effective Date:</strong> {formatDate(effectiveDate)}
            </Text>

            <Text style={{ margin: "8px 0", fontSize: "14px" }}>
              <strong>Prorated Charge:</strong>{" "}
              <span style={{ color: "#10b981" }}>{formatPrice(proratedAmount)}</span>
            </Text>

            <Text style={{ margin: "8px 0", fontSize: "14px" }}>
              <strong>New Monthly Billing:</strong> {formatPrice(newBillingAmount)}
            </Text>
          </Section>

          <Section
            style={{
              backgroundColor: "#ecfdf5",
              padding: "16px",
              borderRadius: "8px",
              marginTop: "20px",
              marginBottom: "20px",
              borderLeft: "4px solid #10b981",
            }}
          >
            <Text
              style={{
                margin: 0,
                fontSize: "14px",
                color: "#065f46",
                fontWeight: 500,
              }}
            >
              Your new plan features are now active! You can start using your
              upgraded limits immediately.
            </Text>
          </Section>

          <Text
            style={{
              fontSize: "14px",
              lineHeight: "22px",
              color: "#666",
              marginTop: "24px",
            }}
          >
            If you have any questions about your upgrade or need assistance,
            please contact our support team.
          </Text>

          <Text
            style={{
              fontSize: "12px",
              lineHeight: "20px",
              color: "#898989",
              marginTop: "32px",
              borderTop: "1px solid #e5e5e5",
              paddingTop: "16px",
            }}
          >
            Thank you for using Salig Affiliate!
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default UpgradeConfirmationEmail;
