import type { ReactNode } from 'react';
import { DollarSign, CreditCard, Activity, ShieldCheck } from 'lucide-react';
import { useSublyAuth } from '@/hooks/use-subly-auth';
import { useSublyAnalytics } from '@/hooks/use-subly-analytics';
import { USDC_MULTIPLIER } from '@/lib/utils';

function StatCard({ icon, label, value, hint }: { icon: ReactNode; label: string; value: string; hint?: string }) {
    return (
        <div className="flex flex-col relative overflow-hidden bg-card border-0 border-all-dashed-medium rounded-2xl">
            <div className="p-5 flex-grow">
                <div className="flex items-center gap-2 mb-6">
                    <span className="text-sand-1100">{icon}</span>
                    <h3 className="text-[17px] font-semibold text-foreground tracking-tight">{label}</h3>
                </div>
                <div className="space-y-1">
                    <div className="text-2xl font-bold text-foreground truncate">{value}</div>
                    {hint && <div className="text-sm text-sand-1100">{hint}</div>}
                </div>
            </div>
        </div>
    );
}

/**
 * Off-chain revenue analytics from the Subly backend. Requires the merchant to
 * be signed in (wallet signature); shows a sign-in prompt otherwise.
 */
export function RevenueCards() {
    const { isAuthenticated, canSignMessage, isSigningIn, signIn, error: authError } = useSublyAuth();
    const { data, isLoading, isError } = useSublyAnalytics();

    if (!isAuthenticated) {
        return (
            <div className="bg-card border-0 border-all-dashed-medium rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-2">
                    <ShieldCheck className="h-5 w-5 text-sand-1100" />
                    <h3 className="text-[17px] font-semibold text-foreground tracking-tight">Revenue analytics</h3>
                </div>
                <p className="text-sm text-sand-1100 mb-4">
                    Verify your wallet to view revenue, payments, and subscriber totals. Signature only — no fees.
                </p>
                <button
                    onClick={() => void signIn().catch(() => {})}
                    disabled={isSigningIn || !canSignMessage}
                    className="inline-flex items-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                    {isSigningIn ? 'Waiting for signature…' : 'Sign in with wallet'}
                </button>
                {authError && <p className="mt-2 text-sm text-destructive">{authError}</p>}
            </div>
        );
    }

    const revenue = data ? data.totalRevenue / USDC_MULTIPLIER : 0;
    const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const placeholder = isLoading ? '—' : null;

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
            <StatCard
                icon={<DollarSign className="h-5 w-5" />}
                label="Total Revenue"
                value={placeholder ?? `$${fmt(revenue)} USDC`}
                hint={isError ? 'Backend unavailable' : 'Collected to date'}
            />
            <StatCard
                icon={<CreditCard className="h-5 w-5" />}
                label="Payments"
                value={placeholder ?? String(data?.totalPayments ?? 0)}
                hint="Successful charges"
            />
            <StatCard
                icon={<Activity className="h-5 w-5" />}
                label="Active Subscriptions"
                value={placeholder ?? String(data?.activeSubscriptions ?? 0)}
                hint={`${data?.totalSubscriptions ?? 0} total`}
            />
        </div>
    );
}
