"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Mail, Pencil, ArrowLeft } from "lucide-react";
import { PlatformEmailTemplateEditor } from "./_components/PlatformEmailTemplateEditor";

export default function PlatformEmailTemplatesPage() {
  const templates = useQuery(api.platformTemplates.listPlatformEmailTemplates);
  const [editingTemplateType, setEditingTemplateType] = useState<string | null>(null);

  if (templates === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (editingTemplateType) {
    return (
      <PlatformEmailTemplateEditor
        templateType={editingTemplateType}
        onClose={() => setEditingTemplateType(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)]">
      <div className="px-8 py-6 max-w-4xl">
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] mb-2">
            <a href="/admin-settings" className="hover:text-[var(--text-primary)] transition-colors">
              Settings
            </a>
            <span>/</span>
            <span className="text-[var(--text-primary)]">Email Templates</span>
          </div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">
            Platform Email Templates
          </h1>
          <p className="text-[13px] text-[var(--text-muted)] mt-1">
            Customize emails sent to SaaS owners for billing events. Use{" "}
            <code className="text-xs bg-[var(--bg-muted)] px-1.5 py-0.5 rounded">{"{{variable_name}}"}</code>{" "}
            to personalize content.
          </p>
        </div>

        <div className="space-y-4">
          {templates?.map((template) => (
            <Card key={template.type} className="border-[var(--border-light)] shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[var(--brand-light)]">
                      <Mail className="h-5 w-5 text-[var(--brand-primary)]" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{template.label}</CardTitle>
                      <CardDescription className="mt-0.5">
                        {template.description}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge
                    variant={template.status === "customized" ? "default" : "secondary"}
                    className={
                      template.status === "customized"
                        ? "bg-green-100 text-green-800 hover:bg-green-100"
                        : ""
                    }
                  >
                    {template.status === "customized" ? "Customized" : "Default"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-[var(--text-muted)] space-y-1">
                    <p>
                      <span className="font-medium text-[var(--text-primary)]">Subject: </span>
                      {template.customSubject || template.defaultSubject}
                    </p>
                    <p className="truncate max-w-[500px]">
                      <span className="font-medium text-[var(--text-primary)]">Preview: </span>
                      {template.customBody
                        ? template.customBody.replace(/<[^>]*>/g, "").slice(0, 120) + "..."
                        : template.defaultBody.replace(/<[^>]*>/g, "").slice(0, 120) + "..."}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setEditingTemplateType(template.type)}>
                    <Pencil className="h-4 w-4 mr-1.5" />
                    Customize
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
