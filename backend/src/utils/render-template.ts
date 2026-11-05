export type TemplateVars = Record<string, string | number | undefined | null>;

/**
 * Renders a template string by replacing `{{ token }}` placeholders (whitespace
 * inside the braces is optional) with the matching variable value. Unknown
 * tokens are replaced with an empty string so no raw placeholders leak to users.
 */
export const renderTemplate = (
  input: string,
  vars: TemplateVars = {},
): string =>
  (input ?? '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, name: string) => {
    const value = vars[name];
    return value === undefined || value === null ? '' : String(value);
  });

/**
 * Variables every template gets without the caller supplying them. Currently
 * only `currentYear`, so the footer copyright rolls forward each year with no
 * admin editing. Callers may still override by passing the key explicitly.
 */
export const withSystemVars = (vars: TemplateVars = {}): TemplateVars => ({
  currentYear: String(new Date().getFullYear()),
  ...vars,
});
