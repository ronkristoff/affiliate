"use client";

import { useEffect } from "react";
import { getErrorMessage, reportClientError } from "@/lib/utils";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError({
      severity: "error",
      source: "error-boundary",
      message: getErrorMessage(error, "Route error"),
      stackTrace: error.stack,
      metadata: { digest: error.digest },
    });
  }, [error]);

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center max-w-md">
        <h2 className="text-lg font-semibold text-red-800">Something went wrong</h2>
        <p className="text-sm text-red-600 mt-2">
          An unexpected error occurred. Please try again.
        </p>
        <button
          onClick={reset}
          className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
