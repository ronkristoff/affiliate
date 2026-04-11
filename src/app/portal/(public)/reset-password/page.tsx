"use client";

import { Suspense } from "react";
import { AffiliateResetPasswordForm } from "@/components/affiliate/AffiliateResetPasswordForm";

export default function PortalResetPasswordPage() {
  return (
    <Suspense>
      <AffiliateResetPasswordForm />
    </Suspense>
  );
}
