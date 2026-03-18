"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  ArrowLeft,
  Save,
  RotateCcw,
  AlertTriangle,
  Eye,
  Code,
  Variable,
  Copy,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { renderTemplate } from "@/lib/template-utils";

interface EmailTemplateEditorProps {
  templateType: string;
  onClose: () => void;
}

export function EmailTemplateEditor({ templateType, onClose }: EmailTemplateEditorProps) {
  const template = useQuery(api.templates.getMyEmailTemplate, {
    templateType,
  });
  const upsertTemplate = useMutation(api.templates.upsertMyEmailTemplate);
  const resetTemplate = useMutation(api.templates.resetMyEmailTemplate);

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  // Load template data
  useEffect(() => {
    if (template) {
      setSubject(template.subject);
      setBody(template.body);
    }
  }, [template]);

  // Validate template on content change
  useEffect(() => {
    if (!template) return;

    const errors: string[] = [];

    // Check required variables in subject
    const subjectVars = subject.match(/\{\{(\w+)\}\}/g)?.map((m) => m.replace(/\{\{|\}\}/g, "")) || [];
    const bodyVars = body.match(/\{\{(\w+)\}\}/g)?.map((m) => m.replace(/\{\{|\}\}/g, "")) || [];

    // Check for unknown variables
    const allFoundVars = new Set([...subjectVars, ...bodyVars]);
    for (const v of allFoundVars) {
      if (!template.variables.includes(v)) {
        errors.push(`Unknown variable: {{${v}}}`);
      }
    }

    // Check for missing required variables
    for (const required of template.requiredVariables) {
      const inSubject = subjectVars.includes(required);
      const inBody = bodyVars.includes(required);
      if (!inSubject && !inBody) {
        errors.push(`Missing required variable: {{${required}}}`);
      }
    }

    setValidationErrors(errors);
  }, [subject, body, template]);

  // Live preview with sample data
  const previewSubject = useMemo(() => {
    if (!template) return "";
    return renderTemplate(subject, template.sampleData);
  }, [subject, template]);

  const previewBody = useMemo(() => {
    if (!template) return "";
    return renderTemplate(body, template.sampleData);
  }, [body, template]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const result = await upsertTemplate({
        templateType,
        customSubject: subject,
        customBody: body,
      });

      if (result.success) {
        toast.success("Template saved successfully");
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save template");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    setIsResetting(true);
    try {
      await resetTemplate({ templateType });
      // Reload defaults
      if (template) {
        setSubject(template.defaultSubject);
        setBody(template.defaultBody);
      }
      toast.success("Template reset to default");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reset template");
    } finally {
      setIsResetting(false);
    }
  };

  const insertVariable = useCallback((variable: string) => {
    setBody((prev) => prev + `{{${variable}}}`);
  }, []);

  const copyVariable = useCallback((variable: string) => {
    const text = `{{${variable}}}`;
    navigator.clipboard.writeText(text).then(() => {
      toast.success(`Copied {{${variable}}} to clipboard`);
    });
  }, []);

  // Loading state
  if (template === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (template === null) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Template Not Found
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            The requested template could not be found.
          </p>
          <Button variant="outline" onClick={onClose}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Templates
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onClose}>
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">{template.label}</h1>
            <p className="text-sm text-muted-foreground">{template.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={isResetting}>
                <RotateCcw className="h-4 w-4 mr-1.5" />
                Reset to Default
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset Template?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will discard your customizations and restore the default template
                  for &quot;{template.label}&quot;. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleReset} disabled={isResetting}>
                  {isResetting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Reset Template
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving || validationErrors.length > 0}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1.5" />
            )}
            Save
          </Button>
        </div>
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-center gap-2 text-amber-800 font-medium text-sm mb-2">
            <AlertTriangle className="h-4 w-4" />
            Template Validation Issues
          </div>
          <ul className="text-sm text-amber-700 space-y-1">
            {validationErrors.map((error, i) => (
              <li key={i}>• {error}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Editor */}
        <div className="lg:col-span-2 space-y-4">
          {/* Subject Line */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Subject Line</CardTitle>
              <CardDescription>
                The email subject line. Use variables to personalize.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Email subject line..."
                  className="font-medium"
                />
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {subject.length} chars
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Body Editor */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Email Body</CardTitle>
                  <CardDescription>
                    HTML content of the email. Use variables to personalize.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant={!showPreview ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowPreview(false)}
                  >
                    <Code className="h-4 w-4 mr-1.5" />
                    Edit
                  </Button>
                  <Button
                    variant={showPreview ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowPreview(true)}
                  >
                    <Eye className="h-4 w-4 mr-1.5" />
                    Preview
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {showPreview ? (
                <div className="border rounded-lg p-4 min-h-[300px] bg-white">
                  <div className="mb-2 pb-2 border-b">
                    <p className="font-medium text-sm text-muted-foreground">Subject:</p>
                    <p className="font-semibold">{previewSubject}</p>
                  </div>
                  <div
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: previewBody }}
                  />
                </div>
              ) : (
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Email body HTML content..."
                  className="font-mono text-sm min-h-[300px]"
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Variables Sidebar */}
        <div className="space-y-4">
          <Card className="sticky top-8">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Variable className="h-4 w-4" />
                Available Variables
              </CardTitle>
              <CardDescription>
                Click to insert, or click the copy icon to copy to clipboard.
                <br />
                <span className="font-medium text-amber-600">Bold</span> = required
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {template.variables.map((variable) => {
                  const isRequired = template.requiredVariables.includes(variable);
                  return (
                    <div
                      key={variable}
                      className="flex items-center justify-between p-2 rounded-md hover:bg-muted transition-colors group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono truncate">
                          {"{{" + variable + "}}"}
                        </code>
                        {isRequired && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            Required
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => insertVariable(variable)}
                          title={`Insert {{${variable}}}`}
                        >
                          <Variable className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => copyVariable(variable)}
                          title={`Copy {{${variable}}}`}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Default Template Reference */}
          {template.status === "customized" && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-muted-foreground">Default Template</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-1">
                  <strong>Subject:</strong> {template.defaultSubject}
                </p>
                <p className="text-xs text-muted-foreground line-clamp-3">
                  <strong>Body:</strong>{" "}
                  {template.defaultBody.replace(/<[^>]*>/g, "").slice(0, 200)}...
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
