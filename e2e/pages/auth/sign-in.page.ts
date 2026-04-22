import { type Page, type Locator, type FrameLocator, expect } from "@playwright/test";

export class SignInPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;
  readonly forgotPasswordLink: Locator;
  readonly showPasswordButton: Locator;
  readonly signUpLink: Locator;
  readonly forgotPasswordModal: Locator;
  readonly forgotPasswordEmailInput: Locator;
  readonly forgotPasswordSubmitButton: Locator;
  readonly forgotPasswordSuccessMessage: Locator;
  readonly closeForgotPasswordButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByLabel(/email address/i);
    this.passwordInput = page.locator('input[placeholder*="password"]');
    this.submitButton = page.getByRole("button", { name: /sign in/i });
    this.errorMessage = page.locator('[class*="bg-red-"]').first();
    this.forgotPasswordLink = page.getByRole("button", { name: /forgot password/i });
    this.showPasswordButton = page.getByLabel(/show password/i).or(page.getByLabel(/hide password/i)).first();
    this.signUpLink = page.getByRole("link", { name: /start.*free.*trial/i }).first();

    // Forgot password modal
    this.forgotPasswordModal = page.locator('[role="dialog"]').first();
    this.forgotPasswordEmailInput = this.forgotPasswordModal.getByLabel(/email address/i);
    this.forgotPasswordSubmitButton = this.forgotPasswordModal.getByRole("button", { name: /send reset link/i });
    this.forgotPasswordSuccessMessage = this.forgotPasswordModal.getByText(/check your email/i);
    this.closeForgotPasswordButton = this.forgotPasswordModal.getByRole("button", { name: /close/i });
  }

  async goto() {
    await this.page.goto("/sign-in");
  }

  async signIn(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async openForgotPassword() {
    await this.forgotPasswordLink.click();
    await this.forgotPasswordModal.waitFor({ state: "visible" });
  }

  async requestPasswordReset(email: string) {
    await this.openForgotPassword();
    await this.forgotPasswordEmailInput.fill(email);
    await this.forgotPasswordSubmitButton.click();
  }

  async togglePasswordVisibility() {
    await this.showPasswordButton.click();
  }
}