"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { RejectionDialog } from "@/components/affiliate/RejectionDialog";
import { SuspendDialog } from "@/components/affiliate/SuspendDialog";
import { ReactivateDialog } from "@/components/affiliate/ReactivateDialog";
import { BulkActionBar } from "@/components/affiliate/BulkActionBar";
import { ActivityTimeline } from "@/components/shared/ActivityTimeline";
import { toast } from "sonner";
import { CheckCircle, XCircle, Loader2, Activity, Eye, PauseCircle, CheckCircle2 } from "lucide-react";
import Link from "next/link";

type AffiliateStatus = "pending" | "active" | "suspended" | "rejected";

interface Affiliate {
  _id: Id<"affiliates">;
  _creationTime: number;
  email: string;
  name: string;
  uniqueCode: string;
  status: string;
  promotionChannel?: string;
}

export default function AffiliatesPageClient() {
  const [activeTab, setActiveTab] = useState<AffiliateStatus>("pending");
  const [selectedAffiliates, setSelectedAffiliates] = useState<Set<Id<"affiliates">>>(new Set());
  const [rejectingAffiliate, setRejectingAffiliate] = useState<Affiliate | null>(null);
  const [suspendingAffiliate, setSuspendingAffiliate] = useState<Affiliate | null>(null);
  const [reactivatingAffiliate, setReactivatingAffiliate] = useState<Affiliate | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Get current user for RBAC
  const currentUser = useQuery(api.auth.getCurrentUser);
  const canManageAffiliates = currentUser?.role === "owner" || currentUser?.role === "manager";

  // Queries
  const affiliates = useQuery(api.affiliates.listAffiliatesByStatus, { status: activeTab }) || [];
  const counts = useQuery(api.affiliates.getAffiliateCountByStatus, {}) || {
    pending: 0,
    active: 0,
    suspended: 0,
    rejected: 0,
    total: 0,
  };
  // Get recent audit logs for activity timeline
  const recentActivity = useQuery(api.affiliates.getRecentAffiliateActivity, { limit: 10 }) || [];

  // Mutations
  const approveAffiliate = useMutation(api.affiliates.approveAffiliate);
  const rejectAffiliate = useMutation(api.affiliates.rejectAffiliate);
  const suspendAffiliate = useMutation(api.affiliates.suspendAffiliate);
  const reactivateAffiliate = useMutation(api.affiliates.reactivateAffiliate);
  const bulkApproveAffiliates = useMutation(api.affiliates.bulkApproveAffiliates);
  const bulkRejectAffiliates = useMutation(api.affiliates.bulkRejectAffiliates);

  // Handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedAffiliates(new Set(affiliates.map((a) => a._id)));
    } else {
      setSelectedAffiliates(new Set());
    }
  };

  const handleSelectAffiliate = (affiliateId: Id<"affiliates">, checked: boolean) => {
    const newSelected = new Set(selectedAffiliates);
    if (checked) {
      newSelected.add(affiliateId);
    } else {
      newSelected.delete(affiliateId);
    }
    setSelectedAffiliates(newSelected);
  };

  const handleApprove = async (affiliateId: Id<"affiliates">, affiliateName: string) => {
    try {
      await approveAffiliate({ affiliateId });
      toast.success(`Approved ${affiliateName}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to approve affiliate");
    }
  };

  const handleReject = async (affiliateId: Id<"affiliates">, affiliateName: string, reason: string) => {
    try {
      await rejectAffiliate({ affiliateId, reason: reason || undefined });
      toast.success(`Rejected ${affiliateName}`);
      setRejectingAffiliate(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reject affiliate");
    }
  };

  const handleBulkApprove = async () => {
    if (selectedAffiliates.size === 0) return;
    
    setIsProcessing(true);
    try {
      const result = await bulkApproveAffiliates({
        affiliateIds: Array.from(selectedAffiliates),
      });
      toast.success(`Approved ${result.success} affiliates${result.failed > 0 ? `, ${result.failed} failed` : ""}`);
      setSelectedAffiliates(new Set());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to bulk approve affiliates");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkReject = async () => {
    if (selectedAffiliates.size === 0) return;

    setIsProcessing(true);
    try {
      const result = await bulkRejectAffiliates({
        affiliateIds: Array.from(selectedAffiliates),
      });
      toast.success(`Rejected ${result.success} affiliates${result.failed > 0 ? `, ${result.failed} failed` : ""}`);
      setSelectedAffiliates(new Set());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to bulk reject affiliates");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSuspend = async (affiliateId: Id<"affiliates">, affiliateName: string, reason: string) => {
    try {
      await suspendAffiliate({ affiliateId, reason });
      toast.success(`${affiliateName} has been suspended`);
      setSuspendingAffiliate(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to suspend affiliate");
    }
  };

  const handleReactivate = async (affiliateId: Id<"affiliates">, affiliateName: string) => {
    try {
      await reactivateAffiliate({ affiliateId });
      toast.success(`${affiliateName} has been reactivated`);
      setReactivatingAffiliate(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reactivate affiliate");
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const allSelected = affiliates.length > 0 && affiliates.every((a) => selectedAffiliates.has(a._id));
  const someSelected = affiliates.some((a) => selectedAffiliates.has(a._id)) && !allSelected;

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Affiliates</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AffiliateStatus)}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="pending" className="relative">
                Pending
                {counts.pending > 0 && (
                  <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-xs font-medium text-white">
                    {counts.pending}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="active">
                Active
                {counts.active > 0 && (
                  <span className="ml-2 text-muted-foreground">({counts.active})</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="suspended">
                Suspended
                {counts.suspended > 0 && (
                  <span className="ml-2 text-muted-foreground">({counts.suspended})</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="rejected">
                Rejected
                {counts.rejected > 0 && (
                  <span className="ml-2 text-muted-foreground">({counts.rejected})</span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-6">
              {affiliates.length === 0 ? (
                <div className="flex h-32 items-center justify-center text-muted-foreground">
                  No {activeTab} affiliates found
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {activeTab === "pending" && canManageAffiliates && (
                          <TableHead className="w-12">
                            <Checkbox
                              checked={allSelected}
                              data-state={someSelected ? "indeterminate" : allSelected ? "checked" : "unchecked"}
                              onCheckedChange={handleSelectAll}
                            />
                          </TableHead>
                        )}
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Referral Code</TableHead>
                        {activeTab === "pending" && <TableHead>Source</TableHead>}
                        <TableHead>Status</TableHead>
                        <TableHead>Applied Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {affiliates.map((affiliate) => (
                        <TableRow key={affiliate._id} className="cursor-pointer hover:bg-muted/50">
                          {activeTab === "pending" && canManageAffiliates && (
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={selectedAffiliates.has(affiliate._id)}
                                onCheckedChange={(checked) =>
                                  handleSelectAffiliate(affiliate._id, checked as boolean)
                                }
                              />
                            </TableCell>
                          )}
                          <TableCell className="font-medium">
                            <Link href={`/affiliates/${affiliate._id}`} className="hover:underline">
                              {affiliate.name}
                            </Link>
                          </TableCell>
                          <TableCell>{affiliate.email}</TableCell>
                          <TableCell>
                            <code className="rounded bg-muted px-2 py-1 text-sm">
                              {affiliate.uniqueCode}
                            </code>
                          </TableCell>
                          {activeTab === "pending" && (
                            <TableCell>{affiliate.promotionChannel || "-"}</TableCell>
                          )}
                          <TableCell>
                            <StatusBadge status={affiliate.status} />
                          </TableCell>
                          <TableCell>{formatDate(affiliate._creationTime)}</TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end gap-2">
                              {/* View Details - All tabs */}
                              <Button
                                size="sm"
                                variant="outline"
                                asChild
                                className="h-8 gap-1"
                              >
                                <Link href={`/affiliates/${affiliate._id}`}>
                                  <Eye className="h-4 w-4" />
                                  View
                                </Link>
                              </Button>

                              {/* Pending Tab Actions */}
                              {activeTab === "pending" && canManageAffiliates && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="default"
                                    onClick={() => handleApprove(affiliate._id, affiliate.name)}
                                    className="h-8 gap-1"
                                  >
                                    <CheckCircle className="h-4 w-4" />
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => setRejectingAffiliate(affiliate)}
                                    className="h-8 gap-1"
                                  >
                                    <XCircle className="h-4 w-4" />
                                    Reject
                                  </Button>
                                </>
                              )}

                              {/* Active Tab Actions */}
                              {activeTab === "active" && canManageAffiliates && (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => setSuspendingAffiliate(affiliate)}
                                  className="h-8 gap-1"
                                >
                                  <PauseCircle className="h-4 w-4" />
                                  Suspend
                                </Button>
                              )}

                              {/* Suspended Tab Actions */}
                              {activeTab === "suspended" && canManageAffiliates && (
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => setReactivatingAffiliate(affiliate)}
                                  className="h-8 gap-1"
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                  Reactivate
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Activity Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityTimeline activities={recentActivity} />
        </CardContent>
      </Card>

      {/* Rejection Dialog */}
      <RejectionDialog
        isOpen={rejectingAffiliate !== null}
        onClose={() => setRejectingAffiliate(null)}
        onConfirm={async (reason) => {
          if (rejectingAffiliate) {
            await handleReject(rejectingAffiliate._id, rejectingAffiliate.name, reason);
          }
        }}
        affiliateName={rejectingAffiliate?.name || ""}
      />

      {/* Suspend Dialog */}
      <SuspendDialog
        isOpen={suspendingAffiliate !== null}
        onClose={() => setSuspendingAffiliate(null)}
        onConfirm={async (reason) => {
          if (suspendingAffiliate) {
            await handleSuspend(suspendingAffiliate._id, suspendingAffiliate.name, reason);
          }
        }}
        affiliateName={suspendingAffiliate?.name || ""}
      />

      {/* Reactivate Dialog */}
      <ReactivateDialog
        isOpen={reactivatingAffiliate !== null}
        onClose={() => setReactivatingAffiliate(null)}
        onConfirm={async () => {
          if (reactivatingAffiliate) {
            await handleReactivate(reactivatingAffiliate._id, reactivatingAffiliate.name);
          }
        }}
        affiliateName={reactivatingAffiliate?.name || ""}
      />

      {/* Bulk Action Bar */}
      {activeTab === "pending" && canManageAffiliates && selectedAffiliates.size > 0 && (
        <BulkActionBar
          selectedCount={selectedAffiliates.size}
          onApproveAll={handleBulkApprove}
          onRejectAll={handleBulkReject}
          isProcessing={isProcessing}
        />
      )}
    </div>
  );
}
