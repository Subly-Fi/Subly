import type { SublyConfig, DelegationSummary } from './types';

const DEFAULT_PROGRAM_ADDRESS = 'De1egAFMkMWZSN5rYXRj9CAdheBamobVNubTsi9avR44';

/**
 * High-level client for interacting with Subly (subscriptions on Solana).
 *
 * Wraps @subscriptions/client with ergonomic defaults.
 * Full implementation will come after SDK integration with the upstream client.
 */
export class SublyClient {
  readonly rpcUrl: string;
  readonly programAddress: string;

  constructor(config: SublyConfig) {
    this.rpcUrl = config.rpcUrl;
    this.programAddress = config.programAddress ?? DEFAULT_PROGRAM_ADDRESS;
  }

  // TODO: Implement after @subscriptions/client integration
  async getDelegationSummary(_wallet: string): Promise<DelegationSummary> {
    return { fixed: 0, recurring: 0, subscriptions: 0, total: 0 };
  }
}
