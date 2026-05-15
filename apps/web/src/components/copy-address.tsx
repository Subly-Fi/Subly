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
      /* clipboard not available */
    }
  }, [address]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="group inline-flex items-center gap-2 font-mono text-xs transition-colors"
    >
      <span className="text-zinc-600">{label}</span>
      <span className="text-zinc-500 transition-colors group-hover:text-zinc-300">
        {address}
      </span>
      {isCopied ? (
        <Check size={12} className="shrink-0 text-emerald-400" />
      ) : (
        <Copy size={12} className="shrink-0 text-zinc-600 transition-colors group-hover:text-zinc-400" />
      )}
      {isCopied && (
        <span className="text-[10px] text-emerald-400">copied!</span>
      )}
    </button>
  );
}
