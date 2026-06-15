'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
    useWallet,
    useConnectWallet,
    useWalletConnectors,
    useDisconnectWallet,
    useTransactionSigner,
} from '@solana/connector/react';
import type { TransactionSigner } from '@solana/kit';
import { resolvePlan, subscribeToPlan, type ResolvedPlan } from '@/lib/subscribe';
import type { CheckoutNetwork } from '@/lib/checkout-clusters';

type Phase = 'loading' | 'ready' | 'subscribing' | 'success' | 'error';

const USDC_DECIMALS = 1_000_000;

function formatPeriod(hours: number): string {
    const plural = (n: number, unit: string) => (n === 1 ? unit : `${n} ${unit}s`);
    if (hours < 24) return plural(hours, 'hour');
    if (hours % 720 === 0) return plural(hours / 720, 'month');
    if (hours % 168 === 0) return plural(hours / 168, 'week');
    if (hours % 24 === 0) return plural(hours / 24, 'day');
    return plural(hours, 'hour');
}

function ellipsify(s: string, n = 4): string {
    return s.length <= n * 2 ? s : `${s.slice(0, n)}…${s.slice(-n)}`;
}

export function CheckoutInner({ network }: { network: CheckoutNetwork }) {
    const planAddress = useMemo(() => {
        if (typeof window === 'undefined') return null;
        return new URLSearchParams(window.location.search).get('plan');
    }, []);
    const redirectUrl = useMemo(() => {
        if (typeof window === 'undefined') return null;
        return new URLSearchParams(window.location.search).get('redirect');
    }, []);

    const [phase, setPhase] = useState<Phase>('loading');
    const [plan, setPlan] = useState<ResolvedPlan | null>(null);
    const [error, setError] = useState('');
    const [txSig, setTxSig] = useState('');

    const { account, isConnected } = useWallet();
    const connectors = useWalletConnectors();
    const { connect, isConnecting } = useConnectWallet();
    const { disconnect } = useDisconnectWallet();
    const { signer } = useTransactionSigner();

    // Resolve real plan terms from chain.
    useEffect(() => {
        let cancelled = false;
        if (!planAddress) {
            setError('Missing plan address in the link.');
            setPhase('error');
            return;
        }
        resolvePlan(planAddress, network)
            .then(p => {
                if (cancelled) return;
                setPlan(p);
                setPhase('ready');
            })
            .catch(err => {
                if (cancelled) return;
                setError(err instanceof Error ? err.message : 'Failed to load plan');
                setPhase('error');
            });
        return () => {
            cancelled = true;
        };
    }, [planAddress, network]);

    const handleConnect = useCallback(async () => {
        const first = connectors[0];
        if (!first) {
            setError('No Solana wallet found. Install Phantom or another wallet.');
            setPhase('error');
            return;
        }
        try {
            await connect(first.id);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Wallet connection failed');
        }
    }, [connectors, connect]);

    const handleSubscribe = useCallback(async () => {
        if (!plan || !signer) return;
        setPhase('subscribing');
        setError('');
        try {
            // The connector's signer is a kit-compatible sending signer at
            // runtime; its address brand differs only at the type level.
            const sig = await subscribeToPlan(plan, signer as unknown as TransactionSigner, network);
            setTxSig(sig);
            setPhase('success');
            if (redirectUrl) setTimeout(() => (window.location.href = redirectUrl), 2500);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Subscription failed');
            setPhase('error');
        }
    }, [plan, signer, network, redirectUrl]);

    const amountLabel = plan ? (Number(plan.amount) / USDC_DECIMALS).toLocaleString() : '';
    const periodLabel = plan ? formatPeriod(plan.periodHours) : '';

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-black px-6">
            <div className="w-full max-w-md">
                <div className="mb-8 text-center">
                    <h1 className="text-2xl font-extrabold tracking-tight text-white">subly.</h1>
                    <p className="mt-1 font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">checkout</p>
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8">
                    {phase === 'loading' && <p className="text-center text-zinc-500">Loading plan…</p>}

                    {phase === 'error' && (
                        <div className="text-center">
                            <p className="whitespace-pre-wrap break-words text-left font-mono text-xs text-red-400">{error}</p>
                            <Link href="/" className="mt-4 inline-block text-sm text-zinc-500 hover:text-white">
                                Back to home
                            </Link>
                        </div>
                    )}

                    {(phase === 'ready' || phase === 'subscribing') && plan && (
                        <>
                            <div className="mb-6 text-center">
                                <p className="mb-2 text-xs uppercase tracking-wider text-zinc-500">
                                    from {ellipsify(plan.owner)}
                                </p>
                                <h2 className="text-lg font-semibold text-white">{plan.name || 'Subscription Plan'}</h2>
                                <div className="mt-3">
                                    <span className="text-4xl font-bold text-white">{amountLabel}</span>
                                    <span className="ml-1 text-sm text-zinc-400">USDC</span>
                                    <span className="ml-1 text-sm text-zinc-400">/ {periodLabel}</span>
                                </div>
                            </div>

                            <div className="mb-6 space-y-2 text-xs text-zinc-500">
                                <div className="flex justify-between">
                                    <span>Settlement</span>
                                    <span className="text-zinc-300">Instant (~400ms)</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Billing</span>
                                    <span className="text-zinc-300">Auto-renews every {periodLabel}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Cancel anytime</span>
                                    <span className="text-zinc-300">One click from your wallet</span>
                                </div>
                                {network !== 'mainnet' && (
                                    <div className="flex justify-between">
                                        <span>Network</span>
                                        <span className="text-amber-400">{network}</span>
                                    </div>
                                )}
                            </div>

                            {!isConnected ? (
                                <button
                                    onClick={handleConnect}
                                    disabled={isConnecting}
                                    className="w-full rounded-xl bg-white px-6 py-3.5 text-sm font-bold text-black transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {isConnecting ? 'Connecting…' : 'Connect wallet'}
                                </button>
                            ) : (
                                <>
                                    <button
                                        onClick={handleSubscribe}
                                        disabled={phase === 'subscribing' || !signer}
                                        className="w-full rounded-xl bg-white px-6 py-3.5 text-sm font-bold text-black transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {phase === 'subscribing' ? 'Confirm in your wallet…' : 'Subscribe with Solana'}
                                    </button>
                                    <button
                                        onClick={() => disconnect()}
                                        className="mt-3 w-full text-center text-[11px] text-zinc-600 hover:text-zinc-400"
                                    >
                                        {account ? `${ellipsify(account)} — disconnect` : 'disconnect'}
                                    </button>
                                </>
                            )}

                            <p className="mt-4 text-center text-[10px] text-zinc-600">
                                Powered by Subly — audited by Cantina
                            </p>
                        </>
                    )}

                    {phase === 'success' && (
                        <div className="text-center">
                            <div className="mb-4 text-4xl">&#10003;</div>
                            <h2 className="text-lg font-semibold text-white">Subscribed!</h2>
                            <p className="mt-2 text-sm text-zinc-400">Your subscription is now active.</p>
                            {txSig && (
                                <p className="mt-3 break-all font-mono text-[10px] text-zinc-600">{txSig}</p>
                            )}
                            {redirectUrl ? (
                                <p className="mt-4 text-xs text-zinc-500">Redirecting…</p>
                            ) : (
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
