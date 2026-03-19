"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, ArrowLeft, UserPlus, Mail, Megaphone } from "lucide-react";
import Link from "next/link";

const PROMOTION_CHANNELS = [
  "Newsletter / Blog",
  "YouTube / Video content",
  "Social media (Facebook, Instagram, TikTok)",
  "Telegram / Discord community",
  "Podcast",
  "Other",
] as const;

export default function InviteAffiliatePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [promotionChannel, setPromotionChannel] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentUser = useQuery(api.auth.getCurrentUser);
  const canManage = currentUser?.role === "owner" || currentUser?.role === "manager";
  const inviteAffiliate = useMutation(api.affiliates.inviteAffiliate);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !email.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await inviteAffiliate({
        email: email.trim().toLowerCase(),
        name: name.trim(),
        promotionChannel: promotionChannel || undefined,
      });

      toast.success(`${result.uniqueCode} has been added as an active affiliate`);
      router.push(`/affiliates/${result.affiliateId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to invite affiliate");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (currentUser === undefined) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="py-12">
            <div className="flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Loading...
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">You don&apos;t have permission to invite affiliates.</p>
            <Button asChild variant="link" className="mt-4">
              <Link href="/affiliates">Back to Affiliates</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 max-w-lg">
      <Button variant="ghost" asChild className="mb-4">
        <Link href="/affiliates">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Affiliates
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[var(--brand-primary)] flex items-center justify-center">
              <UserPlus className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle>Invite Affiliate</CardTitle>
              <CardDescription>
                Add a new affiliate to your program. They&apos;ll be activated immediately.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name">
                Full Name <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="name"
                  placeholder="Jamie Mendoza"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="pl-10"
                  required
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">
                Email Address <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="jamie@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="channel">Promotion Channel</Label>
              <div className="relative">
                <Megaphone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Select value={promotionChannel} onValueChange={setPromotionChannel} disabled={isSubmitting}>
                  <SelectTrigger className="pl-10">
                    <SelectValue placeholder="Select their channel..." />
                  </SelectTrigger>
                  <SelectContent>
                    {PROMOTION_CHANNELS.map((channel) => (
                      <SelectItem key={channel} value={channel}>
                        {channel}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-[11px] text-muted-foreground">Helps you understand their audience</p>
            </div>

            <Button
              type="submit"
              className="w-full bg-[var(--brand-primary)] hover:bg-[var(--brand-secondary)]"
              disabled={isSubmitting || !name.trim() || !email.trim()}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding Affiliate...
                </>
              ) : (
                "Add Affiliate"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
