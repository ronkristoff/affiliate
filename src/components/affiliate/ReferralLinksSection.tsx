"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Copy, Check, Link as LinkIcon, Loader2, Plus, Trash2 } from "lucide-react";

interface ReferralLink {
  _id: Id<"referralLinks">;
  _creationTime: number;
  tenantId: Id<"tenants">;
  affiliateId: Id<"affiliates">;
  campaignId?: Id<"campaigns">;
  code: string;
  vanitySlug?: string;
  campaignName?: string;
  shortUrl: string;
  fullUrl: string;
  campaignUrl?: string;
  vanityUrl?: string;
  clickCount: number;
  conversionCount: number;
  conversionRate: number;
}

interface Campaign {
  _id: Id<"campaigns">;
  name: string;
  status: string;
}

interface ReferralLinksSectionProps {
  affiliateId: Id<"affiliates">;
  canManage: boolean;
  affiliateName?: string;
}

export function ReferralLinksSection({ affiliateId, canManage, affiliateName }: ReferralLinksSectionProps) {
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("none");
  const [vanitySlug, setVanitySlug] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [expandedLinkId, setExpandedLinkId] = useState<Id<"referralLinks"> | null>(null);
  const [isDeletingVanity, setIsDeletingVanity] = useState(false);

  // Queries
  const referralLinks = useQuery(api.referralLinks.getAffiliatePortalLinks, { 
    affiliateId 
  }) || [];
  
  const campaigns = useQuery(api.campaigns.listCampaigns, {}) || [];

  // Mutations
  const generateReferralLink = useMutation(api.referralLinks.generateReferralLink);
  const deleteVanitySlug = useMutation(api.referralLinks.deleteVanitySlug);

  const activeCampaigns = campaigns.filter((c: Campaign) => c.status === "active");

  const handleGenerateLink = async () => {
    try {
      setIsGenerating(true);
      const campaignId = selectedCampaignId === "none" ? undefined : selectedCampaignId as Id<"campaigns">;
      const vanity = vanitySlug.trim() || undefined;
      
      const result = await generateReferralLink({
        affiliateId,
        campaignId,
        vanitySlug: vanity,
      });

      toast.success("Referral link generated successfully!");
      setIsGenerateDialogOpen(false);
      setSelectedCampaignId("none");
      setVanitySlug("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate referral link");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyUrl = async (url: string, type: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(`${type}-${url}`);
      toast.success("Copied to clipboard!");
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (error) {
      toast.error("Failed to copy to clipboard");
    }
  };

  const handleDeleteVanitySlug = async () => {
    try {
      setIsDeletingVanity(true);
      await deleteVanitySlug({ affiliateId });
      toast.success("Vanity slug deleted successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete vanity slug");
    } finally {
      setIsDeletingVanity(false);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title flex items-center gap-2">
          <LinkIcon className="h-4 w-4" />
          Referral Links
        </h3>
        {canManage && (
          <Dialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Generate Link
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Generate Referral Link</DialogTitle>
                <DialogDescription>
                  Create a unique referral link for this affiliate. You can optionally associate it with a campaign and set a custom vanity slug.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="campaign">Campaign (Optional)</Label>
                  <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a campaign" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Campaign</SelectItem>
                      {activeCampaigns.map((campaign: Campaign) => (
                        <SelectItem key={campaign._id} value={campaign._id}>
                          {campaign.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vanitySlug">Vanity Slug (Optional)</Label>
                  <Input
                    id="vanitySlug"
                    placeholder="e.g., johns-special-offer"
                    value={vanitySlug}
                    onChange={(e) => setVanitySlug(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    3-50 characters. Use letters, numbers, hyphens, and underscores.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsGenerateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleGenerateLink} disabled={isGenerating}>
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    "Generate Link"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
      <div className="px-5 pb-5">
        {referralLinks.length === 0 ? (
          <div className="text-center py-10 text-[var(--text-muted)]">
            <LinkIcon className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-[14px] font-medium mb-1">No referral links yet</p>
            <p className="text-[12px] mb-4">Generate a referral link to start tracking clicks and conversions.</p>
            {canManage && (
              <Button onClick={() => setIsGenerateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Generate Link
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {referralLinks.map((link: ReferralLink) => (
              <div key={link._id} className="border border-[var(--border-light)] rounded-lg p-4">
                <div 
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedLinkId(expandedLinkId === link._id ? null : link._id)}
                >
                  <div>
                    <p className="font-mono text-[13px] text-[var(--text-heading)]">{link.code}</p>
                    {link.campaignName && (
                      <p className="text-[11px] text-[var(--text-muted)]">Campaign: {link.campaignName}</p>
                    )}
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)]">
                    Created {formatDate(link._creationTime)}
                  </div>
                </div>

                {expandedLinkId === link._id && (
                  <div className="mt-4 space-y-3 pt-4 border-t border-[var(--border-light)]">
                    {/* Short URL */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <p className="text-[11px] text-[var(--text-muted)] mb-1 uppercase tracking-wide">Short URL</p>
                        <code className="text-[12px] bg-[var(--bg-page)] px-2.5 py-1 rounded-md block truncate font-mono">
                          {link.shortUrl}
                        </code>
                      </div>
                      <Button
                        variant="outline"
                        size="icon"
                        className="shrink-0"
                        onClick={() => handleCopyUrl(link.shortUrl, `short-${link._id}`)}
                      >
                        {copiedUrl === `short-${link._id}` ? (
                          <Check className="h-4 w-4 text-[var(--success)]" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>

                    {/* Full URL */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <p className="text-[11px] text-[var(--text-muted)] mb-1 uppercase tracking-wide">Full URL</p>
                        <code className="text-[12px] bg-[var(--bg-page)] px-2.5 py-1 rounded-md block truncate font-mono">
                          {link.fullUrl}
                        </code>
                      </div>
                      <Button
                        variant="outline"
                        size="icon"
                        className="shrink-0"
                        onClick={() => handleCopyUrl(link.fullUrl, `full-${link._id}`)}
                      >
                        {copiedUrl === `full-${link._id}` ? (
                          <Check className="h-4 w-4 text-[var(--success)]" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>

                    {/* Campaign URL */}
                    {link.campaignUrl && (
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <p className="text-[11px] text-[var(--text-muted)] mb-1 uppercase tracking-wide">Campaign URL</p>
                          <code className="text-[12px] bg-[var(--bg-page)] px-2.5 py-1 rounded-md block truncate font-mono">
                            {link.campaignUrl}
                          </code>
                        </div>
                        <Button
                          variant="outline"
                          size="icon"
                          className="shrink-0"
                          onClick={() => handleCopyUrl(link.campaignUrl!, `campaign-${link._id}`)}
                        >
                          {copiedUrl === `campaign-${link._id}` ? (
                            <Check className="h-4 w-4 text-[var(--success)]" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    )}

                    {/* Vanity URL */}
                    {link.vanityUrl ? (
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <p className="text-[11px] text-[var(--text-muted)] mb-1 uppercase tracking-wide">Vanity URL</p>
                          <code className="text-[12px] bg-[var(--bg-page)] px-2.5 py-1 rounded-md block truncate font-mono">
                            {link.vanityUrl}
                          </code>
                        </div>
                        <Button
                          variant="outline"
                          size="icon"
                          className="shrink-0 mr-2"
                          onClick={() => handleCopyUrl(link.vanityUrl!, `vanity-${link._id}`)}
                        >
                          {copiedUrl === `vanity-${link._id}` ? (
                            <Check className="h-4 w-4 text-[var(--success)]" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                        {canManage && (
                          <Button
                            variant="outline"
                            size="icon"
                            className="shrink-0 text-[var(--danger)] hover:text-[var(--danger)]"
                            onClick={handleDeleteVanitySlug}
                            disabled={isDeletingVanity}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="pt-2">
                        <p className="text-[11px] text-[var(--text-muted)]">No vanity URL set</p>
                      </div>
                    )}

                    {/* Stats */}
                    {link.clickCount !== undefined && (
                      <div className="pt-2 flex gap-4 text-[12px]">
                        <div>
                          <span className="font-semibold text-[var(--text-heading)]">{link.clickCount}</span>
                          <span className="text-[var(--text-muted)]"> clicks</span>
                        </div>
                        <div>
                          <span className="font-semibold text-[var(--text-heading)]">{link.conversionCount}</span>
                          <span className="text-[var(--text-muted)]"> conversions</span>
                        </div>
                        <div>
                          <span className="font-semibold text-[var(--text-heading)]">{link.conversionRate}%</span>
                          <span className="text-[var(--text-muted)]"> conversion rate</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
