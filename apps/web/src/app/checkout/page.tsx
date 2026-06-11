'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

type CheckoutState = 'loading' | 'ready' | 'connecting' | 'subscribing' | 'success' | 'error';

interface PlanData {
  address: string;
  owner: string;
  mint: string;
  amount: string;
  periodHours: number;
  metadataUri: string;
  name?: string;
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-black text-zinc-500">Loading...</div>}>
      <CheckoutContent />
    </Suspense>
  );
}

function CheckoutContent() {
  const searchParams = useSearchParams();
  const planAddress = searchParams.get('plan');
  const redirectUrl = searchParams.get('redirect');
  const merchantName = searchParams.get('merchant');

  const [state, setState] = useState<CheckoutState>('loading');
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!planAddress) {
      setError('Missing plan address');
      setState('error');
      return;
    }
    setPlan({
      address: planAddress,
      owner: '',
      mint: 'USDC',
      amount: searchParams.get('amount') || '?',
      periodHours: Number(searchParams.get('period_hours') || 720),
      metadataUri: '',
      name: searchParams.get('name') || merchantName || 'Subscription Plan',
    });
    setState('ready');
  }, [planAddress, searchParams, merchantName]);

  const handleSubscribe = useCallback(async () => {
    setState('connecting');

    try {
      const phantom = (window as unknown as Record<string, unknown>).phantom as Record<string, unknown> | undefined;
      const provider = phantom?.solana as { connect: () => Promise<{ publicKey: { toString: () => string } }>; isConnected: boolean } | undefined;

      if (!provider) {
        setError('Phantom wallet not found. Please install Phantom.');
        setState('error');
        return;
      }

      if (!provider.isConnected) {
        await provider.connect();
      }

      setState('subscribing');

      // TODO: Build and send subscribe transaction using @subscriptions/client
      // For now, simulate a short delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      setState('success');

      if (redirectUrl) {
        setTimeout(() => {
          window.location.href = redirectUrl;
        }, 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Subscription failed');
      setState('error');
    }
  }, [redirectUrl]);

  const periodLabel = plan ? formatPeriod(plan.periodHours) : '';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-6">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-extrabold tracking-tight">subly.</h1>
          <p className="mt-1 font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
            checkout
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8">
          {state === 'loading' && (
            <p className="text-center text-zinc-500">Loading plan...</p>
          )}

          {state === 'error' && (
            <div className="text-center">
              <p className="text-red-400">{error}</p>
              <Link href="/" className="mt-4 inline-block text-sm text-zinc-500 hover:text-white">
                Back to home
              </Link>
            </div>
          )}

          {(state === 'ready' || state === 'connecting' || state === 'subscribing') && plan && (
            <>
              <div className="mb-6 text-center">
                {merchantName && (
                  <p className="mb-2 text-xs uppercase tracking-wider text-zinc-500">{merchantName}</p>
                )}
                <h2 className="text-lg font-semibold text-white">{plan.name}</h2>
                <div className="mt-3">
                  <span className="text-4xl font-bold text-white">{plan.amount}</span>
                  <span className="ml-1 text-sm text-zinc-400">{plan.mint}</span>
                  <span className="ml-1 text-sm text-zinc-400">/ {periodLabel}</span>
                </div>
              </div>

              <div className="mb-6 space-y-2 text-xs text-zinc-500">
                <div className="flex justify-between">
                  <span>Settlement</span>
                  <span className="text-zinc-300">Instant (~400ms)</span>
                </div>
                <div className="flex justify-between">
                  <span>Network fee</span>
                  <span className="text-zinc-300">~$0.00025</span>
                </div>
                <div className="flex justify-between">
                  <span>Cancel anytime</span>
                  <span className="text-zinc-300">One click from wallet</span>
                </div>
              </div>

              <button
                onClick={handleSubscribe}
                disabled={state === 'connecting' || state === 'subscribing'}
                className="w-full rounded-xl bg-white px-6 py-3.5 text-sm font-bold text-black transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {state === 'connecting' && 'Connecting wallet...'}
                {state === 'subscribing' && 'Subscribing...'}
                {state === 'ready' && 'Subscribe with Solana'}
              </button>

              <p className="mt-4 text-center text-[10px] text-zinc-600">
                Powered by Subly — audited by Cantina
              </p>
            </>
          )}

          {state === 'success' && (
            <div className="text-center">
              <div className="mb-4 text-4xl">&#10003;</div>
              <h2 className="text-lg font-semibold text-white">Subscribed!</h2>
              <p className="mt-2 text-sm text-zinc-400">
                Your subscription is now active.
              </p>
              {redirectUrl && (
                <p className="mt-4 text-xs text-zinc-500">Redirecting...</p>
              )}
              {!redirectUrl && (
                <Link href="/" className="mt-4 inline-block text-sm text-zinc-500 hover:text-white">
                  Back to home
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatPeriod(hours: number): string {
  if (hours <= 24) return 'day';
  if (hours <= 168) return 'week';
  if (hours <= 744) return 'month';
  return 'year';
}
