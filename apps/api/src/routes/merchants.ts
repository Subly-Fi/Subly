import { Hono } from 'hono';
import { z } from 'zod';
import { address } from '@solana/kit';
import { fetchMaybePlan } from '@subscriptions/client';
import { requireSupabase } from '../lib/supabase';
import { rpc } from '../lib/solana';
import { authMiddleware, type AuthEnv } from '../lib/auth';

const registerSchema = z.object({
  email: z.string().email().optional(),
  webhookUrl: z.string().url().optional(),
  name: z.string().max(100).optional(),
});

const updateSchema = registerSchema;

const syncPlansSchema = z.object({
  planAddresses: z.array(z.string().min(32).max(44)).max(50),
});

// All merchant endpoints are authenticated and scoped to the caller's own wallet
// (the wallet proven via the /auth signature flow or a merchant api_key).
export const merchants = new Hono<AuthEnv>()
  .use('*', authMiddleware)
  .post('/register', async (c) => {
    const wallet = c.get('wallet');
    const body = await c.req.json().catch(() => ({}));
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400);
    }

    const db = requireSupabase();
    const { data, error } = await db
      .from('merchants')
      .upsert(
        {
          wallet,
          email: parsed.data.email,
          webhook_url: parsed.data.webhookUrl,
          name: parsed.data.name,
        },
        { onConflict: 'wallet' },
      )
      .select()
      .single();

    if (error) {
      return c.json({ error: 'Failed to register merchant', details: error.message }, 500);
    }

    return c.json({ data });
  })

  // Registers the caller's plans so the indexer polls only those plan PDAs
  // (instead of the shared program). For each address: skip if already mirrored
  // for this merchant; otherwise verify on-chain that the caller owns it, then
  // mirror it into `plans`. The dashboard calls this on load / after plan create.
  .post('/plans/sync', async (c) => {
    const wallet = c.get('wallet');
    const body = await c.req.json().catch(() => ({}));
    const parsed = syncPlansSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400);
    }

    const db = requireSupabase();
    const registered: string[] = [];
    const skipped: string[] = [];

    // Skip already-registered plans (owned by this merchant) without any RPC.
    const { data: existing } = await db
      .from('plans')
      .select('address')
      .eq('merchant_wallet', wallet)
      .in('address', parsed.data.planAddresses);
    const known = new Set((existing ?? []).map((p) => p.address));

    for (const planAddress of parsed.data.planAddresses) {
      if (known.has(planAddress)) {
        skipped.push(planAddress);
        continue;
      }
      try {
        const maybe = await fetchMaybePlan(rpc as never, address(planAddress));
        if (!maybe.exists) {
          skipped.push(planAddress);
          continue;
        }
        const plan = maybe.data;
        // Only register plans the caller actually owns (prevents indexing
        // someone else's plan, which would reintroduce stranger traffic).
        if (String(plan.owner) !== wallet) {
          skipped.push(planAddress);
          continue;
        }
        const status = plan.status === 1 ? 'active' : 'sunset';
        await db.from('plans').upsert(
          {
            address: planAddress,
            merchant_wallet: wallet,
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
        registered.push(planAddress);
      } catch (err) {
        console.error(`[merchants] Failed to sync plan ${planAddress}:`, err);
        skipped.push(planAddress);
      }
    }

    return c.json({ data: { registered, skipped } });
  })

  .get('/:wallet', async (c) => {
    const wallet = c.req.param('wallet');
    if (wallet !== c.get('wallet')) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const db = requireSupabase();
    const { data, error } = await db.from('merchants').select('*').eq('wallet', wallet).single();

    if (error || !data) {
      return c.json({ error: 'Merchant not found' }, 404);
    }

    return c.json({ data });
  })

  .put('/:wallet', async (c) => {
    const wallet = c.req.param('wallet');
    if (wallet !== c.get('wallet')) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const body = await c.req.json().catch(() => ({}));
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400);
    }

    const db = requireSupabase();
    const updates: Record<string, unknown> = {};
    if (parsed.data.email !== undefined) updates.email = parsed.data.email;
    if (parsed.data.webhookUrl !== undefined) updates.webhook_url = parsed.data.webhookUrl;
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;

    const { data, error } = await db.from('merchants').update(updates).eq('wallet', wallet).select().single();

    if (error) {
      return c.json({ error: 'Failed to update merchant', details: error.message }, 500);
    }

    return c.json({ data });
  });
