export interface SublyConfig {
  rpcUrl: string;
  programAddress?: string;
  network?: 'mainnet-beta' | 'devnet' | 'localnet';
}

export interface SubscriptionPlan {
  address: string;
  owner: string;
  mint: string;
  amount: bigint;
  periodHours: bigint;
  endTs: bigint;
  status: 'active' | 'sunset';
}

export interface DelegationSummary {
  fixed: number;
  recurring: number;
  subscriptions: number;
  total: number;
}
