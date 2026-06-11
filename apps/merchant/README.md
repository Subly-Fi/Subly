# Subly Merchant Dashboard

Web interface for managing Solana subscriptions, delegations, and recurring payments. Built on the Cantina-audited `solana-program/subscriptions` on-chain program.

## Features

- **Wallet Connection** — Solana wallet integration with real-time SOL and USDC balance display
- **Dashboard** — Overview of delegations, subscriptions, and plans with summary cards
- **Create Delegations** — Three delegation types:
    - **Fixed**: one-time total amount with an expiry date
    - **Recurring**: per-period amount with configurable period length
    - **Subscription**: plan-based recurring billing with merchant-defined terms
- **Manage Plans** — Create, update, and manage merchant subscription plans
- **Collect Payments** — Batch-collect subscription payments from eligible subscribers
- **Marketplace** — Browse and subscribe to merchant plans
- **Subscription Management** — View, cancel, and manage active subscriptions
- **Analytics** — Track MRR, active subscribers, and churn (coming soon)

## Scripts

| Script            | Description                                           |
| ----------------- | ----------------------------------------------------- |
| `pnpm dev`        | Start the Vite dev server with hot module replacement |
| `pnpm build`      | Type-check with TypeScript and build for production   |
| `pnpm preview`    | Preview the production build locally                  |

## Tech Stack

React 19, TypeScript, Vite, Tailwind CSS, Radix UI, Jotai (state), TanStack Query (data fetching), Solana Kit, ConnectorKit.
