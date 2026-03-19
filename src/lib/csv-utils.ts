// =============================================================================
// CSV Generation Utilities
// Story 13.2: Payout Batch CSV Download
// =============================================================================

/**
 * Payout data structure for CSV generation.
 * Matches the shape returned by getBatchPayouts query (minus payoutId, affiliateId, status).
 */
export interface PayoutCsvRow {
  name: string;
  email: string;
  amount: number;
  payoutMethod?: { type: string; details: string } | null;
  commissionCount: number;
}

/**
 * CSV column headers for payout batches.
 */
const CSV_HEADERS = [
  "Affiliate Name",
  "Email",
  "Amount",
  "Payout Method",
  "Commission Count",
  "Notes",
];

/**
 * Escape a CSV field value for proper CSV formatting.
 * Wraps in quotes if the field contains commas, quotes, or newlines.
 * Doubles any internal quotes per RFC 4180.
 */
export function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Generate a payout batch CSV string with UTF-8 BOM prefix.
 *
 * AC#3: CSV Format Accuracy
 * - Columns: Affiliate Name, Email, Amount, Payout Method, Commission Count, Notes
 * - Amounts formatted as plain numbers (2 decimal places, no currency symbol)
 * - First row is a header row
 * - UTF-8 encoding with BOM for Excel compatibility
 *
 * AC#5: Payout Method Display
 * - Shows type + masked details when configured
 * - Shows "Not configured" when missing
 *
 * AC#4: Empty Batch Handling
 * - Returns header-only CSV when payouts array is empty
 */
export function generatePayoutCsv(payouts: Array<PayoutCsvRow>): string {
  const rows = payouts.map((p) => [
    escapeCsvField(p.name),
    escapeCsvField(p.email),
    p.amount.toFixed(2),
    escapeCsvField(
      p.payoutMethod
        ? `${p.payoutMethod.type} - ${p.payoutMethod.details}`
        : "Not configured"
    ),
    String(p.commissionCount),
    "", // Notes column (empty — future use for payment references)
  ]);

  // UTF-8 BOM prefix (\uFEFF) for Excel compatibility
  const headerLine = CSV_HEADERS.join(",");
  const dataLines = rows.map((row) => row.join(",")).join("\n");

  return "\uFEFF" + headerLine + "\n" + dataLines;
}

/**
 * Trigger a browser CSV file download from a string.
 * Creates a Blob URL, clicks a temporary link, then cleans up.
 *
 * @param csvContent - Full CSV string content (including BOM if needed)
 * @param filename - Desired filename without extension (e.g., "payout-batch-2026-03-18")
 */
export function downloadCsvFromString(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
