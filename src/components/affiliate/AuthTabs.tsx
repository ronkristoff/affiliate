"use client";

import { useState } from "react";
import { AffiliateSignInForm } from "./AffiliateSignInForm";
import { AffiliateSignUpForm } from "./AffiliateSignUpForm";
import { ReCaptchaWrapper } from "@/components/ui/ReCaptchaWrapper";

interface AuthTabsProps {
  tenantSlug: string;
  primaryColor: string;
}

export function AuthTabs({ tenantSlug, primaryColor }: AuthTabsProps) {
  const [activeTab, setActiveTab] = useState<"signin" | "register">("signin");

  return (
    <div className="w-full">
      {/* Tabs */}
      <div className="grid grid-cols-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("signin")}
          className={`py-3.5 text-sm font-semibold text-center transition-colors ${
            activeTab === "signin"
              ? `text-[${primaryColor}] border-b-2 border-[${primaryColor}]`
              : "text-gray-500 hover:text-gray-700"
          }`}
          style={activeTab === "signin" ? { borderBottomColor: primaryColor, color: primaryColor } : {}}
        >
          Sign In
        </button>
        <button
          onClick={() => setActiveTab("register")}
          className={`py-3.5 text-sm font-semibold text-center transition-colors ${
            activeTab === "register"
              ? `text-[${primaryColor}] border-b-2 border-[${primaryColor}]`
              : "text-gray-500 hover:text-gray-700"
          }`}
          style={activeTab === "register" ? { borderBottomColor: primaryColor, color: primaryColor } : {}}
        >
          Join Program
        </button>
      </div>

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