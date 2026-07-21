# PROJECT: BlindPulse — Anonymous Feedback on Midnight

## CORE IDENTITY (NEVER FORGET)
You are building BlindPulse: a privacy-first anonymous survey/feedback
platform on the Midnight blockchain using Compact smart contracts.

THE SINGLE MOST IMPORTANT RULE:
- Individual responses and respondent identities are PRIVATE WITNESSES.
- They are inputs to the ZK circuit. They NEVER appear on the public ledger.
- Only AGGREGATE TALLIES and a PARTICIPANT COUNTER are public.
- disclose() is used ONLY for aggregate results, NEVER for individual data.
- A NULLIFIER (one-way hash of credential) prevents double-submission
  WITHOUT linking back to the respondent's identity.

If you ever write code that stores individual responses on-chain,
exposes wallet addresses in public state, or calls disclose() on
a single respondent's data — YOU HAVE BROKEN THE CORE PRIVACY MODEL.
Stop. Re-read this section. Fix it.

## TECH STACK (DO NOT SUBSTITUTE)
- Smart contracts: Compact language (.compact files)
- Frontend: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- Blockchain SDK: @midnight-ntwrk/midnight-js
- Wallet: Lace via DApp Connector API (Preprod network)
- ZK proofs: Compact compiler to circuits in /managed
- Proof server: Docker (midnightntwrk/proof-server)
- Node version: 22
- CI/CD: GitHub Actions
- Testing: Jest + ts-jest

## CONTRACT ARCHITECTURE
File: contract/blindpulse.compact

Public ledger state (readable by anyone):
  - surveyActive: Boolean
  - questionCount: Uint<8>
  - tallies: Map<Uint<8>, Map<Uint<8>, Uint<32>>>
  - participantCount: Uint<32>
  - nullifiers: Map<Bytes<32>, Boolean>
  - organizer: Bytes<32>

Exported functions:
  1. createSurvey(organizer, questionCount) - sets up survey
  2. submitResponse(surveyId, credential, responses[], nullifier)
     - credential, responses, nullifier are PRIVATE WITNESSES
     - Only tallies and participantCount update on-chain
     - Nullifier is checked against ledger to prevent duplicates
  3. getResults() - returns disclose(ledger.tallies)
  4. closeSurvey(organizer) - deactivates survey

## FRONTEND ARCHITECTURE
- / (landing) - hero + privacy explainer + wallet connect
- /create - organizer creates survey (requires wallet)
- /survey/[id] - respondent takes survey (requires wallet, ZK proof)
- /results/[id] - public aggregate results (no wallet needed)

Key components:
  - WalletConnect.tsx: Lace connect/disconnect on Preprod
  - SurveyForm.tsx: builds private witness, calls circuit
  - ResultsDashboard.tsx: reads ONLY public aggregate data
  - PrivacyExplainer.tsx: shows public vs private data model

## LEVEL REQUIREMENTS CHECKLIST
Level 1: toolchain setup, contract compiles, deploys to Preprod,
         5+ commits, README with idea paragraph
Level 2: Lace wallet connect, circuit called from frontend,
         observable privacy behavior, 8+ commits
Level 3: 3+ tests passing, CI/CD pipeline, chosen idea from list,
         10+ commits, privacy model section in README
Level 4: MVP live on Preprod, docs, CI/CD, public product profile
Level 5: 50 Preprod users, feedback loop, mentor approval
Level 6: Mainnet deploy, 20 real users, brand assets

## HARD CONSTRAINTS
1. NEVER store individual survey responses in public ledger state
2. NEVER call disclose() on credential, wallet address, or single response
3. NEVER use a network other than Preprod (Levels 1-5) or Mainnet (Level 6)
4. NEVER skip the nullifier check in submitResponse
5. NEVER hardcode wallet addresses or private keys
6. ALWAYS generate circuits via compact compile - never hand-write circuit files
7. ALWAYS use the Midnight.js SDK for contract interaction - never raw RPC
8. ALL private data flows through ZK circuit witnesses, not frontend state

## CODE STYLE
- TypeScript strict mode everywhere
- Compact contracts: comment every public vs private field
- React: functional components + hooks only
- File naming: kebab-case for files, PascalCase for components
- Every function that touches the contract must have a JSDoc comment
  stating what is PUBLIC and what is PRIVATE
- Commit messages: conventional commits (feat:, fix:, test:, docs:)

## TESTING REQUIREMENTS
Minimum 3 tests (Level 3), aim for 6+:
  1. createSurvey sets correct public state
  2. submitResponse updates tallies correctly
  3. submitResponse rejects duplicate nullifier
  4. submitResponse rejects when survey is inactive
  5. getResults returns correct aggregates
  6. closeSurvey only callable by organizer

## WHEN YOU ARE UNSURE
- Re-read the PRIVACY MODEL section above
- Check: "Does this data cross into public domain?" If yes, it must
  be aggregate only.
- Check: "Am I using disclose() correctly?" It marks data the developer
  considers safe to expose - it does NOT make private data public.
- Data becomes public ONLY when: written to ledger, returned from
  exported contract, or passed in contract-to-contract calls.

## PROJECT NARRATIVE
"In the new moon, the sky holds the moon entirely in shadow - present,
but unseen." BlindPulse embodies this: every respondent is present
(their proof is verified) but unseen (their identity and answers
remain in shadow). Only the collective voice - the aggregate - steps
into the light.

Start in the dark. Ship in the light.
