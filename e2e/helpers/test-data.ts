/**
 * Random test data generators for E2E tests.
 * Provides isolation - each test gets unique data to avoid collisions.
 */

function generateRandomSuffix(): string {
  return Math.random().toString(36).substring(2, 8);
}

export function generateRandomEmail(prefix = "test"): string {
  const timestamp = Date.now();
  const random = generateRandomSuffix();
  return `${prefix}-${timestamp}-${random}@test.local`;
}

export function generateRandomCompany(): string {
  const timestamp = Date.now();
  const random = generateRandomSuffix();
  return `Test Company ${timestamp} ${random}`;
}

export function generateRandomDomain(): string {
  const timestamp = Date.now();
  const random = generateRandomSuffix();
  return `${timestamp}-${random}.test.local`;
}

export interface TestUser {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  company: string;
  domain: string;
}

export function generateRandomTestUser(): TestUser {
  const suffix = generateRandomSuffix();
  return {
    email: generateRandomEmail(`user${suffix}`),
    password: "TestPass123!",
    firstName: "Test",
    lastName: `User${suffix}`,
    company: generateRandomCompany(),
    domain: generateRandomDomain(),
  };
}