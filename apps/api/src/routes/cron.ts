import { Hono } from 'hono';
import { runPaymentCollection } from '../cron/payment-collector';
import { runIndexerCycle } from '../indexer/event-listener';
import { timingSafeEqualStr } from '../lib/auth';

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Authorizes a cron request. Vercel Cron automatically sends
 * `Authorization: Bearer $CRON_SECRET` when the CRON_SECRET env var is set, so
 * the same guard covers Vercel Cron, QStash schedules, and manual curls.
 */
function authorizeCron(authHeader: string | undefined): { ok: true } | { ok: false; status: 401 | 503; error: string } {
  if (!CRON_SECRET) {
    return { ok: false, status: 503, error: 'Cron disabled: CRON_SECRET not configured' };
  }
  if (!timingSafeEqualStr(authHeader ?? '', `Bearer ${CRON_SECRET}`)) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }
  return { ok: true };
}

export const cron = new Hono()
  .post('/collect-payments', async (c) => {
    const auth = authorizeCron(c.req.header('Authorization'));
    if (!auth.ok) return c.json({ error: auth.error }, auth.status);

    const results = await runPaymentCollection();
    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return c.json({ data: { total: results.length, successful, failed, results } });
  })
  // Stateless indexing tick — driven by Vercel Cron / QStash on serverless,
  // where there is no long-lived poll loop.
  .post('/index', async (c) => {
    const auth = authorizeCron(c.req.header('Authorization'));
    if (!auth.ok) return c.json({ error: auth.error }, auth.status);

    const summary = await runIndexerCycle();
    return c.json({ data: summary });
  })
  // Vercel Cron issues GET requests; accept GET for both ticks too.
  .get('/collect-payments', async (c) => {
    const auth = authorizeCron(c.req.header('Authorization'));
    if (!auth.ok) return c.json({ error: auth.error }, auth.status);
    const results = await runPaymentCollection();
    const successful = results.filter((r) => r.success).length;
    return c.json({ data: { total: results.length, successful, failed: results.length - successful } });
  })
  .get('/index', async (c) => {
    const auth = authorizeCron(c.req.header('Authorization'));
    if (!auth.ok) return c.json({ error: auth.error }, auth.status);
    const summary = await runIndexerCycle();
    return c.json({ data: summary });
  });
