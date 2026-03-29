"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ShareQueryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  queryId: string | null;
}

const ROLES = [
  { value: "owner", label: "Owner" },
  { value: "manager", label: "Manager" },
  { value: "viewer", label: "Viewer" },
];

export function ShareQueryDialog({
  open,
  onOpenChange,
  queryId,
}: ShareQueryDialogProps) {
  const shareMutation = useMutation(api.queryBuilder.shareSavedQuery);

  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setSelectedRoles([]);
    }
  }, [open]);

  const handleSave = async () => {
    if (!queryId) return;
    setIsSaving(true);
    try {
      await shareMutation({
        queryId: queryId as Id<"savedQueries">,
        isShared: selectedRoles.length > 0,
        sharedWithRoles: selectedRoles,
      });
      toast.success("Sharing updated");
      onOpenChange(false);
    } catch {
      toast.error("Failed to update sharing");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleRole = (role: string) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Query</DialogTitle>
          <DialogDescription>
            Choose which team roles can view this saved query.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-3">
            <span className="text-sm font-medium text-[var(--text-heading)]">
              Access Roles
            </span>
            <div className="space-y-2">
              {ROLES.map((role) => {
                const checked = selectedRoles.includes(role.value);
                return (
                  <label
                    key={role.value}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-all",
                      checked
                        ? "border-[#10409a] bg-[#eff6ff]"
                        : "border-[var(--border)] hover:border-[#1659d6]/40"
                    )}
                  >
                    <Checkbox checked={checked} onCheckedChange={() => handleToggleRole(role.value)} />
                    <div>
                      <span className="text-[13px] font-medium text-[var(--text-heading)]">
                        {role.label}
                      </span>
                      <p className="text-[11px] text-[var(--text-muted)]">
                        {role.value === "owner"
                          ? "Full access including delete and share"
                          : role.value === "manager"
                            ? "Can view and edit the query"
                            : "Can only view and run the query"}
                      </p>
                    </div>
                    {checked && (
                      <Badge variant="default" className="text-[9px] ml-auto px-1.5 py-0">
                        Active
                      </Badge>
                    )}
                  </label>
                );
              })}
            </div>
          </div>

          {selectedRoles.length === 0 && (
            <p className="text-xs text-amber-600 bg-amber-50 rounded-lg p-2">
              No roles selected — query will be private.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
