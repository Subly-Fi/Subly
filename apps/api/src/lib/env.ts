/**
 * Startup environment validation. In production, refuse to boot when secrets
 * that gate money movement or auth are missing — fail fast rather than fall back
 * to insecure defaults.
 */
const isProd = process.env.NODE_ENV === 'production';

export function validateEnv(): void {
  const missing: string[] = [];

  if (isProd) {
    if (!process.env.JWT_SECRET) missing.push('JWT_SECRET');
    if (!process.env.CRON_SECRET) missing.push('CRON_SECRET');
    if (!process.env.SUPABASE_URL) missing.push('SUPABASE_URL');
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  }

  if (missing.length) {
    throw new Error(`Refusing to start: missing required production env: ${missing.join(', ')}`);
  }

  if (isProd && !process.env.SUBLY_SIGNER_SECRET_KEY) {
    console.warn('[env] SUBLY_SIGNER_SECRET_KEY not set — Subly-managed payment collection will fail.');
  }
  if (isProd && !process.env.INBOUND_WEBHOOK_SECRET) {
    console.warn('[env] INBOUND_WEBHOOK_SECRET not set — inbound /webhooks/* endpoints are disabled.');
  }
}
