/** Type guards for JSON the server doesn't control: request bodies and model output. */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** `Array.isArray` without the `any[]` it narrows to. */
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

export function isOneOf<T extends string>(value: unknown, options: readonly T[]): value is T {
  return typeof value === 'string' && (options as readonly string[]).includes(value);
}
