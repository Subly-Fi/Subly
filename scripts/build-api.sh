#!/usr/bin/env bash
# Build step for the Vercel deploy of apps/api. Generates + builds the
# subscriptions TS client (a linked dependency) and type-checks the API. Vercel
# then bundles api/index.ts (and its imports, incl. the built client) as a Node
# serverless function.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "→ Installing subscriptions client dependencies..."
cd "$ROOT/packages/subscriptions"
pnpm install --frozen-lockfile

echo "→ Generating TypeScript client from IDL..."
pnpm tsx scripts/generate-ts-client.ts

echo "→ Building @subscriptions/client..."
pnpm --dir clients/typescript build

echo "→ Type-checking @subly/api..."
cd "$ROOT"
pnpm --filter @subly/api build

echo "→ API build complete (Vercel bundles api/index.ts)."
