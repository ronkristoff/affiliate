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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Save, KeyRound, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";

// Profile form validation schema
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
    reset,
    setValue,
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user.name || "",
    },
  });

  // Handle form submission
  const onSubmit = async (data: ProfileFormData) => {
    setIsSaving(true);
    setIsSuccess(false);

    try {
      await updateProfile({ name: data.name });

      // Show success toast
      toast.success("Profile updated successfully");

      // Update local state for optimistic UI
      setIsSuccess(true);

      // Reset success state after animation
      setTimeout(() => {
        setIsSuccess(false);
      }, 3000);
    } catch (error) {
      console.error("Failed to update profile:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update profile"
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Format plan name for display
  const formatPlan = (plan: string) => {
    return plan.charAt(0).toUpperCase() + plan.slice(1);
  };

  // Format role for display
  const formatRole = (role: string) => {
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  // Format creation date
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      {/* Profile Information Card */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>Manage your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar and Name Display */}
          <div className="flex items-center gap-4">
            <UserAvatar name={user.name} role={user.role} size="lg" />
            <div>
              <p className="font-semibold text-lg">{user.name || "No name set"}</p>
              <p className="text-sm text-muted-foreground">{formatRole(user.role)}</p>
            </div>
          </div>

          {/* Profile Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Name Field */}
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                Full Name <span className="text-destructive">*</span>
              </label>
              <Input
                id="name"
                type="text"
                placeholder="Enter your full name"
                {...register("name")}
                aria-invalid={errors.name ? "true" : "false"}
              />
              {errors.name && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.name.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Name must be between 2 and 100 characters
              </p>
            </div>

            {/* Email Field (Read-Only) */}
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email Address
              </label>
              <div className="flex items-center gap-2">
                <Input id="email" type="email" value={user.email} disabled readOnly className="flex-1" />
                {user.emailVerified ? (
                  <span className="flex items-center gap-1 text-sm text-green-600">
                    <Check className="h-4 w-4" />
                    Verified
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-sm text-amber-600">
                    <AlertCircle className="h-4 w-4" />
                    Unverified
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Email cannot be changed. Contact support to update your email.
              </p>
            </div>

            {/* Account Info (Read-Only) */}
            <div className="pt-2">
              <p className="text-xs text-muted-foreground">
                Account created: {formatDate(user._creationTime)}
              </p>
            </div>

            {/* Save Button */}
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
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Organization Card */}
      <Card>
        <CardHeader>
          <CardTitle>Organization</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Company Name */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">
              Company Name
            </label>
            <p className="text-sm">{tenant.name}</p>
          </div>

          {/* Plan */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">
              Plan
            </label>
            <p className="text-sm">{formatPlan(tenant.plan)}</p>
          </div>
        </CardContent>
      </Card>

      {/* Security Card */}
      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Password */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">
              Password
            </label>
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
  );
}
