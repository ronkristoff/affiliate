"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { UserAvatar } from "./UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Save, KeyRound, Check, AlertCircle, Shield, Building2, Calendar, Mail, Crown } from "lucide-react";
import { toast } from "sonner";

const profileSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be less than 100 characters")
    .regex(
      /^[a-zA-Z\s'-]+$/,
      "Name can only contain letters, spaces, hyphens, and apostrophes"
    ),
});

type ProfileFormData = z.infer<typeof profileSchema>;

interface ProfileSettingsFormProps {
  user: {
    _id: string;
    _creationTime: number;
    tenantId: string;
    email: string;
    name: string | undefined;
    role: string;
    emailVerified?: boolean;
  };
  tenant: {
    _id: string;
    name: string;
    plan: string;
  };
}

export function ProfileSettingsForm({ user, tenant }: ProfileSettingsFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const updateProfile = useMutation(api.users.updateUserProfile);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user.name || "",
    },
  });

  const onSubmit = async (data: ProfileFormData) => {
    setIsSaving(true);
    setIsSuccess(false);

    try {
      await updateProfile({ name: data.name });
      toast.success("Profile updated successfully");
      setIsSuccess(true);
      setTimeout(() => setIsSuccess(false), 3000);
    } catch (error) {
      console.error("Failed to update profile:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update profile"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const formatPlan = (plan: string) => plan.charAt(0).toUpperCase() + plan.slice(1);
  const formatRole = (role: string) => role.charAt(0).toUpperCase() + role.slice(1);
  const formatDate = (timestamp: number) =>
    new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-light">
              <Crown className="h-4 w-4 text-brand" />
            </div>
            <div>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Manage your account details and display name</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-start gap-5 rounded-lg bg-muted/50 p-4">
            <UserAvatar name={user.name} role={user.role} size="lg" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-heading truncate">{user.name || "No name set"}</p>
                <Badge variant="secondary" className="text-[11px] px-1.5 py-0">
                  {formatRole(user.role)}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5 truncate">{user.email}</p>
              <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                Joined {formatDate(user._creationTime)}
              </div>
            </div>
          </div>

          <Separator />

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Full Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Enter your full name"
                  {...register("name")}
                  aria-invalid={errors.name ? "true" : "false"}
                  className={errors.name ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                {errors.name && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.name.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    value={user.email}
                    disabled
                    readOnly
                    className="pr-20"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                    {user.emailVerified ? (
                      <span className="badge-success text-[10px]">
                        <Check className="h-3 w-3" />
                        Verified
                      </span>
                    ) : (
                      <span className="badge-warning text-[10px]">
                        <AlertCircle className="h-3 w-3" />
                        Unverified
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Contact support to update your email address
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : isSuccess ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Saved!
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
              {isSuccess && (
                <span className="text-xs text-[var(--success)] animate-fade-in">
                  Changes saved successfully
                </span>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-light">
                <Building2 className="h-4 w-4 text-brand" />
              </div>
              <div>
                <CardTitle>Organization</CardTitle>
                <CardDescription>Your workspace details</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Company Name
              </p>
              <p className="text-sm font-medium text-heading">{tenant.name}</p>
            </div>
            <Separator />
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Current Plan
              </p>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-heading">{formatPlan(tenant.plan)}</p>
                <Badge variant="outline" className="text-[10px]">
                  {tenant.plan === "starter" ? "Free" : tenant.plan === "growth" ? "₱2,499/mo" : "₱4,999/mo"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-light">
                <Shield className="h-4 w-4 text-brand" />
              </div>
              <div>
                <CardTitle>Security</CardTitle>
                <CardDescription>Password and authentication</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Password
              </p>
              <p className="text-sm text-muted-foreground">
                Manage your account password and security settings
              </p>
            </div>
            <Button variant="outline" asChild>
              <a href="/settings/security">
                <KeyRound className="mr-2 h-4 w-4" />
                Change Password
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
