import { Metadata } from "next";
import InvitationSignupForm from "@/components/auth/InvitationSignupForm";

export const metadata: Metadata = {
  title: "Accept Invitation | Affilio",
  description: "Accept your team invitation and create your account",
};

interface InvitationAcceptPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function InvitationAcceptPage({ searchParams }: InvitationAcceptPageProps) {
  const params = await searchParams;
  const token = params.token;

  return (
    <InvitationSignupForm token={token} />
  );
}
