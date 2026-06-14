/**
 * Client for the Subly backend (apps/api, default :3002) — merchant auth,
 * profile, and analytics. This is distinct from `lib/api-client.ts`, which talks
 * to the local dev webapp API (:3001) for config/airdrop/setup/program-deploy.
 *
 * The backend protects /merchants and /analytics with a JWT (or merchant
 * api_key) obtained from the wallet-signature flow in `use-subly-auth.ts`.
 */

const SUBLY_API_URL = import.meta.env?.VITE_SUBLY_API_URL ?? 'http://localhost:3002';

export class SublyApiError extends Error {
  status?: number;
  details?: unknown;
  constructor(message: string, status?: number, details?: unknown) {
    super(message);
    this.name = 'SublyApiError';
    this.status = status;
    this.details = details;
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  token?: string | null;
  body?: unknown;
  timeout?: number;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { token, body, timeout = 15_000, headers, ...rest } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${SUBLY_API_URL}${path}`, {
      ...rest,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const json = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = json?.details
        ? `${json.error ?? 'Request failed'}: ${typeof json.details === 'string' ? json.details : JSON.stringify(json.details)}`
        : (json?.error ?? 'Request failed');
      throw new SublyApiError(message, response.status, json);
    }

    return json as T;
  } catch (error) {
    if (error instanceof SublyApiError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new SublyApiError('Request timed out', 408);
    }
    throw new SublyApiError('Network request failed', undefined, error);
  } finally {
    clearTimeout(timer);
  }
}

// ── Response shapes (mirrors apps/api routes) ──────────────────────────────
export interface MerchantRecord {
  wallet: string;
  name: string | null;
  email: string | null;
  webhook_url: string | null;
  api_key: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface AnalyticsSummary {
  totalSubscriptions: number;
  activeSubscriptions: number;
  totalPayments: number;
  totalRevenue: number;
}

export interface SubscriptionRecord {
  id: string;
  plan_address: string | null;
  subscriber_wallet: string;
  status: string;
  current_period_start: string | null;
  expires_at: string | null;
  last_payment_at: string | null;
  consecutive_failures: number | null;
  created_at: string;
}

export interface PaymentRecord {
  id: string;
  plan_address: string | null;
  subscriber_wallet: string;
  merchant_wallet: string;
  amount: string;
  mint: string;
  tx_signature: string | null;
  status: 'success' | 'failed';
  failure_reason: string | null;
  created_at: string;
}

export interface Paginated<T> {
  data: T[];
  total: number;
}

export const sublyApi = {
  auth: {
    challenge: (wallet: string) =>
      request<{ data: { message: string; nonce: string } }>('/auth/challenge', {
        method: 'POST',
        body: { wallet },
      }).then((r) => r.data),

    verify: (wallet: string, signature: string, nonce: string) =>
      request<{ data: { token: string; wallet: string } }>('/auth/verify', {
        method: 'POST',
        body: { wallet, signature, nonce },
      }).then((r) => r.data),
  },

  merchants: {
    get: (wallet: string, token: string) =>
      request<{ data: MerchantRecord }>(`/merchants/${wallet}`, { token }).then((r) => r.data),

    register: (token: string, body: { email?: string; webhookUrl?: string; name?: string }) =>
      request<{ data: MerchantRecord }>('/merchants/register', { method: 'POST', token, body }).then((r) => r.data),

    // Register the merchant's plan PDAs so the backend indexer polls only those
    // (instead of the shared program). Best-effort; idempotent server-side.
    syncPlans: (token: string, planAddresses: string[]) =>
      request<{ data: { registered: string[]; skipped: string[] } }>('/merchants/plans/sync', {
        method: 'POST',
        token,
        body: { planAddresses },
      }).then((r) => r.data),
  },

  analytics: {
    summary: (wallet: string, token: string) =>
      request<{ data: AnalyticsSummary }>(`/analytics/${wallet}/summary`, { token }).then((r) => r.data),

    subscriptions: (wallet: string, token: string, params: { status?: string; limit?: number; offset?: number } = {}) => {
      const q = new URLSearchParams();
      if (params.status) q.set('status', params.status);
      if (params.limit != null) q.set('limit', String(params.limit));
      if (params.offset != null) q.set('offset', String(params.offset));
      const qs = q.toString();
      return request<Paginated<SubscriptionRecord>>(`/analytics/${wallet}/subscriptions${qs ? `?${qs}` : ''}`, { token });
    },

    payments: (wallet: string, token: string, params: { limit?: number; offset?: number } = {}) => {
      const q = new URLSearchParams();
      if (params.limit != null) q.set('limit', String(params.limit));
      if (params.offset != null) q.set('offset', String(params.offset));
      const qs = q.toString();
      return request<Paginated<PaymentRecord>>(`/analytics/${wallet}/payments${qs ? `?${qs}` : ''}`, { token });
    },
  },
};

// ── Wallet-keyed JWT storage ───────────────────────────────────────────────
const tokenKey = (wallet: string) => `subly:jwt:${wallet}`;

function decodeJwtExp(token: string): number | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
    const payload = JSON.parse(atob(base64));
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string): boolean {
  const exp = decodeJwtExp(token);
  // Treat unparseable tokens as expired; add a small skew so we refresh early.
  if (exp == null) return true;
  return exp * 1000 < Date.now() + 30_000;
}

export function getStoredToken(wallet: string): string | null {
  try {
    const token = localStorage.getItem(tokenKey(wallet));
    if (!token) return null;
    if (isTokenExpired(token)) {
      localStorage.removeItem(tokenKey(wallet));
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

export function storeToken(wallet: string, token: string): void {
  try {
    localStorage.setItem(tokenKey(wallet), token);
  } catch {
    /* ignore storage failures (private mode, etc.) */
  }
}

export function clearToken(wallet: string): void {
  try {
    localStorage.removeItem(tokenKey(wallet));
  } catch {
    /* ignore */
  }
}
