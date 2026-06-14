import { address } from '@solana/kit';
import { supabase } from '../lib/supabase';
import { rpc, PROGRAM_ADDRESS } from '../lib/solana';
import { dispatchMerchantWebhook } from '../lib/webhook-dispatcher';
import { decodeSublyEventFromBase58, SublyEventKind, type SublyEvent } from './events';

const POLL_INTERVAL_MS = 30_000;
const SIGNATURE_PAGE_LIMIT = 1000;
const PROGRAM_ID_STR = String(PROGRAM_ADDRESS);
// Per-cycle bounds so a serverless invocation stays well under the time limit.
const MAX_PAGES_PER_PLAN = 5; // a plan's own history is small; cap anyway
const MAX_TX_PER_PLAN = 40;
const MAX_TX_PER_CYCLE = 200;
const CURSOR_FLUSH_EVERY = 10;

let isRunning = false;

// ---------------------------------------------------------------------------
// RPC response shapes (encoding: 'json') — typed loosely, accessed defensively.
// ---------------------------------------------------------------------------
interface RpcCompiledInstruction {
  programIdIndex: number;
  accounts: number[];
  data: string; // base58
}
interface RpcTransactionJson {
  blockTime?: number | null;
  meta?: {
    err: unknown;
    innerInstructions?: { index: number; instructions: RpcCompiledInstruction[] }[];
    loadedAddresses?: { writable: string[]; readonly: string[] };
  } | null;
  transaction?: {
    message?: { accountKeys?: string[]; instructions?: RpcCompiledInstruction[] };
  };
}
interface RpcSignatureInfo {
  signature: string;
  err: unknown;
  blockTime?: number | null;
}

export async function startEventListener() {
  if (isRunning) return;
  isRunning = true;
  console.log('[indexer] Starting per-plan event listener');
  poll();
}

async function poll() {
  if (!isRunning) return;
  try {
    await runIndexerCycle();
  } catch (err) {
    console.error('[indexer] Poll error:', err);
  }
  setTimeout(poll, POLL_INTERVAL_MS);
}

// ── Per-plan cursor storage (plan_index_state) ─────────────────────────────
async function loadPlanCursor(planAddress: string): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase
    .from('plan_index_state')
    .select('last_signature')
    .eq('plan_address', planAddress)
    .single();
  return data?.last_signature ?? null;
}

async function persistPlanCursor(planAddress: string, sig: string): Promise<void> {
  if (!supabase) return;
  await supabase.from('plan_index_state').upsert(
    { plan_address: planAddress, last_signature: sig, updated_at: new Date().toISOString() },
    { onConflict: 'plan_address' },
  );
}

/**
 * Fetches one plan PDA's signatures newer than `until` (newest-first). A plan's
 * own history is small, so a few pages is plenty. With no cursor we backfill the
 * plan's full history, capturing any subscriptions made before it was registered.
 */
async function collectPlanSignatures(planAddress: string, until: string | null): Promise<RpcSignatureInfo[]> {
  const all: RpcSignatureInfo[] = [];
  let before: string | undefined;
  for (let page = 0; page < MAX_PAGES_PER_PLAN; page++) {
    const params: Record<string, unknown> = { limit: SIGNATURE_PAGE_LIMIT, commitment: 'confirmed' };
    if (until) params.until = until;
    if (before) params.before = before;
    const sigs = (await rpc
      .getSignaturesForAddress(address(planAddress), params as never)
      .send()) as unknown as RpcSignatureInfo[];
    if (!sigs.length) break;
    all.push(...sigs);
    if (sigs.length < SIGNATURE_PAGE_LIMIT) break;
    before = sigs[sigs.length - 1].signature;
  }
  return all;
}

/** Oldest-first, capped batch from a newest-first signature list. Pure (tested). */
export function selectIndexBatch<T>(newestFirst: readonly T[], cap: number): T[] {
  return [...newestFirst].reverse().slice(0, cap);
}

/** Injected dependencies so the per-plan orchestrator is unit-testable. */
export interface PlanIndexDeps {
  loadCursor(plan: string): Promise<string | null>;
  collectSignatures(plan: string, until: string | null): Promise<RpcSignatureInfo[]>;
  process(signature: string): Promise<void>;
  saveCursor(plan: string, sig: string): Promise<void>;
  cap: number;
  flushEvery: number;
}

/**
 * Indexes one plan: load cursor → collect new signatures → process oldest→newest,
 * capped, advancing & flushing the cursor incrementally so a timeout never loses
 * progress (handlers are idempotent upserts). RPC/DB are injected via `deps`.
 */
