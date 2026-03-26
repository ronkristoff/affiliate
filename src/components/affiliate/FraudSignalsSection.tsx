"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  ShieldAlert,
  AlertTriangle,
  Link2,
  CheckCircle,
  UserX,
  Filter,
  ArrowUpDown,
  Eye,
  EyeOff,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface FraudSignal {
  type: string;
  severity: "low" | "medium" | "high";
  timestamp: number;
  details?: string;
  reviewedAt?: number;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewNote?: string;
  signalId?: string;
  commissionId?: string;
}

interface FraudSignalsSectionProps {
  fraudSignals: FraudSignal[] | undefined;
  affiliateId: string;
  affiliateName: string;
  onViewCommission?: (commissionId: string) => void;
  onDismissSignal?: (signalId: string, note?: string) => Promise<void>;
  onSuspendAffiliate?: (reason?: string) => Promise<void>;
  isLoading?: boolean;
  canManage?: boolean;
}

const signalTypeLabels: Record<string, string> = {
  selfReferral: "Self-Referral Detected",
  botTraffic: "Bot Traffic Pattern",
  ipAnomaly: "IP Address Anomaly",
  manual_suspension: "Manual Suspension",
};

const severityConfig = {
  high: {
    badge: "bg-[var(--danger-bg)] text-[var(--danger-text)] border-[var(--danger)]",
    card: "border-[var(--danger)] bg-[var(--danger-bg)]/30",
    icon: "🚨",
    iconColor: "text-[var(--danger)]",
  },
  medium: {
    badge: "bg-[var(--warning-bg)] text-[var(--warning-text)] border-[var(--warning)]",
    card: "border-[var(--warning)] bg-[var(--warning-bg)]/30",
    icon: "⚠️",
    iconColor: "text-[var(--warning)]",
  },
  low: {
    badge: "bg-[var(--info-bg)] text-[var(--info-text)] border-[var(--info)]",
    card: "border-[var(--info)] bg-[var(--info-bg)]/30",
    icon: "ℹ️",
    iconColor: "text-[var(--info)]",
  },
};

