#!/usr/bin/env bash
# Build step for the Vercel deploy of apps/web. The hosted checkout imports
# @subscriptions/client (a linked package generated from the IDL), so it must be
# generated + built before `next build` can resolve it — mirrors build-merchant.sh.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "→ Installing subscriptions client dependencies..."
cd "$ROOT/packages/subscriptions"
pnpm install --frozen-lockfile

echo "→ Generating TypeScript client from IDL..."
pnpm tsx scripts/generate-ts-client.ts

echo "→ Building @subscriptions/client..."
pnpm --dir clients/typescript build

echo "→ Building @subly/web..."
cd "$ROOT"
pnpm --filter @subly/web build

echo "→ Web build complete: apps/web/.next"
