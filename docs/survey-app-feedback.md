# App Feedback survey — deployment record

Organizer copy of the off-chain survey metadata (recovered from the
deploying browser's localStorage) so the survey can be re-created or
referenced if that browser's storage is lost. The chain stores only
aggregate tallies; this file is the public description of what those
tallies mean.

- Network: Preprod
- Contract address: `9b6e0eed1f8a8f2a79ed2db9fe35570e1ad30ab8f8c358c44bc4b7e06ed7eeff`
- Title: App Feedback
- Question 1: "Rate this app on a scale of 1 to 5"
  - Option 0: "1"
  - Option 1: "2"
  - Option 2: "3"
  - Option 3: "4"
  - Option 4: "5"
- Created (ms epoch): 1789663269472
- First on-chain state: participants 1, tallies {"0": {"4": 1}}

Verify anytime:

```bash
CONTRACT_ADDRESS=9b6e0eed1f8a8f2a79ed2db9fe35570e1ad30ab8f8c358c44bc4b7e06ed7eeff \
  bun scripts/verify-deploy.ts
```
