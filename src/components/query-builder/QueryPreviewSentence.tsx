"use client";

import { useMemo } from "react";
import type { QueryConfig } from "@/hooks/useQueryBuilder";

interface QueryPreviewSentenceProps {
  config: QueryConfig;
}

/**
 * Natural-language preview of the current query configuration.
 * Built as an array of clauses joined with punctuation.
 * Pure display — clickable segment scrolling deferred to v2.
 */
export function QueryPreviewSentence({ config }: QueryPreviewSentenceProps) {
  const sentence = useMemo(() => {
    const clauses: string[] = [];

    // 1. Select clause — column aliases or names
    if (config.columns.length > 0) {
      const colNames = config.columns.map((c) => c.alias || c.column);
      if (colNames.length <= 3) {
        clauses.push(colNames.join(" and "));
      } else {
        clauses.push(`${colNames.slice(0, -1).join(", ")}, and ${colNames[colNames.length - 1]}`);
      }
    }

    // 2. From clause — table names
    if (config.tables.length > 0) {
      const tableNames = config.tables;
      if (tableNames.length === 1) {
        clauses.push(`from ${tableNames[0]}`);
      } else {
        clauses.push(`from ${tableNames.join(" and ")}`);
      }
    }

    // 3. Where clause — filters with operator and value
    if (config.filters.length > 0) {
      const filterParts = config.filters.map((f) => {
        const displayValue = f.value !== undefined && f.value !== "" ? String(f.value) : "?";
        const displayColumn = f.column;
        const displayOperator = f.operator.replace(/_/g, " ");
        return `${displayColumn} ${displayOperator} ${displayValue}`;
      });

      if (config.filters.length === 1) {
        clauses.push(`where ${filterParts[0]}`);
      } else {
        const connector = config.filterLogic === "or" ? " OR " : " AND ";
        clauses.push(`where ${filterParts.join(connector)}`);
      }
    }

    // 4. Group by clause
    if (config.groupBy.length > 0) {
      const groupCols = config.groupBy.map((g) => g.column).join(", ");
      clauses.push(`grouped by ${groupCols}`);
    }

    // 5. Aggregations clause
    if (config.aggregations.length > 0) {
      const aggParts = config.aggregations.map((a) => `${a.function}(${a.column})`);
      if (aggParts.length <= 2) {
        clauses.push(`calculating ${aggParts.join(" and ")}`);
      } else {
        clauses.push(`calculating ${aggParts.slice(0, -1).join(", ")}, and ${aggParts[aggParts.length - 1]}`);
      }
    }

    // Build final sentence
    if (clauses.length === 0) {
      return "Select a table to get started";
    }

    return `Show me ${clauses.join(", ")}`;
  }, [
    config.tables,
    config.columns,
    config.filters,
    config.joins,
    config.aggregations,
    config.groupBy,
    config.filterLogic,
  ]);

  const isEmpty = config.tables.length === 0;

  return (
    <div
      className={`rounded-xl px-4 py-2.5 text-[13px] leading-relaxed ${
        isEmpty
          ? "text-[var(--text-muted)] italic"
          : "text-[var(--text-heading)]"
      }`}
    >
      {isEmpty ? (
        <span>{sentence}</span>
      ) : (
        <span>
          Show me{" "}
          {/* Render clauses with bold emphasis on table/column names */}
          {config.columns.length > 0 && (
            <span className="font-medium">
              {config.columns.length <= 3
                ? config.columns.map((c) => c.alias || c.column).join(" and ")
                : `${config.columns.slice(0, -1).map((c) => c.alias || c.column).join(", ")}, and ${config.columns[config.columns.length - 1].alias || config.columns[config.columns.length - 1].column}`}
            </span>
          )}
          {config.tables.length > 0 && (
            <span>
              {" "}from{" "}
              <span className="font-medium">
                {config.tables.join(" and ")}
              </span>
            </span>
          )}
          {config.filters.length > 0 && (
            <span>
              , where{" "}
              {config.filters.map((f, i) => (
                <span key={f.id}>
                  {i > 0 && (
                    <span className="text-[#1fb5a5] font-semibold uppercase mx-1">
                      {config.filterLogic}
                    </span>
                  )}
                  <span className="font-medium">{f.column}</span>
                  {" "}
                  {f.operator.replace(/_/g, " ")}{" "}
                  <span className="font-medium">
                    {f.value !== undefined && f.value !== "" ? String(f.value) : "?"}
                  </span>
                </span>
              ))}
            </span>
          )}
          {config.groupBy.length > 0 && (
            <span>
              , grouped by{" "}
              <span className="font-medium">
                {config.groupBy.map((g) => g.column).join(", ")}
              </span>
            </span>
          )}
          {config.aggregations.length > 0 && (
            <span>
              , calculating{" "}
              {config.aggregations.map((a, i) => (
                <span key={a.id}>
                  {i > 0 && " and "}
                  <span className="font-medium">{a.function}({a.column})</span>
                </span>
              ))}
            </span>
          )}
        </span>
      )}
    </div>
  );
}
