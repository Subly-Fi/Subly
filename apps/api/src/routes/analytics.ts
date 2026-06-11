import { Hono } from 'hono';
import { requireSupabase } from '../lib/supabase';
import { authMiddleware, type AuthEnv } from '../lib/auth';

async function getMerchantPlanAddresses(wallet: string): Promise<string[]> {
  const db = requireSupabase();
  const { data } = await db
    .from('plans')
    .select('address')
    .eq('merchant_wallet', wallet);
  return data?.map(p => p.address) ?? [];
}

// Authenticated and scoped: a merchant may only read analytics for their own
// wallet. The :wallet path segment must match the authenticated wallet.
export const analytics = new Hono<AuthEnv>()
  .use('*', authMiddleware)
  .use('/:wallet/*', async (c, next) => {
    if (c.req.param('wallet') !== c.get('wallet')) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    return next();
  })
  .get('/:wallet/summary', async (c) => {
    const wallet = c.req.param('wallet');
    const db = requireSupabase();
    const planAddresses = await getMerchantPlanAddresses(wallet);

    if (!planAddresses.length) {
      return c.json({ data: { totalSubscriptions: 0, activeSubscriptions: 0, totalPayments: 0, totalRevenue: 0 } });
    }

    const [subsResult, activeResult, paymentsResult] = await Promise.all([
      db.from('subscriptions').select('id', { count: 'exact' }).in('plan_address', planAddresses),
      db.from('subscriptions').select('id', { count: 'exact' }).eq('status', 'active').in('plan_address', planAddresses),
      db.from('payments').select('amount').eq('merchant_wallet', wallet).eq('status', 'success'),
    ]);

    const totalRevenue = paymentsResult.data?.reduce(
      (sum, p) => sum + parseFloat(p.amount || '0'), 0
    ) ?? 0;

    return c.json({
      data: {
        totalSubscriptions: subsResult.count ?? 0,
        activeSubscriptions: activeResult.count ?? 0,
        totalPayments: paymentsResult.data?.length ?? 0,
        totalRevenue,
      },
    });
  })

  .get('/:wallet/subscriptions', async (c) => {
    const wallet = c.req.param('wallet');
    const status = c.req.query('status');
    const limit = Math.min(Number(c.req.query('limit') || 50), 100);
    const offset = Number(c.req.query('offset') || 0);
    const db = requireSupabase();
    const planAddresses = await getMerchantPlanAddresses(wallet);

    if (!planAddresses.length) {
      return c.json({ data: [], total: 0 });
    }

    let query = db
      .from('subscriptions')
      .select('*', { count: 'exact' })
      .in('plan_address', planAddresses)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;
    if (error) {
      return c.json({ error: 'Failed to fetch subscriptions', details: error.message }, 500);
    }

    return c.json({ data, total: count });
  })

  .get('/:wallet/payments', async (c) => {
    const wallet = c.req.param('wallet');
    const limit = Math.min(Number(c.req.query('limit') || 50), 100);
    const offset = Number(c.req.query('offset') || 0);
    const db = requireSupabase();

    const { data, error, count } = await db
      .from('payments')
      .select('*', { count: 'exact' })
      .eq('merchant_wallet', wallet)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return c.json({ error: 'Failed to fetch payments', details: error.message }, 500);
    }

    return c.json({ data, total: count });
  })

  .get('/:wallet/events', async (c) => {
    const wallet = c.req.param('wallet');
    const limit = Math.min(Number(c.req.query('limit') || 50), 100);
    const offset = Number(c.req.query('offset') || 0);
    const db = requireSupabase();

    const { data, error, count } = await db
      .from('subscription_events')
      .select('*', { count: 'exact' })
      .eq('merchant_wallet', wallet)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return c.json({ error: 'Failed to fetch events', details: error.message }, 500);
    }

    return c.json({ data, total: count });
  });
