#!/usr/bin/env bash
# Per-session Supabase stacks on the Oracle VM.
# Slot 0 = main checkout (VM folder ~/vitalos-platform, ports 55321+).
# Slots 1-3 = one isolated stack each (ports +100 per slot, own project_id, own folder on the VM).
set -euo pipefail
SELF="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"
cd "$(git rev-parse --show-toplevel)"
VM=${VM:-oracle-vm}
cmd=${1:-help}
n=${2:-}

vm() { ssh "$VM" "$@"; }

slot_vars() {
  [[ "$n" =~ ^[1-3]$ ]] || { echo "slot must be 1, 2 or 3" >&2; exit 2; }
  off=$((n * 100))
  P_API=$((55321 + off)); P_DB=$((55322 + off)); P_STUDIO=$((55323 + off)); P_MAIL=$((55324 + off))
  P_WEB=$((8000 + n)); P_PG=$((5433 + n))
  DIR="vitalos-slots/s$n"
}

case "$cmd" in
  claim)
    owner=$(basename "$PWD")
    vm "mkdir -p ~/vitalos-slots"
    for i in 1 2 3; do
      if vm "mkdir ~/vitalos-slots/.lock-s$i 2>/dev/null && echo '$owner' > ~/vitalos-slots/.lock-s$i/owner"; then
        echo "$i"
        exit 0
      fi
    done
    echo "no free slot" >&2
    exit 1
    ;;
  sync)
    slot_vars
    vm "mkdir -p ~/$DIR && rm -rf ~/$DIR/supabase/migrations"
    tar cz supabase | vm "tar xz -C ~/$DIR"
    expr="s/^project_id = .*/project_id = \"vitalos-s$n\"/"
    for p in 55320 55321 55322 55323 55324 55327 55329; do
      expr="$expr;s/\\b$p\\b/$((p + off))/g"
    done
    vm "cd ~/$DIR/supabase && sed -i -E '$expr' config.toml"
    ;;
  up)
    slot_vars
    bash "$SELF" sync "$n"
    vm "cd ~/$DIR && supabase start"
    ;;
  down)
    slot_vars
    vm "cd ~/$DIR && supabase stop"
    ;;
  reset)
    slot_vars
    vm "cd ~/$DIR && supabase db reset"
    ;;
  status)
    slot_vars
    vm "cd ~/$DIR && supabase status"
    ;;
  env)
    slot_vars
    root=$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")
    if [ "$PWD" -ef "$root" ]; then
      echo "refusing: the main checkout uses slot 0" >&2
      exit 1
    fi
    [ -f .env.local ] || cp "$root/.env.local" .env.local
    sed -i -e "s/\b55321\b/$P_API/g" -e "s/\b55322\b/$P_DB/g" \
           -e "s/\b55323\b/$P_STUDIO/g" -e "s/\b55324\b/$P_MAIL/g" .env.local
    echo ".env.local now points at slot $n (API $P_API, DB $P_DB)"
    ;;
  tunnel)
    slot_vars
    ssh -fN -o ExitOnForwardFailure=yes \
      -L "$P_API:localhost:$P_API" -L "$P_DB:localhost:$P_DB" -L "$P_STUDIO:localhost:$P_STUDIO" \
      -L "$P_MAIL:localhost:$P_MAIL" -L "$P_WEB:localhost:$P_WEB" -L "$P_PG:localhost:$P_PG" "$VM"
    echo "tunnel up for slot $n"
    ;;
  release)
    slot_vars
    bash "$SELF" down "$n" || true
    vm "rm -rf ~/vitalos-slots/.lock-s$n"
    echo "slot $n released"
    ;;
  *)
    echo "usage: vm-slot.sh <claim | sync|up|down|reset|status|env|tunnel|release> [slot 1-3]"
    ;;
esac
