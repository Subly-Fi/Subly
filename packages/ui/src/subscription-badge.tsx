import { cn } from './cn';

export type SubscriptionStatus = 'active' | 'cancelled' | 'expired' | 'pending';

export interface SubscriptionBadgeProps {
  status: SubscriptionStatus;
  className?: string;
}

const statusConfig: Record<SubscriptionStatus, { label: string; classes: string }> = {
  active: {
    label: 'Active',
    classes: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-400 dark:ring-emerald-400/20',
  },
  cancelled: {
    label: 'Cancelled',
    classes: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-950 dark:text-amber-400 dark:ring-amber-400/20',
  },
  expired: {
    label: 'Expired',
    classes: 'bg-zinc-50 text-zinc-600 ring-zinc-500/20 dark:bg-zinc-900 dark:text-zinc-400 dark:ring-zinc-400/20',
  },
  pending: {
    label: 'Pending',
    classes: 'bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-950 dark:text-blue-400 dark:ring-blue-400/20',
  },
};

export function SubscriptionBadge({ status, className }: SubscriptionBadgeProps) {
  const config = statusConfig[status];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        config.classes,
        className,
      )}
    >
      {config.label}
    </span>
  );
}
