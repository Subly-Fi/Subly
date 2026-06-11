import {
  createSolanaRpc,
  type Address,
  type GetProgramAccountsApi,
  type Rpc,
  type Signature,
  address,
} from '@solana/kit';
import { findAssociatedTokenPda, getCreateAssociatedTokenIdempotentInstruction } from '@solana-program/token';
import {
  subscriptionsProgram,
  fetchDelegationsByDelegator,
  fetchDelegationsByDelegatee,
  fetchPlansForOwner,
  fetchSubscriptionsForUser,
  fetchMaybePlan,
  fetchMaybeSubscriptionAuthority,
  findSubscriptionAuthorityPda,
  findSubscriptionDelegationPda,
  getInitSubscriptionAuthorityOverlayInstructionAsync,
  getRevokeSubscriptionAuthorityOverlayInstructionAsync,
  getSubscribeOverlayInstructionAsync,
  getCancelSubscriptionOverlayInstructionAsync,
  getCreateFixedDelegationOverlayInstructionAsync,
  getCreateRecurringDelegationOverlayInstructionAsync,
  getTransferFixedOverlayInstructionAsync,
  getTransferRecurringOverlayInstructionAsync,
  getTransferSubscriptionOverlayInstructionAsync,
  getRevokeDelegationOverlayInstruction,
  SUBSCRIPTIONS_PROGRAM_ADDRESS,
} from '@subscriptions/client';
import type {
  SublyConfig,
  DelegationSummary,
  PlanInfo,
  SubscribeParams,
  CancelSubscriptionParams,
  CreateFixedDelegationParams,
  CreateRecurringDelegationParams,
  TransferParams,
  RevokeDelegationParams,
  InitSubscriptionAuthorityParams,
} from './types';
import { sendAndConfirm, resolveTokenProgram, getChainTime, randomNonce, type SublyRpc } from './tx';

export class SublyClient {
  readonly rpcUrl: string;
  readonly programAddress: Address;
  private readonly _rpc: SublyRpc;

  constructor(config: SublyConfig) {
    this.rpcUrl = config.rpcUrl;
    this.programAddress = config.programAddress ? address(config.programAddress) : SUBSCRIPTIONS_PROGRAM_ADDRESS;
    this._rpc = createSolanaRpc(this.rpcUrl);
  }

  get rpc() {
    return this._rpc;
  }

  /** RPC typed for the generated fetch helpers (getProgramAccounts). */
  private get gpaRpc(): Rpc<GetProgramAccountsApi> {
    return this._rpc as unknown as Rpc<GetProgramAccountsApi>;
  }

  get program() {
    return subscriptionsProgram();
  }

  // ── Reads ────────────────────────────────────────────────────────────────

  async getDelegationSummary(wallet: Address): Promise<DelegationSummary> {
    const [outgoing, incoming] = await Promise.all([
      fetchDelegationsByDelegator(this.gpaRpc, wallet, this.programAddress),
      fetchDelegationsByDelegatee(this.gpaRpc, wallet, this.programAddress),
    ]);

    let fixed = 0;
    let recurring = 0;
    let subscriptions = 0;
    for (const d of [...outgoing, ...incoming]) {
      if (d.kind === 'fixed') fixed++;
      else if (d.kind === 'recurring') recurring++;
      else if (d.kind === 'subscription') subscriptions++;
    }

    return { fixed, recurring, subscriptions, total: fixed + recurring + subscriptions };
  }

  async getPlansForOwner(owner: Address): Promise<PlanInfo[]> {
    const plans = await fetchPlansForOwner(this.gpaRpc, owner, this.programAddress);
    return Promise.all(
      plans.map(async (p) => {
        // A plan's subscribers are delegations whose delegatee is the plan PDA.
        const subs = await fetchDelegationsByDelegatee(this.gpaRpc, p.address, this.programAddress);
        return {
          address: p.address,
          owner: p.data.owner,
          mint: p.data.data.mint,
          amount: p.data.data.terms.amount,
          periodInSeconds: p.data.data.terms.periodHours * 3600n,
          subscriberCount: subs.filter((s) => s.kind === 'subscription').length,
        };
      }),
    );
  }

  async getSubscriptionsForUser(wallet: Address) {
    return fetchSubscriptionsForUser(this.gpaRpc, wallet, this.programAddress);
  }

  async getDelegationsByDelegator(wallet: Address) {
    return fetchDelegationsByDelegator(this.gpaRpc, wallet, this.programAddress);
  }

  async getDelegationsByDelegatee(wallet: Address) {
    return fetchDelegationsByDelegatee(this.gpaRpc, wallet, this.programAddress);
  }

  // ── Writes ───────────────────────────────────────────────────────────────

