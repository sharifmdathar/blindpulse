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

See [docs/PRIVACY_MODEL.md](docs/PRIVACY_MODEL.md) for the full public-vs-private
data model, and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the system design.

## Tech Stack

- Compact 0.26.0 (language_version 0.18) smart contracts
- Midnight.js SDK 4.x + DApp Connector API (`@midnight-ntwrk/*`)
- `@midnight-ntwrk/compact-runtime` 0.16.0 (pinned — see Toolchain below)
- Lace Wallet (Preprod)
- Next.js 14 + TypeScript + Tailwind
- Docker (proof server)
- GitHub Actions (CI/CD)

## Quick Start

```bash
bun install
docker compose up -d
bun run compile
bun run test
bun run dev
```

Verify everything with: `bun run lint && bun run test && bun run build`
(or `make lint`, `make test`, `make build`).

## Toolchain (pinned — do not float)

| Piece | Version | Why |
| ----- | ------- | --- |
| `compact` compiler | 0.26.0 (`compact update 0.26.0`) | Newer (0.31+) emits bindings needing compact-runtime 0.19+, which midnight-js 4.x types reject; older (0.23) only speaks language 0.15 (no `assert`, no `vector[i]`) |
| Contract pragma | `language_version 0.18` | Highest the 0.26.0 toolchain accepts with full syntax |
| `@midnight-ntwrk/compact-runtime` | 0.16.0 | Pinned to midnight-js 4.x; the compiler output targets this API |
| Node | 22 | Midnight SDK requirement |

`bun run compile` (→ `scripts/compile.sh`) enforces the compiler pin, and CI
installs the same version. `managed/` output is `index.cjs` + `index.d.cts`
(CJS bindings — imported as such from `src/lib`).

## Contract Address (Preprod)

_To be added after deployment_

## Public State vs Private Witness

**Public ledger state**: survey metadata, aggregate tallies, participant count, nullifier set

**Private witness** (never on-chain): wallet credential, individual responses, eligibility proof data

## Notes

- Wallet/contract pages (`/create`, `/survey/[id]`, `/results/[id]`) are
  client-only (`next/dynamic` with `ssr: false`): the Compact wasm runtime
  instantiates via top-level await and the managed bindings do a synchronous
  module-scope version check, so the stack cannot be evaluated during SSR.
- Midnight wasm binaries are served from `src/app/midnight-runtime/[...path]`
  (allowlisted, from `node_modules`); ZK artifacts from
  `src/app/zk-artifacts/[...path]` (from `managed/`).
- Until a contract is deployed on Preprod, the app runs on a local fallback:
  surveys/responses persist in `localStorage` and results tally locally, so
  the full UX works end-to-end without a wallet.

## Levels

| Level | Status | Requirements                                                             |
| ----- | ------ | ------------------------------------------------------------------------ |
| 1     | 🚧     | Toolchain, contract compile, deploy to Preprod, 5+ commits, README       |
| 2     | ⏳     | Lace wallet connect, circuit from frontend, privacy behavior, 8+ commits |
| 3     | ⏳     | 3+ tests passing, CI/CD, 10+ commits, privacy model section              |
| 4     | ⏳     | MVP live on Preprod, docs, CI/CD, product profile                        |
| 5     | ⏳     | 50 Preprod users, feedback loop, mentor approval                         |
| 6     | ⏳     | Mainnet deploy, 20 real users, brand assets                              |
