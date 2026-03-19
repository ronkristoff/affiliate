"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Users, Eye } from "lucide-react";
import {
  DataTable,
  AvatarCell,
  StatusBadgeCell,
  type TableColumn,
} from "@/components/ui/DataTable";

interface AffiliateData {
  _id: Id<"affiliates">;
  _creationTime: number;
  email: string;
  name: string;
  uniqueCode: string;
  status: string;
}

export function AffiliatesClient() {
  const affiliates = useQuery(api.affiliates.getAffiliatesByTenant);

  const columns: TableColumn<AffiliateData>[] = [
    {
      key: "name",
      header: "Name",
      cell: (row) => <AvatarCell name={row.name} email={row.email} />,
    },
    {
      key: "referralCode",
      header: "Referral Code",
      cell: (row) => (
        <code className="bg-[#f3f4f6] px-2 py-1 rounded text-[12px] font-mono">
          {row.uniqueCode}
        </code>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => <StatusBadgeCell status={row.status} />,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Users className="h-6 w-6" />
            Affiliates
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your affiliate partners and their commission rates
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Affiliates</CardTitle>
          <CardDescription>
            View and manage all affiliates in your program
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!affiliates ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={affiliates}
              getRowId={(row) => row._id}
              emptyMessage="No affiliates yet. Affiliates will appear here once they register."
              onRowClick={(row) => {
                // Navigate to affiliate detail page
                window.location.href = `/dashboard/affiliates/${row._id}`;
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
