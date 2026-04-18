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

interface DowngradeConfirmationEmailProps {
  previousPlan: string;
  newPlan: string;
  effectiveDate: number;
  newBillingAmount: number;
}

export function DowngradeConfirmationEmail({
  previousPlan,
  newPlan,
  effectiveDate,
  newBillingAmount,
}: DowngradeConfirmationEmailProps) {
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

  const previewText = `Your subscription has been changed to ${newPlan}`;

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
            Subscription Change Confirmation
          </Heading>

          <Text style={{ fontSize: "16px", lineHeight: "24px", color: "#333" }}>
            Your subscription has been successfully changed.
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
              Plan Change Details
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
              <strong>New Monthly Billing:</strong>{" "}
              <span style={{ color: "#10b981" }}>{formatPrice(newBillingAmount)}</span>
            </Text>

            <Text style={{ margin: "8px 0", fontSize: "14px" }}>
              <strong>Prorated Charge:</strong>{" "}
              <span style={{ color: "#666" }}>None (takes effect at next billing cycle)</span>
            </Text>
          </Section>

          <Section
            style={{
              backgroundColor: "#fef3c7",
              padding: "16px",
              borderRadius: "8px",
              marginTop: "20px",
              marginBottom: "20px",
              borderLeft: "4px solid #f59e0b",
            }}
          >
            <Text
              style={{
                margin: 0,
                fontSize: "14px",
                color: "#92400e",
                fontWeight: 500,
              }}
            >
              Important: Your new plan limits are now in effect. Some features
              may no longer be available, and you may be restricted from creating
              new resources if you&apos;ve exceeded your new plan limits.
            </Text>
          </Section>

          <Section
            style={{
              backgroundColor: "#eff6ff",
              padding: "16px",
              borderRadius: "8px",
              marginTop: "20px",
              marginBottom: "20px",
              borderLeft: "4px solid #3b82f6",
            }}
          >
            <Text
              style={{
                margin: 0,
                fontSize: "14px",
                color: "#1e40af",
                fontWeight: 500,
              }}
            >
              Your existing data remains accessible. If you need to regain access
              to premium features, you can upgrade your plan at any time from
              your billing settings.
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
            If you have any questions about your plan change or need assistance,
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

export default DowngradeConfirmationEmail;
