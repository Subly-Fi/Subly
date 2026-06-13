/**
 * Hosted-checkout link + embed snippet helpers.
 *
 * The checkout page resolves everything it needs (terms, mint, owner) from the
 * plan account on-chain, so a share link only needs the plan PDA. An optional
 * `network` hint lets the checkout pick the right RPC for non-mainnet demos.
 */
const BASE_URL = (import.meta.env.VITE_CHECKOUT_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? 'https://subly.fi';

export function checkoutUrl(planAddress: string, opts?: { network?: string; redirect?: string }): string {
    const url = new URL(`${BASE_URL}/checkout`);
    url.searchParams.set('plan', planAddress);
    if (opts?.network && opts.network !== 'mainnet') url.searchParams.set('network', opts.network);
    if (opts?.redirect) url.searchParams.set('redirect', opts.redirect);
    return url.toString();
}

/** Inline <script> that injects a "Subscribe with Solana" button opening checkout. */
export function embedScriptSnippet(planAddress: string, network?: string): string {
    const href = checkoutUrl(planAddress, { network });
    return `<!-- Subly subscribe button -->
<a href="${href}"
   style="display:inline-flex;align-items:center;gap:8px;padding:12px 20px;border-radius:9999px;background:#000;color:#fff;font:600 14px system-ui,sans-serif;text-decoration:none">
  Subscribe with Solana
</a>`;
}

/** Embeddable iframe for sites that prefer an inline checkout. */
export function embedIframeSnippet(planAddress: string, network?: string): string {
    const href = checkoutUrl(planAddress, { network });
    return `<iframe src="${href}"
        width="420" height="640" frameborder="0"
        style="border-radius:16px;max-width:100%"
        title="Subly checkout"></iframe>`;
}
