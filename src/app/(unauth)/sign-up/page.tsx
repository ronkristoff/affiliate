"use client";

import { Suspense } from "react";
import SignUp from "@/app/(unauth)/sign-up/SignUp";

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUp />
    </Suspense>
  );
}
