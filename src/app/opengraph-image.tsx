import { ImageResponse } from "next/og";

export const alt = "Affilio — Affiliate Program Management for SaaS on SaligPay";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#ffffff",
          padding: "60px",
        }}
      >
        {/* Background gradient accent */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "8px",
            background: "linear-gradient(90deg, #1c2260 0%, #1fb5a5 100%)",
          }}
        />

        {/* Logo/Brand */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              marginBottom: "40px",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                background: "#1fb5a5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span
                style={{
                  color: "#ffffff",
                  fontSize: "28px",
                  fontWeight: "900",
                }}
              >
                S
              </span>
            </div>
            <span>
              <span
                style={{
                  fontSize: "36px",
                  fontWeight: "900",
                  color: "#1c2260",
                  letterSpacing: "-0.5px",
                }}
              >
                affilio
              </span>
            </span>
          </div>

        {/* Main Headline */}
        <h1
          style={{
            fontSize: "56px",
            fontWeight: "800",
            color: "#0e1333",
            textAlign: "center",
            lineHeight: "1.2",
            marginBottom: "24px",
            maxWidth: "900px",
          }}
        >
          Affiliate Program Management
        </h1>

        {/* Subheadline */}
        <p
          style={{
            fontSize: "28px",
            color: "#474747",
            textAlign: "center",
            lineHeight: "1.4",
            marginBottom: "48px",
            maxWidth: "800px",
          }}
        >
          Launch and manage your SaaS affiliate program natively on SaligPay
        </p>

        {/* CTA Badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            background: "#f0f7ff",
            padding: "16px 32px",
            borderRadius: "12px",
            border: "2px solid #1c2260",
          }}
        >
          <span
            style={{
              fontSize: "20px",
              fontWeight: "600",
              color: "#1c2260",
            }}
          >
            14-day free trial
          </span>
          <span style={{ color: "#474747" }}>•</span>
          <span
            style={{
              fontSize: "20px",
              color: "#474747",
            }}
          >
            No credit card required
          </span>
        </div>

        {/* Bottom accent */}
        <div
          style={{
            position: "absolute",
            bottom: "40px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span
            style={{
              fontSize: "16px",
              color: "#1fb5a5",
              fontWeight: "500",
            }}
          >
            Built for SaligPay
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
