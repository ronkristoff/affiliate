"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { getErrorMessage, getSanitizedErrorMessage, reportClientError } from "@/lib/utils";
import { AlertTriangle, Bug, Terminal, Zap } from "lucide-react";

/**
 * Error Simulation Test Page
 *
 * Use this page to verify:
 * 1. Exceptions are correctly logged (console + /api/client-error endpoint)
 * 2. Stack traces do NOT leak into toast notifications
 */
export default function ErrorSimulationPage() {
  const [lastErrorPayload, setLastErrorPayload] = useState<Record<string, unknown> | null>(null);

  // ─── Scenario 1: Synchronous error in click handler ───
  const throwSyncError = () => {
    const err = new Error("Simulated synchronous error from click handler");
    // Attach some fake metadata to make it look realistic
    (err as any).code = "SIMULATION_001";

    toast.error(getSanitizedErrorMessage(err, "Something went wrong"));
    reportClientError({
      source: "ErrorSimulationPage",
      message: getErrorMessage(err, "Something went wrong"),
      stackTrace: err.stack,
      metadata: { scenario: "sync_click", code: "SIMULATION_001" },
    });

    // Also capture what we sent so user can inspect
    setLastErrorPayload({
      source: "ErrorSimulationPage",
      message: getSanitizedErrorMessage(err, "Something went wrong"),
      stackTrace: err.stack,
      metadata: { scenario: "sync_click", code: "SIMULATION_001" },
    });
  };

  // ─── Scenario 2: Unhandled promise rejection ───
  const triggerUnhandledRejection = () => {
    Promise.reject(new Error("Simulated unhandled promise rejection"));
  };

  // ─── Scenario 3: Error inside useEffect (component-level) ───
  const [shouldThrowInEffect, setShouldThrowInEffect] = useState(false);
  if (shouldThrowInEffect) {
    // Intentionally throwing during render to test error boundary behavior
    // In production this would be caught by nearest error boundary
    throw new Error("Simulated render-time error (test error boundary)");
  }

  // ─── Scenario 4: Error thrown inside async handler with toast ───
  const throwAsyncError = async () => {
    try {
      await new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Simulated async operation failure")), 100)
      );
    } catch (error) {
      const cleanMessage = getSanitizedErrorMessage(error, "Async operation failed");
      const rawMessage = getErrorMessage(error, "Async operation failed");
      toast.error(cleanMessage);
      reportClientError({
        source: "ErrorSimulationPage",
        message: rawMessage,
        stackTrace: error instanceof Error ? error.stack : undefined,
        metadata: { scenario: "async_handler" },
      });
      setLastErrorPayload({
        source: "ErrorSimulationPage",
        message: rawMessage,
        stackTrace: error instanceof Error ? error.stack : undefined,
        metadata: { scenario: "async_handler" },
      });
    }
  };

  // ─── Scenario 5: Convex-style internal error (should be sanitized) ───
  const throwConvexStyleError = () => {
    const err = new Error("ReturnsValidationError: Extra field 'pageStatus' in return value");
    const rawMessage = getErrorMessage(err, "Operation failed");
    const cleanMessage = getSanitizedErrorMessage(err, "Operation failed");
    toast.error(cleanMessage);
    reportClientError({
      source: "ErrorSimulationPage",
      message: rawMessage,
      stackTrace: err.stack,
      metadata: { scenario: "convex_internal_error" },
    });
    setLastErrorPayload({
      source: "ErrorSimulationPage",
      message: rawMessage,
      stackTrace: err.stack,
      metadata: { scenario: "convex_internal_error" },
    });
  };

  return (
    <div className="space-y-6 p-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Error Simulation</h1>
        <p className="text-muted-foreground mt-2">
          Trigger controlled exceptions to verify logging and toast behavior.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Sync error */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bug className="h-5 w-5 text-destructive" />
              Sync Click Error
            </CardTitle>
            <CardDescription>
              Throws in an event handler. Should log to console + API, toast should show clean message.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={throwSyncError}>
              Throw Sync Error
            </Button>
          </CardContent>
        </Card>

        {/* Async error */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="h-5 w-5 text-amber-500" />
              Async Handler Error
            </CardTitle>
            <CardDescription>
              Simulates a failed mutation or API call with try/catch + toast.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="secondary" onClick={throwAsyncError}>
              Throw Async Error
            </Button>
          </CardContent>
        </Card>

        {/* Unhandled rejection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Unhandled Rejection
            </CardTitle>
            <CardDescription>
              Triggers a promise rejection without catch. GlobalErrorReporter should pick it up.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={triggerUnhandledRejection}>
              Trigger Rejection
            </Button>
          </CardContent>
        </Card>

        {/* Convex-style internal error */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Terminal className="h-5 w-5 text-primary" />
              Convex Internal Error
            </CardTitle>
            <CardDescription>
              Tests sanitization: toast should show fallback, not internal stack dump.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={throwConvexStyleError}>
              Throw Sanitized Error
            </Button>
          </CardContent>
        </Card>

        {/* Render error */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Render / Error Boundary Error
            </CardTitle>
            <CardDescription>
              Throws during component render. Will crash the page unless caught by an error boundary.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              onClick={() => setShouldThrowInEffect(true)}
            >
              Trigger Render Error
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Inspector panel */}
      {lastErrorPayload && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Last Reported Payload</CardTitle>
            <CardDescription>
              This is what was sent to <code>/api/client-error</code>. The stack trace should be present here but NOT in the toast above.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-lg text-xs overflow-auto max-h-96">
              {JSON.stringify(lastErrorPayload, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
