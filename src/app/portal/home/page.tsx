"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Id } from "../../../../convex/_generated/dataModel";

interface AffiliateSession {
  affiliateId: string;
  tenantId: string;
  email: string;
  name: string;
  uniqueCode: string;
  status: string;
}

export default function PortalHomePage() {
  const router = useRouter();
  const [session, setSession] = useState<AffiliateSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Get session from cookie via API on mount
  useEffect(() => {
    async function fetchSession() {
      try {
        const response = await fetch("/api/affiliate-auth/session", {
          method: "GET",
          credentials: "include", // Include cookies
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.session) {
            setSession(data.session);
          }
        }
      } catch (error) {
        console.error("Failed to fetch session:", error);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchSession();
  }, []);

  // Fetch affiliate data
  const affiliateData = useQuery(
    api.affiliateAuth.getCurrentAffiliate,
    session ? { affiliateId: session.affiliateId as Id<"affiliates"> } : "skip"
  );

  // Check if affiliate is authenticated
  useEffect(() => {
    if (!isLoading && !session) {
      router.push("/portal/login");
    }
  }, [isLoading, session, router]);

  // Handle logout - call API to clear httpOnly cookie
  const handleLogout = async () => {
    try {
      await fetch("/api/affiliate-auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "logout" }),
        credentials: "include", // Include cookies
      });
    } catch (error) {
      console.error("Logout error:", error);
    }
    
    router.push("/portal/login");
    router.refresh();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-semibold">Affiliate Portal</h1>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-muted-foreground">
              {session.email}
            </span>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {session.status === "pending" ? (
          <Card>
            <CardHeader>
              <CardTitle>Account Pending Approval</CardTitle>
              <CardDescription>
                Your affiliate application is pending approval from the merchant.
                You will receive an email once your account is approved.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Status: <span className="font-medium text-yellow-600">Pending</span>
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Welcome Card */}
            <Card>
              <CardHeader>
                <CardTitle>Welcome back, {session.name}!</CardTitle>
                <CardDescription>
                  Your referral code: <code className="bg-gray-100 px-2 py-1 rounded">{session.uniqueCode}</code>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Share your referral link to start earning commissions.
                </p>
              </CardContent>
            </Card>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Clicks</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {affiliateData ? "0" : <Loader2 className="h-4 w-4 animate-spin" />}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Conversions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {affiliateData ? "0" : <Loader2 className="h-4 w-4 animate-spin" />}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Commissions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {affiliateData ? "₱0.00" : <Loader2 className="h-4 w-4 animate-spin" />}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  <Button variant="outline">
                    Copy Referral Link
                  </Button>
                  <Button variant="outline">
                    View Statistics
                  </Button>
                  <Button variant="outline">
                    Payout Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}