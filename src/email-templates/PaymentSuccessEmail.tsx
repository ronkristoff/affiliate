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

interface PaymentSuccessEmailProps {
  tenantName: string;
  plan: string;
  amount: number;
  currency?: string;
  billingStartDate: number;
  billingEndDate: number;
  transactionId?: string;
}

export default function PaymentSuccessEmail({
  tenantName,
  plan,
  amount,
  currency = "PHP",
  billingStartDate,
  billingEndDate,
  transactionId,
}: PaymentSuccessEmailProps) {
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
      currency,
      minimumFractionDigits: 0,
    }).format(price);
  };

  return (
    <Html>
      <Head />
      <Preview>Payment confirmed — {formatPrice(amount)} for {plan} plan</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Payment Confirmed</Heading>

          <Text style={text}>
            Hi {tenantName},
          </Text>

          <Text style={text}>
            Your payment has been successfully processed. Here are your receipt details:
          </Text>

          <Section style={detailsBox}>
            <Text style={detailRow}>
              <strong>Plan:</strong>{" "}
              <span style={{ textTransform: "capitalize" }}>{plan}</span>
            </Text>
            <Text style={detailRow}>
              <strong>Amount Paid:</strong>{" "}
              <span style={{ color: "#10b981" }}>{formatPrice(amount)}</span>
            </Text>
            <Text style={detailRow}>
              <strong>Billing Period:</strong>{" "}
              {formatDate(billingStartDate)} — {formatDate(billingEndDate)}
            </Text>
            {transactionId && (
              <Text style={detailRow}>
                <strong>Transaction ID:</strong> {transactionId}
              </Text>
            )}
          </Section>

          <Section style={successBox}>
            <Text style={successText}>
              Your subscription is now active. All features included in your plan are available.
            </Text>
          </Section>

          <Text style={footer}>
            If you have any questions about your payment, please contact our support team.
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

const detailsBox = {
  backgroundColor: "#f9fafb",
  border: "1px solid #e5e7eb",
  padding: "20px",
  borderRadius: "8px",
  margin: "20px",
};

const detailRow = {
  margin: "8px 0",
  fontSize: "14px",
  color: "#374151",
};

const successBox = {
  backgroundColor: "#ecfdf5",
  border: "1px solid #10b981",
  padding: "16px",
  borderRadius: "8px",
  margin: "20px",
};

const successText = {
  color: "#065f46",
  fontSize: "16px",
  lineHeight: "24px",
};

const footer = {
  color: "#9ca3af",
  fontSize: "14px",
  lineHeight: "20px",
  padding: "20px 20px 0",
};
