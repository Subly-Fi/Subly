# subly.

Subscriptions on Solana. The commerce layer for recurring payments, merchant tools, and developer SDKs — all on-chain.

Built on [`solana-program/subscriptions`](https://github.com/solana-program/subscriptions) (audited by [Cantina](https://cantina.xyz)).

## What

Three payment models, one protocol:

- **Fixed delegation** — one-time allowance with optional expiry
- **Recurring delegation** — per-period budget that auto-resets
- **Subscription plan** — merchant publishes terms, users subscribe, automatic pull payments

## Structure

```
apps/
├── web/          # subly.fi marketing site (Next.js 15)
├── merchant/     # Merchant dashboard (React 19, Vite)
└── api/          # Backend API (Hono)

packages/
├── sdk/          # @subly/sdk — developer SDK
├── ui/           # @subly/ui — embeddable components
└── config/       # Shared TypeScript, ESLint, Tailwind config
```

## Quick Start

```bash
pnpm install
pnpm dev
```

## Links

- **Website**: [subly.fi](https://www.subly.fi)
- **Twitter**: [@SublyFi](https://twitter.com/SublyFi)
- **Program**: `De1egAFMkMWZSN5rYXRj9CAdheBamobVNubTsi9avR44`

## License

MIT
