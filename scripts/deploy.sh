#!/usr/bin/env bash
set -euo pipefail

# BlindPulse deploy helper (Preprod only — see CLAUDE.md hard constraints).
#
# There is no raw-CLI deploy path on purpose: the project constraint is to
# ALWAYS use the Midnight.js SDK, so deployment happens from the DApp itself
# (createSurvey in src/lib/contract-api.ts deploys via the connected Lace
# wallet). This script only guarantees the compiled artifacts the DApp needs
# (circuits, keys, bindings in managed/) are present and fresh.

echo "=== BlindPulse Deploy (Preprod) ==="
echo ""

bash "$(dirname "$0")/compile.sh"

echo ""
echo "Artifacts ready in managed/ (circuits, keys, bindings)."
echo "To deploy: run the app (bun run dev), connect Lace on Preprod,"
echo "and create a survey — the DApp deploys the contract via Midnight.js."
echo ""
echo "Contract Address (Preprod): record it in README after deploying."
echo "=== Deploy prep complete ==="
