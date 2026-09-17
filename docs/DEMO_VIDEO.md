# Demo video — shot list (aim: 2–3 minutes)

Record at 1080p. Have two wallets ready: the organizer wallet
(pre-funded) and a second respondent wallet. Keep a terminal visible
for the verify step. Use the take numbers as timestamps; the script
follows the moon phases so reviewers hear the narrative once.

## 0:00 — Hook (narration over the landing page)

> "BlindPulse is anonymous feedback on Midnight. Respondents prove
> eligibility in zero knowledge — the chain only ever learns the
> aggregate. Here's the product, end to end."

## 0:15 — Privacy model (20s)

Landing page scroll: the how-it-works strip (Deploy → Prove → Count →
Verify) and the privacy explainer.

> "Everything marked private never touches the ledger. What's public
> is exactly what a survey should honestly report: tallies, a
> participant counter, and one-way nullifiers."

## 0:35 — Create and deploy live (35s)

/create: connect the organizer wallet, fill a one-question survey,
Deploy, approve in the wallet, show the green success panel with the
contract ID.

> "Deploying through the DApp via Lace. The contract address is the
> survey's public identity — the results page is public at that
> address."

## 1:10 — Respond anonymously from a second wallet (35s)

/survey/<id> from the second wallet: newcomer hints visible on the
connect wall, connect, answer, submit, approve. Then open /results/<id>
in a fresh tab — no wallet, no login.

> "The respondent's answers and identity are ZK witnesses. Anyone can
> verify the aggregate from the indexer — no account, no trust in the
> operator."

## 1:45 — Double-vote rejection (25s)

Submit again from the same wallet; show the friendly amber notice; then
reload the results page.

> "One response per wallet, enforced on-chain by a per-survey
> nullifier — same wallet, same survey, same nullifier, rejected. The
> count didn't move."

## 2:10 — Verify on-chain (20s)

Terminal: `CONTRACT_ADDRESS=<id> bun scripts/verify-deploy.ts`.

> "surveyActive, question count, participant count, tallies — read
> straight from the ledger. The organizer line is the close-gate: the
> survey's organizer key recorded at deploy; closeSurvey verifies the
> caller against it in-circuit."

## 2:30 — Close and feedback loop (25s)

Dashboard: Feedback Loop panel (participants toward the goal), Close →
confirm on a scratch survey, badge flips to closed. Then /feedback.

> "Only the organizer wallet can end collection — the circuit checks
> it in zero knowledge. And the product runs its own feedback loop on
> itself: BlindPulse surveys its own users, anonymously."

## 2:55 — Outro

> "Open source, CI-tested, live on Midnight Preprod. Link in the
> description."

## Pre-flight checklist

- [ ] Organizer wallet connected BEFORE recording the deploy take
- [ ] Second wallet pre-funded and on Preprod
- [ ] Terminal font size readable at 1080p
- [ ] Registry restored so survey titles show real names, not generic labels
- [ ] Upload: YouTube (unlisted) + attach to the X profile; put both
      links in the README submission table
