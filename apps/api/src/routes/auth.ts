import { Hono } from 'hono';
import { z } from 'zod';
import { createAuthToken, verifyWalletSignature } from '../lib/auth';
import { requireSupabase } from '../lib/supabase';
import { randomUUID } from 'crypto';

const NONCE_TTL_MS = 5 * 60 * 1000;

const challengeSchema = z.object({
  wallet: z.string().min(32).max(44),
});

const verifySchema = z.object({
  wallet: z.string().min(32).max(44),
  signature: z.string(),
  nonce: z.string(),
});

export const auth = new Hono()
  .post('/challenge', async (c) => {
    const body = await c.req.json();
    const parsed = challengeSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid wallet address' }, 400);
    }

    const nonce = randomUUID();
    const message = `Sign this message to authenticate with Subly.\n\nWallet: ${parsed.data.wallet}\nNonce: ${nonce}`;

    const db = requireSupabase();
    await db.from('auth_nonces').upsert(
      {
        wallet: parsed.data.wallet,
        nonce,
        expires_at: new Date(Date.now() + NONCE_TTL_MS).toISOString(),
      },
      { onConflict: 'wallet' },
    );

    return c.json({ data: { message, nonce } });
  })

  .post('/verify', async (c) => {
    const body = await c.req.json();
    const parsed = verifySchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400);
    }

    const db = requireSupabase();
    const { data: stored } = await db
      .from('auth_nonces')
      .select('nonce, expires_at')
      .eq('wallet', parsed.data.wallet)
      .single();

    if (!stored || stored.nonce !== parsed.data.nonce) {
      return c.json({ error: 'Invalid or expired nonce' }, 401);
    }
    if (Date.now() > new Date(stored.expires_at).getTime()) {
      await db.from('auth_nonces').delete().eq('wallet', parsed.data.wallet);
      return c.json({ error: 'Nonce expired' }, 401);
    }

    const message = `Sign this message to authenticate with Subly.\n\nWallet: ${parsed.data.wallet}\nNonce: ${parsed.data.nonce}`;
    const isValid = verifyWalletSignature(parsed.data.wallet, message, parsed.data.signature);

    if (!isValid) {
      return c.json({ error: 'Invalid signature' }, 401);
    }

    // Single-use: consume the nonce so a signature can't be replayed.
    await db.from('auth_nonces').delete().eq('wallet', parsed.data.wallet);

    const { data: existing } = await db
      .from('merchants')
      .select('wallet')
      .eq('wallet', parsed.data.wallet)
      .single();

    if (!existing) {
      await db.from('merchants').insert({
        wallet: parsed.data.wallet,
        api_key: randomUUID(),
      });
    }

    const token = await createAuthToken(parsed.data.wallet);
    return c.json({ data: { token, wallet: parsed.data.wallet } });
  });
