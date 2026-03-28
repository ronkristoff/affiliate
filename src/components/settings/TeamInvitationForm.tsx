"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Mail, UserPlus, AlertTriangle, TrendingUp, Users } from "lucide-react";
import { toast } from "sonner";

const invitationSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Enter a valid email like name@company.com"),
  role: z.enum({ owner: "owner", manager: "manager", viewer: "viewer" }),
});

type InvitationFormData = z.infer<typeof invitationSchema>;

interface TeamInvitationFormProps {
  onInvitationSent?: () => void;
  disabled?: boolean;
}

export function TeamInvitationForm({ onInvitationSent, disabled }: TeamInvitationFormProps) {
  const [isLoading, setIsLoading] = useState(false);

  const createInvitation = useMutation(api.teamInvitations.createTeamInvitation);
  
  // Task 3.5: Get tier limit status
  const limitStatus = useQuery(api.teamInvitations.getTeamLimitStatus);
  
  const isAtLimit = limitStatus && (limitStatus.status === "critical" || limitStatus.status === "blocked");
  const isAtWarning = limitStatus && limitStatus.status === "warning";
  const isUnlimited = limitStatus && limitStatus.limit === -1;
  
  // Combine disabled states - also disable when at limit
  const isDisabled = disabled || isAtLimit;

  const form = useForm<InvitationFormData>({
    resolver: zodResolver(invitationSchema),
    defaultValues: {
      email: "",
      role: "viewer",
    },
  });

  const onSubmit = async (data: InvitationFormData) => {
    setIsLoading(true);

    try {
      await createInvitation({
        email: data.email,
        role: data.role,
      });
      form.reset({ email: "", role: "viewer" });
      toast.success("Invitation sent successfully!");
      onInvitationSent?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to send invitation";
      form.setError("root", { message: errorMessage });
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
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {form.formState.errors.root && (
              <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <p className="text-sm text-red-600 dark:text-red-400">
                  {form.formState.errors.root.message}
                </p>
              </div>
            )}

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="colleague@company.com"
                        disabled={isDisabled || isLoading}
                        className="pl-10"
                        {...field}
                      />
                    </FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isDisabled || isLoading}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="viewer">Viewer - Read-only access</SelectItem>
                      <SelectItem value="manager">Manager - Can manage campaigns, affiliates, commissions</SelectItem>
                      <SelectItem value="owner">Owner - Full access to everything</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {field.value === "owner" && "Owners have full access to all settings and data."}
                    {field.value === "manager" && "Managers can manage campaigns, affiliates, and commissions."}
                    {field.value === "viewer" && "Viewers have read-only access to campaigns, affiliates, and commissions."}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter>
            {isAtLimit && (
              <p className="text-sm text-red-600 dark:text-red-400 mb-2 text-center w-full">
                Cannot invite more team members. Please upgrade your plan.
              </p>
            )}
            <Button 
              type="submit" 
              disabled={isDisabled || isLoading} 
              className="w-full"
            >
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
      </Form>
    </Card>
  );
}
