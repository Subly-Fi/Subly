/**
 * Real on-chain subscribe flow for the hosted checkout. Mirrors the logic in
 * @subly/ui's SubscribeButton but exposed as a plain async helper so the
 * checkout page keeps full control of its UI/state.
 */
import {
    type TransactionSigner,
    address,
    pipe,
    createSolanaRpc,
    createTransactionMessage,
    setTransactionMessageFeePayerSigner,
    setTransactionMessageLifetimeUsingBlockhash,
    appendTransactionMessageInstruction,
    signTransactionMessageWithSigners,
    compileTransaction,
    getBase64EncodedWireTransaction,
} from '@solana/kit';
import { findAssociatedTokenPda } from '@solana-program/token';
import {
    getSubscribeOverlayInstructionAsync,
    getInitSubscriptionAuthorityOverlayInstructionAsync,
    findSubscriptionAuthorityPda,
    fetchMaybePlan,
    fetchPlan,
    fetchSubscriptionAuthority,
} from '@subscriptions/client';
import { PROGRAM_ADDRESS, rpcUrlForNetwork, type CheckoutNetwork } from './checkout-clusters';

export interface ResolvedPlan {
    planAddress: string;
    owner: string;
    planId: bigint;
    mint: string;
    amount: bigint;
    periodHours: number;
    metadataUri: string;
    name?: string;
}

const TOKEN_PROGRAM_LEGACY = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

function parsePlanName(metadataUri: string): string | undefined {
    try {
        const meta = JSON.parse(metadataUri) as { n?: string };
        return meta.n;
    } catch {
        return undefined;
    }
}

/** Reads the Plan account on-chain and returns everything checkout needs. */
export async function resolvePlan(planAddress: string, network: CheckoutNetwork): Promise<ResolvedPlan> {
    const rpc = createSolanaRpc(rpcUrlForNetwork(network));
    const maybe = await fetchMaybePlan(rpc as never, address(planAddress));
    if (!maybe.exists) throw new Error('Plan not found on-chain');
    const p = maybe.data;
    return {
        planAddress,
        owner: String(p.owner),
        planId: p.data.planId,
        mint: String(p.data.mint),
        amount: p.data.terms.amount,
        periodHours: Number(p.data.terms.periodHours),
        metadataUri: p.data.metadataUri,
        name: parsePlanName(p.data.metadataUri),
    };
}

async function resolveTokenProgram(rpc: ReturnType<typeof createSolanaRpc>, mint: ReturnType<typeof address>) {
    const info = await rpc.getAccountInfo(mint, { encoding: 'base64' }).send();
    return info.value ? address(String(info.value.owner)) : address(TOKEN_PROGRAM_LEGACY);
}

/**
 * Simulates a transaction message before the wallet sends it. The connector
 * exposes a sending signer (sign+send is atomic), so the wallet only surfaces a
 * generic "Failed to send transaction" on a program error. Simulating the
 * unsigned, compiled message (sigVerify:false) lets us surface the real on-chain
 * error and program logs instead.
 */
async function simulateOrThrow(
    rpc: ReturnType<typeof createSolanaRpc>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    msg: any,
    label: string,
): Promise<void> {
    const wire = getBase64EncodedWireTransaction(compileTransaction(msg));
    const { value } = await rpc
        .simulateTransaction(wire, { encoding: 'base64', replaceRecentBlockhash: true, sigVerify: false })
        .send();
    if (value.err) {
        const logs = (value.logs ?? []).join('\n');
        throw new Error(`${label} would fail on-chain: ${JSON.stringify(value.err)}${logs ? `\n${logs}` : ''}`);
    }
}

/**
 * Signs with the wallet (sign-only) and broadcasts via our own RPC — the same
 * proven path the merchant dashboard uses. The connector's atomic sign+send
 * swallows the underlying failure into a generic "Failed to send transaction",
 * whereas rpc.sendTransaction surfaces the real preflight error and logs.
 */
async function signAndSendViaRpc(
    rpc: ReturnType<typeof createSolanaRpc>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    msg: any,
): Promise<string> {
    const signed = await signTransactionMessageWithSigners(msg);
    const sig = await rpc.sendTransaction(getBase64EncodedWireTransaction(signed), { encoding: 'base64' }).send();
    return String(sig);
}

