'use client';

import { useMemo } from 'react';
import { AppProvider, getDefaultConfig } from '@solana/connector/react';
import { clusterForNetwork, normalizeNetwork, type CheckoutNetwork } from '@/lib/checkout-clusters';
import { CheckoutInner } from './checkout-inner';

export function CheckoutApp() {
    // The share link encodes which network the plan lives on; the checkout
    // operates on exactly that cluster.
    const network: CheckoutNetwork = useMemo(() => {
        if (typeof window === 'undefined') return 'mainnet';
        return normalizeNetwork(new URLSearchParams(window.location.search).get('network'));
    }, []);

    const connectorConfig = useMemo(
        () =>
            getDefaultConfig({
                appName: 'Subly',
                autoConnect: true,
                // A single cluster (overrides `network`) so the wallet and our
                // RPC calls operate on exactly the plan's network.
                clusters: [clusterForNetwork(network)],
                persistClusterSelection: false,
            }),
        [network],
    );

    return (
        <AppProvider connectorConfig={connectorConfig}>
            <CheckoutInner network={network} />
        </AppProvider>
    );
}

export default CheckoutApp;
