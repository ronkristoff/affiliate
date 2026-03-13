import { Suspense } from "react";
import { AffiliateSignUpForm } from "@/components/affiliate/AffiliateSignUpForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface PortalRegisterPageContentProps {
  searchParams: Promise<{ tenant?: string }>;
}

async function PortalRegisterPageContent({ searchParams }: PortalRegisterPageContentProps) {
  const params = await searchParams;
  const tenantSlug = params.tenant || "default";
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            Become an Affiliate
          </CardTitle>
          <CardDescription className="text-center">
            Create your affiliate account to start earning commissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AffiliateSignUpForm 
            tenantSlug={tenantSlug} 
            redirectUrl="/portal/login"
          />
          <div className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <a href={`/portal/login${tenantSlug !== 'default' ? `?tenant=${tenantSlug}` : ''}`} className="text-primary hover:underline">
              Sign in
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PortalRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    }>
      <PortalRegisterPageContent searchParams={searchParams} />
    </Suspense>
  );
}