# BlindPulse Beta Feedback survey — deployment record

Organizer copy of the off-chain survey metadata (also mirrored in
`public/survey-registry.json`) for the Level 5 collection survey.

- Network: Preprod
- Contract address: `d9a1605a0ada136ffe075736784a28b6e58c876ad53825fe1be0d23dfda5f132`
- Title: BlindPulse Beta Feedback
- Organizer (coin public key, in-circuit close-gate): `26d80ca0700353460b4abc88ba95c1a19ffcbfe2b6cf2884f7dd30316f3cbdaa`
  — recorded on-chain at deploy; only this wallet can pass the
  closeSurvey circuit's organizer assert.
- Google Form fallback (off-chain, outside the ZK guarantee):
  <https://forms.gle/tSfuc3mhU87XQjh68>
- Question 1: "Overall, how would you rate BlindPulse?" — options 1–5
- Question 2: "Which feature do you value most?" — options:
  Privacy (answers hidden) / Verifiability (counts provable) /
  Simplicity / Anonymity
- Question 3: "How likely are you to recommend BlindPulse?" — options 1–5
- Created (ms epoch): 1789667295642
- First on-chain state: participants 0, all tallies zero, surveyActive true

Verify anytime:

```bash
CONTRACT_ADDRESS=d9a1605a0ada136ffe075736784a28b6e58c876ad53825fe1be0d23dfda5f132 \
  bun scripts/verify-deploy.ts
```
