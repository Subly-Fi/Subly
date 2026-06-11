import { Client } from '@upstash/qstash';

const token = process.env.QSTASH_TOKEN;

export const qstash = token ? new Client({ token }) : null;

export async function publishWebhook(opts: {
  url: string;
  body: Record<string, unknown>;
  retries?: number;
}) {
  if (!qstash) {
    console.warn('QStash not configured — webhook not published:', opts.url);
    return null;
  }

  return qstash.publishJSON({
    url: opts.url,
    body: opts.body,
    retries: opts.retries ?? 3,
  });
}
