"use client";

import { useState } from "react";
import { AffiliateSignInForm } from "./AffiliateSignInForm";
import { AffiliateSignUpForm } from "./AffiliateSignUpForm";
import { ReCaptchaWrapper } from "@/components/ui/ReCaptchaWrapper";
import { FilterTabs, type FilterTabItem } from "@/components/ui/FilterTabs";

interface AuthTabsProps {
  tenantSlug: string;
  primaryColor: string;
}

export function AuthTabs({ tenantSlug, primaryColor }: AuthTabsProps) {
  const [activeTab, setActiveTab] = useState<"signin" | "register">("signin");

  const tabs: FilterTabItem[] = [
    { key: "signin", label: "Sign In", activeColor: `bg-[${primaryColor}]` },
    { key: "register", label: "Join Program", activeColor: `bg-[${primaryColor}]` },
  ];

  return (
    <div className="w-full">
      {/* Tabs */}
      <FilterTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(key) => setActiveTab(key as "signin" | "register")}
        size="lg"
      />

      {/* Form Area */}
      <div className="p-6">
        {activeTab === "signin" ? (
          <AffiliateSignInForm 
            tenantSlug={tenantSlug} 
            redirectUrl="/portal/home"
          />
        ) : (
          <ReCaptchaWrapper>
            <AffiliateSignUpForm
              tenantSlug={tenantSlug}
              redirectUrl="/portal/login"
            />
          </ReCaptchaWrapper>
        )}
      </div>
    </div>
  );
}
