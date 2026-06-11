#!/usr/bin/env bash
# ============================================================================
# Subly — local demo stack (localnet, no production deploy)
#
#   scripts/demo-local.sh up       # start everything (default)
#   scripts/demo-local.sh stop     # stop everything
#   scripts/demo-local.sh status   # port / process overview
#
# Stack:
#   :8899  surfpool (local validator, program at canonical address, time-travel)
#   :3001  merchant local dev API (faucet / setup / config)
#   :3002  Subly backend API (auth, analytics, indexer, cron collector)
#   :5173  merchant dashboard (vite)
#
# Requirements: node>=20, pnpm, solana CLI (incl. spl-token, solana-keygen),
# surfpool (brew install txtx/taps/surfpool  |  curl -sL https://run.surfpool.run/ | bash)
# ============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SUBS="$ROOT/packages/subscriptions"
DEMO_DIR="$ROOT/.demo"
KEYS_DIR="$ROOT/keys"
PROGRAM_ID="De1egAFMkMWZSN5rYXRj9CAdheBamobVNubTsi9avR44"
RPC_URL="http://127.0.0.1:8899"
SO_PATH="$SUBS/target/deploy/subscriptions_program.so"
SIGNER_PATH="$KEYS_DIR/subly-signer-localnet.json"
SUPABASE_URL_DEFAULT="https://jjfnnzdpicwtcivgmrgh.supabase.co"

mkdir -p "$DEMO_DIR" "$KEYS_DIR"

log()  { printf '\033[1;36m[demo]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[demo]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[demo]\033[0m %s\n' "$*" >&2; exit 1; }

