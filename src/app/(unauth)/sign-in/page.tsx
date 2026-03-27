"use client";

import { Suspense } from "react";
import SignIn from "@/app/(unauth)/sign-in/SignIn";

export default function SignInPage() {
  return (
    <Suspense>
      <SignIn />
    </Suspense>
  );
}
