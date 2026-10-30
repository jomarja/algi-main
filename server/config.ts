/**
 * Server settings, read once from the environment (see .env.example).
 *
 * TBC_MODE picks where bank data comes from:
 *   mock        the built-in imitation of TBC's Open Banking API (server/mock-tbc), same flow and payloads.
 *               Works with no credentials; the default.
 *   sandbox     TBC's test environment. Needs a registered client ID and TBC-issued QWAC certificate.
 *   production  TBC's live environment. Additionally needs an NBG open banking licence.
 */

export type TbcMode = 'mock' | 'sandbox' | 'production';

export interface TbcConfig {
  mode: TbcMode;
  clientId: string;
  /** Where TBC sends the PSU back after consent, e.g. https://algi.example/api/bank/callback. */
  redirectUri: string;
  /** NextGenPSD2 AIS base, e.g. https://test-openbanking.tbcbank.ge/0.8. Called by the server. */
  apiBaseUrl: string;
  /** Loans and savings (/v2/loans, /v2/savings) base. Called by the server. */
  productsBaseUrl: string;
  /** OAuth authorize host, e.g. https://test-api.tbcbank.ge. Opened in the PSU's browser. */
  authBaseUrl: string;
  /** OAuth token endpoint. Called by the server over mutual TLS. */
  tokenUrl: string;
  /** QWAC client certificate and key (PEM) for mutual TLS. Required outside mock mode. */
  certPath: string | null;
  keyPath: string | null;
  keyPassphrase: string | null;
  /** Extra CA bundle (PEM), when TBC's sandbox chain isn't in Node's store. */
  caPath: string | null;
  /** QSealC key and certificate (PEM) for Digest + X-JWS-Signature request signing, when TBC requires it. */
  signingKeyPath: string | null;
  signingCertPath: string | null;
  /** How far back to read transactions on each sync. */
  historyDays: number;
  /** Consent lifetime requested from the bank. */
  consentDays: number;
}

export interface AiConfig {
  apiKey: string | null;
  model: string;
}

export interface ServerConfig {
  port: number;
  production: boolean;
  /** The origin the browser uses, e.g. http://localhost:5173 in development. */
  publicBaseUrl: string;
  /** Loopback origin of this server, for calls the server makes to its own mock bank. */
  internalBaseUrl: string;
  /** Built front end to serve, when present (production). */
  staticDir: string;
  tbc: TbcConfig;
  ai: AiConfig;
}

const tbcHosts: Record<Exclude<TbcMode, 'mock'>, { api: string; products: string; auth: string; token: string }> = {
  sandbox: {
    api: 'https://test-openbanking.tbcbank.ge/0.8',
    products: 'https://test-openbanking.tbcbank.ge',
    auth: 'https://test-api.tbcbank.ge',
    token: 'https://test-openbanking.tbcbank.ge/openbanking/oauth/token',
  },
  production: {
    api: 'https://openbanking.tbcbank.ge/0.8',
    products: 'https://openbanking.tbcbank.ge',
    auth: 'https://api.tbcbank.ge',
    token: 'https://openbanking.tbcbank.ge/openbanking/oauth/token',
  },
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const port = Number(env.PORT ?? 8787);
  const production = env.NODE_ENV === 'production';
  const publicBaseUrl = trimSlash(env.PUBLIC_BASE_URL ?? (production ? `http://localhost:${port}` : 'http://localhost:5173'));
  const internalBaseUrl = `http://127.0.0.1:${port}`;
  const mode = parseMode(env.TBC_MODE);
  const hosts = mode === 'mock'
    ? {
        api: `${internalBaseUrl}/mock-tbc/0.8`,
        products: `${internalBaseUrl}/mock-tbc`,
        auth: `${publicBaseUrl}/mock-tbc`,
        token: `${internalBaseUrl}/mock-tbc/openbanking/oauth/token`,
      }
    : tbcHosts[mode];

  return {
    port,
    production,
    publicBaseUrl,
    internalBaseUrl,
    staticDir: env.STATIC_DIR ?? 'dist',
    tbc: {
      mode,
      clientId: env.TBC_CLIENT_ID ?? (mode === 'mock' ? 'algi-mock-client' : ''),
      redirectUri: env.TBC_REDIRECT_URI ?? `${publicBaseUrl}/api/bank/callback`,
      apiBaseUrl: trimSlash(env.TBC_API_BASE_URL ?? hosts.api),
      productsBaseUrl: trimSlash(env.TBC_PRODUCTS_BASE_URL ?? hosts.products),
      authBaseUrl: trimSlash(env.TBC_AUTH_BASE_URL ?? hosts.auth),
      tokenUrl: env.TBC_TOKEN_URL ?? hosts.token,
      certPath: env.TBC_CERT_PATH || null,
      keyPath: env.TBC_KEY_PATH || null,
      keyPassphrase: env.TBC_KEY_PASSPHRASE || null,
      caPath: env.TBC_CA_PATH || null,
      signingKeyPath: env.TBC_SIGNING_KEY_PATH || null,
      signingCertPath: env.TBC_SIGNING_CERT_PATH || null,
      historyDays: Number(env.TBC_HISTORY_DAYS ?? 120),
      consentDays: Number(env.TBC_CONSENT_DAYS ?? 90),
    },
    ai: {
      apiKey: env.ANTHROPIC_API_KEY || null,
      model: env.AI_MODEL || 'claude-opus-5-5',
    },
  };
}

function parseMode(value: string | undefined): TbcMode {
  if (value === 'sandbox' || value === 'production') return value;
  return 'mock';
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

/** Problems that stop live TBC calls from working, for a clear message at start-up. */
export function tbcConfigProblems(tbc: TbcConfig): string[] {
  if (tbc.mode === 'mock') return [];
  const problems: string[] = [];
  if (!tbc.clientId) problems.push('TBC_CLIENT_ID is not set');
  if (!tbc.certPath || !tbc.keyPath) problems.push('TBC_CERT_PATH and TBC_KEY_PATH (QWAC certificate) are not set');
  return problems;
}
