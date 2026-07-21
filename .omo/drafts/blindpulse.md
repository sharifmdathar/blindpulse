# BlindPulse — Build Plan Draft

## Intent

Build full BlindPulse anonymous survey platform on Midnight blockchain per blueprint. Greenfield project.

## Topology (Components)

1. Root config scaffold — package.json, tsconfig, next/tailwind/postcss configs, gitignore, env, docker-compose, Makefile
2. Compact contract — contract/blindpulse.compact (core ZK survey contract), contract/tsconfig.json
3. Contract tests + CI — contract/blindpulse.test.ts, test/*.ts, .github/workflows/ci.yml
4. Lib layer — src/lib/{midnight,wallet,contract-api,types,utils}.ts
5. React hooks — src/hooks/{useWallet,useSurvey,useCircuit}.ts
6. UI components — src/components/{WalletConnect,SurveyCreator,SurveyForm,ResultsDashboard,EligibilityBadge,PrivacyExplainer,Layout}.tsx
7. App pages — src/app/{layout,page,create/page,survey/[id]/page,results/[id]/page}.tsx + globals.css
8. Docker + scripts — docker-compose.yml, scripts/{deploy,compile}.sh
9. Docs + agent prompt — docs/*.md, README.md, CLAUDE.md

## Decisions (adopted defaults, no forks)

- CLAUDE.md at project root for agent instructions
- Simple CSS bar rendering for results (zero extra deps)
- Keep contract unit tests in contract/ + integration tests in test/
- Milestone order: scaffold → contract → tests/CI → lib → hooks → components → pages → docs → scripts

## Milestone plan

9 milestones, each clean conventional commit. See .omo/plans/blindpulse.md

## Status

approved
