import { address } from '@solana/kit';
import { fetchMaybePlan } from '@subscriptions/client';
import { supabase } from '../lib/supabase';
import { rpc, PROGRAM_ADDRESS } from '../lib/solana';
import { dispatchMerchantWebhook } from '../lib/webhook-dispatcher';
import { decodeSublyEventFromBase58, SublyEventKind, type SublyEvent } from './events';

const POLL_INTERVAL_MS = 15_000;
const SIGNATURE_PAGE_LIMIT = 1000;
const PROGRAM_ID_STR = String(PROGRAM_ADDRESS);

let lastSignature: string | null = null;
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

  console.log('[indexer] Starting event listener for program:', PROGRAM_ID_STR);

  if (supabase) {
    const { data } = await supabase
      .from('indexer_state')
      .select('last_signature')
      .eq('program', PROGRAM_ID_STR)
      .single();
    if (data?.last_signature) {
      lastSignature = data.last_signature;
    }
  }

  poll();
}

async function poll() {
  if (!isRunning) return;
  try {
    if (!lastSignature) {
      lastSignature = await newestSignature(); // prime to now, no backfill
    } else {
      lastSignature = await indexOnce(lastSignature);
    }
  } catch (err) {
    console.error('[indexer] Poll error:', err);
  }
  setTimeout(poll, POLL_INTERVAL_MS);
}

// The subscriptions program is SHARED across all Solana users, so a cycle could
// see far more activity than just Subly's. Bound the work per serverless
// invocation to stay well under the function time limit; QStash drives the next
// cycle to catch up (cursor persisted incrementally so timeouts never lose it).
const MAX_TX_PER_CYCLE = 40;
const CURSOR_FLUSH_EVERY = 10;

async function persistCursor(cursor: string): Promise<void> {
  if (!supabase) return;
  await supabase.from('indexer_state').upsert(
    { program: PROGRAM_ID_STR, last_signature: cursor, updated_at: new Date().toISOString() },
    { onConflict: 'program' },
  );
}

/** Newest program signature, used to prime the cursor to "now" on first run. */
async function newestSignature(): Promise<string | null> {
  const sigs = (await rpc
    .getSignaturesForAddress(PROGRAM_ADDRESS, { limit: 1, commitment: 'confirmed' } as never)
    .send()) as unknown as RpcSignatureInfo[];
  return sigs[0]?.signature ?? null;
}

/**
 * Runs one bounded indexing cycle from a cursor and returns the advanced cursor.
 * Processes oldest -> newest (cursor only advances over fully-handled txs) and
 * persists incrementally, so a serverless timeout never loses progress
 * (handlers are idempotent upserts, so re-processing is safe).
 */
async function indexOnce(cursorIn: string): Promise<string> {
  const newestFirst = await collectNewSignatures(cursorIn);
  if (!newestFirst.length) return cursorIn;

  const ordered = [...newestFirst].reverse().slice(0, MAX_TX_PER_CYCLE);
  let cursor = cursorIn;
  let sinceFlush = 0;

  for (const sig of ordered) {
    if (sig.err) {
      cursor = sig.signature; // failed tx carries no committed events — safe to skip
    } else {
      try {
        await processTransaction(sig.signature);
        cursor = sig.signature;
      } catch (err) {
        console.error(`[indexer] Failed to process tx ${sig.signature}:`, err);
        break;
      }
    }
    if (++sinceFlush >= CURSOR_FLUSH_EVERY && cursor !== cursorIn) {
      await persistCursor(cursor);
      sinceFlush = 0;
    }
  }

  if (cursor !== cursorIn) await persistCursor(cursor);
  return cursor;
}

/**
 * One-shot indexing cycle for serverless cron. Loads the persisted cursor,
 * processes new transactions (bounded), and persists the advanced cursor.
 * First run: prime the cursor to the newest signature WITHOUT backfilling the
 * shared program's history (which would exceed the function time limit).
 */
