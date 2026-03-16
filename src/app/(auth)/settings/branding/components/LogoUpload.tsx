"use client";

import { useState, useCallback, useRef } from "react";
import { X, Image as ImageIcon, Upload, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";

interface LogoUploadProps {
  value: string;
  onChange: (value: string) => void;
  primaryColor: string;
}

// Allowed file types and max size (2MB)
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.svg', '.webp'];
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB in bytes

export function LogoUpload({ value, onChange, primaryColor }: LogoUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const uploadLogo = useAction(api.branding.uploadTenantLogo);
  
  const validateFile = (file: File): string | null => {
    // Check file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return "Invalid file type. Supported: PNG, JPG, SVG, WebP";
    }
    
    // Check file extension (additional validation)
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return "Invalid file extension. Use: .png, .jpg, .jpeg, .svg, .webp";
    }
    
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return `File too large. Maximum size: 2MB (your file: ${(file.size / 1024 / 1024).toFixed(2)}MB)`;
    }
    
    return null;
  };
  
  const handleFileUpload = async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      toast.error(validationError);
      return;
    }
    
    setIsUploading(true);
    setUploadProgress(0);
    setError(null);
    
    try {
      // Simulate progress (Convex doesn't give real-time upload progress)
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 100);
      
      // Upload to Convex storage
      const result = await uploadLogo({ fileName: file.name, contentType: file.type });
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      if (result.success && result.logoUrl) {
        onChange(result.logoUrl);
        toast.success("Logo uploaded successfully");
      } else {
        throw new Error("Upload failed");
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to upload logo";
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  }, []);
  
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);
  
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);
  
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  };
  
  const handleClear = () => {
    onChange("");
    setError(null);
  };
  
  const handleImageError = () => {
    setError("Failed to load logo image. The URL may be invalid or the image may no longer exist.");
    onChange("");
    toast.error("Logo image failed to load");
  };

  return (
    <div className="space-y-4">
      {/* Current Logo Preview */}
      {value && !isUploading && (
        <div className="relative inline-block">
          <div 
            className="w-24 h-24 rounded-lg border-2 flex items-center justify-center overflow-hidden bg-white"
            style={{ borderColor: primaryColor }}
          >
            <img 
              src={value} 
              alt="Current logo" 
              className="max-w-full max-h-full object-contain"
              onError={handleImageError}
            />
          </div>
          <button
            onClick={handleClear}
            className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 hover:bg-destructive/90 transition-colors focus:outline-none focus:ring-2 focus:ring-destructive focus:ring-offset-2"
            aria-label="Remove logo"
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      
      {/* Upload Area */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          relative border-2 border-dashed rounded-lg p-6 transition-all cursor-pointer
          ${isDragging 
            ? 'border-primary bg-primary/5' 
            : 'border-muted-foreground/25 hover:border-muted-foreground/50'
          }
          ${isUploading ? 'pointer-events-none opacity-50' : ''}
        `}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            fileInputRef.current?.click();
          }
        }}
        aria-label="Upload logo file"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".png,.jpg,.jpeg,.svg,.webp"
          onChange={handleFileInput}
          className="hidden"
          aria-label="Select logo file"
        />
        
        {isUploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Uploading... {uploadProgress}%</p>
            <div className="w-full max-w-xs h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Click or drag logo here</p>
            <p className="text-xs text-muted-foreground">
              PNG, JPG, SVG, WebP up to 2MB
            </p>
          </div>
        )}
      </div>
      
      {/* Error Display */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-lg">
          <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
    </div>
  );
}
