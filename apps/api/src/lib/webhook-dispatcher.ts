import { supabase } from './supabase';
import { publishWebhook } from './qstash';
import { sendEmail } from './resend';

export type WebhookEventType =
  | 'subscription.created'
  | 'subscription.cancelled'
  | 'subscription.resumed'
  | 'payment.received'
  | 'payment.failed';

interface WebhookPayload {
  type: WebhookEventType;
  data: Record<string, unknown>;
  timestamp: number;
}

export async function dispatchMerchantWebhook(
  merchantWallet: string,
  event: WebhookPayload,
) {
  if (!supabase) return;

  const { data: merchant } = await supabase
    .from('merchants')
    .select('id, webhook_url, email')
    .eq('wallet', merchantWallet)
    .single();

  if (!merchant) return;

  if (merchant.webhook_url) {
    await supabase.from('webhook_deliveries').insert({
      merchant_id: merchant.id,
      event_type: event.type,
      payload: JSON.parse(JSON.stringify(event)),
      status: 'pending',
    });

    await publishWebhook({
      url: merchant.webhook_url,
      body: { ...event } as Record<string, unknown>,
    });
  }

  if (merchant.email && shouldSendEmail(event.type)) {
    await sendEmail({
      to: merchant.email,
      subject: emailSubject(event),
      html: emailBody(event),
    });
  }
}

function shouldSendEmail(type: WebhookEventType): boolean {
  return type === 'payment.received' || type === 'payment.failed';
}

function emailSubject(event: WebhookPayload): string {
  const data = event.data as Record<string, string>;
  switch (event.type) {
    case 'payment.received':
      return `Payment received — ${data.amount ?? ''} ${data.mint ?? 'USDC'}`;
    case 'payment.failed':
      return `Payment failed — subscriber ${(data.subscriberWallet ?? '').slice(0, 8)}...`;
    default:
      return `Subly event: ${event.type}`;
  }
}

function emailBody(event: WebhookPayload): string {
  const data = event.data as Record<string, string>;
  const sub = data.subscriberWallet
    ? `${data.subscriberWallet.slice(0, 8)}...${data.subscriberWallet.slice(-4)}`
    : 'unknown';

  if (event.type === 'payment.received') {
    return `
      <h2>Payment Received</h2>
      <p>Amount: <strong>${data.amount ?? 'N/A'}</strong> ${data.mint ?? 'USDC'}</p>
      <p>Subscriber: <code>${sub}</code></p>
      <p style="color:#888;font-size:12px">Powered by Subly — subly.fi</p>
    `;
  }

  if (event.type === 'payment.failed') {
    return `
      <h2>Payment Failed</h2>
      <p>Subscriber <code>${sub}</code> has insufficient balance.</p>
      <p>Reason: ${data.failureReason ?? 'Insufficient balance'}</p>
      <p style="color:#888;font-size:12px">Powered by Subly — subly.fi</p>
    `;
  }

  return `<p>Event: ${event.type}</p><pre>${JSON.stringify(data, null, 2)}</pre>`;
}
