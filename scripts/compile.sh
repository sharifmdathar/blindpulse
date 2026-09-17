#!/usr/bin/env bash
set -euo pipefail

# BlindPulse compile script
# Compiles BlindPulse Compact contract to circuits in ../managed/
#
# TOOLCHAIN PIN: compact 0.31.0 / language_version 0.23.
# The midnight-js 4.x stack pins @midnight-ntwrk/compact-runtime 0.16.0, and
# compact 0.31.0 is the newest compiler whose bindings target that runtime:
#   - compact 0.34.0 emits bindings for compact-runtime 0.19+ (incompatible
#     with midnight-js 4.x types)
#   - compact 0.26.0 (our previous pin) emits an older bindings layout whose
#     inline version check expects compact-runtime 0.9 and crashes on load
#     (`undefined.split`) with the current runtime
#   - 0.28/0.29/0.30 expect runtimes 0.14/0.15 (exact minor match required)
# `compact update` is idempotent — it downloads only if missing.

echo "=== BlindPulse Compile ==="

command -v compact >/dev/null 2>&1 || {
  echo "Error: 'compact' CLI not found. Install the Midnight toolchain:"
  echo "  curl --proto '=https' --tlsv1.2 -LsSf https://github.com/midnightntwrk/compact/releases/download/compact-v0.4.0/compact-installer.sh | sh"
  exit 1
}

echo "Selecting toolchain 0.31.0..."
compact update 0.31.0

cd "$(dirname "$0")/../contract"

echo "Compiling blindpulse.compact..."
compact compile blindpulse.compact ../managed

echo "Compiled circuits written to ../managed/"
echo "=== Compile complete ==="
