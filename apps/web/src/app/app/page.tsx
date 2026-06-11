import { redirect } from 'next/navigation';

export const metadata = {
  title: 'subly. — merchant dashboard',
  description: 'Access the Subly merchant dashboard for managing subscriptions on Solana.',
};

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.subly.fi';

export default function AppPage() {
  redirect(APP_URL);
}
