import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { health } from './routes/health';
import { webhooks } from './routes/webhooks';

export const app = new Hono()
  .use('*', logger())
  .use(
    '*',
    cors({
      origin: ['http://localhost:5173', 'http://localhost:3000', 'https://www.subly.fi'],
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    }),
  )
  .route('/health', health)
  .route('/webhooks', webhooks);

export type AppType = typeof app;
