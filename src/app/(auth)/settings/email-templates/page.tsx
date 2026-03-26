"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageTopbar } from "@/components/ui/PageTopbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Mail, Pencil, AlertCircle } from "lucide-react";
import { EmailTemplateEditor } from "./_components/EmailTemplateEditor";

export default function EmailTemplatesPage() {
  const templates = useQuery(api.templates.listMyEmailTemplates);
  const [editingTemplateType, setEditingTemplateType] = useState<string | null>(null);

  // Loading state
  if (templates === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Error / unauthenticated state
  if (templates === null) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Unable to Load Templates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Please sign in to manage your email templates.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Editor mode
  if (editingTemplateType) {
    return (
      <EmailTemplateEditor
        templateType={editingTemplateType}
        onClose={() => setEditingTemplateType(null)}
      />
    );
  }

  return (
    <div className="animate-fade-in">
      <PageTopbar description="Customize the emails sent to your affiliates">
        <h1 className="text-lg font-semibold text-heading">Email Templates</h1>
      </PageTopbar>
      <div className="px-8 py-6">
        <div className="max-w-4xl">
          <p className="text-sm text-muted-foreground mb-6">
            Use template variables like{" "}
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{"{{affiliate_name}}"}</code>{" "}
            to personalize content.
          </p>

          <div className="space-y-4">
        {templates.map((template) => (
          <Card key={template.type}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                    <Mail className="h-5 w-5 text-primary" />
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
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>
                    <span className="font-medium text-foreground">Subject: </span>
                    {template.customSubject || template.defaultSubject}
                  </p>
                  <p className="truncate max-w-[500px]">
                    <span className="font-medium text-foreground">Preview: </span>
                    {template.customBody
                      ? template.customBody.replace(/<[^>]*>/g, "").slice(0, 120) + "..."
                      : template.defaultBody.replace(/<[^>]*>/g, "").slice(0, 120) + "..."}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingTemplateType(template.type)}
                >
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
    </div>
  );
}
