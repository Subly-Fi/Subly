import {
  type GetProgramAccountsApi,
  type Rpc,
  type Signature,
  createSolanaRpc,
  address,
  pipe,
  createTransactionMessage,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions,
  signTransactionMessageWithSigners,
  getSignatureFromTransaction,
  getBase64EncodedWireTransaction,
} from '@solana/kit';
import {
  getTransferSubscriptionOverlayInstructionAsync,
  findSubscriptionDelegationPda,
} from '@subscriptions/client';
import { findAssociatedTokenPda, getCreateAssociatedTokenIdempotentInstruction } from '@solana-program/token';
import { supabase } from '../lib/supabase';
import { getSublySignerWallet, PROGRAM_ADDRESS, rpc } from '../lib/solana';
import { dispatchMerchantWebhook } from '../lib/webhook-dispatcher';

/**
 * Resolves the owning token program (SPL Token vs Token-2022) for a mint by
 * reading the mint account's owner. Cached per process — a mint's owner can
 * never change.
 */
const tokenProgramCache = new Map<string, ReturnType<typeof address>>();
async function resolveTokenProgram(mint: ReturnType<typeof address>) {
  const cached = tokenProgramCache.get(String(mint));
  if (cached) return cached;
  const info = await rpc.getAccountInfo(mint, { encoding: 'base64' }).send();
  if (!info.value) throw new Error(`Mint ${mint} not found on-chain`);
  const owner = address(String(info.value.owner));
  tokenProgramCache.set(String(mint), owner);
  return owner;
}

/** Mark a subscription as payment_failed after this many consecutive failures. */
const MAX_CONSECUTIVE_FAILURES = 3;
const CONFIRM_TIMEOUT_MS = 30_000;
const CONFIRM_INTERVAL_MS = 2_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface CollectionResult {
  planAddress: string;
  subscriberWallet: string;
  success: boolean;
  txSignature?: string;
  error?: string;
}

interface SubscriptionRow {
  subscriber_wallet: string;
  current_period_start: string | null;
  last_payment_at: string | null;
  consecutive_failures: number | null;
}

/**
 * Authoritative "now" = chain clock, not wall clock. The on-chain program
 * enforces periods against chain time; using the same clock keeps eligibility
 * consistent (and makes localnet time-travel demos work). Falls back to wall
 * time if block time is unavailable.
 */
async function getChainNow(): Promise<number> {
  try {
    const slot = await rpc.getSlot({ commitment: 'confirmed' }).send();
    const time = await rpc.getBlockTime(slot).send();
    if (time != null) return Number(time);
  } catch (err) {
    console.warn('[cron] Failed to read chain time, falling back to wall clock:', err);
  }
  return Math.floor(Date.now() / 1000);
}

export async function runPaymentCollection(): Promise<CollectionResult[]> {
  console.log('[cron] Starting payment collection cycle...');
  const results: CollectionResult[] = [];

  if (!supabase) {
    console.warn('[cron] Supabase not configured, skipping collection');
    return results;
  }

  const { data: plans } = await supabase
    .from('plans')
    .select('address, merchant_wallet, mint, amount, period_hours')
    .eq('status', 'active');

  if (!plans?.length) {
    console.log('[cron] No active plans found');
    return results;
  }

  const signer = await getSublySignerWallet();
  const typedRpc = rpc as unknown as Rpc<GetProgramAccountsApi>;

  for (const plan of plans) {
    try {
      const planResults = await collectForPlan(
        typedRpc,
        signer,
        plan as { address: string; merchant_wallet: string; mint: string; amount: number; period_hours: number },
      );
      results.push(...planResults);
    } catch (err) {
      console.error(`[cron] Failed to process plan ${plan.address}:`, err);
    }
  }

  console.log(
    `[cron] Collection cycle complete. ${results.length} attempts, ${results.filter((r) => r.success).length} successful.`,
  );
  return results;
}

