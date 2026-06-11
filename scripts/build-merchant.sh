#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "→ Installing subscriptions client dependencies..."
cd "$ROOT/packages/subscriptions"
pnpm install --frozen-lockfile

echo "→ Generating TypeScript client from IDL..."
pnpm tsx scripts/generate-ts-client.ts

echo "→ Building @subscriptions/client..."
pnpm --dir clients/typescript build

echo "→ Building @subly/merchant..."
cd "$ROOT"
pnpm --filter @subly/merchant build

echo "→ Merchant build complete: apps/merchant/dist"
