import { Metadata } from "next";
import { AffiliateDetailClient } from "./client";

export function generateMetadata(): Metadata {
  return {
    title: `Affiliate Details | Salig Affiliates`,
    description: "View affiliate details and manage commission overrides",
  };
}

interface AffiliateDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function AffiliateDetailPage({
  params,
}: AffiliateDetailPageProps) {
  const { id } = await params;
  return <AffiliateDetailClient affiliateId={id} />;
}
