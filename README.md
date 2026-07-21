# BlindPulse

> Anonymous Feedback & Surveys with Verifiable Participation on Midnight

## What It Does

Organizations create surveys. Respondents prove eligibility
(token holder / member / attendee) via ZK proof WITHOUT revealing
identity. Only aggregate tallies hit the public ledger.

## Privacy Model

- **PRIVATE**: respondent identity, individual responses, credential data
- **PUBLIC**: aggregate tallies, participant count, nullifiers (anti-double-submit)
- disclose() is used ONLY for the aggregated result counter

## Tech Stack

- Compact (Midnight smart contracts)
- Midnight.js SDK + DApp Connector API
- Lace Wallet (Preprod)
- Next.js 14 + TypeScript + Tailwind
- Docker (proof server)
- GitHub Actions (CI/CD)

## Quick Start

```bash
npm install
docker compose up -d
npm run compile
npm test
npm run dev
```

## Contract Address (Preprod)

_To be added after deployment_

## Public State vs Private Witness

**Public ledger state**: survey metadata, aggregate tallies, participant count, nullifier set

**Private witness** (never on-chain): wallet credential, individual responses, eligibility proof data

## Levels

| Level | Status | Requirements |
|-------|--------|-------------|
| 1 | 🚧 | Toolchain, contract compile, deploy to Preprod, 5+ commits, README |
| 2 | ⏳ | Lace wallet connect, circuit from frontend, privacy behavior, 8+ commits |
| 3 | ⏳ | 3+ tests passing, CI/CD, 10+ commits, privacy model section |
| 4 | ⏳ | MVP live on Preprod, docs, CI/CD, product profile |
| 5 | ⏳ | 50 Preprod users, feedback loop, mentor approval |
| 6 | ⏳ | Mainnet deploy, 20 real users, brand assets |
