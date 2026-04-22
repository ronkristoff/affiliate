"use client";

import { useEffect } from "react";
import { getErrorMessage, reportClientError } from "@/lib/utils";

const REPORTED_ERRORS = new Set<string>();

export function GlobalErrorReporter() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      const key = `${event.message}:${event.filename}:${event.lineno}`;
      if (REPORTED_ERRORS.has(key)) return;
      REPORTED_ERRORS.add(key);
      setTimeout(() => REPORTED_ERRORS.delete(key), 5_000);

      reportClientError({
        severity: "error",
        source: "window.onerror",
        message: getErrorMessage(event.error, event.message || "Unhandled error"),
        stackTrace: event.error?.stack,
        metadata: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason;
      const key = `rejection:${error instanceof Error ? error.message : String(error).slice(0, 100)}`;
      if (REPORTED_ERRORS.has(key)) return;
      REPORTED_ERRORS.add(key);
      setTimeout(() => REPORTED_ERRORS.delete(key), 5_000);

      const message =
        error instanceof Error
          ? getErrorMessage(error, "Unhandled promise rejection")
          : typeof error === "string"
            ? error
            : "Unhandled promise rejection";
      const stack =
        error instanceof Error ? error.stack : undefined;

      reportClientError({
        severity: "error",
        source: "unhandledrejection",
        message,
        stackTrace: stack,
      });
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  return <></>;
}