export async function indexPlanCore(
  deps: PlanIndexDeps,
  planAddress: string,
): Promise<{ seen: number; processed: number; to: string | null }> {
  const cursor = await deps.loadCursor(planAddress);
  const newestFirst = await deps.collectSignatures(planAddress, cursor);
  const seen = newestFirst.length;
  if (!seen) return { seen: 0, processed: 0, to: cursor };

  const batch = selectIndexBatch(newestFirst, deps.cap);
  let cur = cursor;
  let processed = 0;
  let sinceFlush = 0;

  for (const sig of batch) {
    if (sig.err) {
      cur = sig.signature; // failed tx carries no committed events — safe to skip
    } else {
      try {
        await deps.process(sig.signature);
        cur = sig.signature;
        processed++;
      } catch (err) {
        console.error(`[indexer] Failed to process tx ${sig.signature}:`, err);
        break;
      }
    }
    if (++sinceFlush >= deps.flushEvery && cur && cur !== cursor) {
      await deps.saveCursor(planAddress, cur);
      sinceFlush = 0;
    }
  }

  if (cur && cur !== cursor) await deps.saveCursor(planAddress, cur);
  return { seen, processed, to: cur };
}

function realDeps(cap: number): PlanIndexDeps {
  return {
    loadCursor: loadPlanCursor,
    collectSignatures: collectPlanSignatures,
    process: processTransaction,
    saveCursor: persistPlanCursor,
    cap,
    flushEvery: CURSOR_FLUSH_EVERY,
  };
}

/**
 * One indexing cycle: poll every registered Subly plan PDA. Cost scales with
 * Subly's own plans (zero plans → one DB read, zero RPC). Work is bounded across
 * plans per cycle; each plan is isolated, so one plan's failure leaves its cursor
 * put (retried next cycle) without blocking the others.
 */
export async function runIndexerCycle(): Promise<{ plans: number; seen: number; processed: number }> {
  if (!supabase) return { plans: 0, seen: 0, processed: 0 };

  const { data: plans } = await supabase.from('plans').select('address').neq('status', 'deleted');
  const list = plans ?? [];
  let totalSeen = 0;
  let totalProcessed = 0;
  let budget = MAX_TX_PER_CYCLE;

  for (const { address: planAddress } of list) {
    if (budget <= 0) break;
    try {
      const r = await indexPlanCore(realDeps(Math.min(MAX_TX_PER_PLAN, budget)), planAddress);
      totalSeen += r.seen;
      totalProcessed += r.processed;
      budget -= r.processed;
    } catch (err) {
      console.error(`[indexer] plan ${planAddress} cycle failed:`, err);
    }
  }

  console.log(`[indexer][metric] plans=${list.length} seen=${totalSeen} processed=${totalProcessed}`);
  return { plans: list.length, seen: totalSeen, processed: totalProcessed };
}

async function processTransaction(signature: string) {
  const tx = (await rpc
    .getTransaction(signature as never, {
      maxSupportedTransactionVersion: 0,
      commitment: 'confirmed',
      encoding: 'json',
    } as never)
    .send()) as unknown as RpcTransactionJson | null;

  if (!tx || tx.meta?.err) return;

  const blockTime = typeof tx.blockTime === 'number' ? tx.blockTime : Math.floor(Date.now() / 1000);

  for (const event of extractEvents(tx)) {
    await handleEvent(event, signature, blockTime);
  }
}

/** Resolves all account keys for a json-encoded tx (static + LUT-loaded). */
function resolveAccountKeys(tx: RpcTransactionJson): string[] {
  const staticKeys = tx.transaction?.message?.accountKeys ?? [];
  const loaded = tx.meta?.loadedAddresses;
  return [...staticKeys, ...(loaded?.writable ?? []), ...(loaded?.readonly ?? [])];
}

/**
 * Extracts subscriptions-program events from a transaction by scanning inner
 * (self-CPI) and outer instructions for data beginning with the event tag.
 */
function extractEvents(tx: RpcTransactionJson): SublyEvent[] {
  const keys = resolveAccountKeys(tx);
  const candidates: RpcCompiledInstruction[] = [];
  for (const group of tx.meta?.innerInstructions ?? []) candidates.push(...group.instructions);
  for (const ix of tx.transaction?.message?.instructions ?? []) candidates.push(ix);

  const events: SublyEvent[] = [];
  for (const ix of candidates) {
    if (!ix?.data) continue;
    // Best-effort program check; the 8-byte tag is the primary discriminant.
    const programId = keys[ix.programIdIndex];
    if (programId && programId !== PROGRAM_ID_STR) continue;
    const event = decodeSublyEventFromBase58(ix.data);
    if (event) events.push(event);
  }
  return events;
}

