import { useState, useEffect } from 'react';
import { useWallet } from '@solana/connector/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@solana/design-system';
import { Copy, Check, Eye, EyeOff, Webhook, Key, Bell, ShieldCheck, LogOut } from 'lucide-react';
import { useSublyAuth } from '@/hooks/use-subly-auth';
import { sublyApi, SublyApiError } from '@/lib/subly-api';

export function Settings() {
    const { account } = useWallet();
    const { token, isAuthenticated, canSignMessage, isSigningIn, error: authError, signIn, signOut } = useSublyAuth();

    const [webhookUrl, setWebhookUrl] = useState('');
    const [email, setEmail] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [isApiKeyVisible, setIsApiKeyVisible] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
    const [isCopied, setIsCopied] = useState(false);

    useEffect(() => {
        if (!account || !token) return;
        let cancelled = false;
        setIsLoading(true);
        setLoadError(null);

        sublyApi.merchants
            .get(account, token)
            .then((rec) => {
                if (cancelled) return;
                setWebhookUrl(rec.webhook_url ?? '');
                setEmail(rec.email ?? '');
                setApiKey(rec.api_key ?? '');
            })
            .catch((err) => {
                if (cancelled) return;
                // 404 just means no merchant row yet — the first save creates it.
                if (err instanceof SublyApiError && err.status === 404) return;
                setLoadError(err instanceof Error ? err.message : 'Failed to load settings');
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [account, token]);

    const handleSave = async () => {
        if (!token) return;
        setIsSaving(true);
        setSaveStatus('idle');
        try {
            const rec = await sublyApi.merchants.register(token, {
                webhookUrl: webhookUrl || undefined,
                email: email || undefined,
            });
            if (rec.api_key) setApiKey(rec.api_key);
            setSaveStatus('saved');
        } catch {
            setSaveStatus('error');
        } finally {
            setIsSaving(false);
        }
    };

    const copyApiKey = () => {
        navigator.clipboard.writeText(apiKey);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    if (!account) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
                <h1 className="text-2xl font-bold">Connect your wallet</h1>
                <p className="text-muted-foreground">Connect your wallet to manage settings.</p>
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <div className="space-y-8 max-w-3xl mx-auto">
                <h1 className="text-3xl font-semibold tracking-tight text-foreground">Settings</h1>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ShieldCheck className="h-5 w-5" /> Verify your wallet
                        </CardTitle>
                        <CardDescription>
                            Sign a message to prove you own this wallet. This unlocks your API key, webhook, and
                            notification settings. It's a signature only — no transaction and no fees.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <Button variant="primary" onClick={() => void signIn().catch(() => {})} disabled={isSigningIn || !canSignMessage}>
                            {isSigningIn ? 'Waiting for signature…' : 'Sign in with wallet'}
                        </Button>
                        {!canSignMessage && (
                            <p className="text-sm text-muted-foreground">
                                The connected wallet doesn't support message signing, so settings can't be unlocked here.
                            </p>
                        )}
                        {authError && <p className="text-sm text-destructive">{authError}</p>}
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-3xl mx-auto">
            <div className="flex items-center justify-between gap-4">
                <h1 className="text-3xl font-semibold tracking-tight text-foreground">Settings</h1>
                <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                        <ShieldCheck className="h-4 w-4" /> Verified
                    </span>
                    <button onClick={signOut} className="inline-flex items-center gap-1.5 text-sm text-sand-1100 hover:text-foreground">
                        <LogOut className="h-4 w-4" /> Sign out
                    </button>
                </div>
            </div>

            {loadError && <p className="text-sm text-destructive">{loadError}</p>}

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Key className="h-5 w-5" /> API Key
                    </CardTitle>
                    <CardDescription>Use this key to authenticate SDK and API requests.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-2">
                        <code className="flex-1 rounded-lg bg-sand-100 px-4 py-2.5 font-mono text-sm">
                            {isLoading ? 'Loading…' : isApiKeyVisible ? apiKey || 'Not generated yet' : '••••••••••••••••••••••••'}
                        </code>
                        <button onClick={() => setIsApiKeyVisible(!isApiKeyVisible)} className="p-2 text-sand-1100 hover:text-foreground">
                            {isApiKeyVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                        {apiKey && (
                            <button onClick={copyApiKey} className="p-2 text-sand-1100 hover:text-foreground">
                                {isCopied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                            </button>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Webhook className="h-5 w-5" /> Webhook URL
                    </CardTitle>
                    <CardDescription>
                        We'll send subscription events (created, cancelled, payment received/failed) to this URL.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <input
                        type="url"
                        value={webhookUrl}
                        onChange={(e) => setWebhookUrl(e.target.value)}
                        placeholder="https://your-api.com/webhooks/subly"
                        className="w-full rounded-lg border border-border-low bg-transparent px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sand-500"
                    />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Bell className="h-5 w-5" /> Email Notifications
                    </CardTitle>
                    <CardDescription>Receive email alerts for payment events.</CardDescription>
                </CardHeader>
                <CardContent>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="merchant@example.com"
                        className="w-full rounded-lg border border-border-low bg-transparent px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sand-500"
                    />
                </CardContent>
            </Card>

            <div className="flex items-center gap-4">
                <Button variant="primary" onClick={handleSave} disabled={isSaving || isLoading}>
                    {isSaving ? 'Saving...' : 'Save Settings'}
                </Button>
                {saveStatus === 'saved' && <span className="text-sm text-emerald-600">Settings saved!</span>}
                {saveStatus === 'error' && <span className="text-sm text-destructive">Failed to save</span>}
            </div>
        </div>
    );
}
