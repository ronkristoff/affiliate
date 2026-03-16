"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";

interface DomainInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function DomainInput({ value, onChange, disabled }: DomainInputProps) {
  const [error, setError] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(false);
  
  // Domain validation regex - matches backend validation
  // Rejects: double dots (..), leading/trailing hyphens, IP addresses
  const domainRegex = /^(?!.*\.\.)(?!.*-$)(?!^-)[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
  
  useEffect(() => {
    if (!value) {
      setError(null);
      setIsValid(false);
      return;
    }
    
    // Strip protocol if provided
    const cleanDomain = value
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .trim();
    
    if (cleanDomain !== value) {
      onChange(cleanDomain);
      return;
    }
    
    if (!domainRegex.test(cleanDomain)) {
      setError("Please enter a valid domain (e.g., affiliates.mycompany.com)");
      setIsValid(false);
    } else {
      setError(null);
      setIsValid(true);
    }
  }, [value, onChange]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };
  
  return (
    <div className="space-y-2">
      <Label htmlFor="domain">Custom Domain</Label>
      <div className="relative">
        <Input
          id="domain"
          type="text"
          placeholder="affiliates.mycompany.com"
          value={value}
          onChange={handleChange}
          disabled={disabled}
          className={error ? "border-destructive pr-10" : isValid ? "border-green-500 pr-10" : "pr-10"}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {error ? (
            <AlertCircle className="h-4 w-4 text-destructive" />
          ) : isValid && value ? (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          ) : null}
        </div>
      </div>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      <p className="text-sm text-muted-foreground">
        Enter your custom domain without http:// or https://
      </p>
    </div>
  );
}
