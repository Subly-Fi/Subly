import { cn } from './cn';

export interface SubscribeButtonProps {
  planName?: string;
  amount?: string;
  period?: string;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

export function SubscribeButton({
  planName,
  amount,
  period,
  onClick,
  disabled = false,
  loading = false,
  className,
}: SubscribeButtonProps) {
  const label = amount && period ? `${amount} / ${period}` : 'Subscribe';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-sky-500 to-violet-500 px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all',
        'hover:from-sky-400 hover:to-violet-400 hover:shadow-xl',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2',
        className,
      )}
    >
      <SolanaLogo />
      <span className="flex flex-col items-start leading-tight">
        <span className="text-xs opacity-80">{planName ?? 'Subscribe with Solana'}</span>
        <span className="font-bold">{loading ? 'Processing...' : label}</span>
      </span>
    </button>
  );
}

function SolanaLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M25.5 99.5L43.2 81.1C43.9 80.4 44.8 80 45.8 80H119.7C121.3 80 122.1 81.9 121 83.1L103.3 101.5C102.6 102.2 101.7 102.6 100.7 102.6H26.8C25.2 102.6 24.4 100.7 25.5 99.5Z"
        fill="currentColor"
      />
      <path
        d="M25.5 28.5L43.2 46.9C43.9 47.6 44.8 48 45.8 48H119.7C121.3 48 122.1 46.1 121 44.9L103.3 26.5C102.6 25.8 101.7 25.4 100.7 25.4H26.8C25.2 25.4 24.4 27.3 25.5 28.5Z"
        fill="currentColor"
      />
      <path
        d="M103.3 63.5L121 81.9C122.1 83.1 121.3 85 119.7 85H45.8C44.8 85 43.9 84.6 43.2 83.9L25.5 65.5C24.4 64.3 25.2 62.4 26.8 62.4H100.7C101.7 62.4 102.6 62.8 103.3 63.5Z"
        fill="currentColor"
      />
    </svg>
  );
}
