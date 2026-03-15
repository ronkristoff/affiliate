import { CampaignList } from "@/components/dashboard/CampaignList";

export default function CampaignsPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Campaigns</h1>
        <p className="text-muted-foreground mt-1">
          Manage your affiliate campaigns and track performance
        </p>
      </div>

      <CampaignList />
    </div>
  );
}
