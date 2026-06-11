import { Hono } from 'hono';
import { z } from 'zod';
import { requireSupabase } from '../lib/supabase';
import { authMiddleware, type AuthEnv } from '../lib/auth';

const registerSchema = z.object({
  email: z.string().email().optional(),
  webhookUrl: z.string().url().optional(),
  name: z.string().max(100).optional(),
});

const updateSchema = registerSchema;

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
