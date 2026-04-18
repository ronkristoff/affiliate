---
title: 'Rename Tenant Filter Labels for Domain Clarity'
type: 'refactor'
created: '2026-04-18'
status: 'done'
route: 'one-shot'
---

## Intent

**Problem:** "Flagged" and "Needs Attention" filter labels on the tenants admin list don't communicate *what kind* of attention is needed. Both imply urgency but for different domains (security vs billing).

**Approach:** Rename to domain-specific labels: "Flagged" → "Security Alerts" and "Needs Attention" → "Billing Issues" across the tenants admin UI components.

## Suggested Review Order

1. [FilterPills.tsx](../../src/app/(admin)/tenants/_components/FilterPills.tsx) — Filter tab labels ("Security Alerts", "Billing Issues")
2. [StatusBadge.tsx](../../src/app/(admin)/tenants/_components/StatusBadge.tsx) — Badge label ("Security Alert" singular — appropriate for per-row display)
3. [StatsRow.tsx](../../src/app/(admin)/tenants/_components/StatsRow.tsx) — Metric card label ("Security Alerts")
4. [TenantTable.tsx](../../src/app/(admin)/tenants/_components/TenantTable.tsx) — Billing alert tooltip ("Billing issue")