/** Polls until an account exists (used to confirm the init tx landed before subscribing). */
async function waitForAccount(
    rpc: ReturnType<typeof createSolanaRpc>,
    addr: ReturnType<typeof address>,
    { tries = 20, delayMs = 1000 }: { tries?: number; delayMs?: number } = {},
): Promise<void> {
    for (let i = 0; i < tries; i++) {
        const info = await rpc.getAccountInfo(addr, { encoding: 'base64' }).send();
        if (info.value) return;
        await new Promise(r => setTimeout(r, delayMs));
    }
    throw new Error('Timed out waiting for the subscription account to initialize. Please try again.');
}

/**
 * Initializes the subscriber's SubscriptionAuthority for this mint (if needed)
 * then sends a plan-verified subscribe transaction. Returns the subscribe tx
 * signature. Throws on user rejection or chain error.
 */
export async function subscribeToPlan(
    plan: ResolvedPlan,
    signer: TransactionSigner,
    network: CheckoutNetwork,
): Promise<string> {
    const rpcUrl = rpcUrlForNetwork(network);
    const rpc = createSolanaRpc(rpcUrl);
    const progAddr = address(PROGRAM_ADDRESS);
    const mint = address(plan.mint);
    const merchant = address(plan.owner);
    const subscriber = signer.address;

    const tokenProgram = await resolveTokenProgram(rpc, mint);
    const [userAta] = await findAssociatedTokenPda({ mint, owner: subscriber, tokenProgram });

    // Preflight checks — a fresh wallet fails the on-chain simulation with an
    // opaque "Failed to send transaction", so surface the real reason first.
    const { value: lamports } = await rpc.getBalance(subscriber).send();
    if (lamports === 0n) {
        throw new Error('This wallet has no SOL to cover network fees. Add a little SOL and try again.');
    }
    const ataInfo = await rpc.getAccountInfo(userAta, { encoding: 'base64' }).send();
    if (!ataInfo.value) {
        throw new Error('This wallet holds no USDC yet. Receive some USDC, then subscribe (the first payment is pulled on subscribe).');
    }

    const [saPda] = await findSubscriptionAuthorityPda(
        { tokenMint: mint, user: subscriber },
        { programAddress: progAddr },
    );

    // 1. Init SubscriptionAuthority if it does not exist yet, then WAIT for it
    //    to land — subscribing reads this account, so it must be confirmed.
    const saAccount = await rpc.getAccountInfo(saPda, { encoding: 'base64' }).send();
    if (!saAccount.value) {
        const initIx = await getInitSubscriptionAuthorityOverlayInstructionAsync({
            owner: signer,
            tokenMint: mint,
            tokenProgram,
            userAta,
            programAddress: progAddr,
        });
        const { value: bh } = await rpc.getLatestBlockhash().send();
        const initMsg = pipe(
            createTransactionMessage({ version: 0 }),
            m => setTransactionMessageFeePayerSigner(signer, m),
            m => setTransactionMessageLifetimeUsingBlockhash(bh, m),
            m => appendTransactionMessageInstruction(initIx, m),
        );
        await simulateOrThrow(rpc, initMsg, 'Account setup');
        await signAndSendViaRpc(rpc, initMsg);
        await waitForAccount(rpc, saPda);
    }

    // 2. Subscribe with on-chain-verified plan terms.
    const planAccount = await fetchPlan(rpc as never, address(plan.planAddress));
    const saData = await fetchSubscriptionAuthority(rpc as never, saPda);

    const subscribeIx = await getSubscribeOverlayInstructionAsync({
        merchant,
        subscriber: signer,
        planId: plan.planId,
        tokenMint: mint,
        expectedAmount: planAccount.data.data.terms.amount,
        expectedPeriodHours: planAccount.data.data.terms.periodHours,
        expectedCreatedAt: planAccount.data.data.terms.createdAt,
        expectedSubscriptionAuthorityInitId: saData.data.initId,
        programAddress: progAddr,
    });

    const { value: bh2 } = await rpc.getLatestBlockhash().send();
    const subMsg = pipe(
        createTransactionMessage({ version: 0 }),
        m => setTransactionMessageFeePayerSigner(signer, m),
        m => setTransactionMessageLifetimeUsingBlockhash(bh2, m),
        m => appendTransactionMessageInstruction(subscribeIx, m),
    );
    await simulateOrThrow(rpc, subMsg, 'Subscribe');
    return signAndSendViaRpc(rpc, subMsg);
}
