"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import {
  Send,
  Loader2,
  Users,
  Eye,
  Mail,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";

export default function BroadcastPage() {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

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
      setShowPreview(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send broadcast";
      toast.error(message);
    } finally {
      setIsSending(false);
    }
  };

  const isValid = subject.trim().length > 0 && body.trim().length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/emails/history"
            className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Broadcast Email</h1>
            <p className="text-muted-foreground mt-1">
              Send an email to all active affiliates
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
            disabled={!isValid}
          >
            <Eye className="h-4 w-4 mr-2" />
            {showPreview ? "Edit" : "Preview"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Compose Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Mail className="h-5 w-5" />
              Compose Email
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Recipient Count */}
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
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
              <p className="text-xs text-muted-foreground text-right">
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
              <p className="text-xs text-muted-foreground">
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
          </CardContent>
        </Card>

        {/* Preview Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Eye className="h-5 w-5" />
              Email Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isValid ? (
              <div className="border rounded-lg overflow-hidden">
                {/* Email Header */}
                <div className="bg-muted/50 px-4 py-3 border-b">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Mail className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">
                        Subject
                      </p>
                      <p className="text-sm font-medium truncate">
                        {subject}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Users className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
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
                <div className="bg-muted/30 px-4 py-3 border-t">
                  <p className="text-xs text-muted-foreground">
                    Sent from your affiliate program
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Eye className="h-8 w-8 mb-3" />
                <p className="text-sm">Enter a subject and body to see preview</p>
              </div>
            )}
          </CardContent>
        </Card>
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
                <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                  <p className="text-sm">
                    <strong>Subject:</strong> {subject}
                  </p>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    <strong>Body:</strong> {body}
                  </p>
                </div>
                <p className="text-sm text-amber-600">
                  This action cannot be undone. All active affiliates will receive this email.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSend}
              disabled={isSending}
              className="bg-primary hover:bg-primary/90"
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
    </div>
  );
}
