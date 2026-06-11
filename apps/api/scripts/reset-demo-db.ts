/**
 * Wipes all demo data from Supabase so a video take starts clean.
 *
 *   cd apps/api && set -a && source .env.local && set +a && pnpm tsx scripts/reset-demo-db.ts
 *
 * Only touches row data — schema, policies, and migrations stay intact.
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key || key.startsWith('PASTE_')) {
  console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY eksik (apps/api/.env.local).');
  process.exit(1);
}

const db = createClient(url, key);

// Child tables first; merchants last so kayıtlı cüzdanlar da temizlensin.
const tables = [
  'webhook_deliveries',
  'subscription_events',
  'payments',
  'subscriptions',
  'plans',
  'indexer_state',
  'merchants',
] as const;

for (const table of tables) {
  // PostgREST delete requires a filter; bu koşul her satırı kapsar.
  const { error, count } = await db
    .from(table)
    .delete({ count: 'exact' })
    .not('created_at', 'is', null)
    .gte('created_at', '1970-01-01');

  if (error) {
    // indexer_state'in created_at kolonu yok — anahtar kolonuyla sil.
    const fallback = await db.from(table).delete({ count: 'exact' }).neq('program', '');
    if (fallback.error) {
      console.error(`✗ ${table}: ${error.message} / ${fallback.error.message}`);
      process.exitCode = 1;
      continue;
    }
    console.log(`✓ ${table} temizlendi (${fallback.count ?? 0} satır)`);
    continue;
  }
  console.log(`✓ ${table} temizlendi (${count ?? 0} satır)`);
}

console.log('Demo veritabanı sıfırlandı.');
