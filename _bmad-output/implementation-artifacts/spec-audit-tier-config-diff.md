---
title: 'Audit Log Tier Config Rendering & Date Filters'
type: 'feature'
created: '2026-04-19'
status: 'done'
route: 'one-shot'
---

## Intent

**Problem:** Platform admin audit log page displayed tier config change events as raw truncated JSON (`{"adminEmail":"admin@...","before":{"price":500...`), making it impossible for admins to understand what changed. Additionally, there was no way to filter audit logs by date range.

**Approach:** Add a structured before/after diff renderer for tier config entries with field-level change highlighting, fix the entityType mismatch (`tierConfigs` vs `tier_config`), add proper action labels, and add native date range filter inputs with backend support.

## Suggested Review Order

1. [convex/admin/tier_configs.ts:348](convex/admin/tier_configs.ts:348) — entityType fix (3 places: updated, created, deleted)
2. [convex/admin/audit.ts:27](convex/admin/audit.ts:27) — startDate/endDate filter args added to query
3. [src/lib/audit-constants.ts:137](src/lib/audit-constants.ts:137) — TIER_CONFIG_ACTIONS constant + labels + severity
4. [src/app/(admin)/audit/page.tsx:155](src/app/(admin)/audit/page.tsx:155) — TierConfigDiffRenderer (before/after table)
5. [src/app/(admin)/audit/page.tsx:235](src/app/(admin)/audit/page.tsx:235) — StructuredMetadata (routes to diff renderer)
6. [src/app/(admin)/audit/page.tsx:295](src/app/(admin)/audit/page.tsx:295) — FilterBar with date inputs
7. [src/app/(admin)/audit/page.tsx:510](src/app/(admin)/audit/page.tsx:510) — Date state + query integration
