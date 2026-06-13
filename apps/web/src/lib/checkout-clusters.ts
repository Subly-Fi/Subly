import type { SolanaCluster, SolanaClusterId } from '@solana/connector/react';

export type CheckoutNetwork = 'mainnet' | 'devnet' | 'testnet' | 'localnet';

export function normalizeNetwork(raw: string | null): CheckoutNetwork {
    if (raw === 'devnet' || raw === 'testnet' || raw === 'localnet') return raw;
    return 'mainnet';
}

export function rpcUrlForNetwork(network: CheckoutNetwork): string {
    switch (network) {
        case 'localnet':
            return process.env.NEXT_PUBLIC_LOCALNET_RPC_URL ?? 'http://127.0.0.1:8899';
        case 'devnet':
            return 'https://api.devnet.solana.com';
        case 'testnet':
            return 'https://api.testnet.solana.com';
        case 'mainnet':
        default:
            return process.env.NEXT_PUBLIC_MAINNET_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
    }
}

export function clusterIdForNetwork(network: CheckoutNetwork): SolanaClusterId {
    return `solana:${network}` as SolanaClusterId;
}

/** Build the single cluster the checkout operates on, based on the share link. */
export function clusterForNetwork(network: CheckoutNetwork): SolanaCluster {
    return {
        id: clusterIdForNetwork(network),
        label: network.charAt(0).toUpperCase() + network.slice(1),
        url: rpcUrlForNetwork(network),
    } as SolanaCluster;
}

export const PROGRAM_ADDRESS = process.env.NEXT_PUBLIC_PROGRAM_ADDRESS ?? 'De1egAFMkMWZSN5rYXRj9CAdheBamobVNubTsi9avR44';
