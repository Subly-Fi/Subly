/**
 * Vercel serverless entry, pre-bundled by scripts/build-api.sh (esbuild) into a
 * single self-contained file. Bundling avoids runtime module resolution of the
 * linked @subscriptions/client and workspace sources, which Vercel's function
 * tracer can't always follow for a pnpm `link:` package.
 */
import { handle } from '@hono/node-server/vercel';
import { app } from './app';

export default handle(app);
