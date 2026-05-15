const ITEMS = [
  'subscriptions',
  'solana',
  'audited by cantina',
  'pinocchio',
  'SPL Token',
  'delegations',
  'recurring',
  'wallet-to-wallet',
  'open source',
  'Token-2022',
  '@solana/kit',
];

export function Marquee({
  speed = 30,
  reverse = false,
}: {
  speed?: number;
  reverse?: boolean;
}) {
  const content = ITEMS.map((t) => (
    <span key={t} className="mx-6 shrink-0 whitespace-nowrap text-xs uppercase tracking-[0.2em] text-zinc-600 sm:mx-8 sm:text-sm">
      {t}
    </span>
  ));

  return (
    <div className="relative overflow-hidden border-y border-zinc-800/50 py-4">
      <div
        className="flex w-max"
        style={{
          animation: `marquee ${speed}s linear infinite${reverse ? ' reverse' : ''}`,
        }}
      >
        <div className="flex shrink-0 font-mono">{content}</div>
        <div className="flex shrink-0 font-mono" aria-hidden>{content}</div>
      </div>
    </div>
  );
}
