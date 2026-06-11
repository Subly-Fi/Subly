import { cn } from './cn';

export interface PlanCardProps {
  name: string;
  description?: string;
  amount: string;
  period: string;
  mint?: string;
  subscriberCount?: number;
  isActive?: boolean;
  onSubscribe?: () => void;
  onManage?: () => void;
  className?: string;
}

export function PlanCard({
  name,
  description,
  amount,
  period,
  mint = 'USDC',
  subscriberCount,
  isActive = true,
  onSubscribe,
  onManage,
  className,
}: PlanCardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950',
        !isActive && 'opacity-60',
        className,
      )}
    >
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{name}</h3>
        {description && (
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
        )}
      </div>

      <div className="mb-6">
        <span className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">{amount}</span>
        <span className="ml-1 text-sm text-zinc-500 dark:text-zinc-400">{mint}</span>
        <span className="ml-1 text-sm text-zinc-500 dark:text-zinc-400">/ {period}</span>
      </div>

      {subscriberCount !== undefined && (
        <p className="mb-4 text-xs text-zinc-400 dark:text-zinc-500">
          {subscriberCount} subscriber{subscriberCount !== 1 ? 's' : ''}
        </p>
      )}

      <div className="flex gap-2">
        {onSubscribe && (
          <button
            type="button"
            onClick={onSubscribe}
            disabled={!isActive}
            className={cn(
              'flex-1 rounded-full bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors',
              'hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            Subscribe
          </button>
        )}
        {onManage && (
          <button
            type="button"
            onClick={onManage}
            className="rounded-full border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Manage
          </button>
        )}
      </div>
    </div>
  );
}
