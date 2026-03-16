"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PortalNameInputProps {
  value: string;
  onChange: (value: string) => void;
  defaultName?: string;
}

const MAX_LENGTH = 50;

export function PortalNameInput({ value, onChange, defaultName }: PortalNameInputProps) {
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    if (value && value.length > MAX_LENGTH) {
      setError(`Portal name must be ${MAX_LENGTH} characters or less`);
    } else {
      setError(null);
    }
  }, [value]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };
  
  const handleResetToDefault = () => {
    onChange(defaultName || "");
  };
  
  const characterCount = value.length;
  const isOverLimit = characterCount > MAX_LENGTH;
  const isNearLimit = characterCount >= MAX_LENGTH - 10;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor="portal-name">Portal Name</Label>
        {defaultName && value !== defaultName && (
          <button
            onClick={handleResetToDefault}
            className="text-xs text-primary hover:underline"
          >
            Reset to default
          </button>
        )}
      </div>
      <Input
        id="portal-name"
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={defaultName || "My Affiliate Portal"}
        maxLength={MAX_LENGTH + 5} // Allow slightly over to show error state
        className={isOverLimit ? "border-destructive" : ""}
      />
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          This name appears in the portal header
        </p>
        <span className={`text-xs ${isNearLimit || isOverLimit ? "text-destructive" : "text-muted-foreground"}`}>
          {characterCount}/{MAX_LENGTH}
        </span>
      </div>
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
