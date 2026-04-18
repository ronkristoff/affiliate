import { Heading, Text, Hr, Section } from "@react-email/components";
import React from "react";
import { BaseEmail, styles } from "./components/BaseEmail";

interface BroadcastEmailProps {
  subject: string;
  body: string; // Can contain HTML (sanitized) or plain text
  portalName: string;
  brandLogoUrl?: string;
  brandPrimaryColor?: string;
  unsubscribeUrl?: string;
}

export default function BroadcastEmail({
  subject,
  body,
  portalName,
  brandLogoUrl,
  brandPrimaryColor = "#1c2260",
  unsubscribeUrl,
}: BroadcastEmailProps) {
  const primaryColor = brandPrimaryColor;

  return (
    <BaseEmail
      previewText={subject}
      brandName={portalName}
      brandLogoUrl={brandLogoUrl}
      footerLinks={
        unsubscribeUrl
          ? [{ text: "Unsubscribe", href: unsubscribeUrl }]
          : undefined
      }
    >
      <Heading style={styles.h1}>{subject}</Heading>

      <Hr style={{ margin: "24px 0" }} />

      {/* Body content - supports HTML or plain text */}
      <Section style={styles.text}>
        {isHtml(body) ? (
          <div
            style={styles.text}
            dangerouslySetInnerHTML={{ __html: body }}
          />
        ) : (
          <Text style={styles.text}>{body}</Text>
        )}
      </Section>

      <Hr style={{ margin: "24px 0" }} />

      <Text
        style={{
          ...styles.text,
          marginTop: "32px",
          color: "#898989",
          fontSize: "12px",
        }}
      >
        This message was sent from {portalName}.
      </Text>
    </BaseEmail>
  );
}

/**
 * Simple HTML detection heuristic.
 * Checks if the body contains common HTML tags.
 */
function isHtml(content: string): boolean {
  const htmlTagPattern = /<(p|div|span|br|h[1-6]|ul|ol|li|a|strong|em|b|i|img|table)\b/i;
  return htmlTagPattern.test(content);
}
