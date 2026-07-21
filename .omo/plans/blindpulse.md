# blindpulse - Work Plan

## TL;DR (For humans)

**What you'll get:** A complete BlindPulse project — anonymous ZK-verified surveys on Midnight blockchain. Smart contract, Next.js frontend with wallet connect, survey creation/taking/results pages, tests, CI/CD, Docker proof server, and full docs.

**Why this approach:** 9 sequential milestones, each producing a working state with clean commit. Build order follows dependency chain — contract first, then lib, then UI, then pages. Every milestone is independently verifiable.

**What it will NOT do:** Deploy to Preprod (needs Midnight toolchain + Lace wallet). Run real ZK proofs (needs proof-server Docker container). Those are Level 2+ actions after code scaffold is complete.

**Effort:** Large — 40+ files across 5 domains (contract, frontend, infra, tests, docs)
**Risk:** Low — blueprint is exhaustive, every file path and interface is specified
**Decisions to sanity-check:** None — all defaults adopted from blueprint spec

Your next move: Approve and run `$start-work` to execute, or run high-accuracy Momus review first.

---

> TL;DR (machine): Large/9 milestones/40+ files/Compact+Next.js+Midnight. Sequential build from contract to frontend to docs. 9 conventional commits.

## Scope

### Must have

- Full file tree per blueprint: root configs, Compact contract, lib layer, hooks, components, pages, tests, CI, docs, scripts, Docker
- Privacy model enforced: individual responses NEVER public, only aggregate tallies
- Conventional commit per milestone
- CLAUDE.md with master agent prompt

### Must NOT have (guardrails, anti-slop, scope boundaries)

- NO runtime compilation or deployment — code scaffold only
- NO real wallet integration testing (needs Lace extension)
- NO charting library dependency — use simple CSS bars
- NO raw RPC calls — always use Midnight.js SDK
- NO `as any` or `@ts-ignore` anywhere
- NO hand-written circuit files — always via `compact compile`

## Verification strategy

> Zero human intervention - all verification is agent-executed.

- Test decision: tests-after for contract unit tests; none needed for configs/docs
- Framework: Jest + ts-jest
- Evidence: .omo/evidence/ dir per task
- Per-todo: `lsp_diagnostics` clean + file existence + content verification via `read`

## Execution strategy

### Sequential waves (dependency-locked — each milestone builds on prior)

9 sequential todos, each produces one conventional commit. No parallelization across domains because each wave depends on the previous.

Wave 1: Root configs → Wave 2: Contract → Wave 3: Tests+CI → Wave 4: Lib → Wave 5: Hooks → Wave 6: Components → Wave 7: Pages → Wave 8: Docs → Wave 9: Scripts

### Dependency matrix

| Todo                   | Depends on | Blocks     | Can parallelize with |
| ---------------------- | ---------- | ---------- | -------------------- |
| 1. Root scaffold       | git init   | 2-9        | nothing              |
| 2. Compact contract    | 1          | 3          | nothing              |
| 3. Tests + CI          | 2          | 4          | nothing              |
| 4. Lib layer           | 3          | 5          | nothing              |
| 5. React hooks         | 4          | 6          | nothing              |
| 6. UI components       | 5          | 7          | nothing              |
| 7. App pages           | 6          | 8          | nothing              |
| 8. Docs + agent prompt | 7          | 9          | nothing              |
| 9. Scripts             | 7          | final wave | nothing              |

## Todos

> Implementation + Test = ONE todo. Never separate.

<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->

### Wave 1: Foundation

