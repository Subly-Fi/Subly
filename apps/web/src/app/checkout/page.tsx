'use client';

import dynamic from 'next/dynamic';

// The checkout is wallet-driven and must run only in the browser (the wallet
// connector touches window at import time), so disable SSR for it.
const CheckoutApp = dynamic(() => import('@/components/checkout/checkout-app').then(m => m.CheckoutApp), {
    ssr: false,
    loading: () => (
        <div className="flex min-h-screen items-center justify-center bg-black text-zinc-500">Loading…</div>
    ),
});

export default function CheckoutPage() {
    return <CheckoutApp />;
}
