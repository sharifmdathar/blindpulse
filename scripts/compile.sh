#!/usr/bin/env bash
set -euo pipefail

# BlindPulse compile script
# Compiles BlindPulse Compact contract to circuits in ../managed/
#
# TOOLCHAIN PIN: compact 0.26.0 / language_version 0.18.
# The midnight-js 4.x stack pins @midnight-ntwrk/compact-runtime 0.16.0, and
# only compact 0.26.0 emits bindings for that runtime API:
#   - newer compilers (0.31+) emit copyCircuitContext/finalizeCallProofData,
#     which need compact-runtime 0.19+ (incompatible with midnight-js 4.x types)
#   - older compilers (0.23) only speak language 0.15 (no assert, no vector[i])
# `compact update` is idempotent — it downloads only if missing.

echo "=== BlindPulse Compile ==="

command -v compact >/dev/null 2>&1 || {
  echo "Error: 'compact' CLI not found. Install the Midnight toolchain:"
  echo "  curl --proto '=https' --tlsv1.2 -LsSf https://github.com/midnightntwrk/compact/releases/download/compact-v0.4.0/compact-installer.sh | sh"
  exit 1
}

echo "Selecting toolchain 0.26.0..."
compact update 0.26.0

cd "$(dirname "$0")/../contract"

echo "Compiling blindpulse.compact..."
compact compile blindpulse.compact ../managed

echo "Compiled circuits written to ../managed/"
echo "=== Compile complete ==="