  /**
   * Initializes the caller's SubscriptionAuthority for a mint (one-time SPL
   * Approve that lets the program pull future payments). Idempotent: returns null
   * if the authority already exists.
   */
  async initSubscriptionAuthority(params: InitSubscriptionAuthorityParams): Promise<Signature | null> {
    const mint = address(params.mint);
    const tokenProgram = await resolveTokenProgram(this._rpc, mint);
    const [authorityPda] = await findSubscriptionAuthorityPda(
      { tokenMint: mint, user: params.signer.address },
      { programAddress: this.programAddress },
    );
    const existing = await fetchMaybeSubscriptionAuthority(this._rpc, authorityPda);
    if (existing.exists) return null;

    const [userAta] = await findAssociatedTokenPda({ mint, owner: params.signer.address, tokenProgram });
    const ix = await getInitSubscriptionAuthorityOverlayInstructionAsync({
      owner: params.signer,
      programAddress: this.programAddress,
      tokenMint: mint,
      tokenProgram,
      userAta,
    });
    return sendAndConfirm(this._rpc, [ix], params.signer);
  }

  /**
   * Revokes the standing SPL/Token-2022 delegate approval granted by
   * initSubscriptionAuthority (owner-signed). Stops all future pull payments for
   * this mint and clears any approval left behind after closing the authority.
   * Added upstream as RevokeSubscriptionAuthority (program instruction 14).
   */
  async revokeSubscriptionAuthority(params: InitSubscriptionAuthorityParams): Promise<Signature> {
    const mint = address(params.mint);
    const tokenProgram = await resolveTokenProgram(this._rpc, mint);
    const ix = await getRevokeSubscriptionAuthorityOverlayInstructionAsync({
      programAddress: this.programAddress,
      tokenMint: mint,
      tokenProgram,
      user: params.signer,
    });
    return sendAndConfirm(this._rpc, [ix], params.signer);
  }

  /**
   * Subscribes the caller to a plan. Snapshots the live plan terms as consent
   * (anti "ghost plan"), and — unless disabled — first initializes the caller's
   * SubscriptionAuthority for the plan's mint in the same transaction.
   */
  async subscribe(params: SubscribeParams): Promise<Signature> {
    const planPda = address(params.planAddress);
    const plan = await fetchMaybePlan(this._rpc, planPda);
    if (!plan.exists) throw new Error(`Plan ${planPda} not found`);

    const mint = plan.data.data.mint;
    const tokenProgram = await resolveTokenProgram(this._rpc, mint);
    const instructions = [];

    if (params.autoInitAuthority !== false) {
      const [authorityPda] = await findSubscriptionAuthorityPda(
        { tokenMint: mint, user: params.signer.address },
        { programAddress: this.programAddress },
      );
      const existing = await fetchMaybeSubscriptionAuthority(this._rpc, authorityPda);
      if (!existing.exists) {
        const [userAta] = await findAssociatedTokenPda({ mint, owner: params.signer.address, tokenProgram });
        instructions.push(
          await getInitSubscriptionAuthorityOverlayInstructionAsync({
            owner: params.signer,
            programAddress: this.programAddress,
            tokenMint: mint,
            tokenProgram,
            userAta,
          }),
        );
      }
    }

    instructions.push(
      await getSubscribeOverlayInstructionAsync({
        expectedAmount: plan.data.data.terms.amount,
        expectedCreatedAt: plan.data.data.terms.createdAt,
        expectedPeriodHours: plan.data.data.terms.periodHours,
        merchant: plan.data.owner,
        planId: plan.data.data.planId,
        programAddress: this.programAddress,
        subscriber: params.signer,
        tokenMint: mint,
      }),
    );

    return sendAndConfirm(this._rpc, instructions, params.signer);
  }

  /** Cancels the caller's subscription to a plan (grace period to end of billing cycle). */
  async cancelSubscription(params: CancelSubscriptionParams): Promise<Signature> {
    const planPda = address(params.planAddress);
    const [subscriptionPda] = await findSubscriptionDelegationPda(
      { planPda, subscriber: params.signer.address },
      { programAddress: this.programAddress },
    );
    const ix = await getCancelSubscriptionOverlayInstructionAsync({
      planPda,
      programAddress: this.programAddress,
      subscriber: params.signer,
      subscriptionPda,
    });
    return sendAndConfirm(this._rpc, [ix], params.signer);
  }

  /** Creates a one-time capped delegation (fixed allowance, optional expiry). */
  async createFixedDelegation(params: CreateFixedDelegationParams): Promise<Signature> {
    const ix = await getCreateFixedDelegationOverlayInstructionAsync({
      amount: params.amount,
      delegatee: address(params.delegatee),
      delegator: params.signer,
      expiryTs: params.expiresAt ?? 0n,
      nonce: params.nonce ?? randomNonce(),
      programAddress: this.programAddress,
      tokenMint: address(params.mint),
    });
    return sendAndConfirm(this._rpc, [ix], params.signer);
  }

