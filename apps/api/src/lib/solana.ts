import {
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  type Address,
  type KeyPairSigner,
  address,
  createKeyPairSignerFromBytes,
} from '@solana/kit';
import { SUBSCRIPTIONS_PROGRAM_ADDRESS } from '@subscriptions/client';

const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const wsUrl = process.env.SOLANA_WS_URL || rpcUrl.replace('https', 'wss');

export const rpc = createSolanaRpc(rpcUrl);
export const rpcSubscriptions = createSolanaRpcSubscriptions(wsUrl);

export const PROGRAM_ADDRESS: Address = process.env.PROGRAM_ADDRESS
  ? address(process.env.PROGRAM_ADDRESS)
  : SUBSCRIPTIONS_PROGRAM_ADDRESS;

let _sublySigner: KeyPairSigner | null = null;

export async function getSublySignerWallet(): Promise<KeyPairSigner> {
  if (_sublySigner) return _sublySigner;

  const secretKey = process.env.SUBLY_SIGNER_SECRET_KEY;
  if (!secretKey) {
    throw new Error('SUBLY_SIGNER_SECRET_KEY not configured');
  }

  const keyBytes = Uint8Array.from(JSON.parse(secretKey));
  _sublySigner = await createKeyPairSignerFromBytes(keyBytes);
  return _sublySigner;
}

export function getSublySignerAddress(): Address {
  const addr = process.env.SUBLY_SIGNER_ADDRESS;
  if (!addr) throw new Error('SUBLY_SIGNER_ADDRESS not configured');
  return address(addr);
}