async function collectForPlan(
  _typedRpc: Rpc<GetProgramAccountsApi>,
  signer: Awaited<ReturnType<typeof getSublySignerWallet>>,
  plan: { address: string; merchant_wallet: string; mint: string; amount: number; period_hours: number },
): Promise<CollectionResult[]> {
  const results: CollectionResult[] = [];
  const planAddr = address(plan.address);
  const mintAddr = address(plan.mint);
  const merchantAddr = address(plan.merchant_wallet);
  const tokenProgram = await resolveTokenProgram(mintAddr);
  const periodSeconds = plan.period_hours * 3600;
  const now = await getChainNow();

  const { data: subs } = await supabase!
    .from('subscriptions')
    .select('subscriber_wallet, current_period_start, last_payment_at, consecutive_failures')
    .eq('plan_address', plan.address)
    .eq('status', 'active');

  if (!subs?.length) return results;

  for (const sub of subs as SubscriptionRow[]) {
    const subscriberAddr = address(sub.subscriber_wallet);
    const periodStart = sub.current_period_start
      ? Math.floor(new Date(sub.current_period_start).getTime() / 1000)
      : 0;

    const isEligible = periodStart === 0 || now - periodStart >= periodSeconds;
    if (!isEligible) continue;

    try {
      const [subscriptionPda] = await findSubscriptionDelegationPda(
        { planPda: planAddr, subscriber: subscriberAddr },
        { programAddress: PROGRAM_ADDRESS },
      );

      const [receiverAta] = await findAssociatedTokenPda({
        mint: mintAddr,
        owner: merchantAddr,
        tokenProgram,
      });

      // Ensure the merchant's destination token account exists. A merchant that
      // has never held this mint has no ATA, so the transfer would fail with
      // INVALID_TOKEN_SPL_TOKEN_ACCOUNT_DATA (0x6e). Idempotent: a no-op if the
      // ATA already exists. Subly's signer pays the (one-time) rent.
      const createReceiverAtaIx = getCreateAssociatedTokenIdempotentInstruction({
        ata: receiverAta,
        mint: mintAddr,
        owner: merchantAddr,
        payer: signer,
        tokenProgram,
      });

      const instruction = await getTransferSubscriptionOverlayInstructionAsync({
        amount: BigInt(plan.amount),
        caller: signer,
        delegator: subscriberAddr,
        planPda: planAddr,
        receiverAta,
        subscriptionPda,
        tokenMint: mintAddr,
        tokenProgram,
        programAddress: PROGRAM_ADDRESS,
      });

      const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

      const txMessage = pipe(
        createTransactionMessage({ version: 0 }),
        (m) => setTransactionMessageFeePayerSigner(signer, m),
        (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
        (m) => appendTransactionMessageInstructions([createReceiverAtaIx, instruction], m),
      );

      const signedTx = await signTransactionMessageWithSigners(txMessage);
      const signature = getSignatureFromTransaction(signedTx);

      await rpc
        .sendTransaction(getBase64EncodedWireTransaction(signedTx), {
          encoding: 'base64',
          skipPreflight: false,
          preflightCommitment: 'confirmed',
          maxRetries: 3n,
        })
        .send();

      // Do not record success until the transfer is actually confirmed on-chain.
      const confirmation = await confirmTransaction(signature);
      if (!confirmation.ok) {
        throw new Error(confirmation.reason ?? 'transaction not confirmed');
      }

      await recordSuccess(plan, sub, signature, now);

      results.push({
        planAddress: plan.address,
        subscriberWallet: sub.subscriber_wallet,
        success: true,
        txSignature: String(signature),
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      await recordFailure(plan, sub, errorMsg, now);

      results.push({
        planAddress: plan.address,
        subscriberWallet: sub.subscriber_wallet,
        success: false,
        error: errorMsg,
      });
    }
  }

  return results;
}

/** Polls signature status until confirmed/finalized, on-chain error, or timeout. */
async function confirmTransaction(signature: Signature): Promise<{ ok: boolean; reason?: string }> {
  const deadline = Date.now() + CONFIRM_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const { value } = await rpc.getSignatureStatuses([signature], { searchTransactionHistory: false }).send();
    const status = value[0];
    if (status) {
      if (status.err) return { ok: false, reason: `on-chain error: ${JSON.stringify(status.err)}` };
      if (status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized') {
        return { ok: true };
      }
    }
    await sleep(CONFIRM_INTERVAL_MS);
  }
  return { ok: false, reason: 'confirmation timeout' };
}

async function recordSuccess(
  plan: { address: string; merchant_wallet: string; mint: string; amount: number },
  sub: SubscriptionRow,
  signature: Signature,
  now: number,
) {
  // Upsert on tx_signature so this row and the indexer's mirror of the same
  // on-chain transfer collapse into one (no double-counted revenue).
  await supabase!.from('payments').upsert(
    {
      plan_address: plan.address,
      subscriber_wallet: sub.subscriber_wallet,
      merchant_wallet: plan.merchant_wallet,
      amount: plan.amount.toString(),
      mint: plan.mint,
      tx_signature: String(signature),
      status: 'success',
    },
    { onConflict: 'tx_signature' },
  );

  await supabase!
    .from('subscriptions')
    .update({
      status: 'active',
      last_payment_at: new Date(now * 1000).toISOString(),
      current_period_start: new Date(now * 1000).toISOString(),
      consecutive_failures: 0,
    })
    .eq('plan_address', plan.address)
    .eq('subscriber_wallet', sub.subscriber_wallet);

  await dispatchMerchantWebhook(plan.merchant_wallet, {
    type: 'payment.received',
    data: {
      planAddress: plan.address,
      subscriberWallet: sub.subscriber_wallet,
      amount: plan.amount.toString(),
      mint: plan.mint,
      txSignature: String(signature),
    },
    timestamp: now,
  });
}

async function recordFailure(
  plan: { address: string; merchant_wallet: string; mint: string; amount: number },
  sub: SubscriptionRow,
  errorMsg: string,
  now: number,
) {
  const failures = (sub.consecutive_failures ?? 0) + 1;

  await supabase!.from('payments').insert({
    plan_address: plan.address,
    subscriber_wallet: sub.subscriber_wallet,
    merchant_wallet: plan.merchant_wallet,
    amount: plan.amount.toString(),
    mint: plan.mint,
    status: 'failed',
    failure_reason: errorMsg,
  });

  // Advance the failure counter but DO NOT advance the billing period — the
  // subscriber stays due and is retried next cycle (the on-chain per-period cap
  // prevents a double charge if a "timed out" tx actually landed).
  const update: Record<string, unknown> = { consecutive_failures: failures };
  if (failures >= MAX_CONSECUTIVE_FAILURES) {
    update.status = 'payment_failed';
  }

  await supabase!
    .from('subscriptions')
    .update(update)
    .eq('plan_address', plan.address)
    .eq('subscriber_wallet', sub.subscriber_wallet);

  await dispatchMerchantWebhook(plan.merchant_wallet, {
    type: 'payment.failed',
    data: {
      planAddress: plan.address,
      subscriberWallet: sub.subscriber_wallet,
      amount: plan.amount.toString(),
      mint: plan.mint,
      failureReason: errorMsg,
      consecutiveFailures: failures,
    },
    timestamp: now,
  });
}
