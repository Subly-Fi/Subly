import { useState } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';
import { Button as SolanaButton } from '@solana/design-system';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useClusterConfig } from '@/hooks/use-cluster-config';
import { clusterIdToNetwork } from '@/lib/cluster';
import { checkoutUrl, embedScriptSnippet, embedIframeSnippet } from '@/lib/checkout';

type Tab = 'link' | 'button' | 'iframe';

function CopyField({ value, multiline }: { value: string; multiline?: boolean }) {
    const [copied, setCopied] = useState(false);
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            /* clipboard blocked — user can still select manually */
        }
    };
    return (
        <div className="relative">
            {multiline ? (
                <pre className="max-h-48 overflow-auto rounded-lg border border-sand-300 bg-sand-100 p-3 pr-12 font-mono text-xs text-foreground whitespace-pre-wrap break-all">
                    {value}
                </pre>
            ) : (
                <div className="flex items-center rounded-lg border border-sand-300 bg-sand-100 p-3 pr-12">
                    <span className="font-mono text-xs text-foreground break-all">{value}</span>
                </div>
            )}
            <button
                type="button"
                onClick={copy}
                className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md border border-sand-300 bg-card px-2 py-1 text-xs text-foreground hover:bg-sand-100"
            >
                {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                {copied ? 'Copied' : 'Copy'}
            </button>
        </div>
    );
}

export function ShareCheckoutDialog({
    planAddress,
    planName,
    open,
    onOpenChange,
}: {
    planAddress: string;
    planName: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const { id } = useClusterConfig();
    const network = clusterIdToNetwork(id);
    const [tab, setTab] = useState<Tab>('link');

    const link = checkoutUrl(planAddress, { network });
    const value = tab === 'link' ? link : tab === 'button' ? embedScriptSnippet(planAddress, network) : embedIframeSnippet(planAddress, network);

    const tabs: { id: Tab; label: string }[] = [
        { id: 'link', label: 'Link' },
        { id: 'button', label: 'Button' },
        { id: 'iframe', label: 'Embed' },
    ];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Share “{planName || 'Plan'}”</DialogTitle>
                    <DialogDescription>
                        Drop this on your site. Customers subscribe with their wallet — no account, no card.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex gap-1 rounded-lg bg-sand-100 p-1">
                    {tabs.map(t => (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => setTab(t.id)}
                            className={
                                'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ' +
                                (tab === t.id ? 'bg-card text-foreground shadow-sm' : 'text-sand-1100 hover:text-foreground')
                            }
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                <div className="mt-1 space-y-3">
                    <CopyField value={value} multiline={tab !== 'link'} />

                    {tab === 'link' && (
                        <a
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-sm text-foreground hover:text-sand-1100"
                        >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Open checkout preview
                        </a>
                    )}

                    {network !== 'mainnet' && (
                        <p className="text-xs text-amber-600">
                            This link targets <span className="font-semibold">{network}</span>. Plans created on{' '}
                            {network} won’t resolve on mainnet — re-share once you’re live.
                        </p>
                    )}
                </div>

                <div className="mt-2 flex justify-end">
                    <SolanaButton size="sm" onClick={() => onOpenChange(false)}>
                        Done
                    </SolanaButton>
                </div>
            </DialogContent>
        </Dialog>
    );
}
