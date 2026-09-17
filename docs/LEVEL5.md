# Level 5 Runbook — 50 Preprod Users, Feedback Loop, Mentor Approval

Everything needed to recruit respondents, run the feedback loop, and
demo for mentor sign-off. Every claim is verifiable via the commands
and links below.

## Live survey (the one to share)

- **Contract:** `d9a1605a0ada136ffe075736784a28b6e58c876ad53825fe1be0d23dfda5f132`
- **Survey page (wallet route):** `/survey/d9a1605a0ada136ffe075736784a28b6e58c876ad53825fe1be0d23dfda5f132`
- **Results (public, no wallet):** `/results/d9a1605a0ada136ffe075736784a28b6e58c876ad53825fe1be0d23dfda5f132`
- **Feedback page (self-hosted loop):** `/feedback`
- **Wallet-free fallback (off-chain):** <https://forms.gle/tSfuc3mhU87XQjh68>
- **Organizer (close-gate):** coin key `26d80ca0…f3cbdaa` recorded on-chain

When sharing publicly, prefix localhost URLs with your public host
(e.g. a tunnel or deployed instance). Locally:
`CONTRACT_ADDRESS=d9a1605a… bun scripts/verify-deploy.ts`.

## Recruitment blurb (copy-paste)

> BlindPulse — anonymous surveys on Midnight where anyone can verify
> the count. Answer 3 questions in under a minute. Your answers are
> zero-knowledge witnesses: we see the aggregate, never you. One
> response per wallet, enforced on-chain. No Lace wallet? There's a
> Google Form fallback on the page (collected off-chain).
> → [survey link] · live results: [results link]

## Respondent quickstart (paste to anyone)

1. Open the survey link in a desktop browser
2. Install the **1AM wallet** (Midnight; check the Chrome Web Store) or
   Lace, set it to **Preprod**, and create a wallet
3. Get free test NIGHT at the Preprod faucet:
   <https://faucet.preprod.midnight.network/>
4. Click **Connect Wallet**, approve, answer 3 questions, **Submit**,
   approve the transaction in the wallet
5. Watch your (anonymous) contribution land on the results page

## The feedback loop

- **Self-hosted:** `/feedback` renders the Beta Feedback survey through
  BlindPulse itself — the app surveys its own users on its own rails
- **Public transparency:** results accumulate on-chain and are readable
  by anyone; the dashboard tracks progress toward the 50-respondent
  goal (Feedback Loop panel)
- **Off-chain supplement:** the Google Form collects free-form
  suggestions the on-chain tally can't; review both weekly

## Channel plan (suggested order)

1. Midnight community Discord/Telegram — introduce the project, share
   the survey + results links
2. X/Twitter thread with the new-moon narrative + results screenshot
3. Local dev communities / hackathon cohorts — the demo doubles as a
   ZK-on-Midnight walkthrough
4. Direct asks: 1-on-1 messages convert far better than broadcasts

## Mentor demo script (~5 minutes)

1. **Landing** — the privacy explainer and how-it-works strip; point
   at the live survey banner (real, on-chain)
2. **Deploy live** — connect wallet, create a 1-question survey,
   approve, show the green panel with contract ID
3. **Vote from a second wallet** — answer, submit, show the aggregate
   move on the results page *in the same browser without any login*
4. **Double-vote proof** — submit again from the same wallet; show the
   friendly amber rejection; reload results to prove the count didn't
   change
5. **Verify script** — run
   `CONTRACT_ADDRESS=<id> bun scripts/verify-deploy.ts` in a terminal;
   note the organizer line (close-gate) and participant count
6. **Close (optional)** — on a scratch survey, Close → confirm; the
   survey becomes read-only; only the organizer wallet could do that
7. **Tests/CI** — `bun run test` (29 tests), point at GitHub Actions

## Sign-off checklist

- [ ] 50 distinct on-chain participants on the Beta Feedback survey
      (or mentor-approved equivalent cohort across surveys)
- [ ] Feedback reviewed: on-chain tallies + Google Form responses
- [ ] At least one improvement shipped *because of* feedback
      (document it in this file with a dated note)
- [ ] Mentor demo completed; approval noted here with date

### Feedback log

| Date | Source | Feedback | Action |
| ---- | ------ | -------- | ------ |
| —    | —      | —        | —      |
