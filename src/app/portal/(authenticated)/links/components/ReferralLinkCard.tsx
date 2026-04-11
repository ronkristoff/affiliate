"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Share2, Check, ExternalLink, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Id } from "@/convex/_generated/dataModel";

interface ReferralLinkCardProps {
  linkData: {
    _id: Id<"referralLinks">;
    shortUrl: string;
    fullUrl: string;
    vanityUrl?: string;
    clickCount: number;
    conversionCount: number;
    conversionRate: number;
  };
  updateVanitySlug: (args: { affiliateId: Id<"affiliates">; vanitySlug: string }) => Promise<{
    success: boolean;
    vanityUrl: string;
    message: string;
  }>;
  affiliateId: Id<"affiliates">;
}

export function ReferralLinkCard({ 
  linkData, 
  updateVanitySlug,
  affiliateId 
}: ReferralLinkCardProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [vanitySlug, setVanitySlug] = useState(linkData.vanityUrl?.split('/r/')[1] || "");
  const [isSaving, setIsSaving] = useState(false);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Link copied to clipboard!");
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
      return true;
    } catch {
      toast.error("Failed to copy link");
      return false;
    }
  };

  const shareLink = async (url: string, title: string) => {
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // User cancelled or error - silent fail
      }
    } else {
      await copyToClipboard(url);
    }
  };

  const handleSaveVanitySlug = async () => {
    if (!vanitySlug.trim()) {
      toast.error("Vanity slug cannot be empty");
      return;
    }

    setIsSaving(true);
    try {
      const result = await updateVanitySlug({
        affiliateId,
        vanitySlug: vanitySlug.trim(),
      });

      if (result.success) {
        toast.success(result.message);
        // Refresh the page to show updated vanity URL
        window.location.reload();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error("Failed to update vanity slug");
      console.error("Error updating vanity slug:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const displayUrl = linkData.vanityUrl || linkData.shortUrl;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Your Primary Referral Link</CardTitle>
        <CardDescription>
          Share this link to start earning commissions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Link Display */}
        <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-3">
          <ExternalLink className="h-4 w-4 text-gray-500 flex-shrink-0" />
          <code className="text-sm truncate flex-1">{displayUrl}</code>
        </div>

        {/* Stats Row */}
        <div className="flex gap-4 text-sm">
          <div>
            <span className="font-semibold">{linkData.clickCount}</span>
            <span className="text-muted-foreground ml-1">clicks</span>
          </div>
          <div>
            <span className="font-semibold">{linkData.conversionCount}</span>
            <span className="text-muted-foreground ml-1">conversions</span>
          </div>
          <div>
            <span className="font-semibold">{linkData.conversionRate}%</span>
            <span className="text-muted-foreground ml-1">CTR</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button 
            onClick={() => copyToClipboard(displayUrl)}
            className="flex-1 bg-[var(--portal-primary)]"
          >
            {isCopied ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                Copy Link
              </>
            )}
          </Button>
          <Button 
            variant="outline"
            onClick={() => shareLink(displayUrl, "Check out this affiliate link")}
          >
            <Share2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Vanity Link Section */}
        <div className="border-t pt-4">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="text-sm font-semibold">Vanity Link</h4>
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-sm text-muted-foreground">yourdomain.com/r/</span>
            <Input
              value={vanitySlug}
              onChange={(e) => setVanitySlug(e.target.value)}
              placeholder="your-slug"
              className="flex-1 max-w-xs"
            />
            <Button
              onClick={handleSaveVanitySlug}
              disabled={isSaving}
              variant="outline"
            >
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
          <div className="flex items-center gap-1 mt-2 text-xs text-amber-600">
            <AlertTriangle className="h-3 w-3" />
            <span>Warning: Old link will stop working after update</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}