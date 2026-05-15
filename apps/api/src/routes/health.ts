import { Hono } from 'hono';

export const health = new Hono().get('/', (c) => {
  return c.json({
    status: 'ok',
    service: 'subly-api',
    timestamp: new Date().toISOString(),
  });
});
