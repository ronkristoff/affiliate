"use client";

import { useState, Suspense } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PageTopbar } from "@/components/ui/PageTopbar";
import { FadeIn } from "@/components/ui/FadeIn";
import { EmailTabs } from "@/components/email/EmailTabs";
import {
  Send,
  Loader2,
  Users,
  Eye,
  Mail,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Broadcast Content (client component with hooks)
// ---------------------------------------------------------------------------

function BroadcastContent() {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const recipientCount = useQuery(api.broadcasts.getActiveAffiliateCount, {});

  const createBroadcast = useMutation(api.broadcasts.createBroadcast);

  const handleSend = async () => {
    try {
      setIsSending(true);
      await createBroadcast({ subject, body });
      toast.success("Broadcast queued for delivery!", {
        description: `Sending to ${recipientCount ?? 0} affiliates. Emails will be delivered shortly.`,
      });
      setSubject("");
      setBody("");
      setShowConfirm(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to send broadcast";
      toast.error(message);
    } finally {
      setIsSending(false);
    }
  };

  const isValid = subject.trim().length > 0 && body.trim().length > 0;

  return (
    <>
      {/* Page Content */}
      <div className="px-8 pt-6 pb-8">
        <FadeIn className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Compose Form */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Compose Email
              </h3>
            </div>
            <div className="px-5 pb-5 space-y-4">
              {/* Recipient Count */}
              <div className="flex items-center gap-2 p-3 bg-[var(--bg-page)] rounded-lg">
                <Users className="h-4 w-4 text-[var(--text-muted)]" />
                <span className="text-sm text-[var(--text-muted)]">
                  Recipients:
                </span>
                <Badge variant="secondary" className="ml-auto">
                  {recipientCount ?? "..."} active affiliates
                </Badge>
              </div>

              {/* Subject */}
              <div className="space-y-2">
                <Label htmlFor="subject">
                  Subject <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="subject"
                  placeholder="Enter email subject..."
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={200}
                />
                <p className="text-xs text-[var(--text-muted)] text-right">
                  {subject.length}/200 characters
                </p>
              </div>

              {/* Body */}
              <div className="space-y-2">
                <Label htmlFor="body">
                  Message Body <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="body"
                  placeholder="Write your message here... HTML is supported."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="min-h-[200px] resize-y"
                />
                <p className="text-xs text-[var(--text-muted)]">
                  Supports plain text or basic HTML formatting.
                </p>
              </div>

              {/* Send Button */}
              <Button
                className="w-full"
                onClick={() => setShowConfirm(true)}
                disabled={!isValid || isSending}
              >
                {isSending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Broadcast
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Preview Panel */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Email Preview
              </h3>
            </div>
            <div className="px-5 pb-5">
              {isValid ? (
                <div className="border rounded-lg overflow-hidden">
                  {/* Email Header */}
                  <div className="bg-[var(--bg-page)] px-4 py-3 border-b">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-[var(--brand-light)] flex items-center justify-center">
                        <Mail className="h-4 w-4 text-[var(--brand-primary)]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-[var(--text-muted)]">
                          Subject
                        </p>
                        <p className="text-sm font-medium truncate">
                          {subject}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Users className="h-3 w-3 text-[var(--text-muted)]" />
                      <span className="text-xs text-[var(--text-muted)]">
                        {recipientCount ?? 0} recipients
                      </span>
                    </div>
                  </div>

                  {/* Email Body */}
                  <div className="px-4 py-4 min-h-[200px]">
                    {body.includes("<") ? (
                      <div
                        className="prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: body }}
                      />
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{body}</p>
                    )}
                  </div>

                  {/* Email Footer */}
                  <div className="bg-[var(--bg-page)] px-4 py-3 border-t">
                    <p className="text-xs text-[var(--text-muted)]">
                      Sent from your affiliate program
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-[var(--text-muted)]">
                  <Eye className="h-8 w-8 mb-3" />
                  <p className="text-sm">
                    Enter a subject and body to see preview
                  </p>
                </div>
              )}
            </div>
          </div>
        </FadeIn>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send Broadcast Email?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  You are about to send an email to{" "}
                  <strong>{recipientCount ?? 0} active affiliates</strong>.
                </p>
                <div className="bg-[var(--bg-page)] rounded-lg p-3 space-y-1">
                  <p className="text-sm">
                    <strong>Subject:</strong> {subject}
                  </p>
                  <p className="text-sm text-[var(--text-muted)] line-clamp-2">
                    <strong>Body:</strong> {body}
                  </p>
                </div>
                <p className="text-sm text-amber-600">
                  This action cannot be undone. All active affiliates will
                  receive this email.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSend}
              disabled={isSending}
              className="bg-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/90"
            >
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Confirm Send
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function BroadcastSkeleton() {
  return (
    <div className="px-8 pt-6 pb-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Compose skeleton */}
        <div className="card">
          <div className="card-header">
            <Skeleton className="h-5 w-32" />
          </div>
          <div className="px-5 pb-5 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-[200px] w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
        {/* Preview skeleton */}
        <div className="card">
          <div className="card-header">
            <Skeleton className="h-5 w-32" />
          </div>
          <div className="px-5 pb-5">
            <Skeleton className="h-[320px] w-full rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page (with Suspense boundary)
// ---------------------------------------------------------------------------

export default function BroadcastPage() {
  return (
    <>
      {/* Top Bar */}
      <PageTopbar description="Send an email to all active affiliates">
        <h1 className="text-[17px] font-bold text-[var(--text-heading)]">
          Broadcast Email
        </h1>
      </PageTopbar>

      {/* Tabs */}
      <div className="px-8 pt-4">
        <EmailTabs />
      </div>

      <Suspense fallback={<BroadcastSkeleton />}>
        <BroadcastContent />
      </Suspense>
    </>
  );
}
