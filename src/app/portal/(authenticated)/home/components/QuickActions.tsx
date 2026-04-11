"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Share2, Link2, Wallet } from "lucide-react";
import { toast } from "sonner";

interface QuickActionsProps {
  referralLink?: string;
  availableEarnings: number;
}

export function QuickActions({
  referralLink,
  availableEarnings,
}: QuickActionsProps) {
  const router = useRouter();

  const handleShare = async () => {
    if (!referralLink) {
      toast.error("No referral link available yet");
      return;
    }

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(
      `Sign up using my referral link: ${referralLink}`
    )}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join via my referral link",
          url: referralLink,
        });
        return;
      } catch {
        window.open(whatsappUrl, "_blank");
        return;
      }
    }

    window.open(whatsappUrl, "_blank");
  };

  return (
    <div className="flex flex-wrap gap-3">
      <Button onClick={handleShare}>
        <Share2 className="w-4 h-4 mr-1.5" />
        Share Link
      </Button>
      <Button variant="outline" onClick={() => router.push("/portal/links")}>
        <Link2 className="w-4 h-4 mr-1.5" />
        My Links
      </Button>
      {availableEarnings > 0 && (
        <Button variant="outline" onClick={() => router.push("/portal/earnings")}>
          <Wallet className="w-4 h-4 mr-1.5" />
          Withdraw
        </Button>
      )}
    </div>
  );
}