// ---------------------------------------------------------------------------
// Handlers — every field comes straight from the decoded event payload.
// ---------------------------------------------------------------------------

function tsToIso(seconds: number): string | null {
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(seconds * 1000).toISOString();
}

async function handleEvent(event: SublyEvent, signature: string, blockTime: number) {
  if (!supabase) return;
  switch (event.kind) {
    case SublyEventKind.SubscriptionCreated:
      return handleCreated(event, signature);
    case SublyEventKind.SubscriptionCancelled:
      return handleCancelled(event, signature);
    case SublyEventKind.SubscriptionResumed:
      return handleResumed(event, signature);
    case SublyEventKind.SubscriptionTransfer:
      return handleSubscriptionTransfer(event, signature, blockTime);
    case SublyEventKind.FixedTransfer:
    case SublyEventKind.RecurringTransfer:
      return handleDelegationTransfer(event, signature);
  }
}

async function handleCreated(
  event: Extract<SublyEvent, { kind: SublyEventKind.SubscriptionCreated }>,
  signature: string,
) {
  const merchant = await resolveSublyPlanOwner(event.plan);
  if (!merchant) return; // not a Subly plan — skip

  await supabase!.from('subscriptions').upsert(
    {
      plan_address: event.plan,
      subscriber_wallet: event.subscriber,
      status: 'active',
      current_period_start: tsToIso(event.createdTs),
    },
    { onConflict: 'plan_address,subscriber_wallet' },
  );

  await supabase!.from('subscription_events').insert({
    event_type: 'created',
    plan_address: event.plan,
    subscriber_wallet: event.subscriber,
    merchant_wallet: merchant,
    mint: event.mint,
    tx_signature: signature,
  });

  if (merchant) {
    await dispatchMerchantWebhook(merchant, {
      type: 'subscription.created',
      data: { planAddress: event.plan, subscriberWallet: event.subscriber, mint: event.mint, txSignature: signature },
      timestamp: event.createdTs,
    });
  }
  console.log(`[indexer] created: ${event.subscriber} -> ${event.plan}`);
}

async function handleCancelled(
  event: Extract<SublyEvent, { kind: SublyEventKind.SubscriptionCancelled }>,
  signature: string,
) {
  const merchant = await resolveSublyPlanOwner(event.plan);
  if (!merchant) return; // not a Subly plan — skip

  await supabase!
    .from('subscriptions')
    .update({ status: 'cancelled', expires_at: tsToIso(event.expiresAtTs) })
    .eq('plan_address', event.plan)
    .eq('subscriber_wallet', event.subscriber);

  await supabase!.from('subscription_events').insert({
    event_type: 'cancelled',
    plan_address: event.plan,
    subscriber_wallet: event.subscriber,
    merchant_wallet: merchant,
    tx_signature: signature,
  });

  if (merchant) {
    await dispatchMerchantWebhook(merchant, {
      type: 'subscription.cancelled',
      data: { planAddress: event.plan, subscriberWallet: event.subscriber, expiresAt: tsToIso(event.expiresAtTs), txSignature: signature },
      timestamp: event.expiresAtTs,
    });
  }
  console.log(`[indexer] cancelled: ${event.subscriber} -> ${event.plan}`);
}

async function handleResumed(
  event: Extract<SublyEvent, { kind: SublyEventKind.SubscriptionResumed }>,
  signature: string,
) {
  const merchant = await resolveSublyPlanOwner(event.plan);
  if (!merchant) return; // not a Subly plan — skip

  await supabase!
    .from('subscriptions')
    .update({ status: 'active', expires_at: null })
    .eq('plan_address', event.plan)
    .eq('subscriber_wallet', event.subscriber);

  await supabase!.from('subscription_events').insert({
    event_type: 'resumed',
    plan_address: event.plan,
    subscriber_wallet: event.subscriber,
    merchant_wallet: merchant,
    tx_signature: signature,
  });

  if (merchant) {
    await dispatchMerchantWebhook(merchant, {
      type: 'subscription.resumed',
      data: { planAddress: event.plan, subscriberWallet: event.subscriber, txSignature: signature },
      timestamp: event.resumedTs,
    });
  }
  console.log(`[indexer] resumed: ${event.subscriber} -> ${event.plan}`);
}

