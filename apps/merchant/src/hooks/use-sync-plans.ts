import { useEffect, useRef } from 'react';
import { useMyPlans } from '@/hooks/use-plans';
import { useSublyAuth } from '@/hooks/use-subly-auth';
import { sublyApi } from '@/lib/subly-api';

/**
 * Registers the connected merchant's plan PDAs with the Subly backend so the
 * indexer polls only those (instead of the shared program). Runs whenever the
 * merchant is signed in and their plan list is available — including right after
 * creating a plan (the plans query invalidates → refetches → this re-runs).
 * Best-effort and idempotent server-side; failures simply retry on the next set.
 */
export function useSyncPlans() {
    const { token, isAuthenticated } = useSublyAuth();
    const { data: plans } = useMyPlans();
    const lastSynced = useRef<string>('');

    useEffect(() => {
        if (!isAuthenticated || !token || !plans?.length) return;

        const addresses = plans.map((p) => p.address).sort();
        const key = addresses.join(',');
        if (key === lastSynced.current) return; // this exact set already synced
        lastSynced.current = key;

        sublyApi.merchants.syncPlans(token, addresses).catch((err) => {
            console.warn('[subly] plan sync failed:', err);
            lastSynced.current = ''; // allow a retry next render
        });
    }, [isAuthenticated, token, plans]);
}
