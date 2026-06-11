import type { Address, TransactionSigner } from '@solana/kit';

export interface SublyConfig {
  rpcUrl: string;
  programAddress?: string;
  network?: 'mainnet-beta' | 'devnet' | 'localnet';
}

export interface CreatePlanParams {
  signer: TransactionSigner;
  mint: Address;
  amount: bigint;
  periodInSeconds: bigint;
  metadata?: string;
}

export interface InitSubscriptionAuthorityParams {
  signer: TransactionSigner;
  mint: Address | string;
}

export interface SubscribeParams {
  signer: TransactionSigner;
  /** The plan PDA to subscribe to. */
  planAddress: Address | string;
  /** Initialize the caller's SubscriptionAuthority in the same tx if missing (default true). */
  autoInitAuthority?: boolean;
}

export interface CancelSubscriptionParams {
  signer: TransactionSigner;
  planAddress: Address | string;
}

export interface CreateFixedDelegationParams {
  signer: TransactionSigner;
  delegatee: Address | string;
  mint: Address | string;
  amount: bigint;
  expiresAt?: bigint;
  /** Random by default; set to derive a deterministic delegation PDA. */
  nonce?: bigint;
}

export interface CreateRecurringDelegationParams {
  signer: TransactionSigner;
  delegatee: Address | string;
  mint: Address | string;
  amountPerPeriod: bigint;
  periodInSeconds: bigint;
  expiresAt?: bigint;
  nonce?: bigint;
  /** Defaults to current on-chain time. */
  startTs?: bigint;
}

export interface TransferParams {
  signer: TransactionSigner;
  kind: 'fixed' | 'recurring';
  delegationAddress: Address | string;
  /** Token owner the funds are pulled from. */
  delegator: Address | string;
  mint: Address | string;
  amount: bigint;
  /** Receiver owner; defaults to the caller. */
  destination?: Address | string;
}

export interface RevokeDelegationParams {
  signer: TransactionSigner;
  delegationAddress: Address | string;
  /** Rent receiver (defaults to the caller). */
  receiver?: Address | string;
}

export interface DelegationSummary {
  fixed: number;
  recurring: number;
  subscriptions: number;
  total: number;
}

export interface PlanInfo {
  address: string;
  owner: string;
  mint: string;
  amount: bigint;
  periodInSeconds: bigint;
  subscriberCount: number;
}
