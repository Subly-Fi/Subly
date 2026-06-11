import { Hono } from 'hono';
import { z } from 'zod';
import { supabase } from '../lib/supabase';
import { dispatchMerchantWebhook } from '../lib/webhook-dispatcher';
import { timingSafeEqualStr } from '../lib/auth';

const INBOUND_WEBHOOK_SECRET = process.env.INBOUND_WEBHOOK_SECRET;

const subscriptionEventSchema = z.object({
  planAddress: z.string(),
  subscriberWallet: z.string(),
  merchantWallet: z.string(),
  mint: z.string(),
  amount: z.string().optional(),
  timestamp: z.number(),
});

const paymentEventSchema = z.object({
  planAddress: z.string(),
  subscriberWallet: z.string(),
  merchantWallet: z.string(),
  mint: z.string(),
  amount: z.string(),
  period: z.number().optional(),
  timestamp: z.number(),
});

export const webhooks = new Hono()
  // Fail closed: inbound event ingestion requires a shared secret. If the secret
  // is unset the endpoints are disabled (the on-chain indexer is the primary
  // source of truth for these events).
  .use('*', async (c, next) => {
    if (!INBOUND_WEBHOOK_SECRET) {
      return c.json({ error: 'Inbound webhooks disabled: INBOUND_WEBHOOK_SECRET not configured' }, 503);
    }
    const provided = c.req.header('X-Subly-Secret') ?? '';
    if (!timingSafeEqualStr(provided, INBOUND_WEBHOOK_SECRET)) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    return next();
  })
  .post('/subscription-created', async (c) => {
    const body = await c.req.json();
    const parsed = subscriptionEventSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400);
    }

    const event = parsed.data;

    if (supabase) {
      await supabase.from('subscription_events').insert({
        event_type: 'created',
        plan_address: event.planAddress,
        subscriber_wallet: event.subscriberWallet,
        merchant_wallet: event.merchantWallet,
        mint: event.mint,
        amount: event.amount,
      });

      await supabase.from('subscriptions').upsert({
        plan_address: event.planAddress,
        subscriber_wallet: event.subscriberWallet,
        status: 'active',
        current_period_start: new Date(event.timestamp * 1000).toISOString(),
      }, { onConflict: 'plan_address,subscriber_wallet' });
    }

    await dispatchMerchantWebhook(event.merchantWallet, {
      type: 'subscription.created',
      data: event,
      timestamp: event.timestamp,
    });

    return c.json({ received: true, event: 'subscription-created' });
  })

  .post('/subscription-cancelled', async (c) => {
    const body = await c.req.json();
    const parsed = subscriptionEventSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400);
    }

    const event = parsed.data;

    if (supabase) {
      await supabase.from('subscription_events').insert({
        event_type: 'cancelled',
        plan_address: event.planAddress,
        subscriber_wallet: event.subscriberWallet,
        merchant_wallet: event.merchantWallet,
        mint: event.mint,
      });

      await supabase
        .from('subscriptions')
        .update({ status: 'cancelled' })
        .eq('plan_address', event.planAddress)
        .eq('subscriber_wallet', event.subscriberWallet);
    }

    await dispatchMerchantWebhook(event.merchantWallet, {
      type: 'subscription.cancelled',
      data: event,
      timestamp: event.timestamp,
    });

    return c.json({ received: true, event: 'subscription-cancelled' });
  })

  .post('/payment-received', async (c) => {
    const body = await c.req.json();
    const parsed = paymentEventSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400);
    }

    const event = parsed.data;

    if (supabase) {
      await supabase.from('payments').insert({
        plan_address: event.planAddress,
        subscriber_wallet: event.subscriberWallet,
        merchant_wallet: event.merchantWallet,
        amount: event.amount,
        mint: event.mint,
        status: 'success',
      });

      await supabase
        .from('subscriptions')
        .update({
          last_payment_at: new Date(event.timestamp * 1000).toISOString(),
          current_period_start: new Date(event.timestamp * 1000).toISOString(),
          consecutive_failures: 0,
        })
        .eq('plan_address', event.planAddress)
        .eq('subscriber_wallet', event.subscriberWallet);
    }

    await dispatchMerchantWebhook(event.merchantWallet, {
      type: 'payment.received',
      data: event,
      timestamp: event.timestamp,
    });

    return c.json({ received: true, event: 'payment-received' });
  });
