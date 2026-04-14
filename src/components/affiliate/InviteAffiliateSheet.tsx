"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { Loader2, UserPlus } from "lucide-react";

const PROMOTION_CHANNELS = [
  { value: "newsletter", label: "Newsletter / Blog" },
  { value: "youtube", label: "YouTube / Video content" },
  { value: "social_media", label: "Social media (Facebook, Instagram, TikTok)" },
  { value: "telegram_discord", label: "Telegram / Discord community" },
  { value: "podcast", label: "Podcast" },
  { value: "other", label: "Other" },
] as const;

const inviteSchema = z.object({
  firstName: z
    .string()
    .min(1, "First name is required")
    .min(2, "First name must be at least 2 characters")
    .max(50, "First name must be less than 50 characters"),
  lastName: z
    .string()
    .min(1, "Last name is required")
    .min(2, "Last name must be at least 2 characters")
    .max(50, "Last name must be less than 50 characters"),
  email: z
    .string()
    .min(1, "Email is required")
    .email("Enter a valid email like name@company.com"),
  promotionChannel: z.string().optional(),
});

type InviteFormData = z.infer<typeof inviteSchema>;

interface InviteAffiliateSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function InviteAffiliateSheet({ isOpen, onClose }: InviteAffiliateSheetProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentUser = useQuery(api.auth.getCurrentUser);
  const canManage = currentUser?.role === "owner" || currentUser?.role === "manager";
  const inviteAffiliate = useMutation(api.affiliates.inviteAffiliate);

  const form = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      promotionChannel: "",
    },
  });

  const resetForm = () => {
    form.reset({ firstName: "", lastName: "", email: "", promotionChannel: "" });
  };

  const onSubmit = async (data: InviteFormData) => {
    try {
      setIsSubmitting(true);
      const result = await inviteAffiliate({
        email: data.email.trim().toLowerCase(),
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        promotionChannel: data.promotionChannel || undefined,
      });

      toast.success(`${result.uniqueCode} has been added as an active affiliate`);
      resetForm();
      onClose();
      router.push(`/affiliates/${result.affiliateId}`);
    } catch (error) {
      const message =
        typeof error === "object" && error !== null && "data" in error
          ? String(error.data)
          : error instanceof Error
            ? error.message
            : "Failed to invite affiliate";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent className="w-[480px] sm:max-w-[480px] p-0 flex flex-col">
        <SheetHeader className="px-6 py-5 border-b border-[#e5e7eb]">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[var(--brand-primary)] flex items-center justify-center shrink-0">
              <UserPlus className="h-5 w-5 text-white" />
            </div>
            <div className="text-left">
              <SheetTitle className="text-base font-bold text-[#333]">
                Invite Affiliate
              </SheetTitle>
              <SheetDescription>
                Add a new affiliate to your program
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 overflow-y-auto">
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="John"
                          disabled={isSubmitting}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Doe"
                          disabled={isSubmitting}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="john@example.com"
                        disabled={isSubmitting}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="promotionChannel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Promotion Channel (Optional)</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                      disabled={isSubmitting}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="How will they promote you?" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PROMOTION_CHANNELS.map((channel) => (
                          <SelectItem key={channel.value} value={channel.value}>
                            {channel.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="px-6 py-4 border-t border-[#e5e7eb] flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Inviting...
                  </>
                ) : (
                  "Invite Affiliate"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
