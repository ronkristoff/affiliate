import { Id } from "@/convex/_generated/dataModel";

/**
 * Shared TenantDetail type used across tenant detail components.
 * Matches the return shape of admin.tenants.getTenantDetails.
 */
export interface TenantDetail {
  _id: Id<"tenants">;
  companyName: string;
  domain: string | undefined;
  ownerEmail: string;
  ownerName: string | undefined;
  plan: string;
  status: string;
  createdAt: number;
  saligPayStatus: string | undefined;
  saligPayExpiresAt: number | undefined;
  subscriptionStatus?: string | null;
  subscriptionId?: string | null;
  billingStartDate?: number | null;
  billingEndDate?: number | null;
  trialEndsAt?: number | null;
  cancellationDate?: number | null;
  deletionScheduledDate?: number | null;
  cancelledReason?: "grace_expired" | "trial_expired" | "admin_cancelled" | "owner_cancelled" | null;
  pastDueSince?: number | null;
  affiliateCount: {
    total: number;
    active: number;
    pending: number;
    flagged: number;
  };
  totalCommissions: number;
  mrrInfluenced: number;
  isFlagged: boolean;
  flagReasons: string[];
}
