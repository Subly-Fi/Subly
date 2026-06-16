import { redirect } from 'next/navigation';

export const metadata = {
  title: 'subly. — merchant dashboard',
  description: 'Access the Subly merchant dashboard for managing subscriptions on Solana.',
};

// subly.fi/app is the public entry point to the merchant dashboard; it
// redirects to wherever the dashboard (apps/merchant) is deployed. Set
// NEXT_PUBLIC_APP_URL to that deployment URL.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.subly.fi';

export default function AppPage() {
  redirect(APP_URL);
}
