// Returns a URL only if it uses an http(s) scheme; otherwise returns null.
// Used to guard href attributes and window.open against javascript: / data:
// payloads stored in user-controlled entity fields.
export function safeHttpUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return null;
}