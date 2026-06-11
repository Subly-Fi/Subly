const DEFAULT_API_URL = 'https://api.subly.fi';

export interface SublyApiConfig {
  apiUrl?: string;
  apiKey: string;
}

export class SublyApi {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(config: SublyApiConfig) {
    this.baseUrl = config.apiUrl ?? DEFAULT_API_URL;
    this.apiKey = config.apiKey;
  }

  private async fetch<T>(path: string, opts?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        ...opts?.headers,
      },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(`Subly API error (${res.status}): ${(body as Record<string, string>).error ?? res.statusText}`);
    }

    return res.json() as Promise<T>;
  }

  async registerMerchant(opts: {
    wallet: string;
    email?: string;
    webhookUrl?: string;
    name?: string;
  }) {
    return this.fetch<{ data: Record<string, unknown> }>('/merchants/register', {
      method: 'POST',
      body: JSON.stringify(opts),
    });
  }

  async updateMerchant(wallet: string, opts: {
    email?: string;
    webhookUrl?: string;
    name?: string;
  }) {
    return this.fetch<{ data: Record<string, unknown> }>(`/merchants/${wallet}`, {
      method: 'PUT',
      body: JSON.stringify(opts),
    });
  }

  async getMerchant(wallet: string) {
    return this.fetch<{ data: Record<string, unknown> }>(`/merchants/${wallet}`);
  }

  async getAnalyticsSummary(wallet: string) {
    return this.fetch<{ data: { totalSubscriptions: number; totalPayments: number; totalRevenue: number } }>(
      `/analytics/${wallet}/summary`,
    );
  }

  async getPaymentHistory(wallet: string, opts?: { limit?: number; offset?: number }) {
    const params = new URLSearchParams();
    if (opts?.limit) params.set('limit', String(opts.limit));
    if (opts?.offset) params.set('offset', String(opts.offset));
    const qs = params.toString();
    return this.fetch<{ data: unknown[]; total: number }>(
      `/analytics/${wallet}/payments${qs ? `?${qs}` : ''}`,
    );
  }
}
