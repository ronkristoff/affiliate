"use client";

import { GoogleReCaptchaProvider } from "react-google-recaptcha-v3";
import { ReactNode } from "react";

interface ReCaptchaWrapperProps {
  children: ReactNode;
}

/**
 * ReCaptchaWrapper Component
 * 
 * Wraps children with Google reCAPTCHA v3 provider.
 * Uses NEXT_PUBLIC_RECAPTCHA_SITE_KEY from environment variables.
 * 
 * Note: reCAPTCHA v3 works invisibly in the background without user interaction.
 * The token is generated programmatically when needed.
 */
export function ReCaptchaWrapper({ children }: ReCaptchaWrapperProps) {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

  if (!siteKey) {
    console.warn("NEXT_PUBLIC_RECAPTCHA_SITE_KEY is not set. reCAPTCHA will not function.");
    // Still render children - let the form handle missing reCAPTCHA gracefully
    return <>{children}</>;
  }

  return (
    <GoogleReCaptchaProvider
      reCaptchaKey={siteKey}
      scriptProps={{
        async: true,
        defer: true,
        appendTo: "head",
      }}
    >
      {children}
    </GoogleReCaptchaProvider>
  );
}
