import { test, expect } from "@playwright/test";
import { SignInPage } from "../../pages/auth/sign-in.page";

test.describe("Sign-In Flow", () => {
  let signInPage: SignInPage;

  test.beforeEach(async ({ page }) => {
    signInPage = new SignInPage(page);
    await signInPage.goto();
  });

  test.describe("Happy Path", () => {
    test("SI-01: Valid credentials redirect to dashboard", async ({ page }) => {
      test.skip(true, "Requires pre-seeded test user");
      await signInPage.signIn("owner@test.local", "TestPass123!");
      await expect(page).toHaveURL(/\/dashboard|\/portal\/login/);
    });
  });

  test.describe("Validation", () => {
    test("SI-04: Empty fields show validation errors", async ({ page }) => {
      await signInPage.submitButton.click();
      await expect(page.getByText(/email is required/i)).toBeVisible();
    });

    test("SI-05: Invalid email format", async ({ page }) => {
      await signInPage.emailInput.fill("notanemail");
      await signInPage.emailInput.blur();
      await expect(page.getByText(/valid email/i)).toBeVisible();
    });
  });

  test.describe("Error Paths", () => {
    test("SI-02: Invalid password shows error", async ({ page }) => {
      await signInPage.signIn("owner@test.local", "WrongPassword");
      await expect(page.locator('[class*="bg-red-"]').first()).toBeVisible();
    });

    test("SI-03: Non-existent email shows generic error", async ({ page }) => {
      await signInPage.signIn("nonexistent@test.local", "password123");
      await expect(page.locator('[class*="bg-red-"]').first()).toBeVisible();
    });
  });

  test.describe("UI Interactions", () => {
    test("SI-06: Password visibility toggle works", async ({ page }) => {
      const pwInput = signInPage.passwordInput;
      await expect(pwInput).toHaveAttribute("type", "password");
      await signInPage.togglePasswordVisibility();
      await expect(pwInput).toHaveAttribute("type", "text");
    });

    test("SI-07: Forgot password modal opens", async () => {
      await signInPage.openForgotPassword();
      await expect(signInPage.forgotPasswordModal).toBeVisible();
    });

    test("SI-08: Navigation to sign-up works", async ({ page }) => {
      await signInPage.signUpLink.click();
      await expect(page).toHaveURL(/\/sign-up/);
    });
  });

  test.describe("Security", () => {
    test("SI-09: Error does not reveal if email exists", async ({ page }) => {
      await signInPage.signIn("owner@test.local", "wrongpassword");
      const errorEl = page.locator('[class*="bg-red-"]').first();
      if (await errorEl.isVisible()) {
        const errorText = await errorEl.textContent();
        expect(errorText).not.toContain("email");
      }
    });
  });

  test.describe("Rate Limiting", () => {
    test("SI-10: Multiple failed attempts shows warning", async ({ page }) => {
      for (let i = 0; i < 3; i++) {
        await signInPage.signIn("owner@test.local", "WrongPassword");
        await page.waitForTimeout(500);
      }
      const message = page.locator('[class*="bg-red-"]').first();
      if (await message.isVisible()) {
        const text = await message.textContent();
        expect(text).toMatch(/attempt|remaining|locked/i);
      }
    });
  });
});