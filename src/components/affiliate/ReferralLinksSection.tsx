"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <LinkIcon className="h-5 w-5" />
          Referral Links
        </CardTitle>
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
      </CardHeader>
      <CardContent>
        {referralLinks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <LinkIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">No referral links yet</p>
            <p className="text-sm mb-4">Generate a referral link to start tracking clicks and conversions.</p>
            {canManage && (
              <Button onClick={() => setIsGenerateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Generate Link
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {referralLinks.map((link: ReferralLink) => (
              <div key={link._id} className="border rounded-lg p-4">
                <div 
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedLinkId(expandedLinkId === link._id ? null : link._id)}
                >
                  <div>
                    <p className="font-mono text-sm">{link.code}</p>
                    {link.campaignName && (
                      <p className="text-xs text-muted-foreground">Campaign: {link.campaignName}</p>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Created {formatDate(link._creationTime)}
                  </div>
                </div>

                {expandedLinkId === link._id && (
                  <div className="mt-4 space-y-3 pt-4 border-t">
                    {/* Short URL */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-1">Short URL</p>
                        <code className="text-sm bg-muted px-2 py-1 rounded block truncate">
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
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>

                    {/* Full URL */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-1">Full URL</p>
                        <code className="text-sm bg-muted px-2 py-1 rounded block truncate">
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
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>

                    {/* Campaign URL */}
                    {link.campaignUrl && (
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground mb-1">Campaign URL</p>
                          <code className="text-sm bg-muted px-2 py-1 rounded block truncate">
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
                            <Check className="h-4 w-4 text-green-500" />
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
                          <p className="text-xs text-muted-foreground mb-1">Vanity URL</p>
                          <code className="text-sm bg-muted px-2 py-1 rounded block truncate">
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
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                        {canManage && (
                          <Button
                            variant="outline"
                            size="icon"
                            className="shrink-0 text-destructive hover:text-destructive"
                            onClick={handleDeleteVanitySlug}
                            disabled={isDeletingVanity}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="pt-2">
                        <p className="text-xs text-muted-foreground">No vanity URL set</p>
                      </div>
                    )}

                    {/* Stats */}
                    {link.clickCount !== undefined && (
                      <div className="pt-2 flex gap-4 text-sm">
                        <div>
                          <span className="font-medium">{link.clickCount}</span>
                          <span className="text-muted-foreground"> clicks</span>
                        </div>
                        <div>
                          <span className="font-medium">{link.conversionCount}</span>
                          <span className="text-muted-foreground"> conversions</span>
                        </div>
                        <div>
                          <span className="font-medium">{link.conversionRate}%</span>
                          <span className="text-muted-foreground"> conversion rate</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
