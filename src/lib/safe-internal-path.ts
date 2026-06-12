/**
 * Returns a same-origin path safe to use after auth redirects.
 * Rejects protocol-relative and absolute URLs to avoid open redirects.
 */
export function safeInternalPath(
  candidate: string | null | undefined,
  fallback: string
): string {
  if (!candidate || typeof candidate !== "string") return fallback;
  const t = candidate.trim();
  if (!t.startsWith("/") || t.startsWith("//")) return fallback;
  return t;
}
