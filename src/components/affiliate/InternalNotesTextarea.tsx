"use client";

import { useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FileText, Save, Loader2 } from "lucide-react";

interface InternalNotesTextareaProps {
  note: string | undefined;
  onSave: (note: string | undefined) => Promise<void>;
  canManage: boolean;
}

export function InternalNotesTextarea({
  note,
  onSave,
  canManage,
}: InternalNotesTextareaProps) {
  const [noteValue, setNoteValue] = useState(note || "");
  const [isSaving, setIsSaving] = useState(false);

  // Sync with external note value when it changes
  useEffect(() => {
    if (note !== undefined) {
      setNoteValue(note);
    }
  }, [note]);

  const handleSave = async () => {
    if (!canManage) return;

    try {
      setIsSaving(true);
      await onSave(noteValue || undefined);
    } finally {
      setIsSaving(false);
    }
  };

  if (!canManage) {
    return null;
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Internal Notes
        </h3>
      </div>
      <div className="px-5 pb-5 space-y-3">
        <Textarea
          placeholder="Add a private note about this affiliate (not visible to them)..."
          value={noteValue}
          onChange={(e) => setNoteValue(e.target.value)}
          rows={4}
          className="resize-none text-[13px]"
        />
        <Button
          size="sm"
          onClick={handleSave}
          disabled={isSaving || noteValue === (note || "")}
        >
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Note
        </Button>
      </div>
    </div>
  );
}
