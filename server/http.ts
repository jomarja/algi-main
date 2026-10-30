import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';

/** Minimal routing, JSON and cookie-session helpers on top of node:http, so the server needs no framework. */

export type RouteParams = Record<string, string>;

export interface RequestContext {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  params: RouteParams;
  session: Session;
}

export type Handler = (ctx: RequestContext) => Promise<void> | void;

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface Route {
  method: Method;
  segments: string[];
  handler: Handler;
}

export class Router {
  private readonly routes: Route[] = [];

  get(pattern: string, handler: Handler): void { this.add('GET', pattern, handler); }
  post(pattern: string, handler: Handler): void { this.add('POST', pattern, handler); }
  put(pattern: string, handler: Handler): void { this.add('PUT', pattern, handler); }
  delete(pattern: string, handler: Handler): void { this.add('DELETE', pattern, handler); }

  /** Runs the first matching route. Returns false when nothing matched, so the caller can fall through. */
  async handle(ctx: Omit<RequestContext, 'params'>): Promise<boolean> {
    const method = ctx.req.method ?? 'GET';
    const path = splitPath(ctx.url.pathname);
    for (const route of this.routes) {
      if (route.method !== method) continue;
      const params = matchSegments(route.segments, path);
      if (!params) continue;
      await route.handler({ ...ctx, params });
      return true;
    }
    return false;
  }

  private add(method: Method, pattern: string, handler: Handler): void {
    this.routes.push({ method, segments: splitPath(pattern), handler });
  }
}

function splitPath(path: string): string[] {
  return path.split('/').filter(Boolean);
}

/** `:name` captures one segment; a trailing `*` captures the rest of the path as `params['*']`. */
export function matchSegments(pattern: string[], path: string[]): RouteParams | null {
  const params: RouteParams = {};
  for (let i = 0; i < pattern.length; i++) {
    const part = pattern[i];
    if (part === '*') {
      params['*'] = path.slice(i).map(decodeURIComponent).join('/');
      return params;
    }
    const value = path[i];
    if (value === undefined) return null;
    if (part.startsWith(':')) params[part.slice(1)] = decodeURIComponent(value);
    else if (part !== value) return null;
  }
  return pattern.length === path.length ? params : null;
}

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message?: string) {
    super(message ?? code);
    this.status = status;
    this.code = code;
  }
}

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
  });
  res.end(payload);
}

export function sendNoContent(res: ServerResponse): void {
  res.writeHead(204, { 'Cache-Control': 'no-store' });
  res.end();
}

export function redirect(res: ServerResponse, location: string): void {
  res.writeHead(302, { Location: location, 'Cache-Control': 'no-store' });
  res.end();
}

export function sendHtml(res: ServerResponse, status: number, html: string): void {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(html);
}

const maxBodyBytes = 1_000_000;

export async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBodyBytes) throw new HttpError(413, 'payload_too_large');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function readJson<T>(req: IncomingMessage): Promise<T> {
  const text = await readBody(req);
  if (!text) throw new HttpError(400, 'empty_body');
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(400, 'invalid_json');
  }
}

export async function readForm(req: IncomingMessage): Promise<URLSearchParams> {
  return new URLSearchParams(await readBody(req));
}

/** The PSU's address for PSD2 `PSU-IP-Address`: the first X-Forwarded-For hop behind nginx, else the socket. */
export function clientIp(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
  return first || req.socket.remoteAddress?.replace(/^::ffff:/, '') || '127.0.0.1';
}

// MARK: Sessions

const sessionCookie = 'algi_sid';
const sessionTtlMs = 30 * 24 * 60 * 60 * 1000;

/** Server-side session data. Bank tokens and consent state live here and never reach the browser. */
export class Session {
  readonly id: string;
  private readonly values = new Map<string, unknown>();
  lastSeen = Date.now();

  constructor(id: string) {
    this.id = id;
  }

  get<T>(key: string): T | undefined {
    return this.values.get(key) as T | undefined;
  }

  set(key: string, value: unknown): void {
    this.values.set(key, value);
  }

  delete(key: string): void {
    this.values.delete(key);
  }
}

export class SessionStore {
  private readonly sessions = new Map<string, Session>();
  private readonly secureCookies: boolean;

  constructor(secureCookies: boolean) {
    this.secureCookies = secureCookies;
  }

  /** Finds the request's session, or starts one and sets its cookie on the response. */
  resolve(req: IncomingMessage, res: ServerResponse): Session {
    this.sweep();
    const id = readCookie(req, sessionCookie);
    const existing = id ? this.sessions.get(id) : undefined;
    if (existing) {
      existing.lastSeen = Date.now();
      return existing;
    }
    const session = new Session(randomUUID());
    this.sessions.set(session.id, session);
    const attributes = ['Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${sessionTtlMs / 1000}`];
    if (this.secureCookies) attributes.push('Secure');
    res.setHeader('Set-Cookie', `${sessionCookie}=${session.id}; ${attributes.join('; ')}`);
    return session;
  }

  private sweep(): void {
    const cutoff = Date.now() - sessionTtlMs;
    for (const [id, session] of this.sessions) {
      if (session.lastSeen < cutoff) this.sessions.delete(id);
    }
  }
}

export function readCookie(req: IncomingMessage, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}
