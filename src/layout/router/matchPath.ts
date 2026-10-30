export type RouteParams = Readonly<Record<string, string>>;

function segmentsOf(path: string): string[] {
  return path.split('/').filter(Boolean);
}

/** Joins a parent path and a child segment into an absolute path: ('/plan', 'what-if') → '/plan/what-if'. */
export function joinPaths(parent: string, child: string): string {
  return `/${[...segmentsOf(parent), ...segmentsOf(child)].join('/')}`;
}

/**
 * Matches a whole pathname against a pattern such as '/goals/:goalId'. `:name` captures one segment.
 * Returns the captured params, or null when the path doesn't match exactly.
 */
export function matchPath(pattern: string, pathname: string): RouteParams | null {
  const expected = segmentsOf(pattern);
  const actual = segmentsOf(pathname);
  if (expected.length !== actual.length) return null;

  const params: Record<string, string> = {};
  for (let index = 0; index < expected.length; index++) {
    const part = expected[index];
    const value = actual[index];
    if (part.startsWith(':')) {
      params[part.slice(1)] = safeDecode(value);
    } else if (part !== value) {
      return null;
    }
  }
  return params;
}

/** Fills a pattern's params: ('/goals/:goalId', { goalId: 'car' }) → '/goals/car'. Missing params throw. */
export function buildPath(pattern: string, params: RouteParams = {}): string {
  const segments = segmentsOf(pattern).map((part) => {
    if (!part.startsWith(':')) return part;
    const value = params[part.slice(1)];
    if (value === undefined) throw new Error(`Missing route param "${part.slice(1)}" for ${pattern}`);
    return encodeURIComponent(value);
  });
  return `/${segments.join('/')}`;
}

/** How many param segments a pattern has; static routes win over dynamic ones ('/transactions/new' before '/:id'). */
export function paramCount(pattern: string): number {
  return segmentsOf(pattern).filter((part) => part.startsWith(':')).length;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
