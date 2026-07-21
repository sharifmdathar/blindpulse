# BlindPulse Setup

## Prerequisites

- Node.js 22+
- Docker (for proof server)
- Lace Wallet browser extension (Preprod network)
- Midnight toolchain (`compact` CLI)

## Quick Start

```bash
# Install dependencies
npm install

# Start proof server
docker compose up -d

# Compile contract
npm run compile

# Run tests
npm test

# Start dev server
npm run dev
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| NEXT_PUBLIC_NETWORK | Midnight network | preprod |
| NEXT_PUBLIC_CONTRACT_ADDRESS | Deployed contract address | — |
| NEXT_PUBLIC_PROOF_SERVER_URL | Proof server URL | http://localhost:6300 |
| LACE_EXTENSION_ID | Lace wallet extension ID | — |

## Deployment

```bash
# Deploy to Preprod
npm run deploy
```
