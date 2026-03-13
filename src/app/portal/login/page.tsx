import { Suspense } from "react";
import { AffiliateSignInForm } from "@/components/affiliate/AffiliateSignInForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface PortalLoginPageContentProps {
  searchParams: Promise<{ tenant?: string }>;
}

async function PortalLoginPageContent({ searchParams }: PortalLoginPageContentProps) {
  const params = await searchParams;
  const tenantSlug = params.tenant || "default";
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            Affiliate Portal
          </CardTitle>
          <CardDescription className="text-center">
            Sign in to your affiliate account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AffiliateSignInForm 
            tenantSlug={tenantSlug} 
            redirectUrl="/portal/home"
          />
          <div className="mt-4 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <a href={`/portal/register${tenantSlug !== 'default' ? `?tenant=${tenantSlug}` : ''}`} className="text-primary hover:underline">
              Register
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PortalLoginPage({
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
      <PortalLoginPageContent searchParams={searchParams} />
    </Suspense>
  );
}