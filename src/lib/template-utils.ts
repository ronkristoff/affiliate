/**
 * Client-side template rendering utility.
 * Mirrors the server-side renderTemplate function from convex/templates.ts.
 * Used for live preview in the email template editor.
 */

/**
 * Render a template string by replacing {{variable}} placeholders with actual values.
 * Variables not found in the data map are left as-is.
 */
export function renderTemplate(
  content: string,
  variables: Record<string, string | number | undefined>
): string {
  return content.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = variables[key];
    if (value === undefined) {
      return `{{${key}}}`;
    }
    return String(value);
  });
}

/**
 * Validate template variables client-side.
 * Returns validation result with missing required vars and invalid syntax.
 */
export function validateTemplateVariables(
  requiredVariables: string[],
  allVariables: string[],
  content: string
): { valid: boolean; missing: string[]; invalidSyntax: string[] } {
  const variablePattern = /\{\{(\w+)\}\}/g;
  const foundVars = new Set<string>();
  const invalidSyntax: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = variablePattern.exec(content)) !== null) {
    foundVars.add(match[1]);
  }

  // Check for unknown variables
  for (const foundVar of foundVars) {
    if (!allVariables.includes(foundVar)) {
      invalidSyntax.push(`Unknown variable: {{${foundVar}}}`);
    }
  }

  const missing = requiredVariables.filter((v) => !foundVars.has(v));

  return {
    valid: missing.length === 0 && invalidSyntax.length === 0,
    missing,
    invalidSyntax,
  };
}