- [ ] 1. Scaffold root config files
      What to do: Create `package.json`, `tsconfig.json`, `next.config.js`, `tailwind.config.ts`, `postcss.config.js`, `.gitignore`, `.env.example`, `.env.local`, `docker-compose.yml`, `Makefile` at project root. All content per blueprint spec.
      Must NOT do: Do not add dependencies beyond blueprint list. Do not run `npm install`.
      Wave 1 | Blocked by: nothing | Blocks: 2
      References:
  - `package.json`: blueprint spec with @midnight-ntwrk/*, next, react, tailwind, jest deps
  - `tsconfig.json`: Next.js strict TypeScript config
  - `next.config.js`: minimal Next.js config
  - `tailwind.config.ts`: content paths pointing to src/
  - `postcss.config.js`: tailwindcss + autoprefixer
  - `.gitignore`: node_modules, .next, managed/, .env.local
  - `.env.example`: NEXT_PUBLIC_NETWORK=preprod, NEXT_PUBLIC_CONTRACT_ADDRESS=, NEXT_PUBLIC_PROOF_SERVER_URL, LACE_EXTENSION_ID=
  - `.env.local`: copy of .env.example with empty values
  - `docker-compose.yml`: proof-server service on port 6300 with managed/ volume mount
  - `Makefile`: targets for dev, build, compile, test, deploy, lint
    Acceptance criteria: `ls` shows all 10 files. Each file matches blueprint content. `lsp_diagnostics` clean on tsconfig.
    QA: `ls -la` root dir | expect 10+ files listed. `head -5 package.json` | expect name "blindpulse".
    Evidence: .omo/evidence/task-1-blindpulse.txt
    Commit: Y | chore: scaffold project root configs

- [ ] 2. Write Compact contract + tsconfig
      What to do: Create `contract/blindpulse.compact` with the BlindPulse survey contract. Ledger state: surveyActive, questionCount, tallies (Map<Uint<8>, Map<Uint<8>, Uint<32>>), participantCount, nullifiers (Map<Bytes<32>, Boolean), organizer. Four exported functions: createSurvey, submitResponse (with credential/responses/nullifier as private witnesses), getResults (returns disclose(tallies)), closeSurvey. Create `contract/tsconfig.json` for Compact compilation.
      Must NOT do: NEVER store individual responses in ledger. NEVER call disclose() on credential, wallet address, or single response. NEVER skip nullifier check in submitResponse.
      Wave 1 | Blocked by: 1 | Blocks: 3
      References:
  - blueprint spec for contract/blindpulse.compact content
  - blueprint spec for contract/tsconfig.json
  - Privacy model: tallies public, individual responses NEVER public
    Acceptance criteria: `contract/blindpulse.compact` exists with correct ledger fields and 4 exported functions. `contract/tsconfig.json` exists.
    QA: `grep -c "export fun" contract/blindpulse.compact` | expect 4. `grep "disclose" contract/blindpulse.compact` | must NOT contain "disclose" next to "credential" or "response".
    Evidence: .omo/evidence/task-2-blindpulse.txt
    Commit: Y | feat(contract): add BlindPulse Compact smart contract

### Wave 2: Tests + Core Library

- [ ] 3. Add contract tests and CI pipeline
      What to do: Create `contract/blindpulse.test.ts` (6 tests: createSurvey, submitResponse tally updates, duplicate nullifier rejection, inactive survey rejection, getResults returns correct aggregates, closeSurvey organizer check). Create `test/contract.test.ts`, `test/circuit.test.ts`, `test/integration.test.ts` as integration test stubs. Create `.github/workflows/ci.yml` with checkout, node 22, npm ci, compile, test, build steps.
      Must NOT do: Do not over-implement tests beyond blueprint spec. Keep test stubs simple.
      Wave 2 | Blocked by: 2 | Blocks: 4
      References:
  - blueprint: 6 test descriptions
  - blueprint: CI workflow YAML
  - test/contract.test.ts: integration-level test stub
  - test/circuit.test.ts: circuit integration test stub
  - test/integration.test.ts: end-to-end test stub
    Acceptance criteria: `contract/blindpulse.test.ts` has 6 test blocks (describe/it). CI workflow valid YAML.
    QA: `grep -c "it(" contract/blindpulse.test.ts` | expect ≥6. `node -e "require('js-yaml').load(require('fs').readFileSync('.github/workflows/ci.yml','utf8'))"` | no error = valid YAML.
    Evidence: .omo/evidence/task-3-blindpulse.txt
    Commit: Y | test: add contract tests and CI pipeline

- [ ] 4. Build lib layer (midnight.ts, wallet.ts, contract-api.ts, types.ts, utils.ts)
      What to do: Create `src/lib/midnight.ts` (Midnight.js provider init, Preprod connection, circuit loader). `src/lib/wallet.ts` (Lace DApp Connector wrapper: connect, disconnect, getConnectedAddress, isConnected). `src/lib/contract-api.ts` (createSurvey, submitResponse, getResults, getParticipantCount — all call circuits via SDK). `src/lib/types.ts` (Survey, SurveyQuestion, SurveyResults interfaces, WalletState type). `src/lib/utils.ts` (helper functions: truncateAddress, generateNullifier, validateResponses).
      Must NOT do: Do not hardcode wallet addresses or private keys. Do not call raw RPC — use Midnight.js SDK. Do not store individual responses in public state.
      Wave 2 | Blocked by: 3 | Blocks: 5
      References:
  - blueprint: src/lib/midnight.ts description
  - blueprint: src/lib/wallet.ts description
  - blueprint: src/lib/contract-api.ts description
  - blueprint: src/lib/types.ts interfaces
  - blueprint: src/lib/utils.ts (truncateAddress helper implied)
  - @midnight-ntwrk/midnight-js SDK patterns
    Acceptance criteria: All 5 files exist with correct exports matching blueprint. `lsp_diagnostics` clean on src/lib/.
    QA: `ls src/lib/*.ts` | expect 5 files. `lsp_diagnostics src/lib/` | expect 0 errors.
    Evidence: .omo/evidence/task-4-blindpulse.txt
    Commit: Y | feat(lib): add Midnight SDK, wallet, and contract API layer

### Wave 3: Frontend Core

- [ ] 5. Build React hooks (useWallet, useSurvey, useCircuit)
      What to do: `src/hooks/useWallet.ts` — wraps wallet.ts, returns { address, isConnected, connect, disconnect, status: WalletState }. `src/hooks/useSurvey.ts` — wraps contract-api.ts, returns { createSurvey, submitResponse, getResults, loading, error }. `src/hooks/useCircuit.ts` — handles proof generation + private witness construction, calls proof server at NEXT_PUBLIC_PROOF_SERVER_URL.
      Must NOT do: Do not expose individual response data outside hook scope. Do not store private witness data in React state (React state is not ZK-private).
      Wave 3 | Blocked by: 4 | Blocks: 6
      References:
  - blueprint: src/hooks/useWallet.ts description
  - blueprint: src/hooks/useSurvey.ts description
  - blueprint: src/hooks/useCircuit.ts description
  - src/lib/wallet.ts, src/lib/contract-api.ts, src/lib/types.ts
    Acceptance criteria: All 3 hook files exist with correct return types. `lsp_diagnostics` clean on src/hooks/.
    QA: `ls src/hooks/*.ts` | expect 3 files. `lsp_diagnostics src/hooks/` | expect 0 errors.
    Evidence: .omo/evidence/task-5-blindpulse.txt
    Commit: Y | feat(hooks): add React hooks for wallet and survey operations

- [ ] 6. Build UI components (WalletConnect, SurveyCreator, SurveyForm, ResultsDashboard, EligibilityBadge, PrivacyExplainer, Layout)
      What to do: Create 7 TSX components under `src/components/`:
  - WalletConnect.tsx: Lace connect/disconnect button, shows truncated address, Preprod network prompt
  - SurveyCreator.tsx: Form for organizers (questions + options), calls createSurvey(), shows deployed address
  - SurveyForm.tsx: Respondent UI, renders questions with options, builds private witness on submit (credential + responses + nullifier), calls submitResponse(), success WITHOUT revealing submitted data
  - ResultsDashboard.tsx: Reads aggregate tallies only, CSS bar charts per question, participant counter, "Verified by ZK proof" badge
  - EligibilityBadge.tsx: Shows "Eligibility verified via ZK proof" without revealing identity
  - PrivacyExplainer.tsx: Explains public vs private data model
  - Layout.tsx: Shared layout with header/footer, wallet connect in header
    Must NOT do: NEVER render individual response data. NEVER expose wallet address in ResultsDashboard. No charting library — pure CSS bars.
    Wave 3 | Blocked by: 5 | Blocks: 7
    References:
  - blueprint: each component description
  - src/hooks/*.ts, src/lib/types.ts
  - Next.js App Router component patterns
    Acceptance criteria: All 7 .tsx files exist. `lsp_diagnostics` clean on src/components/. Each component implements blueprint behavior.
    QA: `ls src/components/*.tsx` | expect 7 files. `lsp_diagnostics src/components/` | expect 0 errors. Grep ResultsDashboard for "chart" or "recharts" — expect NOT found.
    Evidence: .omo/evidence/task-6-blindpulse.txt
    Commit: Y | feat(components): add survey UI components

### Wave 4: Pages + Docs

- [ ] 7. Build App Router pages (layout, landing, create, survey, results, globals)
      What to do: `src/app/layout.tsx` (root layout with Layout component). `src/app/page.tsx` (landing: hero "Anonymous Feedback. Verifiable Participation.", CTAs, privacy summary, WalletConnect). `src/app/create/page.tsx` (SurveyCreator with wallet guard). `src/app/survey/[id]/page.tsx` (SurveyForm with wallet guard). `src/app/results/[id]/page.tsx` (ResultsDashboard, no wallet needed). `src/app/globals.css` (Tailwind directives + base styles).
      Must NOT do: Do not add client-side data fetching for results on server — results come from contract. Do not expose wallet requirement on /results page.
      Wave 4 | Blocked by: 6 | Blocks: 8, 9
      References:
  - blueprint: each page description
  - blueprint route structure: /, /create, /survey/[id], /results/[id]
  - src/components/*.tsx
    Acceptance criteria: All 6 route files + CSS exist. `lsp_diagnostics` clean on src/app/. Build check passes with `npx next build` (dry run).
    QA: `ls src/app/*.tsx src/app/create/page.tsx src/app/survey/\[id\]/page.tsx src/app/results/\[id\]/page.tsx` | expect all files. `lsp_diagnostics src/app/` | expect 0 errors.
    Evidence: .omo/evidence/task-7-blindpulse.txt
    Commit: Y | feat(app): add Next.js App Router pages

- [ ] 8. Write docs and agent prompt
      What to do: `docs/PRIVACY_MODEL.md` (public vs private data, disclose() usage, nullifier unlinkability). `docs/ARCHITECTURE.md` (system architecture, component diagram, data flow). `docs/SETUP.md` (setup instructions, prerequisites, env vars, commands). `README.md` (project description, privacy model, tech stack, quick start, contract address placeholder). `CLAUDE.md` (full master agent prompt from blueprint: core identity, tech stack, contract architecture, frontend architecture, level requirements, hard constraints, code style, testing requirements).
      Must NOT do: Do not add emojis beyond blueprint. Do not fabricate contract addresses. Do not add AI attribution.
      Wave 4 | Blocked by: 7 | Blocks: nothing
      References:
  - blueprint: README.md content
  - blueprint: docs/PRIVACY_MODEL.md content
  - blueprint: master agent prompt (CLAUDE.md)
  - docs/ARCHITECTURE.md: describe system layers
  - docs/SETUP.md: installation guide
    Acceptance criteria: All 5 files exist with correct content. README has privacy model section. CLAUDE.md has all sections from blueprint.
    QA: `ls docs/*.md README.md CLAUDE.md` | expect all files. `grep -c "PRIVATE\|PUBLIC" docs/PRIVACY_MODEL.md` | expect ≥2 mentions. `grep -c "NEVER" CLAUDE.md` | expect ≥5 constraint references.
    Evidence: .omo/evidence/task-8-blindpulse.txt
    Commit: Y | docs: add privacy model, architecture, and setup documentation

### Wave 5: Scripts + Finalize

- [ ] 9. Add Docker, scripts, and managed dir stubs
      What to do: `scripts/deploy.sh` (deploy to Preprod — placeholder for compact deploy command). `scripts/compile.sh` (compact compile wrapper). `managed/circuits/.gitkeep` (compile output dir stub). `managed/keys/.gitkeep` (keys dir stub). Verify Makefile has all targets (dev, build, compile, test, test:contract, deploy, lint).
      Must NOT do: Do not implement actual deploy logic — placeholder only. Do not run compile.sh.
      Wave 5 | Blocked by: 7 | Blocks: final wave
      References:
  - blueprint: scripts/deploy.sh, scripts/compile.sh descriptions
  - Makefile: dev, build, compile, test, test:contract, deploy, lint targets
    Acceptance criteria: Both scripts exist and are executable (+x). managed/ dir has .gitkeep files. Makefile has all 7 targets.
    QA: `ls -la scripts/` | expect .sh files with x permission. `ls managed/circuits/.gitkeep managed/keys/.gitkeep` | expect files. `grep -E "^[a-zA-Z_-]+:" Makefile` | expect 7 lines.
    Evidence: .omo/evidence/task-9-blindpulse.txt
    Commit: Y | chore: add deploy and compile scripts

## Final verification wave

> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.

- [ ] F1. Plan compliance audit — every file from blueprint tree exists, content matches spec
- [ ] F2. Code quality review — lsp_diagnostics clean on all src/, contract/, test/
- [ ] F3. Real manual QA — grep-check: no individual response data in public ledger, no chart deps, no as any
- [ ] F4. Scope fidelity — no files outside blueprint tree, no extra dependencies

## Commit strategy

- 9 conventional commits, one per milestone
- Format: `type(scope): summary` — e.g. `feat(contract): add BlindPulse Compact smart contract`
- Types: chore, feat, test, docs — matching the milestone
- Each commit is the milestone boundary — every commit produces a verifiable state
- Commits applied via: `git add -A && git commit -m "<msg>"`

## Success criteria

- All 40+ files from blueprint tree exist with correct content
- `lsp_diagnostics` produces 0 errors across all .ts/.tsx files
- Privacy model enforced: no individual response data leaks to public ledger
- 9 conventional commits with clean history
- CLAUDE.md guides future agents on privacy-first development
- Project can be compiled with `npm run compile` (needs Midnight toolchain)
- Project can be started with `npm run dev` (needs npm install)
