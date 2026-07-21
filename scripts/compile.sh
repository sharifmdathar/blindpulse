#!/usr/bin/env bash
set -euo pipefail

# BlindPulse compile script
# Compiles BlindPulse Compact contract to circuits

echo "=== BlindPulse Compile ==="

cd "$(dirname "$0")/../contract"

echo "Compiling blindpulse.compact..."
compact compile blindpulse.compact ../managed

echo "Compiled circuits written to ../managed/"
echo "=== Compile complete ==="
