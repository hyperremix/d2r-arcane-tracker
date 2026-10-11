/**
 * Escapes text for HTML element content, HTML attribute values (single or double quoted) and XML
 * text. The numeric `&#39;` is used for the apostrophe because it is valid in both HTML and XML.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
