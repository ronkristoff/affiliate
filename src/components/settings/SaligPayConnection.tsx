"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CreditCard, Check, AlertCircle, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface SaligPayConnectionProps {
  /** The tenant ID for the SaligPay connection */
  tenantId: string;
  /** Whether to show in compact mode (for settings page) */
  compact?: boolean;
}

/**
 * SaligPay Connection Status Component
 * 
 * Displays the current SaligPay connection status and provides
 * connect/disconnect functionality.
 */
export function SaligPayConnection({ tenantId, compact = false }: SaligPayConnectionProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);

  // Cast tenantId to Convex ID type
  const tenantIdAsConvexId = tenantId as Id<"tenants">;

  // Query connection status from Convex
  const connectionStatus = useQuery(
    api.tenants.getSaligPayConnectionStatus,
    { tenantId: tenantIdAsConvexId }
  );

  // Mutations
  const connectMockSaligPay = useMutation(api.tenants.connectMockSaligPay);
  const disconnectSaligPay = useMutation(api.tenants.disconnectSaligPay);

  const isConnected = connectionStatus?.isConnected ?? false;

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      setConnectionError(null);
      
      await connectMockSaligPay({ tenantId: tenantIdAsConvexId });
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : "Failed to connect");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setIsDisconnecting(true);
      
      await disconnectSaligPay({ tenantId: tenantIdAsConvexId });
      setShowDisconnectDialog(false);
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : "Failed to disconnect");
    } finally {
      setIsDisconnecting(false);
    }
  };

  // Connected state
  if (isConnected) {
    if (compact) {
      return (
        <div className="flex items-center justify-between p-4 border rounded-lg bg-green-50 dark:bg-green-950">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
              <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="font-medium text-green-900 dark:text-green-100">
                Connected (Mock Mode)
              </p>
              <p className="text-sm text-green-700 dark:text-green-300">
                Ready for testing
              </p>
            </div>
          </div>
          
          <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50">
                <Trash2 className="w-4 h-4 mr-1" />
                Disconnect
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Disconnect SaligPay?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove your SaligPay connection. You can reconnect at any time.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDisconnect}
                  disabled={isDisconnecting}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {isDisconnecting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Disconnecting...
                    </>
                  ) : (
                    "Disconnect"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      );
    }

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <CardTitle className="text-lg">SaligPay Connected</CardTitle>
                <CardDescription>Mock Mode - Ready for testing</CardDescription>
              </div>
            </div>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
              Active
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted rounded-lg p-4">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Mode:</dt>
                <dd className="font-medium">Mock (Development)</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Status:</dt>
                <dd className="font-medium text-green-600">Connected</dd>
              </div>
            </dl>
          </div>
          
          <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full">
                <Trash2 className="w-4 h-4 mr-2" />
                Disconnect SaligPay
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Disconnect SaligPay?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove your SaligPay connection. You can reconnect at any time to continue testing.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDisconnect}
                  disabled={isDisconnecting}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {isDisconnecting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Disconnecting...
                    </>
                  ) : (
                    "Disconnect"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    );
  }

  // Not connected state
  if (compact) {
    return (
      <div className="p-4 border rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">SaligPay</p>
              <p className="text-sm text-muted-foreground">Not connected</p>
            </div>
          </div>
        </div>
        
        {connectionError && (
          <div className="flex items-center gap-2 text-sm text-red-600 mb-3">
            <AlertCircle className="w-4 h-4" />
            {connectionError}
          </div>
        )}
        
        <Button
          onClick={handleConnect}
          disabled={isConnecting}
          className="w-full"
        >
          {isConnecting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <CreditCard className="w-4 h-4 mr-2" />
              Connect SaligPay (Mock)
            </>
          )}
        </Button>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-muted flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <CardTitle className="text-lg">SaligPay Integration</CardTitle>
            <CardDescription>Connect your payment account to receive affiliate payouts</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {connectionError && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-950 p-3 rounded-lg">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {connectionError}
          </div>
        )}
        
        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
            Mock Mode Available
          </h4>
          <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
            Use the mock integration to test the affiliate program flow without real SaligPay credentials.
          </p>
          <Button
            onClick={handleConnect}
            disabled={isConnecting}
            className="bg-[#10409a] hover:bg-[#1659d6]"
          >
            {isConnecting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4 mr-2" />
                Connect with Mock
              </>
            )}
          </Button>
        </div>
        
        <p className="text-xs text-muted-foreground text-center">
          In production, you would connect with real SaligPay credentials (Story 14.1)
        </p>
      </CardContent>
    </Card>
  );
}

export default SaligPayConnection;
