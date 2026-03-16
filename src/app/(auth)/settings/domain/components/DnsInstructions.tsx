"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { useState } from "react";

interface DnsInstructionsProps {
  domain: string;
  targetDomain: string;
}

export function DnsInstructions({ domain, targetDomain }: DnsInstructionsProps) {
  const [copied, setCopied] = useState<string | null>(null);
  
  const copyToClipboard = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>DNS Configuration</CardTitle>
        <CardDescription>
          Configure your DNS records to point your domain to our platform
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-muted p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">CNAME Record</p>
              <p className="text-xs text-muted-foreground">Create a CNAME record in your DNS provider</p>
            </div>
            {/* Copy buttons are provided for each individual field below */}
          </div>
          
          <div className="grid gap-3 text-sm">
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-muted-foreground">Type</span>
              <code className="bg-background px-2 py-1 rounded">CNAME</code>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-muted-foreground">Name</span>
              <code className="bg-background px-2 py-1 rounded">{domain}</code>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-muted-foreground">Value</span>
              <code className="bg-background px-2 py-1 rounded">{targetDomain}</code>
            </div>
          </div>
        </div>
        
        <div className="text-sm text-muted-foreground space-y-2">
          <p><strong>Instructions:</strong></p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Log in to your DNS provider (e.g., Cloudflare, GoDaddy, Namecheap)</li>
            <li>Create a new CNAME record</li>
            <li>Set the name to <code className="bg-muted px-1">{domain}</code></li>
            <li>Set the value to <code className="bg-muted px-1">{targetDomain}</code></li>
            <li>Save the record and wait for propagation (may take up to 24 hours)</li>
          </ol>
        </div>
        
        <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
          <span>Note:</span>
          <span>SSL certificate will be provisioned automatically after DNS verification.</span>
        </div>
      </CardContent>
    </Card>
  );
}
