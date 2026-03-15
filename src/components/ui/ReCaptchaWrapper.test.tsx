import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReCaptchaWrapper } from "./ReCaptchaWrapper";

/**
 * Component Tests for ReCaptchaWrapper
 * 
 * Story 5.2: reCAPTCHA Protection on Registration
 * 
 * Tests reCAPTCHA provider wrapper functionality
 */

// Mock react-google-recaptcha-v3
const mockGoogleReCaptchaProvider = vi.fn(({ children }) => children);

vi.mock("react-google-recaptcha-v3", () => ({
  GoogleReCaptchaProvider: (props: { children: React.ReactNode; reCaptchaKey: string }) => {
    mockGoogleReCaptchaProvider(props);
    return <>{props.children}</>;
  },
}));

describe("ReCaptchaWrapper Component (Task 2)", () => {
  describe("AC1: reCAPTCHA Widget Rendering (2.1, 2.2, 2.3)", () => {
    it("2.1: should render children when site key is configured", () => {
      const originalEnv = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
      process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY = "test-site-key";

      render(
        <ReCaptchaWrapper>
          <div data-testid="child-content">Test Content</div>
        </ReCaptchaWrapper>
      );

      expect(screen.getByTestId("child-content")).toBeInTheDocument();
      expect(mockGoogleReCaptchaProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          reCaptchaKey: "test-site-key",
        })
      );

      process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY = originalEnv;
    });

    it("2.2: should pass script props for async/defer loading", () => {
      const originalEnv = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
      process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY = "test-site-key";

      render(
        <ReCaptchaWrapper>
          <div>Test Content</div>
        </ReCaptchaWrapper>
      );

      expect(mockGoogleReCaptchaProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          scriptProps: {
            async: true,
            defer: true,
            appendTo: "head",
          },
        })
      );

      process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY = originalEnv;
    });

    it("2.3: should still render children when site key is missing (graceful degradation)", () => {
      const originalEnv = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
      process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY = undefined;

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      render(
        <ReCaptchaWrapper>
          <div data-testid="child-content">Test Content</div>
        </ReCaptchaWrapper>
      );

      expect(screen.getByTestId("child-content")).toBeInTheDocument();
      expect(consoleSpy).toHaveBeenCalledWith(
        "NEXT_PUBLIC_RECAPTCHA_SITE_KEY is not set. reCAPTCHA will not function."
      );

      consoleSpy.mockRestore();
      process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY = originalEnv;
    });
  });

  describe("Security: Fail-Closed Behavior", () => {
    it("should warn developers when site key is missing", () => {
      const originalEnv = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
      
      process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY = undefined;
      
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      render(
        <ReCaptchaWrapper>
          <div>Test Content</div>
        </ReCaptchaWrapper>
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        "NEXT_PUBLIC_RECAPTCHA_SITE_KEY is not set. reCAPTCHA will not function."
      );
      
      consoleSpy.mockRestore();
      process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY = originalEnv;
    });
  });
});
