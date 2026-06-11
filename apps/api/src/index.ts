import { serve } from '@hono/node-server';
import { app } from './app';
import { validateEnv } from './lib/env';
import { startEventListener } from './indexer/event-listener';

validateEnv();

const port = Number(process.env.PORT) || 3002;

serve({ fetch: app.fetch, port }, () => {
  console.log(`Subly API running on http://localhost:${port}`);

  if (process.env.ENABLE_INDEXER !== 'false') {
    startEventListener().catch(err => {
      console.error('Failed to start event listener:', err);
    });
  }
});
