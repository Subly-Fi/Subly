import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { health } from './routes/health';
import { auth } from './routes/auth';
import { webhooks } from './routes/webhooks';
import { merchants } from './routes/merchants';
import { analytics } from './routes/analytics';
import { cron } from './routes/cron';

export const app = new Hono()
  .use('*', logger())
  .use(
    '*',
    cors({
      origin: [
        'http://localhost:5173',
        'http://localhost:3000',
        'http://localhost:3001',
        'https://www.subly.fi',
        'https://app.subly.fi',
      ],
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
