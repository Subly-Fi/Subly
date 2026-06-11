import { cn } from './cn';

export type DelegationKind = 'fixed' | 'recurring' | 'subscription';

export interface DelegationCardProps {
  kind: DelegationKind;
  amount: string;
  mint?: string;
  period?: string;
  delegatee: string;
  expiresAt?: string;
  isExpired?: boolean;
  onRevoke?: () => void;
  className?: string;
}

const kindLabels: Record<DelegationKind, string> = {
  fixed: 'Fixed',
  recurring: 'Recurring',
  subscription: 'Subscription',
};

export function DelegationCard({
  kind,
  amount,
  mint = 'USDC',
  period,
  delegatee,
  expiresAt,
  isExpired = false,
  onRevoke,
  className,
}: DelegationCardProps) {
  const truncated = `${delegatee.slice(0, 6)}...${delegatee.slice(-4)}`;

  return (
    <div
      className={cn(
        'rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950',
        isExpired && 'opacity-50',
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <span className="inline-block rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            {kindLabels[kind]}
          </span>
          <p className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {amount} <span className="text-sm font-normal text-zinc-500">{mint}</span>
            {period && <span className="text-sm font-normal text-zinc-500"> / {period}</span>}
          </p>
          <p className="mt-1 text-xs text-zinc-400 font-mono">{truncated}</p>
          {expiresAt && (
            <p className="mt-1 text-xs text-zinc-400">
              {isExpired ? 'Expired' : 'Expires'}: {expiresAt}
            </p>
          )}
        </div>

        {onRevoke && !isExpired && (
          <button
            type="button"
            onClick={onRevoke}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
          >
            Revoke
          </button>
        )}
      </div>
    </div>
  );
}
