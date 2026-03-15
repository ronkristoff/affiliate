"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Users, Trash2 } from "lucide-react";
import { RemoveTeamMemberDialog } from "./RemoveTeamMemberDialog";
import { toast } from "sonner";

// Use string type for user ID to avoid import issues
type UserId = string;

interface User {
  _id: UserId;
  email: string;
  name?: string;
  role: string;
}

function formatRole(role: string): string {
  switch (role) {
    case "owner":
      return "Owner";
    case "manager":
      return "Manager";
    case "viewer":
      return "Viewer";
    default:
      return role;
  }
}

function getRoleBadgeColor(role: string): string {
  switch (role) {
    case "owner":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
    case "manager":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    case "viewer":
      return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export function TeamMembersList() {
  const currentUser = useQuery(api.auth.getCurrentUser);
  const users = useQuery(api.users.getUsersByTenant);

  const [memberToRemove, setMemberToRemove] = useState<User | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Only Owners can remove team members
  const canRemoveMembers = currentUser?.role === "owner";

  const handleRemoveClick = (user: User) => {
    setMemberToRemove(user);
    setIsDialogOpen(true);
  };

  const handleRemoveSuccess = () => {
    toast.success("Team member removed successfully");
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setMemberToRemove(null);
  };

  if (currentUser === undefined || users === undefined) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-4">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!users || users.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center p-6 text-muted-foreground">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p>No team members found</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Team Members ({users.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {users.map((user) => (
              <div
                key={user._id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="space-y-1">
                  <p className="font-medium">
                    {user.name || "Unnamed User"}
                    {currentUser?._id === user._id && (
                      <span className="ml-2 text-xs text-muted-foreground">(You)</span>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(
                      user.role
                    )}`}
                  >
                    {formatRole(user.role)}
                  </span>
                  {canRemoveMembers && currentUser?._id !== user._id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleRemoveClick(user)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <RemoveTeamMemberDialog
        member={memberToRemove}
        isOpen={isDialogOpen}
        onClose={handleCloseDialog}
        onSuccess={handleRemoveSuccess}
      />
    </>
  );
}