# BlindPulse Architecture

## System Layers

```
┌─────────────────────────────────────┐
│          Next.js Frontend           │
│  (Landing / Create / Survey / Results) │
├─────────────────────────────────────┤
│        React Components            │
│  (WalletConnect / SurveyForm / etc) │
├─────────────────────────────────────┤
│     Hooks (useWallet / useSurvey)   │
├─────────────────────────────────────┤
│   Lib Layer (midnight.js / wallet)  │
├─────────────────────────────────────┤
│     Midnight.js SDK + DApp API      │
├─────────────────────────────────────┤
│      Compact Contract (ZK)          │
├─────────────────────────────────────┤
│       Midnight Blockchain           │
│  (Preprod → Mainnet)                │
└─────────────────────────────────────┘
```

## Data Flow

1. Organizer deploys survey contract → public state initialized
2. Respondent connects Lace wallet → address used for credential
3. Respondent fills survey → responses become private witness
4. ZK proof generated via proof server → submitted on-chain
5. Only aggregate tallies update on public ledger
6. Anyone reads results via getResults() → disclose(tallies)

## Key Design Decisions

- **Privacy-first**: All individual data stays off-chain
- **Nullifier-based prevention**: One-way hash prevents double-submit
- **Proof server isolation**: Docker container handles proof generation