  /** Creates a per-period capped delegation (recurring budget that auto-resets). */
  async createRecurringDelegation(params: CreateRecurringDelegationParams): Promise<Signature> {
    const ix = await getCreateRecurringDelegationOverlayInstructionAsync({
      amountPerPeriod: params.amountPerPeriod,
      delegatee: address(params.delegatee),
      delegator: params.signer,
      expiryTs: params.expiresAt ?? 0n,
      nonce: params.nonce ?? randomNonce(),
      periodLengthS: params.periodInSeconds,
      programAddress: this.programAddress,
      startTs: params.startTs ?? (await getChainTime(this._rpc)),
      tokenMint: address(params.mint),
    });
    return sendAndConfirm(this._rpc, [ix], params.signer);
  }

  /** Pulls funds against a fixed or recurring delegation (caller must be the delegatee). */
  async transfer(params: TransferParams): Promise<Signature> {
    const mint = address(params.mint);
    const tokenProgram = await resolveTokenProgram(this._rpc, mint);
    const delegator = address(params.delegator);
    const [delegatorAta] = await findAssociatedTokenPda({ mint, owner: delegator, tokenProgram });

    const receiverOwner = params.destination ? address(params.destination) : params.signer.address;
    const [receiverAta] = await findAssociatedTokenPda({ mint, owner: receiverOwner, tokenProgram });

    const createAtaIx = getCreateAssociatedTokenIdempotentInstruction({
      ata: receiverAta,
      mint,
      owner: receiverOwner,
      payer: params.signer,
      tokenProgram,
    });

    const build =
      params.kind === 'recurring' ? getTransferRecurringOverlayInstructionAsync : getTransferFixedOverlayInstructionAsync;
    const transferIx = await build({
      amount: params.amount,
      delegatee: params.signer,
      delegationPda: address(params.delegationAddress),
      delegator,
      delegatorAta,
      programAddress: this.programAddress,
      receiverAta,
      tokenMint: mint,
      tokenProgram,
    });

    return sendAndConfirm(this._rpc, [createAtaIx, transferIx], params.signer);
  }

  /**
   * Pulls a subscription payment (caller must be the plan owner or an authorized
   * puller). This is the on-chain "collect" used by merchants and the Subly puller.
   */
  async transferSubscription(params: {
    signer: import('@solana/kit').TransactionSigner;
    planAddress: Address | string;
    subscriber: Address | string;
    amount: bigint;
    mint?: Address | string;
    receiver?: Address | string;
  }): Promise<Signature> {
    const planPda = address(params.planAddress as string);
    const subscriber = address(params.subscriber as string);

    let mint: Address;
    if (params.mint) {
      mint = address(params.mint as string);
    } else {
      const plan = await fetchMaybePlan(this._rpc, planPda);
      if (!plan.exists) throw new Error(`Plan ${planPda} not found`);
      mint = plan.data.data.mint;
    }
    const tokenProgram = await resolveTokenProgram(this._rpc, mint);

    const [subscriptionPda] = await findSubscriptionDelegationPda(
      { planPda, subscriber },
      { programAddress: this.programAddress },
    );
    const receiverOwner = params.receiver ? address(params.receiver as string) : params.signer.address;
    const [receiverAta] = await findAssociatedTokenPda({ mint, owner: receiverOwner, tokenProgram });

    const createAtaIx = getCreateAssociatedTokenIdempotentInstruction({
      ata: receiverAta,
      mint,
      owner: receiverOwner,
      payer: params.signer,
      tokenProgram,
    });

    const transferIx = await getTransferSubscriptionOverlayInstructionAsync({
      amount: params.amount,
      caller: params.signer,
      delegator: subscriber,
      planPda,
      programAddress: this.programAddress,
      receiverAta,
      subscriptionPda,
      tokenMint: mint,
      tokenProgram,
    });

    return sendAndConfirm(this._rpc, [createAtaIx, transferIx], params.signer);
  }

  /** Revokes (and closes) a delegation, reclaiming rent to the original payer. */
  async revokeDelegation(params: RevokeDelegationParams): Promise<Signature> {
    const receiver = params.receiver ? address(params.receiver) : undefined;
    const ix = getRevokeDelegationOverlayInstruction({
      authority: params.signer,
      delegationAccount: address(params.delegationAddress),
      programAddress: this.programAddress,
      receiver,
    });
    return sendAndConfirm(this._rpc, [ix], params.signer);
  }
}
