"use client";

import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { CheckCircle, PauseCircle } from "lucide-react";

interface AffiliateProfileHeroProps {
  name: string;
  joinDate: number;
  status: string;
  canManage: boolean;
  isActive: boolean;
  isSuspended: boolean;
  onSuspend: () => void;
  onReactivate: () => void;
}

export function AffiliateProfileHero({
  name,
  joinDate,
  status,
  canManage,
  isActive,
  isSuspended,
  onSuspend,
  onReactivate,
}: AffiliateProfileHeroProps) {
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-lg font-semibold text-primary">
              {name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">{name}</CardTitle>
            <p className="text-muted-foreground text-sm">
              Joined {formatDate(joinDate)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={status} />
          {canManage && isActive && (
            <Button
              variant="destructive"
              size="sm"
              onClick={onSuspend}
            >
              <PauseCircle className="mr-2 h-4 w-4" />
              Suspend
            </Button>
          )}
          {canManage && isSuspended && (
            <Button
              variant="default"
              size="sm"
              onClick={onReactivate}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Reactivate
            </Button>
          )}
        </div>
      </CardHeader>
    </Card>
  );
}
