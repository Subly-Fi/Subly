// Bundles the Vercel serverless handler into one self-contained CJS file so the
// runtime needs no module resolution of the linked @subscriptions/client or
// workspace sources. Run by scripts/build-api.sh during the Vercel build.
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

await build({
  entryPoints: [join(apiRoot, 'src/vercel-handler.ts')],
  outfile: join(apiRoot, '.vercel-bundle/handler.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  // Node built-ins stay external; everything else (incl. the linked client and
  // @solana/* ESM packages) is inlined.
  packages: undefined,
  logLevel: 'info',
});

console.log('✓ Bundled api handler → apps/api/.vercel-bundle/handler.cjs');
