"use client";

import { useQuery, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { AlertTriangle, LogOut, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function ImpersonationBanner() {
  const router = useRouter();
  const [isExiting, setIsExiting] = useState(false);

  const status = useQuery(api.admin.impersonation.getImpersonationStatus);
  const endImpersonation = useMutation(
    api.admin.impersonation.endImpersonation
  );

  // Don't render if not impersonating (query loading or null result)
  if (!status) {
    return null;
  }

  const handleExit = async () => {
    setIsExiting(true);
    try {
      const result = await endImpersonation({
        returnToTenantId: status.targetTenantId,
      });
      if (result.success) {
        toast.info("Impersonation ended", {
          description: `Session duration: ${Math.round(result.sessionSummary.duration / 60)} minutes. ${result.sessionSummary.mutationsCount} mutation(s) performed.`,
        });
        router.push(result.redirectUrl);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to end impersonation";
      toast.error("Error ending impersonation", { description: message });
    } finally {
      setIsExiting(false);
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-50 border-b-2 border-amber-400 px-4 sm:px-6 py-2.5 flex items-center justify-between">
      <div className="flex items-center gap-3 min-w-0">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
        <p className="text-sm font-medium text-amber-900 truncate">
          Acting as <strong>{status.targetOwnerEmail}</strong> &mdash;{" "}
          <span className="font-normal">
            all actions are logged. You are viewing this tenant&apos;s dashboard.
          </span>
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="shrink-0 bg-amber-800 hover:bg-amber-900 text-white border-amber-800"
        onClick={handleExit}
        disabled={isExiting}
      >
        {isExiting ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <LogOut className="w-4 h-4 mr-2" />
        )}
        Exit Impersonation
      </Button>
    </div>
  );
}
