"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Mail, X, Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface Invitation {
  _id: Id<"teamInvitations">;
  _creationTime: number;
  tenantId: Id<"tenants">;
  email: string;
  role: string;
  expiresAt: number;
  acceptedAt?: number;
}

function getExpirationStatus(expiresAt: number): { text: string; variant: "default" | "warning" | "destructive" } {
  const now = Date.now();
  const daysRemaining = Math.floor((expiresAt - now) / (1000 * 60 * 60 * 24));

  if (daysRemaining <= 0) {
    return { text: "Expired", variant: "destructive" };
  } else if (daysRemaining <= 1) {
    return { text: `Expires today`, variant: "warning" };
  } else if (daysRemaining <= 3) {
    return { text: `Expires in ${daysRemaining} days`, variant: "warning" };
  }
  return { text: `Expires in ${daysRemaining} days`, variant: "default" };
}

function formatRole(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function PendingInvitationsList() {
  const invitations = useQuery(api.teamInvitations.getPendingInvitations);
  const cancelInvitation = useMutation(api.teamInvitations.cancelInvitation);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const handleCancel = async (invitationId: Id<"teamInvitations">) => {
    try {
      setCancellingId(invitationId as string);
      await cancelInvitation({ invitationId });
      toast.success("Invitation cancelled successfully");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to cancel invitation";
      toast.error(errorMessage);
    } finally {
      setCancellingId(null);
    }
  };

  if (invitations === undefined) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pending Invitations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-4">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (invitations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pending Invitations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center p-6 text-muted-foreground">
            <Mail className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p>No pending invitations</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="w-5 h-5" />
          Pending Invitations ({invitations.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {invitations.map((invitation) => {
            const expiration = getExpirationStatus(invitation.expiresAt);
            const isCancelling = cancellingId === invitation._id;

            return (
              <div
                key={invitation._id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="space-y-1">
                  <p className="font-medium">{invitation.email}</p>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <span className="font-medium">{formatRole(invitation.role)}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span className={expiration.variant === "destructive" ? "text-red-500" : expiration.variant === "warning" ? "text-yellow-500" : ""}>
                        {expiration.text}
                      </span>
                    </span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCancel(invitation._id)}
                  disabled={isCancelling}
                  className="text-muted-foreground hover:text-red-500"
                >
                  {isCancelling ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <X className="w-4 h-4" />
                  )}
                  <span className="ml-2">Cancel</span>
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}