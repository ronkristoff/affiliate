"use client";

import { AlertTriangle, Calendar, Eye, Pencil, Trash2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface CancellationNoticeProps {
  billingEndDate: number;
  cancellationDate: number;
  deletionScheduledDate: number;
}

export function CancellationNotice({
  billingEndDate,
  cancellationDate,
  deletionScheduledDate,
}: CancellationNoticeProps) {
  const now = Date.now();
  const accessEndDate = new Date(billingEndDate);
  const deletionDate = new Date(deletionScheduledDate);
  
  const daysUntilAccessEnd = Math.ceil(
    (accessEndDate.getTime() - now) / (1000 * 60 * 60 * 24)
  );
  const daysUntilDeletion = Math.ceil(
    (deletionDate.getTime() - now) / (1000 * 60 * 60 * 24)
  );
  
  const isWithinRetentionPeriod = now < billingEndDate;
  const isReadOnlyPeriod = now >= billingEndDate && now < deletionScheduledDate;

  return (
    <Alert variant="destructive" className="border-amber-500">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Subscription Cancelled</AlertTitle>
      <AlertDescription>
        Your subscription was cancelled on {new Date(cancellationDate).toLocaleDateString()}.
      </AlertDescription>
    </Alert>
  );
}

interface CancellationRetentionCardProps {
  billingEndDate: number;
  cancellationDate: number;
  deletionScheduledDate: number;
  onReactivate?: () => void;
}

export function CancellationRetentionCard({
  billingEndDate,
  cancellationDate,
  deletionScheduledDate,
  onReactivate,
}: CancellationRetentionCardProps) {
  const now = Date.now();
  const accessEndDate = new Date(billingEndDate);
  const deletionDate = new Date(deletionScheduledDate);
  
  const daysUntilAccessEnd = Math.ceil(
    (accessEndDate.getTime() - now) / (1000 * 60 * 60 * 24)
  );
  const daysUntilDeletion = Math.ceil(
    (deletionDate.getTime() - now) / (1000 * 60 * 60 * 24)
  );
  
  const isWithinRetentionPeriod = now < billingEndDate;
  const isReadOnlyPeriod = now >= billingEndDate && now < deletionScheduledDate;

  return (
    <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
          <AlertTriangle className="h-5 w-5" />
          Subscription Cancelled
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-amber-700 dark:text-amber-300">
          Your subscription was cancelled on {new Date(cancellationDate).toLocaleDateString()}.
          Your account and all data will be permanently deleted after the retention period.
        </p>

        <div className="space-y-3">
          {/* Access end date */}
          <div className="flex items-start gap-3 text-sm">
            <Calendar className="h-4 w-4 mt-0.5 text-amber-600" />
            <div>
              <p className="font-medium">
                Access ends: {accessEndDate.toLocaleDateString()}
              </p>
              <p className="text-muted-foreground text-xs">
                {daysUntilAccessEnd > 0 
                  ? `${daysUntilAccessEnd} days remaining in current billing cycle`
                  : 'Your access has ended'
                }
              </p>
            </div>
          </div>

          {/* Deletion date */}
          <div className="flex items-start gap-3 text-sm">
            <Trash2 className="h-4 w-4 mt-0.5 text-red-600" />
            <div>
              <p className="font-medium">
                Data deletion: {deletionDate.toLocaleDateString()}
              </p>
              <p className="text-muted-foreground text-xs">
                {daysUntilDeletion > 0 
                  ? `${daysUntilDeletion} days until permanent deletion`
                  : 'Your data has been deleted'
                }
              </p>
            </div>
          </div>
        </div>

        {/* Access status indicator */}
        {isWithinRetentionPeriod && (
          <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <Eye className="h-4 w-4 text-blue-600" />
            <span className="text-sm text-blue-700 dark:text-blue-300">
              <strong>Read-only access</strong> - You can view your data but cannot create or modify new content.
            </span>
          </div>
        )}

        {isReadOnlyPeriod && (
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
            <Pencil className="h-4 w-4 text-red-600" />
            <span className="text-sm text-red-700 dark:text-red-300">
              <strong>Write operations blocked</strong> - Your billing cycle has ended. You can no longer create or modify data.
            </span>
          </div>
        )}

        {/* Action buttons */}
        {onReactivate && daysUntilDeletion > 0 && (
          <div className="pt-2">
            <Button 
              onClick={onReactivate}
              className="w-full bg-amber-600 hover:bg-amber-700"
            >
              Reactivate Subscription
            </Button>
            <p className="text-xs text-center text-muted-foreground mt-2">
              Reactivate now to preserve your data and continue using the platform.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
