#!/usr/bin/env bash
# Copies Midnight wasm binaries into public/midnight-runtime so the browser
# shims in src/lib/wasm can fetch them at runtime (webpack cannot bundle
# the .wasm files directly). Idempotent — safe to run on every build.
set -euo pipefail
cd "$(dirname "$0")/.."

copy_wasm() {
  local src="$1" dest_dir="$2"
  mkdir -p "public/${dest_dir}"
  cp -f "${src}" "public/${dest_dir}/"
}

copy_wasm \
  "node_modules/@midnight-ntwrk/onchain-runtime-v3/midnight_onchain_runtime_wasm_bg.wasm" \
  "midnight-runtime/onchain-runtime-v3"

copy_wasm \
  "node_modules/@midnight-ntwrk/ledger-v8/midnight_ledger_wasm_bg.wasm" \
  "midnight-runtime/ledger-v8"

echo "wasm binaries staged under public/midnight-runtime"
