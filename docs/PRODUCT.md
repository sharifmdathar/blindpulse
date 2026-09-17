# BlindPulse — Product Profile

> Copy-paste ready for program submissions, product directories, and the
> repo's GitHub About. Every claim below is verifiable against the linked
> chain state and this repository.

## One-liner

Anonymous surveys with verifiable participation on Midnight — respondents
prove who they are in ZK, and only the aggregate ever becomes public.

## Elevator pitch

BlindPulse is a privacy-first survey platform built on Midnight's Compact
circuit language. Organizations ask questions; respondents answer under
zero-knowledge proofs that verify eligibility without revealing identity.
Individual responses and wallet credentials are private witnesses that
never touch the ledger. What the world sees is exactly what a survey
should honestly report: aggregate tallies, a participant counter, and
one-way nullifiers that make double-voting impossible without making
voters traceable.

The name comes from the new moon: the sky holds the moon entirely in
shadow — present, but unseen. Every respondent is present (their proof is
verified) but unseen (their identity and answers stay in shadow). Only
the collective voice steps into the light.

## The problem

Feedback systems fail at one of two extremes. Centralized survey tools
collect names, emails, and behavioral metadata — respondents self-censor,
and the operator can correlate everything. Fully anonymous web forms
solve privacy but lose integrity: anyone can vote twice, bots vote at
all, and nobody can verify the published result. BlindPulse refuses that
trade-off. Participation is proven; identity is not revealed.

## How it works

1. **Organizer** connects a Lace wallet and deploys a survey contract
   (`/create`). Questions and option labels stay off-chain; the chain
   receives only the question count and a pre-created tally structure.
2. **Respondent** opens the share link (`/survey/<id>`), connects Lace,
   and submits answers. The DApp derives a nullifier — BLAKE2b-256 of a
   domain tag, the wallet's coin public key, and the survey id — and
   builds a ZK proof through the wallet's DApp-connector proof provider.
   The coin key itself is only a hash input and is never transmitted.
3. **The circuit** (`contract/blindpulse.compact`) asserts the survey is
   active, rejects any nullifier already in the spent set, then discloses
   only aggregate updates: tally increments and the participant counter.
4. **Anyone** reads live results (`/results/<id>`) straight from the
   ledger via the Midnight indexer — no wallet, no login, no trust in the
   operator.

## Privacy model (the invariant)

| Data                       | Where it lives                          |
| -------------------------- | --------------------------------------- |
| Individual answers         | Private ZK witnesses — never on-chain   |
| Wallet identity / coin key | Hash input only — never transmitted     |
| Nullifier digest           | Public, one-way, per (wallet, survey)   |
| Aggregate tallies          | Public ledger, per question per option  |
| Participant count          | Public ledger counter                   |
| Question text and options  | Off-chain (organizer + public registry) |

Double-voting is impossible by construction: the nullifier is
deterministic per wallet per survey, so a second submission from the same
wallet is rejected on-chain — and the form explains it with a friendly
notice. Because the survey id is bound into the hash, the same wallet's
votes in different surveys cannot be correlated.

## What's live today

- **Network:** Midnight Preprod
- **Live survey:** `d9a1605a0ada136ffe075736784a28b6e58c876ad53825fe1be0d23dfda5f132`
  ("BlindPulse Beta Feedback" — 3 questions), deployed through the DApp
  via Lace + Midnight.js on the organizer-gated contract: the deploying
  wallet's coin public key is recorded as organizer and `closeSurvey`
  asserts the caller's (private) coin key against it in-circuit. A
  wallet-free Google Form fallback is advertised alongside the ZK form
  (organizer-collected, outside the ZK guarantee).
- **Verified flows:** wallet connect → deploy → anonymous submit →
  double-vote rejection → live aggregate results, all exercised on-chain
  end-to-end
- **Quality gates:** 29 passing tests (nullifier properties, multi-vote
  semantics, registry restore), ESLint clean, production build green,
  GitHub Actions CI

## Stack

Compact 0.31.0 (pragma 0.23) · Midnight.js SDK 4.x + DApp Connector ·
Lace wallet (Preprod) · Next.js 14 + TypeScript + Tailwind · Jest ·
GitHub Actions.

## Roadmap

1. **Next:** per-survey share pages with embedded metadata;
   registry auto-write at deploy time (entry is copy-paste today)
2. **Then:** eligibility proofs beyond one-wallet-one-vote (token
   holdings, membership, attendance)
3. **Level 5:** 50 Preprod users with an open feedback loop
4. **Level 6:** Mainnet deployment, 20 real users, brand assets

## Links

- Repository: see the hosting repo of this document
- Verify the live survey on-chain:
  `CONTRACT_ADDRESS=9b6e0eed1f8a8f2a79ed2db9fe35570e1ad30ab8f8c358c44bc4b7e06ed7eeff bun scripts/verify-deploy.ts`
- Privacy model in depth: [docs/PRIVACY_MODEL.md](PRIVACY_MODEL.md)
- System design: [docs/ARCHITECTURE.md](ARCHITECTURE.md)
