"use client";

import { Component, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class QueryErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    this.props.onError?.(error);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="bg-white border border-[#e5e7eb] rounded-xl p-5 flex items-center justify-between">
            <span className="text-[13px] text-[#ef4444]">
              Failed to load data
            </span>
            <Button
              variant="link"
              size="sm"
              onClick={this.handleRetry}
              className="text-[12px] font-semibold text-[#10409a]"
            >
              Retry
            </Button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
