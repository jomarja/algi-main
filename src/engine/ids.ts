/** A unique id for app-created records (goals, manual transactions, saved plans). */
export function newId(): string {
  // randomUUID is missing outside secure contexts (plain-HTTP previews), hence the fallback.
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