port_open() { curl -sf -m 2 -X POST "http://127.0.0.1:$1" -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' >/dev/null 2>&1 || nc -z 127.0.0.1 "$1" >/dev/null 2>&1; }

start_bg() { # name, dir, command...
  local name="$1" dir="$2"; shift 2
  ( cd "$dir" && nohup "$@" >"$DEMO_DIR/$name.log" 2>&1 & echo $! > "$DEMO_DIR/$name.pid" )
  log "$name başlatıldı (pid $(cat "$DEMO_DIR/$name.pid"), log: .demo/$name.log)"
}

stop_one() {
  local name="$1"
  if [[ -f "$DEMO_DIR/$name.pid" ]]; then
    local pid; pid=$(cat "$DEMO_DIR/$name.pid")
    if kill -0 "$pid" 2>/dev/null; then kill "$pid" 2>/dev/null || true; sleep 0.3; kill -9 "$pid" 2>/dev/null || true; fi
    rm -f "$DEMO_DIR/$name.pid"
    log "$name durduruldu"
  fi
}

cmd_stop() {
  for s in vite subly-api local-api surfpool; do stop_one "$s"; done
  pkill -f 'surfpool start' 2>/dev/null || true
  log "tamamlandı."
}

cmd_status() {
  for entry in "surfpool:8899" "local-api:3001" "subly-api:3002" "vite:5173"; do
    local_name="${entry%%:*}"; local_port="${entry##*:}"
    if port_open "$local_port"; then echo "  ✓ $local_name (:$local_port) çalışıyor"; else echo "  ✗ $local_name (:$local_port) kapalı"; fi
  done
}

cmd_up() {
  # ── 1. Bağımlılık kontrolleri ─────────────────────────────────────────────
  command -v node    >/dev/null || die "node bulunamadı"
  command -v pnpm    >/dev/null || die "pnpm bulunamadı"
  command -v solana  >/dev/null || die "solana CLI bulunamadı → https://solana.com/docs/intro/installation"
  command -v spl-token >/dev/null || die "spl-token bulunamadı (solana CLI kurulumuyla gelir)"
  command -v solana-keygen >/dev/null || die "solana-keygen bulunamadı"
  command -v surfpool >/dev/null || die "surfpool bulunamadı → brew install txtx/taps/surfpool"

  # ── 2. Varsayılan keypair (fee payer) ────────────────────────────────────
  if [[ ! -f "$HOME/.config/solana/id.json" ]]; then
    log "Varsayılan solana keypair yok, oluşturuluyor..."
    solana-keygen new --no-bip39-passphrase --silent
  fi

  # ── 3. Program binary'si (mainnet'ten dump — Rust toolchain gerekmez) ────
  if [[ ! -f "$SO_PATH" ]]; then
    log "Program binary'si yok; mainnet'ten indiriliyor (solana program dump)..."
    mkdir -p "$(dirname "$SO_PATH")"
    solana program dump "$PROGRAM_ID" "$SO_PATH" --url mainnet-beta \
      || die "Program dump başarısız. İnternet bağlantısını kontrol et."
    log "✓ $SO_PATH ($(du -h "$SO_PATH" | cut -f1))"
  fi

  # ── 4. Merchant api/scripts bağımlılıkları ───────────────────────────────
  # Bu iki klasör pnpm workspace ÜYESİ DEĞİL (apps/* sadece apps/merchant'ı
  # kapsar). --ignore-workspace olmadan pnpm kuruluma kök workspace'te yapar
  # ve node_modules/.bin/tsx burada oluşmaz.
  if [[ ! -x "$ROOT/apps/merchant/api/node_modules/.bin/tsx" ]]; then
    log "merchant/api deps kuruluyor..."
    ( cd "$ROOT/apps/merchant/api" && pnpm install --ignore-workspace --silent )
  fi
  if [[ ! -x "$ROOT/apps/merchant/scripts/node_modules/.bin/tsx" ]]; then
    log "merchant/scripts deps kuruluyor..."
    ( cd "$ROOT/apps/merchant/scripts" && pnpm install --ignore-workspace --silent )
  fi

  # ── 5. Surfpool (validator + program kurulumu runbook ile) ───────────────
  if port_open 8899; then
    log "✓ Validator zaten çalışıyor (:8899)"
  else
    log "Surfpool başlatılıyor (offline, surfnet-setup runbook'u ile)..."
    ( cd "$SUBS" && nohup surfpool start --no-tui --port 8899 --offline --yes --runbook surfnet-setup \
        >"$DEMO_DIR/surfpool.log" 2>&1 & echo $! > "$DEMO_DIR/surfpool.pid" )
    for i in $(seq 1 30); do port_open 8899 && break; sleep 1; done
    port_open 8899 || die "Validator 30 sn içinde ayağa kalkmadı — .demo/surfpool.log'a bak"
    log "✓ Validator hazır"
    sleep 2
  fi

  # ── 6. Program zincirde mi? (runbook bazen sessiz düşebilir — garantiye al)
  if ! solana account "$PROGRAM_ID" --url "$RPC_URL" >/dev/null 2>&1; then
    log "Program localnete kurulmamış; surfnet_writeProgram ile yazılıyor..."
    node -e "
      const fs=require('fs');
      const hex=fs.readFileSync('$SO_PATH').toString('hex');
      fs.writeFileSync('$DEMO_DIR/write-program.json', JSON.stringify({jsonrpc:'2.0',id:1,method:'surfnet_writeProgram',params:['$PROGRAM_ID',hex,0]}));
    "
    RESULT=$(curl -s -X POST "$RPC_URL" -H 'Content-Type: application/json' --data @"$DEMO_DIR/write-program.json")
    echo "$RESULT" | grep -q '"error"' && die "Program yazılamadı: $RESULT"
    solana account "$PROGRAM_ID" --url "$RPC_URL" >/dev/null 2>&1 || die "Program hâlâ zincirde görünmüyor"
  fi
  log "✓ Program zincirde ($PROGRAM_ID)"

  # ── 7. Fee payer'a SOL ───────────────────────────────────────────────────
  solana airdrop 10 --url "$RPC_URL" >/dev/null 2>&1 || true

  # ── 8. Mock USDC + config.json (idempotent) ──────────────────────────────
  log "Test ortamı başlatılıyor (mock USDC, config)..."
  ( cd "$ROOT/apps/merchant/scripts" && NETWORK=localnet RPC_URL="$RPC_URL" ./node_modules/.bin/tsx init-test-environment.ts )

  USDC_MINT=$(node -e "const c=JSON.parse(require('fs').readFileSync('$ROOT/apps/merchant/config.json'));process.stdout.write(c.networks.localnet.tokens.find(t=>t.symbol==='USDC').mint)")
  log "✓ Mock USDC: $USDC_MINT"

  # ── 9. Subly signer (puller) cüzdanı ─────────────────────────────────────
  if [[ ! -f "$SIGNER_PATH" ]]; then
    solana-keygen new --no-bip39-passphrase --silent -o "$SIGNER_PATH"
  fi
  SIGNER_ADDRESS=$(solana-keygen pubkey "$SIGNER_PATH")
  solana airdrop 5 "$SIGNER_ADDRESS" --url "$RPC_URL" >/dev/null 2>&1 || true
  SIGNER_SECRET=$(cat "$SIGNER_PATH")
  log "✓ Subly signer: $SIGNER_ADDRESS"

  # ── 10. Env dosyaları ─────────────────────────────────────────────────────
  MERCHANT_ENV="$ROOT/apps/merchant/.env.local"
  cat > "$MERCHANT_ENV" <<EOF
# scripts/demo-local.sh tarafından üretildi
VITE_DEFAULT_CLUSTER=solana:localnet
VITE_LOCALNET_PROGRAM=$PROGRAM_ID
VITE_LOCALNET_USDC_MINT=$USDC_MINT
VITE_API_URL=http://localhost:3001
VITE_SUBLY_API_URL=http://localhost:3002
EOF
  log "✓ apps/merchant/.env.local yazıldı"

  API_ENV="$ROOT/apps/api/.env.local"
  if [[ -f "$API_ENV" ]] && grep -q "SUPABASE_SERVICE_ROLE_KEY=ey" "$API_ENV" 2>/dev/null; then
    # Service role anahtarı elle girilmiş — koru, sadece localnet alanlarını tazele.
    EXISTING_KEY=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' "$API_ENV" | cut -d= -f2-)
  else
    EXISTING_KEY="${SUPABASE_SERVICE_ROLE_KEY:-PASTE_SERVICE_ROLE_KEY_HERE}"
  fi
  JWT_SECRET_VAL=$( (grep '^JWT_SECRET=' "$API_ENV" 2>/dev/null | cut -d= -f2-) || true)
  [[ -n "${JWT_SECRET_VAL:-}" ]] || JWT_SECRET_VAL=$(openssl rand -hex 32)
  CRON_SECRET_VAL=$( (grep '^CRON_SECRET=' "$API_ENV" 2>/dev/null | cut -d= -f2-) || true)
  [[ -n "${CRON_SECRET_VAL:-}" ]] || CRON_SECRET_VAL=$(openssl rand -hex 32)

  cat > "$API_ENV" <<EOF
# scripts/demo-local.sh tarafından üretildi (localnet demo)
SOLANA_RPC_URL=$RPC_URL
SOLANA_WS_URL=ws://127.0.0.1:8900
PROGRAM_ADDRESS=$PROGRAM_ID
SUPABASE_URL=$SUPABASE_URL_DEFAULT
SUPABASE_SERVICE_ROLE_KEY=$EXISTING_KEY
JWT_SECRET=$JWT_SECRET_VAL
CRON_SECRET=$CRON_SECRET_VAL
SUBLY_SIGNER_ADDRESS=$SIGNER_ADDRESS
SUBLY_SIGNER_SECRET_KEY=$SIGNER_SECRET
PORT=3002
EOF
  log "✓ apps/api/.env.local yazıldı"

  if [[ "$EXISTING_KEY" == "PASTE_SERVICE_ROLE_KEY_HERE" ]]; then
    warn "─────────────────────────────────────────────────────────────"
    warn "SUPABASE_SERVICE_ROLE_KEY eksik!"
    warn "Supabase Dashboard → Project Settings → API Keys → service_role"
    warn "anahtarını kopyala ve apps/api/.env.local içine yapıştır,"
    warn "sonra scripti tekrar çalıştır. (Auth/analytics bu olmadan boş döner.)"
    warn "─────────────────────────────────────────────────────────────"
  fi

  # ── 11. Servisler ────────────────────────────────────────────────────────
  if port_open 3001; then log "✓ local-api zaten çalışıyor"; else
    start_bg local-api "$ROOT/apps/merchant/api" ./node_modules/.bin/tsx --watch server.ts
  fi

  if port_open 3002; then log "✓ subly-api zaten çalışıyor"; else
    ( cd "$ROOT/apps/api" && set -a && source "$API_ENV" && set +a && nohup pnpm run dev >"$DEMO_DIR/subly-api.log" 2>&1 & echo $! > "$DEMO_DIR/subly-api.pid" )
    log "subly-api başlatıldı (log: .demo/subly-api.log)"
  fi

  if port_open 5173; then log "✓ vite zaten çalışıyor"; else
    start_bg vite "$ROOT/apps/merchant" pnpm run dev
  fi

  sleep 3
  echo
  log "════════════════════════════════════════════════════════════"
  log " Demo stack hazır 🎬"
  log "   Dashboard      → http://localhost:5173"
  log "   Validator      → $RPC_URL  (time-travel destekli)"
  log "   Subly API      → http://localhost:3002"
  log "   Mock USDC mint → $USDC_MINT"
  log "   Subly puller   → $SIGNER_ADDRESS"
  log ""
  log " Cüzdan fonlamak: dashboard içindeki Faucet sayfası"
  log " Tahsilatı tetiklemek (Subly cron):"
  log "   curl -X POST http://localhost:3002/cron/collect-payments \\"
  log "        -H \"Authorization: Bearer $CRON_SECRET_VAL\""
  log " Durdurmak: scripts/demo-local.sh stop"
  log "════════════════════════════════════════════════════════════"
}

case "${1:-up}" in
  up)     cmd_up ;;
  stop)   cmd_stop ;;
  status) cmd_status ;;
  *)      die "kullanım: $0 [up|stop|status]" ;;
esac
