"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { QueryConfig } from "@/hooks/useQueryBuilder";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface SaveQueryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: QueryConfig;
  queryId?: string;
}

const SHARE_ROLES = [
  { value: "owner", label: "Owner" },
  { value: "manager", label: "Manager" },
  { value: "viewer", label: "Viewer" },
];

export function SaveQueryDialog({
  open,
  onOpenChange,
  config,
  queryId,
}: SaveQueryDialogProps) {
  const saveMutation = useMutation(api.queryBuilder.saveQuery);
  const updateMutation = useMutation(api.queryBuilder.updateSavedQuery);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isShared, setIsShared] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Query name is required");
      return;
    }

    setIsSaving(true);
    try {
      if (queryId) {
        await updateMutation({
          queryId: queryId as any,
          name: name.trim(),
          description: description.trim() || undefined,
          queryConfig: JSON.stringify(config),
          isShared,
          sharedWithRoles: isShared ? selectedRoles : undefined,
        });
        toast.success("Query updated");
      } else {
        await saveMutation({
          name: name.trim(),
          description: description.trim() || undefined,
          queryConfig: JSON.stringify(config),
          isShared,
          sharedWithRoles: isShared ? selectedRoles : undefined,
        });
        toast.success("Query saved");
      }
      setName("");
      setDescription("");
      setIsShared(false);
      setSelectedRoles([]);
      onOpenChange(false);
    } catch {
      toast.error("Failed to save query");
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
          <DialogTitle>{queryId ? "Update Query" : "Save Query"}</DialogTitle>
          <DialogDescription>
            {queryId
              ? "Update your saved query settings."
              : "Save this query to your library for quick access later."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="query-name">Name</Label>
            <Input
              id="query-name"
              placeholder="e.g., Top Affiliates Report"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="query-description">Description (optional)</Label>
            <Textarea
              id="query-description"
              placeholder="Brief description of what this query does..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="share-toggle"
                checked={isShared}
                onCheckedChange={(checked) => setIsShared(checked === true)}
              />
              <Label htmlFor="share-toggle" className="cursor-pointer">
                Share with team
              </Label>
            </div>

            {isShared && (
              <div className="ml-6 space-y-2">
                <span className="text-[11px] text-[var(--text-muted)]">
                  Select roles that can view this query:
                </span>
                <div className="flex flex-wrap gap-2">
                  {SHARE_ROLES.map((role) => {
                    const checked = selectedRoles.includes(role.value);
                    return (
                      <label
                        key={role.value}
                        className={cn(
                          "flex items-center gap-2 rounded-lg border px-3 py-1.5 cursor-pointer transition-all text-[13px]",
                          checked
                            ? "border-[#1c2260] bg-[#eff6ff] text-[#1c2260]"
                            : "border-[var(--border)] hover:border-[#1fb5a5]/40"
                        )}
                      >
                        <Checkbox checked={checked} onCheckedChange={() => handleToggleRole(role.value)} />
                        {role.label}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !name.trim()}>
            {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {queryId ? "Update" : "Save Query"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