export async function runIndexerCycle(): Promise<{ from: string | null; to: string | null; processed: boolean; primed?: boolean }> {
  let cursor: string | null = null;
  if (supabase) {
    const { data } = await supabase
      .from('indexer_state')
      .select('last_signature')
      .eq('program', PROGRAM_ID_STR)
      .single();
    cursor = data?.last_signature ?? null;
  }

  if (!cursor) {
    const newest = await newestSignature();
    if (newest) await persistCursor(newest);
    console.log(`[indexer] primed cursor to ${newest ?? '(none)'} — indexing forward from now`);
    return { from: null, to: newest, processed: false, primed: true };
  }

  const next = await indexOnce(cursor);
  return { from: cursor, to: next, processed: next !== cursor };
}

/**
 * Fetches all program signatures newer than `until` (newest-first), paginating
 * with `before` to drain bursts. On the first run (no cursor) only the most
 * recent page is taken so we begin indexing from "now" rather than backfilling
 * the program's entire history.
 */
async function collectNewSignatures(until: string | null): Promise<RpcSignatureInfo[]> {
  const all: RpcSignatureInfo[] = [];
  // Bounded scan: priming keeps backlogs small, and processing is capped per
  // cycle anyway, so a few pages is plenty (avoids draining a huge burst at once).
  const maxPages = until ? 3 : 1;
  let before: string | undefined;

  for (let page = 0; page < maxPages; page++) {
    const params: Record<string, unknown> = { limit: SIGNATURE_PAGE_LIMIT, commitment: 'confirmed' };
    if (until) params.until = until;
    if (before) params.before = before;

    const sigs = (await rpc
      .getSignaturesForAddress(PROGRAM_ADDRESS, params as never)
      .send()) as unknown as RpcSignatureInfo[];

    if (!sigs.length) break;
    all.push(...sigs);
    if (sigs.length < SIGNATURE_PAGE_LIMIT) break;
    before = sigs[sigs.length - 1].signature;
  }

  return all;
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

// Subly-specific filter. The subscriptions program is shared across all Solana
// users, so we only index plans that authorize the Subly collector ("puller").
// Set from SUBLY_SIGNER_ADDRESS; if unset we fall back to indexing everything.
const SUBLY_SIGNER = process.env.SUBLY_SIGNER_ADDRESS?.trim() || null;
// Per-instance cache: plan address -> owner wallet (Subly plan) or false (not ours).
const planClassCache = new Map<string, string | false>();

/**
 * Returns the merchant (plan owner) wallet ONLY for Subly plans — those whose
 * `pullers` include the Subly collector. Returns null for other merchants' plans
 * (so they are skipped) and for non-existent plans. Reads the local `plans`
 * mirror first (which only ever holds Subly plans); on a miss, fetches the Plan
 * on-chain, checks the puller, and mirrors it if it's ours.
 *
 * Throws on RPC/DB failure so the caller leaves the cursor put and retries next
 * cycle (never silently dropping a real Subly event).
 */
async function resolveSublyPlanOwner(planAddress: string): Promise<string | null> {
  const cached = planClassCache.get(planAddress);
  if (cached !== undefined) return cached === false ? null : cached;

  const { data: planRow } = await supabase!
    .from('plans')
    .select('merchant_wallet')
    .eq('address', planAddress)
    .single();
  if (planRow?.merchant_wallet) {
    planClassCache.set(planAddress, planRow.merchant_wallet);
    return planRow.merchant_wallet;
  }

  const maybe = await fetchMaybePlan(rpc as never, address(planAddress));
  if (!maybe.exists) {
    planClassCache.set(planAddress, false);
    return null;
  }

  const plan = maybe.data;
  const owner = String(plan.owner);

  // The defining Subly check: is the Subly collector an authorized puller?
  const pullers = (plan.data.pullers ?? []).map((p) => String(p));
  const isSubly = SUBLY_SIGNER ? pullers.includes(SUBLY_SIGNER) : true;
  if (!isSubly) {
    planClassCache.set(planAddress, false);
    return null;
  }

  const status = plan.status === 1 ? 'active' : 'sunset';
  await supabase!.from('plans').upsert(
    {
      address: planAddress,
      merchant_wallet: owner,
      mint: String(plan.data.mint),
      amount: plan.data.terms.amount.toString(),
      period_hours: Number(plan.data.terms.periodHours),
      status,
      on_chain_status: status,
      plan_id: plan.data.planId.toString(),
      metadata_uri: plan.data.metadataUri || null,
    },
    { onConflict: 'address' },
  );
  planClassCache.set(planAddress, owner);
  return owner;
}

export function stopEventListener() {
  isRunning = false;
}
