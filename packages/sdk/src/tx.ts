import {
  type Address,
  type Signature,
  type TransactionSigner,
  type Instruction,
  type Rpc,
  type SolanaRpcApi,
  pipe,
  createTransactionMessage,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions,
  signTransactionMessageWithSigners,
  getSignatureFromTransaction,
  getBase64EncodedWireTransaction,
} from '@solana/kit';

export type SublyRpc = Rpc<SolanaRpcApi>;

const CONFIRM_TIMEOUT_MS = 30_000;
const CONFIRM_INTERVAL_MS = 2_000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Builds a v0 transaction from instructions, signs it with the provided signers,
 * submits it, and waits for on-chain confirmation. Works with any partial signer
 * (KeyPairSigner or wallet signer) — unlike signAndSendTransactionMessageWithSigners,
 * which requires a dedicated sending signer.
 */
export async function sendAndConfirm(
  rpc: SublyRpc,
  instructions: Instruction[],
  feePayer: TransactionSigner,
): Promise<Signature> {
  const { value: blockhash } = await rpc.getLatestBlockhash().send();

  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(feePayer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
    (m) => appendTransactionMessageInstructions(instructions, m),
  );

  const signed = await signTransactionMessageWithSigners(message);
  const signature = getSignatureFromTransaction(signed);

  await rpc
    .sendTransaction(getBase64EncodedWireTransaction(signed), {
      encoding: 'base64',
      skipPreflight: false,
      preflightCommitment: 'confirmed',
      maxRetries: 3n,
    })
    .send();

  const deadline = Date.now() + CONFIRM_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const { value } = await rpc.getSignatureStatuses([signature], { searchTransactionHistory: false }).send();
    const status = value[0];
    if (status) {
      if (status.err) throw new Error(`Transaction failed on-chain: ${JSON.stringify(status.err)} (${signature})`);
      if (status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized') return signature;
    }
    await sleep(CONFIRM_INTERVAL_MS);
  }
  throw new Error(`Transaction not confirmed within ${CONFIRM_TIMEOUT_MS}ms (${signature})`);
}

const tokenProgramCache = new Map<string, Address>();

/** Resolves a mint's owning token program (legacy SPL Token vs Token-2022). */
export async function resolveTokenProgram(rpc: SublyRpc, mint: Address): Promise<Address> {
  const key = mint.toString();
  const cached = tokenProgramCache.get(key);
  if (cached) return cached;
  const info = await rpc.getAccountInfo(mint, { encoding: 'base64' }).send();
  if (!info.value) throw new Error(`Mint ${key} not found`);
  tokenProgramCache.set(key, info.value.owner);
  return info.value.owner;
}

/** Current on-chain unix time (avoids client clock skew for delegation start/expiry). */
export async function getChainTime(rpc: SublyRpc): Promise<bigint> {
  const slot = await rpc.getSlot().send();
  const time = await rpc.getBlockTime(slot).send();
  return BigInt(time ?? Math.floor(Date.now() / 1000));
}

/** Generates a random u64 nonce for delegation PDAs. */
export function randomNonce(): bigint {
  const arr = new BigUint64Array(1);
  crypto.getRandomValues(arr);
  return arr[0];
}
