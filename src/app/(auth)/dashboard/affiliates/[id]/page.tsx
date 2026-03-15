import { Metadata } from "next";
import { AffiliateDetailClient } from "./client";

interface AffiliateDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata({
  params,
}: AffiliateDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Affiliate Details | Salig Affiliates`,
    description: "View affiliate details and manage commission overrides",
  };
}

export default async function AffiliateDetailPage({
  params,
}: AffiliateDetailPageProps) {
  const { id } = await params;
  return <AffiliateDetailClient affiliateId={id} />;
}
