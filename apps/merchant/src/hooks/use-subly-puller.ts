/**
 * The Subly-operated collector ("puller") wallet. When a merchant adds this
 * address to a plan's `pullers`, Subly's backend cron can charge subscribers
 * each period on the merchant's behalf — the Stripe-style hosted model.
 *
 * Sourced from VITE_SUBLY_PULLER_ADDRESS (written per-network by the deploy /
 * demo tooling). Returns null when unset, so the UI degrades to manual pulling.
 */
const RAW = import.meta.env.VITE_SUBLY_PULLER_ADDRESS as string | undefined;

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function useSublyPuller(): string | null {
    const trimmed = RAW?.trim();
    if (!trimmed || !BASE58_RE.test(trimmed)) return null;
    return trimmed;
}
