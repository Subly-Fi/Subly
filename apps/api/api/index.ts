// @ts-nocheck
// Vercel serverless function entry. The real handler is pre-bundled into a
// single self-contained file by scripts/build-api.sh (esbuild) so the runtime
// needs no module resolution of the linked @subscriptions/client or workspace
// sources. `.default ?? mod` covers both ESM-bundled and CJS-interop cases.
import mod from '../.vercel-bundle/handler.cjs';

export default mod.default ?? mod;
