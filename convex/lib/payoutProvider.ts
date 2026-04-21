
export interface PayoutProviderStatusDetails {
  currentlyDue?: string[];
  eventuallyDue?: string[];
  pastDue?: string[];
  rejectionReason?: string;
}

export interface OnboardingParams {
  affiliateId: string;
  returnPath: string;
  refreshPath: string;
  tenantId: string;
}

export interface TransferParams {
  payoutId: string;
  batchId: string;
  tenantId: string;
  affiliateId: string;
  amount: number;
  currency: string;
  destinationAccountId: string;
  tenantProviderAccountId: string;
}

export interface ProviderAccountStatus {
  status: string;
  enabled: boolean;
  details: PayoutProviderStatusDetails;
}

export interface ProviderBalance {
  available: number;
  pending: number;
  currency: string;
}

export interface WebhookResult {
  payoutId?: string;
  affiliateId?: string;
  providerAccountId?: string;
  status: string;
  enabled?: boolean;
  details?: PayoutProviderStatusDetails;
  paymentReference?: string;
}

export interface PayoutProvider {
  createOnboardingLink(params: OnboardingParams): Promise<{ url: string }>;
  getAccountStatus(accountId: string): Promise<ProviderAccountStatus>;
  createTransfer(params: TransferParams): Promise<{ transferId: string }>;
  getBalance(accountId: string): Promise<ProviderBalance>;
  retryTransfer(payoutId: string): Promise<{ transferId: string }>;
  getWebhookEventType(event: unknown): string | null;
  handleWebhook(event: unknown): Promise<WebhookResult>;
}

const providerRegistry = new Map<string, PayoutProvider>();

export function getProvider(type: string): PayoutProvider | null {
  return providerRegistry.get(type) ?? null;
}

export function getProviderForTenant(
  tenant: { payoutProviderType?: string },
): PayoutProvider | null {
  const providerType = tenant.payoutProviderType;
  if (!providerType) return null;
  return getProvider(providerType);
}

export function registerProvider(type: string, provider: PayoutProvider): void {
  providerRegistry.set(type, provider);
}
