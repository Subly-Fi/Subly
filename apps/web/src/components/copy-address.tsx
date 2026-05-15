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
      /* fallback: the text is selectable so user can manually copy */
    }
  }, [address]);

  return (
    <div className="inline-flex items-center gap-2 font-mono text-xs">
      <span className="text-zinc-500">{label}</span>
      <code className="select-all text-zinc-400 transition-colors hover:text-white">
        {address}
      </code>
      <button
        type="button"
        onClick={handleCopy}
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
