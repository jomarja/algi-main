import type { IncomingMessage, ServerResponse } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';

const contentTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

/**
 * Serves the built front end from `rootDir`, falling back to index.html for app routes (the app does its
 * own routing). Returns false when the request isn't a GET/HEAD or the build isn't there.
 */
export async function serveStatic(req: IncomingMessage, res: ServerResponse, url: URL, rootDir: string): Promise<boolean> {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  const root = resolve(rootDir);
  const requested = resolve(join(root, normalize(decodeURIComponent(url.pathname))));
  if (requested !== root && !requested.startsWith(root + sep)) return false;

  const file = (await isFile(requested)) ? requested : join(root, 'index.html');
  if (!(await isFile(file))) return false;

  const extension = extname(file);
  const isHashedAsset = url.pathname.startsWith('/assets/');
  res.writeHead(200, {
    'Content-Type': contentTypes[extension] ?? 'application/octet-stream',
    'Cache-Control': isHashedAsset ? 'public, max-age=31536000, immutable' : 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  });
  if (req.method === 'HEAD') {
    res.end();
    return true;
  }
  createReadStream(file).pipe(res);
  return true;
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}
