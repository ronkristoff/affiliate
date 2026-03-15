"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { TeamInvitationForm } from "@/components/settings/TeamInvitationForm";
import { PendingInvitationsList } from "@/components/settings/PendingInvitationsList";
import { TeamMembersList } from "@/components/settings/TeamMembersList";
import { Users, Shield, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function TeamSettingsPage() {
  // Task 5.4: RBAC check - Verify user has permission to access team settings
  // Viewers cannot access team settings
  const currentUser = useQuery(api.auth.getCurrentUser);
  
  // Check if user has viewer role - if so, deny access
  const isViewer = currentUser?.role === "viewer";
  
  // Loading state
  if (currentUser === undefined) {
    return (
      <div className="container max-w-4xl mx-auto py-10 px-4">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </div>
    );
  }
  
  // Task 5.4: Block Viewers from accessing team settings
  if (isViewer) {
    return (
      <div className="container max-w-4xl mx-auto py-10 px-4">
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Lock className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground mb-6 max-w-md">
            You don't have permission to access Team Settings. Only Owners and Managers can manage team members.
          </p>
          <Button asChild>
            <Link href="/dashboard">Return to Dashboard</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto py-10 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Users className="w-8 h-8" />
          Team Management
        </h1>
        <p className="text-muted-foreground mt-2">
          Invite team members and manage their roles and permissions
        </p>
      </div>

      <div className="space-y-8">
        {/* Role Information */}
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 mt-0.5 text-muted-foreground" />
            <div>
              <h3 className="font-medium">Role Permissions</h3>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                <li><strong>Owner:</strong> Full access to all settings and data</li>
                <li><strong>Manager:</strong> Can manage campaigns, affiliates, and commissions</li>
                <li><strong>Viewer:</strong> Read-only access to campaigns, affiliates, and commissions</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Team Members List */}
        <TeamMembersList />

        {/* Pending Invitations */}
        <PendingInvitationsList />

        {/* Invitation Form */}
        <TeamInvitationForm />
      </div>
    </div>
  );
}