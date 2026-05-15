'use client';

import { useState, useCallback } from 'react';
import { Copy, Check } from 'lucide-react';

export function CopyAddress({
  label,
  address,
}: {
  label: string;
  address: string;
}) {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(address);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      /* text is selectable, user can copy manually */
    }
  }, [address]);

  return (
    <div
      className="inline-flex items-center gap-2 font-mono text-xs"
      style={{ position: 'relative', zIndex: 40 }}
    >
      <span className="text-zinc-500">{label}</span>
      <span
        style={{ userSelect: 'all', WebkitUserSelect: 'all', cursor: 'text' }}
        className="text-zinc-400 hover:text-white transition-colors"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {address}
      </span>
      <button
        type="button"
        onClick={handleCopy}
        onMouseDown={(e) => e.stopPropagation()}
        style={{ position: 'relative', zIndex: 41 }}
        className="shrink-0 cursor-pointer text-zinc-500 transition-colors hover:text-white"
        aria-label="Copy address"
      >
        {isCopied ? (
          <Check size={14} className="text-emerald-400" />
        ) : (
          <Copy size={14} />
        )}
      </button>
      {isCopied && (
        <span className="text-[10px] font-semibold text-emerald-400">copied!</span>
      )}
    </div>
  );
}
