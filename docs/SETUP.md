# BlindPulse Setup

## Prerequisites

- Node.js 22+
- [Bun](https://bun.sh) 1.2+
- Docker (for proof server)
- Lace Wallet browser extension (Preprod network)
- Midnight toolchain (`compact` CLI — `bun run compile` selects 0.26.0 for you)

## Quick Start

```bash
# Install dependencies
bun install

# Start proof server
docker compose up -d

# Compile contract (pins compact 0.26.0, emits to managed/)
bun run compile

# Run tests
bun run test

# Start dev server
bun run dev
```

## Environment Variables

| Variable                     | Description               | Default               |
| ---------------------------- | ------------------------- | --------------------- |
| NEXT_PUBLIC_NETWORK          | Midnight network          | preprod               |
| NEXT_PUBLIC_CONTRACT_ADDRESS | Deployed contract address | —                     |
| NEXT_PUBLIC_PROOF_SERVER_URL | Proof server URL          | http://localhost:6300 |
| LACE_EXTENSION_ID            | Lace wallet extension ID  | —                     |

## Deployment

```bash
# Compile + verify artifacts (deploy itself happens in-app via Lace)
bun run deploy
```

Deployment goes through the DApp: connect Lace on Preprod and create a
survey — `createSurvey` deploys the contract with the Midnight.js SDK.
Record the contract address in the README afterwards.
