import { CheckoutAttributionGuide } from "@/components/onboarding/CheckoutAttributionGuide";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Settings } from "lucide-react";

export default function CheckoutAttributionPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Link href="/onboarding?step=4" className="hover:underline">
              Onboarding
            </Link>
            <span>/</span>
            <span>Checkout Attribution</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            Checkout Attribution Setup
          </h1>
          <p className="text-muted-foreground mt-2">
            Configure how referral data flows through your payment provider checkout sessions
          </p>
        </div>

        {/* Main Content */}
        <Card>
          <CardContent className="p-6">
            <CheckoutAttributionGuide />
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8">
          <Button variant="outline" asChild>
            <Link href="/onboarding?step=3">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Tracking Snippet
            </Link>
          </Button>
          
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild>
              <Link href="/settings/attribution">
                <Settings className="w-4 h-4 mr-2" />
                Attribution Settings
              </Link>
            </Button>
            <Button asChild className="bg-[#1c2260] hover:bg-[#1fb5a5]">
              <Link href="/onboarding?step=5">
                Continue Setup
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
