"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link2, Copy, Share2, Settings, Check } from "lucide-react";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

interface QuickLinkCardProps {
  primaryLink?: string;
  affiliateId: string;
}

export function QuickLinkCard({ primaryLink, affiliateId }: QuickLinkCardProps) {
  const [copied, setCopied] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [vanitySlug, setVanitySlug] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  
  const updateVanitySlug = useMutation(api.referralLinks.updateVanitySlug);

  const handleCopyLink = async () => {
    if (!primaryLink) return;
    
    try {
      await navigator.clipboard.writeText(primaryLink);
      setCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = primaryLink;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    if (!primaryLink) return;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Check out my affiliate link",
          text: "Sign up using my referral link:",
          url: primaryLink,
        });
      } catch (error) {
        // User cancelled or share failed
        console.log("Share cancelled or failed");
      }
    } else {
      // Fallback to clipboard
      await handleCopyLink();
      toast.info("Share not supported, link copied instead");
    }
  };

  const handleCustomize = async () => {
    if (!vanitySlug.trim()) return;
    
    setIsUpdating(true);
    try {
      await updateVanitySlug({
        affiliateId: affiliateId as Id<"affiliates">,
        vanitySlug: vanitySlug.trim(),
      });
      toast.success("Vanity slug updated!");
      setShowCustomize(false);
      setVanitySlug("");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update vanity slug";
      toast.error(errorMessage);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Link2 className="w-4 h-4" />
            Your Referral Link
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="text-blue-600 hover:text-blue-700"
            onClick={() => setShowCustomize(!showCustomize)}
            aria-label="Customize your referral link"
          >
            <Settings className="w-4 h-4 mr-1" aria-hidden="true" />
            Customize
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Link Display */}
        <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
          <Link2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <span className="text-sm text-gray-600 truncate flex-1">
            {primaryLink || "Loading..."}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={handleCopyLink}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 mr-1 text-green-600" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-1" />
                Copy Link
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={handleShare}
          >
            <Share2 className="w-4 h-4 mr-1" />
            Share
          </Button>
        </div>

        {/* Customize Section */}
        {showCustomize && (
          <div className="pt-3 border-t">
            <p className="text-sm text-gray-600 mb-2">
              Customize your link with a vanity slug:
            </p>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="your-custom-slug"
                value={vanitySlug}
                onChange={(e) => setVanitySlug(e.target.value)}
                className="flex-1"
              />
              <Button
                size="sm"
                onClick={handleCustomize}
                disabled={isUpdating || !vanitySlug.trim()}
              >
                {isUpdating ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}