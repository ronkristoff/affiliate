import { type Page, type Locator, expect } from "@playwright/test";

export class SignUpPage {
  readonly page: Page;
  readonly firstNameInput: Locator;
  readonly lastNameInput: Locator;
  readonly companyNameInput: Locator;
  readonly domainInput: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly termsCheckbox: Locator;
  readonly submitButton: Locator;
  readonly signInLink: Locator;
  readonly showPasswordButton: Locator;

  readonly monthlyToggle: Locator;
  readonly annualToggle: Locator;
  readonly errorMessage: Locator;
  readonly successMessage: Locator;
  readonly passwordStrengthIndicator: Locator;

  constructor(page: Page) {
    this.page = page;
    this.firstNameInput = page.getByLabel(/first name/i);
    this.lastNameInput = page.getByLabel(/last name/i);
    this.companyNameInput = page.getByLabel(/company/i);
    this.domainInput = page.getByLabel(/website url/i);
    this.emailInput = page.getByLabel(/work email/i);
    this.passwordInput = page.locator('input[placeholder*="Min. 8 characters"]');
    this.termsCheckbox = page.getByLabel(/agree to the/i).first();
    this.submitButton = page.getByRole("button", { name: /start free trial/i });
    this.signInLink = page.getByRole("link", { name: /sign in/i }).first();
    this.showPasswordButton = page.getByLabel(/show password/i).or(page.getByLabel(/hide password/i)).first();

    this.monthlyToggle = page.getByRole("button", { name: /monthly/i });
    this.annualToggle = page.getByRole("button", { name: /annual/i });

    this.errorMessage = page.locator('[data-slot="form-message"]');
    this.successMessage = page.getByText(/created successfully/i);
    this.passwordStrengthIndicator = page.locator('[class*="password"]');
  }

  async goto() {
    await this.page.goto("/sign-up");
  }

  async fillForm(data: {
    firstName: string;
    lastName: string;
    companyName: string;
    domain: string;
    email: string;
    password: string;
    agreeToTerms?: boolean;
  }) {
    await this.firstNameInput.fill(data.firstName);
    await this.lastNameInput.fill(data.lastName);
    await this.companyNameInput.fill(data.companyName);
    await this.domainInput.fill(data.domain);
    await this.emailInput.fill(data.email);
    await this.passwordInput.fill(data.password);

    if (data.agreeToTerms !== false) {
      await this.termsCheckbox.check();
    }
  }

  async submit() {
    await this.submitButton.click();
  }

  async togglePasswordVisibility() {
    await this.showPasswordButton.click();
  }

  async selectMonthlyPlan() {
    await this.monthlyToggle.click();
  }

  async selectAnnualPlan() {
    await this.annualToggle.click();
  }

  async signInInstead() {
    await this.signInLink.click();
  }
}