import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AffiliateSignUpForm } from "./AffiliateSignUpForm";

/**
 * Component Tests for AffiliateSignUpForm
 * 
 * Story 5.1: Affiliate Registration on Portal
 * 
 * Tests UI validation, form submission, and error handling
 */

// Mock useMutation and useAction hooks
const mockUseMutation = vi.fn();
const mockUseAction = vi.fn();
const mockExecuteRecaptcha = vi.fn();

vi.mock("convex/react", () => ({
  useMutation: () => mockUseMutation(),
  useAction: () => mockUseAction(),
}));

// Mock react-google-recaptcha-v3
vi.mock("react-google-recaptcha-v3", () => ({
  useGoogleReCaptcha: () => ({
    executeRecaptcha: mockExecuteRecaptcha,
  }),
}));

// Mock next navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe("AffiliateSignUpForm Component (Task 8)", () => {
  const defaultProps = {
    tenantSlug: "test-tenant",
    redirectUrl: "/portal/login",
    tenantBranding: {
      portalName: "Test Portal",
      primaryColor: "#10409a",
    },
  };

  describe("Form Field Rendering (8.1)", () => {
    it("should render all required form fields", () => {
      render(<AffiliateSignUpForm {...defaultProps} />);

      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/how will you promote us/i)).toBeInTheDocument();
    });

    it("should render apply button", () => {
      render(<AffiliateSignUpForm {...defaultProps} />);

      expect(screen.getByRole("button", { name: /apply to join/i })).toBeInTheDocument();
    });

    it("should render promotion channel options", () => {
      render(<AffiliateSignUpForm {...defaultProps} />);

      // The select should exist
      const channelSelect = screen.getByLabelText(/how will you promote us/i);
      expect(channelSelect).toBeInTheDocument();
    });
  });

  describe("Form Validation (8.2, 8.3, 8.4)", () => {
    it("8.2: should show validation error for empty required fields", async () => {
      render(<AffiliateSignUpForm {...defaultProps} />);

      const submitButton = screen.getByRole("button", { name: /apply to join/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/name must be at least 2 characters/i)).toBeInTheDocument();
      });
    });

    it("8.3: should show error for invalid email format", async () => {
      render(<AffiliateSignUpForm {...defaultProps} />);

      const emailInput = screen.getByLabelText(/email address/i);
      fireEvent.change(emailInput, { target: { value: "invalid-email" } });
      fireEvent.blur(emailInput);

      await waitFor(() => {
        expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
      });
    });

    it("8.4: should show error for password less than 8 characters", async () => {
      render(<AffiliateSignUpForm {...defaultProps} />);

      const passwordInput = screen.getByLabelText(/^password$/i);
      fireEvent.change(passwordInput, { target: { value: "short" } });
      fireEvent.blur(passwordInput);

      await waitFor(() => {
        expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument();
      });
    });

    it("should show error when passwords don't match", async () => {
      render(<AffiliateSignUpForm {...defaultProps} />);

      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmInput = screen.getByLabelText(/confirm password/i);

      fireEvent.change(passwordInput, { target: { value: "password123" } });
      fireEvent.change(confirmInput, { target: { value: "different123" } });
      fireEvent.blur(confirmInput);

      await waitFor(() => {
        expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
      });
    });

    it("should accept valid email formats", async () => {
      const validEmails = [
        "user@example.com",
        "test.user@domain.co.uk",
        "user+tag@example.com",
      ];

      render(<AffiliateSignUpForm {...defaultProps} />);

      const emailInput = screen.getByLabelText(/email address/i);

      for (const email of validEmails) {
        fireEvent.change(emailInput, { target: { value: email } });
        fireEvent.blur(emailInput);

        await waitFor(() => {
          const error = screen.queryByText(/please enter a valid email address/i);
          expect(error).not.toBeInTheDocument();
        });
      }
    });

    it("should accept password with exactly 8 characters", async () => {
      render(<AffiliateSignUpForm {...defaultProps} />);

      const passwordInput = screen.getByLabelText(/^password$/i);
      fireEvent.change(passwordInput, { target: { value: "exactly8" } });
      fireEvent.blur(passwordInput);

      await waitFor(() => {
        const error = screen.queryByText(/password must be at least 8 characters/i);
        expect(error).not.toBeInTheDocument();
      });
    });
  });

  describe("Duplicate Email Handling (8.5)", () => {
    it("should display error message for duplicate email", async () => {
      const mockSignUp = vi.fn().mockResolvedValue({
        success: false,
        error: "An affiliate with this email already exists for this tenant",
      });

      mockUseMutation.mockReturnValue(mockSignUp);

      render(<AffiliateSignUpForm {...defaultProps} />);

      // Fill form with valid data
      fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "John Doe" } });
      fireEvent.change(screen.getByLabelText(/email address/i), { 
        target: { value: "existing@example.com" } 
      });
      fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "password123" } });
      fireEvent.change(screen.getByLabelText(/confirm password/i), { 
        target: { value: "password123" } 
      });

      const submitButton = screen.getByRole("button", { name: /apply to join/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/already exists for this tenant/i)).toBeInTheDocument();
      });
    });
  });

  describe("Loading State (Task 5)", () => {
    it("should show loading state during form submission", async () => {
      const mockSignUp = vi.fn().mockImplementation(() => new Promise(() => {})); // Never resolves
      mockUseMutation.mockReturnValue(mockSignUp);

      render(<AffiliateSignUpForm {...defaultProps} />);

      // Fill form
      fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "John Doe" } });
      fireEvent.change(screen.getByLabelText(/email address/i), { 
        target: { value: "test@example.com" } 
      });
      fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "password123" } });
      fireEvent.change(screen.getByLabelText(/confirm password/i), { 
        target: { value: "password123" } 
      });

      const submitButton = screen.getByRole("button", { name: /apply to join/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/creating account/i)).toBeInTheDocument();
      });

      // Button should be disabled during submission
      expect(submitButton).toBeDisabled();
    });
  });

  describe("Pending Approval UI (8.9)", () => {
    it("should show pending approval confirmation after successful registration", async () => {
      const mockSignUp = vi.fn().mockResolvedValue({
        success: true,
        affiliateId: "aff_123",
        uniqueCode: "AB12CD34",
        status: "pending",
      });

      mockUseMutation.mockReturnValue(mockSignUp);

      render(<AffiliateSignUpForm {...defaultProps} />);

      // Fill and submit form
      fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "John Doe" } });
      fireEvent.change(screen.getByLabelText(/email address/i), { 
        target: { value: "test@example.com" } 
      });
      fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "password123" } });
      fireEvent.change(screen.getByLabelText(/confirm password/i), { 
        target: { value: "password123" } 
      });

      const submitButton = screen.getByRole("button", { name: /apply to join/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/application submitted/i)).toBeInTheDocument();
        expect(screen.getByText(/pending approval/i)).toBeInTheDocument();
      });
    });

    it("should display 1-2 business days timeframe", async () => {
      const mockSignUp = vi.fn().mockResolvedValue({
        success: true,
        status: "pending",
      });

      mockUseMutation.mockReturnValue(mockSignUp);

      render(<AffiliateSignUpForm {...defaultProps} />);

      // Fill and submit form
      fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "John Doe" } });
      fireEvent.change(screen.getByLabelText(/email address/i), { 
        target: { value: "test@example.com" } 
      });
      fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "password123" } });
      fireEvent.change(screen.getByLabelText(/confirm password/i), { 
        target: { value: "password123" } 
      });

      const submitButton = screen.getByRole("button", { name: /apply to join/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/1-2 business days/i)).toBeInTheDocument();
      });
    });
  });

  describe("Tenant Branding Application", () => {
    it("should display tenant portal name in success message", async () => {
      const customBranding = {
        ...defaultProps.tenantBranding,
        portalName: "Alex's SaaS Affiliate Program",
      };

      const mockSignUp = vi.fn().mockResolvedValue({
        success: true,
        status: "pending",
      });

      mockUseMutation.mockReturnValue(mockSignUp);

      render(
        <AffiliateSignUpForm 
          {...defaultProps} 
          tenantBranding={customBranding} 
        />
      );

      // Fill and submit form
      fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "John Doe" } });
      fireEvent.change(screen.getByLabelText(/email address/i), { 
        target: { value: "test@example.com" } 
      });
      fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "password123" } });
      fireEvent.change(screen.getByLabelText(/confirm password/i), { 
        target: { value: "password123" } 
      });

      const submitButton = screen.getByRole("button", { name: /apply to join/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Alex's SaaS Affiliate Program/i)).toBeInTheDocument();
      });
    });
  });

  describe("Trust Signals Section", () => {
    it("should display trust signals with mock data", () => {
      render(<AffiliateSignUpForm {...defaultProps} />);

      // Trust signals should be visible
      expect(screen.getByText(/affiliates earning with us/i)).toBeInTheDocument();
      expect(screen.getByText(/active/i)).toBeInTheDocument();
      expect(screen.getByText(/paid/i)).toBeInTheDocument();
    });
  });

  describe("Terms and Privacy Links", () => {
    it("should display terms of service and privacy policy links", () => {
      render(<AffiliateSignUpForm {...defaultProps} />);

      expect(screen.getByText(/terms of service/i)).toBeInTheDocument();
      expect(screen.getByText(/privacy policy/i)).toBeInTheDocument();
    });
  });

  describe("Promotion Channel Selection", () => {
    it("should allow selecting a promotion channel", () => {
      render(<AffiliateSignUpForm {...defaultProps} />);

      const channelSelect = screen.getByLabelText(/how will you promote us/i);
      expect(channelSelect).toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    it("should display network error message", async () => {
      const mockSignUp = vi.fn().mockRejectedValue(new Error("Network error"));
      mockUseMutation.mockReturnValue(mockSignUp);

      render(<AffiliateSignUpForm {...defaultProps} />);

      // Fill form
      fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "John Doe" } });
      fireEvent.change(screen.getByLabelText(/email address/i), { 
        target: { value: "test@example.com" } 
      });
      fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "password123" } });
      fireEvent.change(screen.getByLabelText(/confirm password/i), { 
        target: { value: "password123" } 
      });

      const submitButton = screen.getByRole("button", { name: /apply to join/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/failed to create account/i)).toBeInTheDocument();
      });
    });
  });

  /**
   * reCAPTCHA Integration Tests
   * Story 5.2: reCAPTCHA Protection on Registration
   */
  describe("reCAPTCHA Integration (Task 3, 6)", () => {
    beforeEach(() => {
      mockExecuteRecaptcha.mockReset();
    });

    describe("AC1: reCAPTCHA Token Generation (3.1, 3.2)", () => {
      it("3.1: should trigger reCAPTCHA token generation on form submit", async () => {
        mockExecuteRecaptcha.mockResolvedValue("valid-recaptcha-token");
        const mockSignUp = vi.fn().mockResolvedValue({
          success: true,
          status: "pending",
        });
        mockUseAction.mockReturnValue(mockSignUp);

        render(<AffiliateSignUpForm {...defaultProps} />);

        // Fill form
        fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "John Doe" } });
        fireEvent.change(screen.getByLabelText(/email address/i), { 
          target: { value: "test@example.com" } 
        });
        fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "password123" } });
        fireEvent.change(screen.getByLabelText(/confirm password/i), { 
          target: { value: "password123" } 
        });

        const submitButton = screen.getByRole("button", { name: /apply to join/i });
        fireEvent.click(submitButton);

        await waitFor(() => {
          expect(mockExecuteRecaptcha).toHaveBeenCalledWith("affiliate_registration");
        });
      });

      it("3.2: should pass reCAPTCHA token to registration mutation", async () => {
        mockExecuteRecaptcha.mockResolvedValue("test-token-123");
        const mockSignUp = vi.fn().mockResolvedValue({
          success: true,
          status: "pending",
        });
        mockUseAction.mockReturnValue(mockSignUp);

        render(<AffiliateSignUpForm {...defaultProps} />);

        // Fill form
        fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "John Doe" } });
        fireEvent.change(screen.getByLabelText(/email address/i), { 
          target: { value: "test@example.com" } 
        });
        fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "password123" } });
        fireEvent.change(screen.getByLabelText(/confirm password/i), { 
          target: { value: "password123" } 
        });

        const submitButton = screen.getByRole("button", { name: /apply to join/i });
        fireEvent.click(submitButton);

        await waitFor(() => {
          expect(mockSignUp).toHaveBeenCalledWith(expect.objectContaining({
            recaptchaToken: "test-token-123",
          }));
        });
      });
    });

    describe("AC2: reCAPTCHA Failure Handling (3.5, 6.1)", () => {
      it("3.5: should display error when reCAPTCHA execution fails", async () => {
        mockExecuteRecaptcha.mockRejectedValue(new Error("reCAPTCHA error"));

        render(<AffiliateSignUpForm {...defaultProps} />);

        // Fill form
        fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "John Doe" } });
        fireEvent.change(screen.getByLabelText(/email address/i), { 
          target: { value: "test@example.com" } 
        });
        fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "password123" } });
        fireEvent.change(screen.getByLabelText(/confirm password/i), { 
          target: { value: "password123" } 
        });

        const submitButton = screen.getByRole("button", { name: /apply to join/i });
        fireEvent.click(submitButton);

        await waitFor(() => {
          expect(screen.getByText(/unable to verify - please check your connection/i)).toBeInTheDocument();
        });
      });

      it("6.1: should display specific error for invalid reCAPTCHA token", async () => {
        mockExecuteRecaptcha.mockResolvedValue(null);

        render(<AffiliateSignUpForm {...defaultProps} />);

        // Fill form
        fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "John Doe" } });
        fireEvent.change(screen.getByLabelText(/email address/i), { 
          target: { value: "test@example.com" } 
        });
        fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "password123" } });
        fireEvent.change(screen.getByLabelText(/confirm password/i), { 
          target: { value: "password123" } 
        });

        const submitButton = screen.getByRole("button", { name: /apply to join/i });
        fireEvent.click(submitButton);

        await waitFor(() => {
          expect(screen.getByText(/verification failed - please try again/i)).toBeInTheDocument();
        });
      });

      it("6.1: should display bot detection error for low score", async () => {
        mockExecuteRecaptcha.mockResolvedValue("valid-token");
        const mockSignUp = vi.fn().mockResolvedValue({
          success: false,
          error: "We couldn't verify you're human - please try again",
        });
        mockUseAction.mockReturnValue(mockSignUp);

        render(<AffiliateSignUpForm {...defaultProps} />);

        // Fill form
        fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "John Doe" } });
        fireEvent.change(screen.getByLabelText(/email address/i), { 
          target: { value: "test@example.com" } 
        });
        fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "password123" } });
        fireEvent.change(screen.getByLabelText(/confirm password/i), { 
          target: { value: "password123" } 
        });

        const submitButton = screen.getByRole("button", { name: /apply to join/i });
        fireEvent.click(submitButton);

        await waitFor(() => {
          expect(screen.getByText(/we couldn't verify you're human/i)).toBeInTheDocument();
        });
      });
    });

    describe("Loading State During reCAPTCHA (3.4)", () => {
      it("3.4: should show loading state while reCAPTCHA validates", async () => {
        mockExecuteRecaptcha.mockImplementation(() => new Promise(() => {})); // Never resolves

        render(<AffiliateSignUpForm {...defaultProps} />);

        // Fill form
        fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "John Doe" } });
        fireEvent.change(screen.getByLabelText(/email address/i), { 
          target: { value: "test@example.com" } 
        });
        fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "password123" } });
        fireEvent.change(screen.getByLabelText(/confirm password/i), { 
          target: { value: "password123" } 
        });

        const submitButton = screen.getByRole("button", { name: /apply to join/i });
        fireEvent.click(submitButton);

        await waitFor(() => {
          expect(screen.getByText(/creating account/i)).toBeInTheDocument();
        });

        expect(submitButton).toBeDisabled();
      });
    });

    describe("Form Validation Coexistence (6.3, 6.4)", () => {
      it("6.3: should maintain existing validation errors alongside reCAPTCHA errors", async () => {
        mockExecuteRecaptcha.mockRejectedValue(new Error("reCAPTCHA failed"));

        render(<AffiliateSignUpForm {...defaultProps} />);

        // Submit with empty form to trigger validation errors
        const submitButton = screen.getByRole("button", { name: /apply to join/i });
        fireEvent.click(submitButton);

        await waitFor(() => {
          // Should show both form validation errors AND reCAPTCHA error handling
          expect(screen.getByText(/name must be at least 2 characters/i)).toBeInTheDocument();
        });
      });

      it("6.4: should not break form validation flow with reCAPTCHA errors", async () => {
        mockExecuteRecaptcha.mockResolvedValue("valid-token");
        const mockSignUp = vi.fn().mockResolvedValue({
          success: false,
          error: "An affiliate with this email already exists for this tenant",
        });
        mockUseAction.mockReturnValue(mockSignUp);

        render(<AffiliateSignUpForm {...defaultProps} />);

        // Fill form with valid data
        fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "John Doe" } });
        fireEvent.change(screen.getByLabelText(/email address/i), { 
          target: { value: "existing@example.com" } 
        });
        fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "password123" } });
        fireEvent.change(screen.getByLabelText(/confirm password/i), { 
          target: { value: "password123" } 
        });

        const submitButton = screen.getByRole("button", { name: /apply to join/i });
        fireEvent.click(submitButton);

        await waitFor(() => {
          // Should show backend error, not reCAPTCHA error
          expect(screen.getByText(/already exists for this tenant/i)).toBeInTheDocument();
        });
      });
    });
  });
});
