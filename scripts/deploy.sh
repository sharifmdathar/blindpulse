#!/usr/bin/env bash
set -euo pipefail

# BlindPulse deploy script
# Deploys compiled contract to Midnight Preprod network

echo "=== BlindPulse Deploy ==="
echo "Network: Preprod"
echo ""

# Check dependencies
command -v compact >/dev/null 2>&1 || {
  echo "Error: 'compact' CLI not found. Install the Midnight toolchain."
  exit 1
}

# Compile if needed
if [ ! -d "../managed/circuits" ]; then
  echo "Compiling contract..."
  cd "$(dirname "$0")/../contract"
  compact compile blindpulse.compact ../managed
fi

echo ""
echo "Deploying contract..."
echo "TODO: implement compact deploy to Preprod"
echo ""
echo "=== Deploy complete ==="
