"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { UserAvatar } from "./UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Save, KeyRound, Check, AlertCircle, Shield, Building2, Calendar, Mail, Crown, Globe, RefreshCw } from "lucide-react";
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
    domain: string;
    trackingVerifiedAt?: number;
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

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
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
                <CardDescription>Your workspace details and website domain</CardDescription>
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
            <Separator />
            <DomainField tenant={tenant} />
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

const domainSchema = z.object({
  domain: z
    .string()
    .min(3, "Domain must be at least 3 characters")
    .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i, "Enter a valid domain like yourcompany.com"),
});

type DomainFormData = z.infer<typeof domainSchema>;

function DomainField({ tenant }: { tenant: { domain: string; trackingVerifiedAt?: number } }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const updateDomain = useMutation(api.tenants.updateTenantWebsiteDomain);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<DomainFormData>({
    resolver: zodResolver(domainSchema),
    defaultValues: { domain: tenant.domain },
  });

  const onSubmit = async (data: DomainFormData) => {
    setIsSaving(true);
    try {
      const result = await updateDomain({ domain: data.domain });
      toast.success(result.message);
      setIsEditing(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update domain");
    } finally {
      setIsSaving(false);
    }
  };

  const cancelEdit = () => {
    reset({ domain: tenant.domain });
    setIsEditing(false);
  };

  const isVerified = !!tenant.trackingVerifiedAt;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Website Domain
        </p>
        {isVerified ? (
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

      {isEditing ? (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div className="flex-1">
              <Input
                placeholder="yourcompany.com"
                {...register("domain")}
                aria-invalid={errors.domain ? "true" : "false"}
                className={errors.domain ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {errors.domain && (
                <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.domain.message}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-1.5 h-3 w-3" />
                  Save Domain
                </>
              )}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={cancelEdit} disabled={isSaving}>
              Cancel
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Changing your domain will reset tracking verification and update all referral links.
            Affiliates will be notified of the change.
          </p>
        </form>
      ) : (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <p className="text-sm font-medium text-heading">{tenant.domain}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
            <RefreshCw className="mr-1.5 h-3 w-3" />
            Edit
          </Button>
        </div>
      )}

      {!isVerified && !isEditing && (
        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
          <AlertCircle className="h-3 w-3 flex-shrink-0" />
          Install the tracking snippet on your website to verify this domain.{" "}
          <a href="/settings/tracking" className="text-brand underline underline-offset-2">
            Go to Tracking settings
          </a>
        </p>
      )}
    </div>
  );
}
