/**
 * Removes characters with a meaning in PostgREST filter syntax (commas, brackets, quotes,
 * wildcards), so user text can only match text.
 */
export function sanitizeSearch(text: string): string {
  return text
    .replace(/[(),"'*%\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
}
