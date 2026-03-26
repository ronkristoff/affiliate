"use client";

import { Suspense } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ProfileSettingsForm } from "@/components/settings/ProfileSettingsForm";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageTopbar } from "@/components/ui/PageTopbar";
import { Loader2, AlertCircle } from "lucide-react";

function ProfileContent() {
  const profileData = useQuery(api.users.getCurrentUserProfile);

  if (profileData === undefined) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (profileData === null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Unable to Load Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Unable to load your profile information. Please sign in again to continue.
          </p>
        </CardContent>
      </Card>
    );
  }

  return <ProfileSettingsForm user={profileData.user} tenant={profileData.tenant} />;
}

function ProfileSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-80" />
      </div>
      <Skeleton className="h-[400px] w-full rounded-xl" />
      <Skeleton className="h-[200px] w-full rounded-xl" />
    </div>
  );
}

export default function ProfileSettingsPage() {
  return (
    <div className="animate-fade-in">
      <PageTopbar description="Manage your account information and personal details">
        <h1 className="text-lg font-semibold text-heading">Profile</h1>
      </PageTopbar>
      <div className="px-8 py-6">
        <Suspense fallback={<ProfileSkeleton />}>
          <ProfileContent />
        </Suspense>
      </div>
    </div>
  );
}
