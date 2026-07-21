# BlindPulse Privacy Model

## What an observer CAN learn:
- Total number of participants
- Aggregate tally per question option
- That a nullifier was spent (someone submitted, but not who)
- Survey metadata (question count, active status)

## What an observer CANNOT learn:
- WHO submitted a response (wallet address is a private witness)
- WHAT any individual answered (responses are private inputs)
- WHETHER a specific wallet participated (nullifier is unlinkable)
- The credential used to prove eligibility

## How disclose() is used:
- disclose() is called ONLY on aggregate tally values
- Individual responses and credentials NEVER enter public domain
- Nullifiers are written to public state but are one-way hashes
  of private credentials — computationally unlinkable
