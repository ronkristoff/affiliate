"use client";

import { useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

export function usePlatformStats() {
  const kpis = useQuery(api.admin.platformStats.getAggregatePlatformKPIs, {});
  const refresh = useMutation(api.admin.platformStats.refreshPlatformStats);
  const hasRefreshed = useRef(false);

  useEffect(() => {
    if (kpis && kpis.isStale && !hasRefreshed.current) {
      hasRefreshed.current = true;
      refresh().catch(() => {
        hasRefreshed.current = false;
      });
    }
  }, [kpis, refresh]);

  return kpis;
}
