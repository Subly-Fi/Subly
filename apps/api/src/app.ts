import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { health } from './routes/health';
import { auth } from './routes/auth';
import { webhooks } from './routes/webhooks';
import { merchants } from './routes/merchants';
import { analytics } from './routes/analytics';
import { cron } from './routes/cron';

// Allowed browser origins. Defaults cover local dev + subly.fi; extend with the
// merchant dashboard's deployment URL via CORS_ORIGINS (comma-separated).
const DEFAULT_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:3001',
  'https://www.subly.fi',
  'https://subly.fi',
  'https://app.subly.fi',
  'https://subly-merchant.vercel.app',
];
const EXTRA_ORIGINS = (process.env.CORS_ORIGINS ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
const ALLOWED_ORIGINS = [...new Set([...DEFAULT_ORIGINS, ...EXTRA_ORIGINS])];

export const app = new Hono()
  .use('*', logger())
  .use(
    '*',
    cors({
      origin: (origin) => {
        // Allow non-browser callers (no Origin header: curl, QStash cron) and
        // any explicitly allow-listed origin; otherwise deny.
        if (!origin) return origin;
        return ALLOWED_ORIGINS.includes(origin) ? origin : null;
      },
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    }),
  )
  .route('/health', health)
  .route('/auth', auth)
  .route('/webhooks', webhooks)
  .route('/merchants', merchants)
  .route('/analytics', analytics)
  .route('/cron', cron);

export type AppType = typeof app;
