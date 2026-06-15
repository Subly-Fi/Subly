/**
 * Vercel serverless entry, pre-bundled by scripts/build-api.sh (esbuild) into a
 * single self-contained file. Bundling avoids runtime module resolution of the
 * linked @subscriptions/client and workspace sources, which Vercel's function
 * tracer can't always follow for a pnpm `link:` package.
 *
 * BODY FIX — why this wrapper exists:
 * Vercel's Node.js runtime parses the request body up-front and exposes it as
 * `req.body`, draining the underlying readable stream in the process. The stock
 * `@hono/node-server/vercel` adapter builds the web Request by reading that
 * (now-empty) stream, so any POST/PUT/PATCH carrying a body hangs until the
 * function hits its max duration and returns 504. GET/HEAD (and body-less cron
 * ticks) are unaffected, which is why only authenticated/body endpoints stalled.
 *
 * We fix the *input* only: reconstruct the raw bytes (from Vercel's parsed
 * `req.body`, or by reading the stream when it wasn't pre-consumed) and hand
 * them to the adapter via `req.rawBody`, a channel its request builder already
 * prefers. The adapter's battle-tested response writer is reused unchanged.
 */
import { handle } from '@hono/node-server/vercel';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { app } from './app';

const listener = handle(app);

type VercelReq = IncomingMessage & { body?: unknown; rawBody?: Buffer };

/** Recover the raw request body as a Buffer, however Vercel surfaced it. */
async function rawBodyFrom(req: VercelReq): Promise<Buffer> {
  const parsed = req.body;
  if (Buffer.isBuffer(parsed)) return parsed;
  if (typeof parsed === 'string') return Buffer.from(parsed);
  // Vercel parses application/json into an object; re-serialize it.
  if (parsed && typeof parsed === 'object') return Buffer.from(JSON.stringify(parsed));
  // Stream wasn't pre-consumed (unparsed content type) — read it ourselves.
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

export default async function handler(req: VercelReq, res: ServerResponse): Promise<void> {
  const method = (req.method ?? 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD' && req.rawBody === undefined) {
    try {
      req.rawBody = await rawBodyFrom(req);
    } catch {
      req.rawBody = Buffer.alloc(0);
    }
  }
  // The adapter listener has the shape (incoming, outgoing) => Promise<void>.
  return (listener as unknown as (i: VercelReq, o: ServerResponse) => Promise<void>)(req, res);
}
