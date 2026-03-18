"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ImpersonateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: Id<"tenants">;
  tenantName: string;
}

export function ImpersonateModal({
  open,
  onOpenChange,
  tenantId,
  tenantName,
}: ImpersonateModalProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const startImpersonation = useMutation(
    api.admin.impersonation.startImpersonation
  );

  const handleConfirm = async () => {
    setIsLoading(true);

    // Capture IP address for security audit (AC2)
    let ipAddress: string | undefined;
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      ipAddress = data.ip;
    } catch {
      // IP detection failed, continue without it
      ipAddress = undefined;
    }

    try {
      const result = await startImpersonation({ tenantId, ipAddress });
      if (result.success) {
        toast.success("Impersonation started", {
          description: `You are now acting as ${tenantName}.`,
        });
        router.push(result.redirectUrl);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to start impersonation";
      toast.error("Impersonation failed", { description: message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-amber-50 border-2 border-amber-200 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            <DialogTitle className="text-lg">Impersonate Tenant</DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            You are about to sign in as{" "}
            <strong className="text-foreground">{tenantName}</strong>. You will
            see exactly what this tenant owner sees.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          <strong>&#9888;&#65039; Audit Notice:</strong> All actions during
          impersonation are logged with your admin identity. Mutations performed
          will affect real data.
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            className="bg-amber-800 hover:bg-amber-900 text-white"
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Start Impersonation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