async function handleSubscriptionTransfer(
  event: Extract<SublyEvent, { kind: SublyEventKind.SubscriptionTransfer }>,
  signature: string,
  blockTime: number,
) {
  const merchant = await resolveSublyPlanOwner(event.plan);
  if (!merchant) return; // not a Subly plan — skip

  // Upsert on tx_signature so this and the cron collector's row for the same
  // on-chain transfer collapse into one (no double-counted revenue).
  await supabase!.from('payments').upsert(
    {
      plan_address: event.plan,
      subscriber_wallet: event.delegator,
      merchant_wallet: merchant,
      amount: event.amount.toString(),
      mint: event.mint,
      tx_signature: signature,
      status: 'success',
    },
    { onConflict: 'tx_signature' },
  );

  await supabase!
    .from('subscriptions')
    .update({
      status: 'active',
      last_payment_at: tsToIso(blockTime),
      current_period_start: tsToIso(event.periodStartTs),
      consecutive_failures: 0,
    })
    .eq('plan_address', event.plan)
    .eq('subscriber_wallet', event.delegator);

  await supabase!.from('subscription_events').insert({
    event_type: 'transfer',
    plan_address: event.plan,
    subscriber_wallet: event.delegator,
    merchant_wallet: merchant,
    mint: event.mint,
    amount: event.amount.toString(),
    tx_signature: signature,
  });

  if (merchant) {
    await dispatchMerchantWebhook(merchant, {
      type: 'payment.received',
      data: {
        planAddress: event.plan,
        subscriberWallet: event.delegator,
        amount: event.amount.toString(),
        mint: event.mint,
        receiver: event.receiver,
        txSignature: signature,
      },
      timestamp: blockTime,
    });
  }
  console.log(`[indexer] transfer: ${event.delegator} -> ${event.plan} (${event.amount})`);
}

/**
 * Fixed/Recurring delegation pulls have no plan; record them as merchant-less
 * payments keyed by the delegatee (the authorized puller / merchant-equivalent).
 */
async function handleDelegationTransfer(
  event: Extract<SublyEvent, { kind: SublyEventKind.FixedTransfer | SublyEventKind.RecurringTransfer }>,
  signature: string,
) {
  // Subly-specific: raw delegation pulls aren't part of the subscription-plan
  // product; only record ones the Subly collector itself made.
  if (SUBLY_SIGNER && String(event.delegatee) !== SUBLY_SIGNER) return;

  await supabase!.from('payments').upsert(
    {
      plan_address: null,
      subscriber_wallet: event.delegator,
      merchant_wallet: event.delegatee,
      amount: event.amount.toString(),
      mint: event.mint,
      tx_signature: signature,
      status: 'success',
    },
    { onConflict: 'tx_signature' },
  );

  await dispatchMerchantWebhook(event.delegatee, {
    type: 'payment.received',
    data: {
      delegation: event.delegation,
      subscriberWallet: event.delegator,
      amount: event.amount.toString(),
      mint: event.mint,
      receiver: event.receiver,
      txSignature: signature,
    },
    timestamp: Math.floor(Date.now() / 1000),
  });
  console.log(`[indexer] delegation transfer: ${event.delegator} -> ${event.delegatee} (${event.amount})`);
}

// The Subly collector address; used to filter raw delegation pulls (subscription
// plans are already filtered by polling only registered plan PDAs).
const SUBLY_SIGNER = process.env.SUBLY_SIGNER_ADDRESS?.trim() || null;
// Per-instance cache: plan address -> owner wallet, or false if not a Subly plan.
const planOwnerCache = new Map<string, string | false>();

/**
 * Returns the merchant (plan owner) wallet for a plan, read from the `plans`
 * mirror. Plans are written there at registration (POST /merchants/plans/sync),
 * so a registered Subly plan resolves to its owner; anything else (e.g. a
 * stranger's plan that appeared in a multi-plan tx) resolves to null and is
 * skipped. No RPC — purely a cached DB lookup.
 */
async function resolveSublyPlanOwner(planAddress: string): Promise<string | null> {
  const cached = planOwnerCache.get(planAddress);
  if (cached !== undefined) return cached === false ? null : cached;

  const { data } = await supabase!
    .from('plans')
    .select('merchant_wallet')
    .eq('address', planAddress)
    .single();
  const owner = data?.merchant_wallet ?? null;
  planOwnerCache.set(planAddress, owner ?? false);
  return owner;
}

export function stopEventListener() {
  isRunning = false;
}
