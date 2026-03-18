"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquarePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface NotesTabProps {
  tenantId: Id<"tenants">;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString("en-PH", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function NotesTab({ tenantId }: NotesTabProps) {
  const [noteContent, setNoteContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const notes = useQuery(api.admin.tenants.getTenantAdminNotes, { tenantId });
  const addNote = useMutation(api.admin.tenants.addTenantAdminNote);

  const handleSubmitNote = async () => {
    if (!noteContent.trim()) return;
    setIsSubmitting(true);
    try {
      await addNote({ tenantId, content: noteContent.trim() });
      setNoteContent("");
      toast.success("Note added successfully");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to add note";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLoading = notes === undefined;

  return (
    <div className="space-y-4">
      {/* Add Note Form */}
      <div className="rounded-xl border border-[#e5e7eb] bg-white p-4">
        <h3 className="mb-3 text-sm font-bold text-[#333333]">Add New Note</h3>
        <Textarea
          placeholder="Add an internal note about this tenant..."
          value={noteContent}
          onChange={(e) => setNoteContent(e.target.value)}
          className="mb-3 min-h-[80px] resize-none"
        />
        <div className="flex items-center justify-between">
          <p className="text-xs text-[#6b7280]">
            Notes are only visible to platform admins
          </p>
          <Button
            onClick={handleSubmitNote}
            disabled={!noteContent.trim() || isSubmitting}
            className="gap-2 bg-[#10409a] text-white hover:bg-[#0d347a]"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MessageSquarePlus className="h-4 w-4" />
            )}
            Add Note
          </Button>
        </div>
      </div>

      {/* Notes List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : !notes || notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-[#e5e7eb] bg-white py-12">
          <MessageSquarePlus className="mb-2 h-8 w-8 text-[#6b7280]" />
          <p className="text-sm text-[#6b7280]">No admin notes yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <div
              key={note._id}
              className="rounded-lg border border-[#fde68a] bg-[#fffbf0] p-4"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-[#333333]">{note.authorName}</span>
                <span className="text-xs text-[#6b7280]">{formatDate(note.createdAt)}</span>
              </div>
              <p className="text-sm text-[#474747] whitespace-pre-wrap">{note.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
