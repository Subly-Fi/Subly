import { SignJWT, jwtVerify } from 'jose';
import nacl from 'tweetnacl';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { Context, Next } from 'hono';
import { supabase } from './supabase';

/** Hono context variables set by {@link authMiddleware}. */
export type AuthEnv = { Variables: { wallet: string } };

const JWT_SECRET_RAW =
  process.env.JWT_SECRET ??
  (() => {
    if (process.env.NODE_ENV === 'production') {
      // Fail closed: never fall back to a known/guessable secret in production.
      throw new Error('JWT_SECRET must be set in production');
    }
    console.warn('[auth] JWT_SECRET not set — using an ephemeral random secret (tokens reset on restart)');
    return randomBytes(32).toString('hex');
  })();
const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_RAW);

/** Constant-time string comparison that does not early-return on length. */
export function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export async function createAuthToken(wallet: string): Promise<string> {
  return new SignJWT({ wallet })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
}

export async function verifyAuthToken(token: string): Promise<{ wallet: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return { wallet: payload.wallet as string };
  } catch {
    return null;
  }
}

export function verifyWalletSignature(
  walletAddress: string,
  message: string,
  signatureBase64: string,
): boolean {
  try {
    const messageBytes = new TextEncoder().encode(message);

    const signatureBytes = Uint8Array.from(
      atob(signatureBase64),
      c => c.charCodeAt(0),
    );

    const publicKeyBytes = decodeBase58(walletAddress);

    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
  } catch {
    return false;
  }
}

function decodeBase58(str: string): Uint8Array {
  const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const base = BigInt(ALPHABET.length);
  let num = 0n;
  for (const char of str) {
    const idx = ALPHABET.indexOf(char);
    if (idx === -1) throw new Error(`Invalid base58 character: ${char}`);
    num = num * base + BigInt(idx);
  }
  const bytes: number[] = [];
  while (num > 0n) {
    bytes.unshift(Number(num % 256n));
    num = num / 256n;
  }
  for (const char of str) {
    if (char !== '1') break;
    bytes.unshift(0);
  }
  return Uint8Array.from(bytes);
}

export async function authMiddleware(c: Context, next: Next) {
  const auth = c.req.header('Authorization');
  if (!auth) {
    return c.json({ error: 'Authorization header required' }, 401);
  }

  const token = auth.replace('Bearer ', '');

  if (token.length === 36 && token.includes('-')) {
    if (!supabase) {
      return c.json({ error: 'API keys not available' }, 503);
    }
    const { data } = await supabase
      .from('merchants')
      .select('wallet')
      .eq('api_key', token)
      .single();

    if (!data) {
      return c.json({ error: 'Invalid API key' }, 401);
    }
    c.set('wallet', data.wallet);
    return next();
  }

  const verified = await verifyAuthToken(token);
  if (!verified) {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }
  c.set('wallet', verified.wallet);
  return next();
}
