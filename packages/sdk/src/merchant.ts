import { type Address, type TransactionSigner, address, createSolanaRpc } from '@solana/kit';
import {
  getCreatePlanOverlayInstructionAsync,
  getUpdatePlanOverlayInstruction,
  fetchMaybePlan,
  SUBSCRIPTIONS_PROGRAM_ADDRESS,
  ZERO_ADDRESS,
  type PlanStatus,
} from '@subscriptions/client';
import { sendAndConfirm, type SublyRpc } from './tx';

const TOKEN_PROGRAM = address('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

export interface CreatePlanOptions {
  rpcUrl: string;
  owner: TransactionSigner;
  mint: Address;
  amount: bigint;
  periodHours: bigint;
  planId: bigint;
  metadataUri?: string;
  destinations?: Address[];
  pullers?: Address[];
  endTs?: bigint;
  programAddress?: Address;
}

export async function createPlan(opts: CreatePlanOptions) {
  const progAddr = opts.programAddress ?? SUBSCRIPTIONS_PROGRAM_ADDRESS;
  const pullers = padArray(opts.pullers ?? [], 4);
  const destinations = padArray(opts.destinations ?? [], 4);

  const ix = await getCreatePlanOverlayInstructionAsync({
    owner: opts.owner,
    mint: opts.mint,
    amount: opts.amount,
    periodHours: opts.periodHours,
    planId: opts.planId,
    metadataUri: opts.metadataUri ?? '',
    destinations,
    pullers,
    endTs: opts.endTs ?? 0n,
    tokenProgram: TOKEN_PROGRAM,
    programAddress: progAddr,
  });

  const rpc = createSolanaRpc(opts.rpcUrl) as SublyRpc;
  return sendAndConfirm(rpc, [ix], opts.owner);
}

export interface CreatePlanWithSublyPullerOptions extends CreatePlanOptions {
  sublyPullerAddress: string;
}

export async function createPlanWithSublyPuller(opts: CreatePlanWithSublyPullerOptions) {
  const sublyAddr = address(opts.sublyPullerAddress);
  // Dedup so the Subly puller is never listed twice.
  const existingPullers = (opts.pullers ?? []).filter((a) => a !== sublyAddr);
  const pullers = [sublyAddr, ...existingPullers].slice(0, 4);

  return createPlan({ ...opts, pullers });
}

export interface AddSublyPullerOptions {
  rpcUrl: string;
  owner: TransactionSigner;
  planPda: Address;
  sublyPullerAddress: string;
  programAddress?: Address;
}

/**
 * Adds the Subly puller to an existing plan, preserving the plan's current
 * status, end timestamp, metadata, and other pullers (an update_plan call
 * overwrites all of these, so they must be read back from chain first).
 */
export async function addSublyPuller(opts: AddSublyPullerOptions) {
  const progAddr = opts.programAddress ?? SUBSCRIPTIONS_PROGRAM_ADDRESS;
  const sublyAddr = address(opts.sublyPullerAddress);
  const rpc = createSolanaRpc(opts.rpcUrl) as SublyRpc;

  const plan = await fetchMaybePlan(rpc, opts.planPda);
  if (!plan.exists) throw new Error(`Plan ${opts.planPda} not found`);

  const existing = plan.data.data.pullers.filter((p) => p !== ZERO_ADDRESS && p !== sublyAddr);
  const pullers = [sublyAddr, ...existing].slice(0, 4);

  const ix = getUpdatePlanOverlayInstruction({
    owner: opts.owner,
    planPda: opts.planPda,
    status: plan.data.status as PlanStatus,
    endTs: plan.data.data.endTs,
    metadataUri: plan.data.data.metadataUri,
    pullers,
    programAddress: progAddr,
  });

  return sendAndConfirm(rpc, [ix], opts.owner);
}

function padArray(arr: Address[], size: number): Address[] {
  const result = [...arr];
  while (result.length < size) {
    result.push(ZERO_ADDRESS);
  }
  return result.slice(0, size);
}
