/**
 * Vercel serverless entry for the Subly backend.
 *
 * All routes from the Hono `app` are served through this single Node function;
 * `vercel.json` rewrites every path here. There is no long-lived process on
 * serverless, so the indexer runs as a scheduled cron (POST /cron/index) rather
 * than the persistent poll loop in src/index.ts (used for local / VPS hosting).
 */
import { handle } from '@hono/node-server/vercel';
import { app } from '../src/app';

export default handle(app);
