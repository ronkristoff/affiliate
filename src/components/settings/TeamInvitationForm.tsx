"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, Mail, UserPlus, AlertTriangle, TrendingUp, Users } from "lucide-react";
import { toast } from "sonner";

interface TeamInvitationFormProps {
  onInvitationSent?: () => void;
  disabled?: boolean;
}

export function TeamInvitationForm({ onInvitationSent, disabled }: TeamInvitationFormProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"owner" | "manager" | "viewer">("viewer");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createInvitation = useMutation(api.teamInvitations.createTeamInvitation);
  
  // Task 3.5: Get tier limit status
  const limitStatus = useQuery(api.teamInvitations.getTeamLimitStatus);
  
  const isAtLimit = limitStatus && (limitStatus.status === "critical" || limitStatus.status === "blocked");
  const isAtWarning = limitStatus && limitStatus.status === "warning";
  const isUnlimited = limitStatus && limitStatus.limit === -1;
  
  // Combine disabled states - also disable when at limit
  const isDisabled = disabled || isAtLimit;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await createInvitation({
        email,
        role,
      });
      setEmail("");
      setRole("viewer");
      toast.success("Invitation sent successfully!");
      onInvitationSent?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to send invitation";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="w-5 h-5" />
          Invite Team Member
        </CardTitle>
        <CardDescription>
          Send an invitation to join your team
        </CardDescription>
      </CardHeader>
      
      {/* Task 3.5: Show tier limit status */}
      {limitStatus && (
        <CardContent className="space-y-4">
          <div className={`rounded-lg p-3 flex items-center gap-3 ${
            isAtLimit 
              ? "bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800" 
              : isAtWarning 
                ? "bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800"
                : "bg-muted/50"
          }`}>
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
              isAtLimit 
                ? "bg-red-100 dark:bg-red-900" 
                : isAtWarning 
                  ? "bg-amber-100 dark:bg-amber-900"
                  : "bg-muted"
            }`}>
              {isAtLimit ? (
                <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
              ) : isAtWarning ? (
                <TrendingUp className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              ) : (
                <Users className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">
                {isUnlimited 
                  ? "Unlimited team members" 
                  : `${limitStatus.current} of ${limitStatus.limit} team members used`
                }
              </p>
              {isAtWarning && !isUnlimited && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Approaching limit - consider upgrading
                </p>
              )}
            </div>
          </div>
          
          {/* Task 3.6: Show upgrade prompt when limit reached */}
          {isAtLimit && (
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                <span className="text-sm font-medium text-red-700 dark:text-red-300">
                  Team member limit reached
                </span>
              </div>
              <p className="text-sm text-red-600 dark:text-red-400 mb-3">
                You have reached your team's member limit. Upgrade your plan to invite more team members.
              </p>
              <Button type="button" variant="outline" className="w-full border-red-300 text-red-700 hover:bg-red-100 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900">
                Upgrade Plan
              </Button>
            </div>
          )}
        </CardContent>
      )}
      
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="colleague@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isDisabled || isLoading}
                className="pl-10"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as "owner" | "manager" | "viewer")}
              disabled={isDisabled || isLoading}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="viewer">Viewer - Read-only access</option>
              <option value="manager">Manager - Can manage campaigns, affiliates, commissions</option>
              <option value="owner">Owner - Full access to everything</option>
            </select>
            <p className="text-xs text-muted-foreground">
              {role === "owner" && "Owners have full access to all settings and data."}
              {role === "manager" && "Managers can manage campaigns, affiliates, and commissions."}
              {role === "viewer" && "Viewers have read-only access to campaigns, affiliates, and commissions."}
            </p>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}
        </CardContent>
        <CardFooter>
          {isAtLimit && (
            <p className="text-sm text-red-600 dark:text-red-400 mb-2 text-center w-full">
              Cannot invite more team members. Please upgrade your plan.
            </p>
          )}
          <Button type="submit" disabled={isDisabled || isLoading || !email} className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending Invitation...
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4 mr-2" />
                Send Invitation
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}