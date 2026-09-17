# BlindPulse

> Anonymous Feedback & Surveys with Verifiable Participation on Midnight

## What It Does

Organizations create surveys. Respondents prove eligibility
(token holder / member / attendee) via ZK proof WITHOUT revealing
identity. Only aggregate tallies hit the public ledger.

## DApp Pages

| Route          | Who                    | What                                                                    |
| -------------- | ---------------------- | ----------------------------------------------------------------------- |
| `/`            | anyone                 | Landing + privacy explainer                                             |
| `/create`      | organizer (wallet)     | Deploy a survey contract through Lace + Midnight.js                     |
| `/survey/[id]` | respondent (wallet)    | Submit an anonymous, ZK-proofed response                                |
| `/results/[id]`| anyone                 | Public aggregate results for one survey (deep-linkable, no wallet)      |
| `/dashboard`   | organizer / public     | All known surveys with live on-chain status, restore registry, add by address |

Survey metadata (title, questions, options) is off-chain by design — the
chain only stores aggregate tallies per contract address. Each deploying
browser keeps its own list; `public/survey-registry.json` ships the known
deployments so any browser can restore them via **Dashboard → Restore
registry**, or a survey can be added by pasting its contract address.

Shared links are self-contained: opening `/survey/<id>` or `/results/<id>`
for a registry-known deployment restores its metadata automatically, so
respondents see the real question text instead of generic labels. New
deployments should be appended to `public/survey-registry.json`.

## Privacy Model

- **PRIVATE**: respondent identity, individual responses, credential data
- **PUBLIC**: aggregate tallies, participant count, nullifiers (anti-double-submit)
- disclose() is used ONLY for the aggregated result counter

See [docs/PRIVACY_MODEL.md](docs/PRIVACY_MODEL.md) for the full public-vs-private
data model, [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the system design,
and [docs/PRODUCT.md](docs/PRODUCT.md) for the public product profile.

## Tech Stack

- Compact 0.31.0 (language_version 0.23) smart contracts
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
| `compact` compiler | 0.31.0 (`compact update 0.31.0`) | Newest compiler whose bindings target compact-runtime 0.16.0: 0.34 needs 0.19+ (rejected by midnight-js 4.x types), 0.30/0.29/0.28 expect runtime 0.15/0.14, and 0.26 emits an old bindings layout that crashes against the current runtime |
| Contract pragma | `language_version 0.23` | Required by the 0.31.0 toolchain |
| `@midnight-ntwrk/compact-runtime` | 0.16.0 | Pinned to midnight-js 4.x; the compiler output targets this API |
| Node | 22 | Midnight SDK requirement |

`bun run compile` (→ `scripts/compile.sh`) enforces the compiler pin, and CI
installs the same version. `managed/` output is `index.js` + `index.d.ts`
(ESM bindings — imported as such from `src/lib`).

## Contract Address (Preprod)

- **Contract address:** `9b6e0eed1f8a8f2a79ed2db9fe35570e1ad30ab8f8c358c44bc4b7e06ed7eeff`
  (live "App Feedback" survey — 1 question, rate 1–5 — verify with
  `CONTRACT_ADDRESS=9b6e… bun scripts/verify-deploy.ts`)
  Deployed from a clean nullifier set after the per-wallet BLAKE2b
  nullifier fix, so every recorded vote uses the correct derivation.
  Survey metadata (title, question, options) lives off-chain in the
  organizer's browser; the contract ID links it to on-chain tallies.
- Earlier deployment (superseded): `92ef920564c1b67d8081f6eea8a880c7ac0904d601396ef87c16859b29ff8087`
  — predates the nullifier fix: its nullifier set contains the legacy
  zero-byte stub digest, so wallets that voted before the fix could be
  counted a second time alongside their old vote.
- Earliest deployment (superseded): `c85d9e980809d76f7f0204be2730c752b0abfb5ae572c1fa038622c7a0ba7d4f`,
  deploy tx [`fb4b3947…33b4`](https://explorer.1am.xyz/tx/fb4b3947e02fce9be2b959ad5daedf3f81886ed3e0920a229fee2de7c4c233b4?network=preprod)
  (block 2,590,444) — retired because its circuit had a first-vote bug:
  tally cells were not pre-created, so any initial vote on an option
  failed with "expected a cell, received null".
- Deployed via the DApp (`/create`) through Lace + Midnight.js, per the
  project constraint that deployment always goes through the SDK — never
  raw RPC.

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
- Double-voting is impossible by construction: the nullifier is
  deterministic per (wallet, survey), so a second submission from the same
  wallet is rejected by the contract's nullifier set and the survey form
  explains this with a friendly notice instead of a raw error.

## Levels

| Level | Status | Requirements                                                             |
| ----- | ------ | ------------------------------------------------------------------------ |
| 1     | ✅     | Toolchain, contract compile, deploy to Preprod, 5+ commits, README       |
| 2     | ✅     | Lace wallet connect, circuit from frontend, privacy behavior, 8+ commits |
| 3     | ✅     | 3+ tests passing (19), CI/CD, 10+ commits, privacy model section         |
| 4     | ✅     | MVP live on Preprod, docs, CI/CD, public product profile                 |
| 5     | ⏳     | 50 Preprod users, feedback loop, mentor approval                         |
| 6     | ⏳     | Mainnet deploy, 20 real users, brand assets                              |
