import { Heading, Text, Link, Hr, Button } from "@react-email/components";
import React from "react";
import { BaseEmail, styles } from "./components/BaseEmail";

interface NewReferralAlertEmailProps {
  ownerName?: string;
  affiliateName: string;
  affiliateEmail: string;
  conversionAmount: number;
  conversionDate: number;
  customerEmail?: string;
  campaignName?: string;
  commissionAmount: number;
  portalName: string;
  brandLogoUrl?: string;
  brandPrimaryColor?: string;
  dashboardAffiliateUrl?: string;
  dashboardConversionUrl?: string;
  contactEmail?: string;
  currency?: string;
}

/**
 * Helper function to mask customer email for privacy
 */
function maskCustomerEmail(email: string): string {
  const [localPart, domain] = email.split("@");
  if (localPart.length <= 2) {
    return `${localPart[0]}***@${domain}`;
  }
  return `${localPart[0]}${"*".repeat(Math.min(localPart.length - 2, 3))}@${domain}`;
}

export default function NewReferralAlertEmail({
  ownerName = "SaaS Owner",
  affiliateName,
  affiliateEmail,
  conversionAmount,
  conversionDate,
  customerEmail,
  campaignName,
  commissionAmount,
  portalName,
  brandLogoUrl,
  brandPrimaryColor = "#10409a",
  dashboardAffiliateUrl,
  dashboardConversionUrl,
  contactEmail,
  currency = "PHP",
}: NewReferralAlertEmailProps) {
  const primaryColor = brandPrimaryColor;
  const maskedCustomerEmail = customerEmail ? maskCustomerEmail(customerEmail) : null;

  // Format dates
  const formattedDate = new Date(conversionDate).toLocaleString();

  return (
    <BaseEmail
      previewText={`New Referral: ${affiliateName} - ${commissionAmount.toLocaleString("en-US", { style: "currency", currency })}`}
      brandName={portalName}
      brandLogoUrl={brandLogoUrl}
    >
      <Heading style={styles.h1}>🎉 New Referral Alert</Heading>
      
      <Text style={styles.text}>
        Hello {ownerName},
      </Text>

      <Text style={styles.text}>
        You have a new referral conversion attributed to your affiliate network.
      </Text>

      <Hr style={{ margin: "24px 0" }} />

      {/* Affiliate Details */}
      <div style={{ 
        backgroundColor: "#f8f9fa", 
        padding: "20px", 
        borderRadius: "8px",
        marginBottom: "24px"
      }}>
        <Text style={{ ...styles.text, margin: "8px 0", fontWeight: 600 }}>
          Affiliate Details:
        </Text>
        
        <Text style={{ ...styles.text, margin: "8px 0" }}>
          <strong>Name:</strong> {affiliateName}
        </Text>
        
        <Text style={{ ...styles.text, margin: "8px 0" }}>
          <strong>Email:</strong> {affiliateEmail}
        </Text>
      </div>

      {/* Conversion Details */}
      <div style={{ 
        backgroundColor: "#f8f9fa", 
        padding: "20px", 
        borderRadius: "8px",
        marginBottom: "24px"
      }}>
        <Text style={{ ...styles.text, margin: "8px 0", fontWeight: 600 }}>
          Conversion Details:
        </Text>
        
        <Text style={{ ...styles.text, margin: "8px 0" }}>
          <strong>Amount:</strong> {conversionAmount.toLocaleString("en-US", { style: "currency", currency })}
        </Text>
        
        {maskedCustomerEmail && (
          <Text style={{ ...styles.text, margin: "8px 0" }}>
            <strong>Customer:</strong> {maskedCustomerEmail}
          </Text>
        )}
        
        {campaignName && (
          <Text style={{ ...styles.text, margin: "8px 0" }}>
            <strong>Campaign:</strong> {campaignName}
          </Text>
        )}
        
        <Text style={{ ...styles.text, margin: "8px 0" }}>
          <strong>Timestamp:</strong> {formattedDate}
        </Text>
      </div>

      {/* Commission Details */}
      <div style={{ 
        backgroundColor: "#e8f5e9", 
        padding: "20px", 
        borderRadius: "8px",
        marginBottom: "24px",
        borderLeft: `4px solid ${primaryColor}`
      }}>
        <Text style={{ ...styles.text, margin: "8px 0", fontWeight: 600 }}>
          Commission Earned:
        </Text>
        
        <Text style={{ ...styles.text, margin: "8px 0", fontSize: "18px", color: primaryColor }}>
          {commissionAmount.toLocaleString("en-US", { style: "currency", currency })}
        </Text>
        
        <Text style={{ ...styles.text, margin: "8px 0", fontSize: "12px", color: "#666" }}>
          This amount will be added to your affiliate payouts according to your campaign commission structure.
        </Text>
      </div>

      {/* Action Buttons */}
      <div style={{ textAlign: "center", margin: "32px 0" }}>
        {dashboardAffiliateUrl && (
          <Button
            href={dashboardAffiliateUrl}
            style={{
              backgroundColor: primaryColor,
              color: "#ffffff",
              padding: "12px 24px",
              borderRadius: "6px",
              textDecoration: "none",
              display: "inline-block",
              fontWeight: "600",
              margin: "0 8px"
            }}
          >
            View Affiliate
          </Button>
        )}
        
        {dashboardConversionUrl && (
          <Button
            href={dashboardConversionUrl}
            style={{
              backgroundColor: primaryColor,
              color: "#ffffff",
              padding: "12px 24px",
              borderRadius: "6px",
              textDecoration: "none",
              display: "inline-block",
              fontWeight: "600",
              margin: "0 8px"
            }}
          >
            View Conversion
          </Button>
        )}
      </div>

      {/* Links for accessibility */}
      <Text style={{ ...styles.text, fontSize: "12px", color: "#666", textAlign: "center" }}>
        {dashboardAffiliateUrl && (
          <Link href={dashboardAffiliateUrl} style={{ ...styles.link, color: primaryColor }}>
            View Affiliate Details
          </Link>
        )}
        {dashboardAffiliateUrl && dashboardConversionUrl && " • "}
        {dashboardConversionUrl && (
          <Link href={dashboardConversionUrl} style={{ ...styles.link, color: primaryColor }}>
            View Conversion Details
          </Link>
        )}
      </Text>

      <Hr style={{ margin: "24px 0" }} />

      <Text style={{ ...styles.text, color: "#898989", fontSize: "12px" }}>
        This is an automated notification from {portalName}. 
        Please do not reply directly to this email.
        {contactEmail && (
          <>
            {" "}For support, contact <Link href={`mailto:${contactEmail}`} style={{ ...styles.link, color: primaryColor }}>{contactEmail}</Link>.
          </>
        )}
      </Text>
    </BaseEmail>
  );
}