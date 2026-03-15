import { Metadata } from "next";
import { AffiliatesClient } from "./client";

export const metadata: Metadata = {
  title: "Affiliates | Salig Affiliates",
  description: "Manage your affiliate partners",
};

export default function AffiliatesPage() {
  return <AffiliatesClient />;
}
