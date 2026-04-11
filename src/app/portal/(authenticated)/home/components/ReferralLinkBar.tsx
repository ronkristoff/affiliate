"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check, Share2, Link2 } from "lucide-react";
import { toast } from "sonner";

interface ReferralLinkBarProps {
  referralLink?: string;
  affiliateId: string;
}

export function ReferralLinkBar({
  referralLink,
}: ReferralLinkBarProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!referralLink) return;

    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = referralLink;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    if (!referralLink) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join via my referral link",
          url: referralLink,
        });
      } catch {
        if ((globalThis as Record<string, unknown>).DOMException && (globalThis as Record<string, unknown>).AbortError) {
          console.log("Share cancelled");
        }
      }
    } else {
      await handleCopy();
      toast.info("Share not supported on this browser — link copied instead");
    }
  };

  return (
    <div className="flex items-center gap-2 bg-muted/50 border border-muted rounded-lg py-3 px-4">
      <Link2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      <span className="text-sm text-muted-foreground truncate flex-1 min-w-0">
        {referralLink || "No referral link yet"}
      </span>
      <Button variant="ghost" size="sm" className="flex-shrink-0 h-8 px-2" onClick={handleCopy}>
        {copied ? (
          <Check className="w-4 h-4 text-green-600" />
        ) : (
          <Copy className="w-4 h-4" />
        )}
        <span className="ml-1.5 text-xs">{copied ? "Copied" : "Copy"}</span>
      </Button>
      <Button variant="ghost" size="sm" className="flex-shrink-0 h-8 px-2" onClick={handleShare}>
        <Share2 className="w-4 h-4" />
        <span className="ml-1.5 text-xs">Share</span>
      </Button>
    </div>
  );
}