export function FraudSignalsSection({
  fraudSignals,
  affiliateId,
  affiliateName,
  onViewCommission,
  onDismissSignal,
  onSuspendAffiliate,
  isLoading = false,
  canManage = false,
}: FraudSignalsSectionProps) {
  const [signalTypeFilter, setSignalTypeFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [reviewedFilter, setReviewedFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [showFilters, setShowFilters] = useState(false);

  // Dismiss dialog state
  const [dismissDialogOpen, setDismissDialogOpen] = useState(false);
  const [selectedSignalId, setSelectedSignalId] = useState<string | null>(null);
  const [selectedSignal, setSelectedSignal] = useState<FraudSignal | null>(null);
  const [dismissNote, setDismissNote] = useState("");
  const [isDismissing, setIsDismissing] = useState(false);

  // Suspend dialog state
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");
  const [isSuspending, setIsSuspending] = useState(false);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Parse matched indicators from details for self-referral signals
  const parseMatchedIndicators = (details?: string): string[] => {
    if (!details) return [];
    try {
      const parsed = JSON.parse(details);
      return parsed.matchedIndicators || [];
    } catch {
      return [];
    }
  };

  // Get commission ID from details for self-referral signals
  const getCommissionId = (details?: string): string | undefined => {
    if (!details) return undefined;
    try {
      const parsed = JSON.parse(details);
      return parsed.commissionId;
    } catch {
      return undefined;
    }
  };

  // Format indicator for display
  const formatIndicator = (indicator: string): string => {
    const labels: Record<string, string> = {
      email_match: "Email Match",
      ip_match: "IP Match",
      ip_subnet_match: "IP Subnet Match",
      device_match: "Device Match",
      payment_method_match: "Payment Method Match",
      payment_processor_match: "Payment Processor Match",
    };
    return labels[indicator] || indicator.replace(/_/g, " ");
  };

  // Filter and sort signals
  const filteredSignals = (fraudSignals || [])
    .filter((signal) => {
      if (signalTypeFilter !== "all" && signal.type !== signalTypeFilter) return false;
      if (severityFilter !== "all" && signal.severity !== severityFilter) return false;
      if (reviewedFilter === "reviewed" && !signal.reviewedAt) return false;
      if (reviewedFilter === "unreviewed" && signal.reviewedAt) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "newest") return b.timestamp - a.timestamp;
      if (sortBy === "oldest") return a.timestamp - b.timestamp;
      if (sortBy === "severity") {
        const order = { high: 3, medium: 2, low: 1 };
        return order[b.severity] - order[a.severity];
      }
      return 0;
    });

  const handleDismissClick = (signal: FraudSignal) => {
    setSelectedSignal(signal);
    setSelectedSignalId(signal.signalId || null);
    setDismissNote("");
    setDismissDialogOpen(true);
  };

  const handleDismissConfirm = async () => {
    if (selectedSignalId === null || !onDismissSignal) return;

    // Require note for high severity
    if (selectedSignal?.severity === "high" && !dismissNote.trim()) {
      return;
    }

    setIsDismissing(true);
    try {
      await onDismissSignal(selectedSignalId, dismissNote.trim() || undefined);
      setDismissDialogOpen(false);
      setSelectedSignalId(null);
      setSelectedSignal(null);
      setDismissNote("");
    } finally {
      setIsDismissing(false);
    }
  };

  const handleSuspendClick = () => {
    setSuspendReason("");
    setSuspendDialogOpen(true);
  };

  const handleSuspendConfirm = async () => {
    if (!onSuspendAffiliate) return;

    setIsSuspending(true);
    try {
      await onSuspendAffiliate(suspendReason.trim() || undefined);
      setSuspendDialogOpen(false);
      setSuspendReason("");
    } finally {
      setIsSuspending(false);
    }
  };

  const unreviewedCount = (fraudSignals || []).filter((s) => !s.reviewedAt).length;

  if (!fraudSignals || fraudSignals.length === 0) {
    return (
      <div className="card">
        <div className="card-header">
          <h3 className="card-title flex items-center gap-2">
            <ShieldAlert className="h-4 w-4" />
            Risk & Security Signals
          </h3>
        </div>
        <div className="px-5 pb-5">
          <div className="text-center py-10 text-[var(--text-muted)]">
            <ShieldAlert className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="text-[13px]">No fraud signals detected for this affiliate</p>
            <p className="text-[11px] mt-1">All activity appears normal</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="card">
        <div className="card-header flex-col !items-start gap-4">
          <div className="flex items-center justify-between w-full">
            <h3 className="card-title flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" />
              Risk & Security Signals
              {unreviewedCount > 0 && (
                <Badge variant="destructive" className="ml-1">
                  {unreviewedCount} unreviewed
                </Badge>
              )}
            </h3>
            <div className="flex items-center gap-2">
              {canManage && unreviewedCount > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleSuspendClick}
                  disabled={isLoading}
                >
                  <UserX className="h-4 w-4 mr-1" />
                  Suspend
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4 mr-1" />
                {showFilters ? "Hide" : "Filters"}
              </Button>
            </div>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-[var(--border-light)] w-full">
              <div className="space-y-1">
                <Label className="text-[11px] text-[var(--text-muted)] uppercase tracking-wide">Signal Type</Label>
                <Select value={signalTypeFilter} onValueChange={setSignalTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="selfReferral">Self-Referral</SelectItem>
                    <SelectItem value="botTraffic">Bot Traffic</SelectItem>
                    <SelectItem value="ipAnomaly">IP Anomaly</SelectItem>
                    <SelectItem value="manual_suspension">Manual Suspension</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-[var(--text-muted)] uppercase tracking-wide">Severity</Label>
                <Select value={severityFilter} onValueChange={setSeverityFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All severities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Severities</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-[var(--text-muted)] uppercase tracking-wide">Status</Label>
                <Select value={reviewedFilter} onValueChange={setReviewedFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="unreviewed">Unreviewed</SelectItem>
                    <SelectItem value="reviewed">Reviewed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-[var(--text-muted)] uppercase tracking-wide">Sort By</Label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger>
                    <ArrowUpDown className="h-3 w-3 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="oldest">Oldest First</SelectItem>
                    <SelectItem value="severity">Severity (High → Low)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="flex items-center gap-4 text-[12px] text-[var(--text-muted)]">
            <span>Total: {filteredSignals.length}</span>
            {filteredSignals.length !== (fraudSignals?.length || 0) && (
              <span>(filtered from {fraudSignals?.length})</span>
            )}
          </div>
        </div>

        <div className="px-5 pb-5">
          <div className="space-y-3">
            {filteredSignals.length === 0 ? (
              <div className="text-center py-8 text-[var(--text-muted)]">
                <EyeOff className="h-8 w-8 mx-auto mb-2 opacity-20" />
                <p className="text-[13px]">No signals match the selected filters</p>
              </div>
            ) : (
              filteredSignals.map((signal, originalIndex) => {
                const isSelfReferral = signal.type === "selfReferral";
                const matchedIndicators = parseMatchedIndicators(signal.details);
                const commissionId = getCommissionId(signal.details);
                const config = severityConfig[signal.severity];
                const isReviewed = !!signal.reviewedAt;

                return (
                  <div
                    key={originalIndex}
                    className={cn(
                      "rounded-lg border p-4 transition-opacity",
                      config.card,
                      isReviewed && "opacity-60"
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[13px] font-medium text-[var(--text-heading)] capitalize flex items-center gap-2">
                            {isSelfReferral && (
                              <AlertTriangle className={cn("h-4 w-4", config.iconColor)} />
                            )}
                            {signalTypeLabels[signal.type] || signal.type.replace(/_/g, " ")}
                          </span>
                          <Badge variant="outline" className={config.badge}>
                            {config.icon} {signal.severity}
                          </Badge>
                          {isReviewed && (
                            <Badge variant="outline" className="bg-[var(--success-bg)] text-[var(--success-text)]">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Reviewed
                            </Badge>
                          )}
                        </div>

                        {/* Self-referral specific: Display matched indicators as pills */}
                        {isSelfReferral && matchedIndicators.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {matchedIndicators.map((indicator, idx) => (
                              <Badge
                                key={idx}
                                variant="outline"
                                className="bg-[var(--danger-bg)] text-[var(--danger-text)]"
                              >
                                <Link2 className="h-3 w-3 mr-1" />
                                {formatIndicator(indicator)}
                              </Badge>
                            ))}
                          </div>
                        )}

                        {signal.details && !isSelfReferral && (
                          <p className="mt-2 text-[12px] text-[var(--text-muted)]">{signal.details}</p>
                        )}

                        {/* Review information */}
                        {isReviewed && (
                          <div className="mt-3 p-3 bg-[var(--bg-surface)] rounded-md">
                            <div className="flex items-center gap-2 text-[12px]">
                              <CheckCircle className="h-4 w-4 text-[var(--success)]" />
                              <span className="font-medium text-[var(--text-heading)]">Reviewed by {signal.reviewedByName || signal.reviewedBy}</span>
                              <span className="text-[var(--text-muted)]">
                                on {formatDate(signal.reviewedAt!)}
                              </span>
                            </div>
                            {signal.reviewNote && (
                              <p className="mt-1 text-[12px] text-[var(--text-muted)] pl-6">
                                Note: {signal.reviewNote}
                              </p>
                            )}
                          </div>
                        )}

                        <div className="mt-3 flex items-center gap-4 text-[11px] text-[var(--text-muted)]">
                          <span>Detected: {formatDate(signal.timestamp)}</span>
                          
                          {/* Self-referral specific: Show link to commission */}
                          {isSelfReferral && commissionId && onViewCommission && (
                            <button
                              onClick={() => onViewCommission(commissionId)}
                              className="text-[var(--danger)] hover:text-[var(--danger-text)] font-medium"
                            >
                              View Commission →
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      {canManage && !isReviewed && (
                        <div className="flex flex-col gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDismissClick(signal)}
                            disabled={isLoading || !signal.signalId}
                            title={!signal.signalId ? "Signal pending migration" : undefined}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Dismiss
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Dismiss Dialog */}
      <Dialog open={dismissDialogOpen} onOpenChange={setDismissDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Dismiss Fraud Signal
            </DialogTitle>
            <DialogDescription>
              You&apos;re dismissing a fraud signal. This action will mark the signal as reviewed.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {selectedSignal && (
              <div className="p-3 rounded-md bg-[var(--bg-page)]">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={severityConfig[selectedSignal.severity].badge}>
                    {severityConfig[selectedSignal.severity].icon} {selectedSignal.severity}
                  </Badge>
                  <span className="text-[13px] font-medium text-[var(--text-heading)]">
                    {signalTypeLabels[selectedSignal.type] || selectedSignal.type}
                  </span>
                </div>
              </div>
            )}

            {selectedSignal?.severity === "high" && (
              <div className="flex items-start gap-2 text-[13px] text-[var(--warning-text)]">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>A dismissal note is required for high-severity signals.</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="dismiss-note">
                Dismissal Note
                {selectedSignal?.severity === "high" && (
                  <span className="text-[var(--danger)]"> *</span>
                )}
              </Label>
              <Textarea
                id="dismiss-note"
                placeholder="Enter a note explaining why you're dismissing this signal..."
                value={dismissNote}
                onChange={(e) => setDismissNote(e.target.value)}
                maxLength={500}
                rows={3}
                className="text-[13px]"
              />
              <div className="flex justify-between text-[11px] text-[var(--text-muted)]">
                <span>
                  {selectedSignal?.severity === "high" && !dismissNote.trim() && (
                    <span className="text-[var(--danger)]">Note is required</span>
                  )}
                </span>
                <span>{dismissNote.length}/500</span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDismissDialogOpen(false)}
              disabled={isDismissing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDismissConfirm}
              disabled={
                isDismissing ||
                (selectedSignal?.severity === "high" && !dismissNote.trim())
              }
            >
              {isDismissing ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Dismissing...
                </>
              ) : (
                "Dismiss Signal"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspend Dialog */}
      <Dialog open={suspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[var(--danger)]">
              <AlertTriangle className="h-5 w-5" />
              Suspend Affiliate
            </DialogTitle>
            <DialogDescription>
              You are about to suspend <strong>{affiliateName}</strong>. This action will:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-[13px] text-[var(--text-muted)]">
            <ul className="list-disc pl-4 space-y-1">
              <li>Prevent the affiliate from logging in to the portal</li>
              <li>Disable their referral links (return 404)</li>
              <li>Preserve pending commissions but stop processing</li>
              <li>Immediately terminate any active sessions</li>
              <li>Send a suspension notification email to the affiliate</li>
            </ul>
          </div>

          <div className="space-y-2">
            <Label htmlFor="suspend-reason">
              Suspension Reason <span className="text-[var(--text-muted)]">(optional)</span>
            </Label>
            <Textarea
              id="suspend-reason"
              placeholder="Enter a reason for the suspension..."
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              maxLength={500}
              rows={3}
              className="text-[13px]"
            />
            <div className="text-[11px] text-[var(--text-muted)] text-right">
              {suspendReason.length}/500
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setSuspendDialogOpen(false)}
              disabled={isSuspending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleSuspendConfirm}
              disabled={isSuspending}
            >
              {isSuspending ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Suspending...
                </>
              ) : (
                <>
                  <UserX className="h-4 w-4 mr-1" />
                  Suspend Affiliate
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
