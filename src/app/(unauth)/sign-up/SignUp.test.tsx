import { describe, it, expect, vi, beforeEach, Mock } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SignUp from "@/app/(unauth)/sign-up/SignUp";
import { authClient } from "@/lib/auth-client";

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import { toast } from "sonner";

describe("SaaS Owner Registration Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("AC1: Valid Registration", () => {
    it("should show all required form fields", () => {
      render(<SignUp />);

      expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/company/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/work email/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/min\. 8 characters/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/terms/i)).toBeInTheDocument();
    });

    it("should validate company name length (min 2 chars)", async () => {
      render(<SignUp />);
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/first name/i), "John");
      await user.type(screen.getByLabelText(/last name/i), "Doe");
      await user.type(screen.getByLabelText(/company/i), "A"); // Too short
      await user.type(screen.getByLabelText(/work email/i), "john@example.com");
      await user.type(screen.getByPlaceholderText(/min\. 8 characters/i), "Password123!");
      await user.click(screen.getByLabelText(/terms/i));

      fireEvent.click(screen.getByRole("button", { name: /start free trial/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Company name must be at least 2 characters");
      });
    });

    it("should validate company name length (max 100 chars)", async () => {
      render(<SignUp />);
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/first name/i), "John");
      await user.type(screen.getByLabelText(/last name/i), "Doe");
      await user.type(screen.getByLabelText(/company/i), "A".repeat(101)); // Too long
      await user.type(screen.getByLabelText(/work email/i), "john@example.com");
      await user.type(screen.getByPlaceholderText(/min\. 8 characters/i), "Password123!");
      await user.click(screen.getByLabelText(/terms/i));

      fireEvent.click(screen.getByRole("button", { name: /start free trial/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Company name must be less than 100 characters");
      });
    });

    it("should call signUp with companyName", async () => {
      const mockSignUp = vi.fn().mockResolvedValue({ data: {}, error: null });
      (authClient.signUp.email as Mock) = mockSignUp;

      render(<SignUp />);
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/first name/i), "John");
      await user.type(screen.getByLabelText(/last name/i), "Doe");
      await user.type(screen.getByLabelText(/company/i), "My SaaS Co");
      await user.type(screen.getByLabelText(/work email/i), "john@example.com");
      await user.type(screen.getByPlaceholderText(/min\. 8 characters/i), "Password123!");
      await user.click(screen.getByLabelText(/terms/i));

      fireEvent.click(screen.getByRole("button", { name: /start free trial/i }));

      await waitFor(() => {
        expect(mockSignUp).toHaveBeenCalledWith(
          expect.objectContaining({
            email: "john@example.com",
            name: "John Doe",
            companyName: "My SaaS Co",
          }),
          expect.any(Object)
        );
      });
    });
  });

  describe("AC2: Duplicate Email Rejection", () => {
    it("should display error for duplicate email", async () => {
      const mockSignUp = vi.fn().mockImplementation((_, callbacks) => {
        callbacks.onError({ error: { message: "Email already registered" } });
        return Promise.resolve({ data: null, error: { message: "Email already registered" } });
      });
      (authClient.signUp.email as Mock) = mockSignUp;

      render(<SignUp />);
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/first name/i), "John");
      await user.type(screen.getByLabelText(/last name/i), "Doe");
      await user.type(screen.getByLabelText(/company/i), "My SaaS Co");
      await user.type(screen.getByLabelText(/work email/i), "existing@example.com");
      await user.type(screen.getByPlaceholderText(/min\. 8 characters/i), "Password123!");
      await user.click(screen.getByLabelText(/terms/i));

      fireEvent.click(screen.getByRole("button", { name: /start free trial/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Email already registered");
      });
    });
  });

  describe("AC3: Company Name Required", () => {
    it("should reject empty company name", async () => {
      render(<SignUp />);
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/first name/i), "John");
      await user.type(screen.getByLabelText(/last name/i), "Doe");
      // Skip company name
      await user.type(screen.getByLabelText(/work email/i), "john@example.com");
      await user.type(screen.getByPlaceholderText(/min\. 8 characters/i), "Password123!");
      await user.click(screen.getByLabelText(/terms/i));

      fireEvent.click(screen.getByRole("button", { name: /start free trial/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Please enter your company name");
      });
    });
  });

  describe("AC4: Password Strength Validation", () => {
    it("should show password requirements", () => {
      render(<SignUp />);

      expect(screen.getByText(/password must have/i)).toBeInTheDocument();
      expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
      expect(screen.getByText(/one uppercase letter/i)).toBeInTheDocument();
      expect(screen.getByText(/one number/i)).toBeInTheDocument();
      expect(screen.getByText(/one special character/i)).toBeInTheDocument();
    });

    it("should reject short passwords", async () => {
      render(<SignUp />);
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/first name/i), "John");
      await user.type(screen.getByLabelText(/last name/i), "Doe");
      await user.type(screen.getByLabelText(/company/i), "My SaaS Co");
      await user.type(screen.getByLabelText(/work email/i), "john@example.com");
      await user.type(screen.getByPlaceholderText(/min\. 8 characters/i), "short1"); // Too short
      await user.click(screen.getByLabelText(/terms/i));

      fireEvent.click(screen.getByRole("button", { name: /start free trial/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Password must be at least 8 characters");
      });
    });
  });

  describe("AC5: Email Format Validation", () => {
    it("should reject invalid email format", async () => {
      render(<SignUp />);
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/first name/i), "John");
      await user.type(screen.getByLabelText(/last name/i), "Doe");
      await user.type(screen.getByLabelText(/company/i), "My SaaS Co");
      await user.type(screen.getByLabelText(/work email/i), "invalid-email");
      await user.type(screen.getByPlaceholderText(/min\. 8 characters/i), "Password123!");
      await user.click(screen.getByLabelText(/terms/i));

      fireEvent.click(screen.getByRole("button", { name: /start free trial/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Please enter a valid email address");
      });
    });

    it("should reject email without domain", async () => {
      render(<SignUp />);
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/first name/i), "John");
      await user.type(screen.getByLabelText(/last name/i), "Doe");
      await user.type(screen.getByLabelText(/company/i), "My SaaS Co");
      await user.type(screen.getByLabelText(/work email/i), "test@");
      await user.type(screen.getByPlaceholderText(/min\. 8 characters/i), "Password123!");
      await user.click(screen.getByLabelText(/terms/i));

      fireEvent.click(screen.getByRole("button", { name: /start free trial/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Please enter a valid email address");
      });
    });
  });

  describe("Redirect to Onboarding", () => {
    it("should redirect to /onboarding after successful registration", async () => {
      const mockPush = vi.fn();
      vi.mocked(require("next/navigation").useRouter).mockReturnValue({
        push: mockPush,
      });

      const mockSignUp = vi.fn().mockImplementation((_, callbacks) => {
        callbacks.onSuccess();
        return Promise.resolve({ data: {}, error: null });
      });
      (authClient.signUp.email as Mock) = mockSignUp;

      render(<SignUp />);
      const user = userEvent.setup();

      await user.type(screen.getByLabelText(/first name/i), "John");
      await user.type(screen.getByLabelText(/last name/i), "Doe");
      await user.type(screen.getByLabelText(/company/i), "My SaaS Co");
      await user.type(screen.getByLabelText(/work email/i), "john@example.com");
      await user.type(screen.getByPlaceholderText(/min\. 8 characters/i), "Password123!");
      await user.click(screen.getByLabelText(/terms/i));

      fireEvent.click(screen.getByRole("button", { name: /start free trial/i }));

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/onboarding");
      });
    });
  });
});
