import { Hono } from 'hono';
import { runPaymentCollection } from '../cron/payment-collector';
import { timingSafeEqualStr } from '../lib/auth';

const CRON_SECRET = process.env.CRON_SECRET;

export const cron = new Hono().post('/collect-payments', async (c) => {
  // Fail closed: an unset secret disables the money-moving trigger entirely
  // rather than leaving it open.
  if (!CRON_SECRET) {
    console.error('[cron] CRON_SECRET not configured — refusing to run payment collection');
    return c.json({ error: 'Collection disabled: CRON_SECRET not configured' }, 503);
  }

  const provided = c.req.header('Authorization') ?? '';
  if (!timingSafeEqualStr(provided, `Bearer ${CRON_SECRET}`)) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const results = await runPaymentCollection();
  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  return c.json({
    data: {
      total: results.length,
      successful,
      failed,
      results,
    },
  });
});
