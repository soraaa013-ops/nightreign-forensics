// Storage is optional: blocked storage must never prevent using either tool.
export function readDraft(key) {
  try {
    return JSON.parse(sessionStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}
export function writeDraft(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Private browsing or quota limit. */
  }
}
