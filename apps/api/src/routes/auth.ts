import { Hono } from 'hono';
import { z } from 'zod';
import { createAuthToken, verifyWalletSignature } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { randomUUID } from 'crypto';

const nonceStore = new Map<string, { nonce: string; expiresAt: number }>();

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

    nonceStore.set(parsed.data.wallet, {
      nonce,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    return c.json({ data: { message, nonce } });
  })

  .post('/verify', async (c) => {
    const body = await c.req.json();
    const parsed = verifySchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400);
    }

    const stored = nonceStore.get(parsed.data.wallet);
    if (!stored || stored.nonce !== parsed.data.nonce) {
      return c.json({ error: 'Invalid or expired nonce' }, 401);
    }
    if (Date.now() > stored.expiresAt) {
      nonceStore.delete(parsed.data.wallet);
      return c.json({ error: 'Nonce expired' }, 401);
    }

    const message = `Sign this message to authenticate with Subly.\n\nWallet: ${parsed.data.wallet}\nNonce: ${parsed.data.nonce}`;
    const isValid = verifyWalletSignature(parsed.data.wallet, message, parsed.data.signature);

    if (!isValid) {
      return c.json({ error: 'Invalid signature' }, 401);
    }

    nonceStore.delete(parsed.data.wallet);

    if (supabase) {
      const { data: existing } = await supabase
        .from('merchants')
        .select('wallet')
        .eq('wallet', parsed.data.wallet)
        .single();

      if (!existing) {
        await supabase.from('merchants').insert({
          wallet: parsed.data.wallet,
          api_key: randomUUID(),
        });
      }
    }

    const token = await createAuthToken(parsed.data.wallet);
    return c.json({ data: { token, wallet: parsed.data.wallet } });
  });
