#!/usr/bin/env bun
/**
 * Test script for generating testnet users and verifying multiple survey responses.
 *
 * This script is SELF-CONTAINED - it does not import browser-only code.
 * It simulates the full test flow and can optionally connect to a real
 * Preprod contract for end-to-end verification.
 *
 * Features:
 * - Generates deterministic test wallet identities (seed-based)
 * - Creates a survey or uses an existing deployment
 * - Submits multiple responses from different users
 * - Verifies aggregate tallies and participant counts
 * - Exports participant data for verification (Levels 5-6 compliant)
 *
 * Modes:
 *   demo   - Uses in-memory storage (no blockchain, no Lace wallet needed)
 *   test   - Comprehensive assertion suite: double-voting rejection,
 *            cross-survey unlinkability, organizer-only close, option-index
 *            boundary, aggregate consistency, and a public-output privacy scan
 *   preprod- Uses real Preprod deployment (requires Lace wallet with testnet
 *            tPAIR) - not available from the CLI; use the DApp in a browser
 *
 * Usage:
 *   bun scripts/test-multi-response.ts [options]
 *
 * Options:
 *   --mode <demo|test|preprod>  Execution mode (default: demo)
 *   --users <number>            Number of test users (default: 5)
 *   --questions <number>        Number of questions in survey (default: 3)
 *   --export                    Export participant data to exports/ (demo mode)
 *   --help                      Show this help message
 *
 * Example:
 *   # Demo mode with 3 users, 2 questions each
 *   bun scripts/test-multi-response.ts --mode demo --users 3 --questions 2
 *
 *   # Run the comprehensive test suite
 *   bun scripts/test-multi-response.ts --mode test --users 5
 *
 *   # Demo with participant export
 *   bun scripts/test-multi-response.ts --mode demo --users 4 --export
 */

import { blake2b } from "@noble/hashes/blake2.js";
import { mkdirSync, writeFileSync } from "node:fs";
import { argv, exit, stdout, stderr } from "node:process";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface TestWallet {
  index: number;
  coinPublicKey: Uint8Array;
  address: string;
}

interface SubmissionResult {
  walletIndex: number;
  responses: number[];
  success: boolean;
  error?: string;
}

interface TestResults {
  surveyId: string;
  totalUsers: number;
  successfulSubmissions: number;
  totalParticipants: number;
  tallies: Record<number, Record<number, number>>;
  /** nullifier hex -> wallet label (demo-local knowledge, NOT derivable on-chain) */
  nullifierOwners: Map<string, string>;
  nullifiers: string[];
  executionTimeMs: number;
}

interface MockLedger {
  surveyActive: boolean;
  questionCount: number;
  tallies: Map<number, Map<number, number>>;
  participantCount: number;
  nullifiers: Set<string>;
  organizer: Uint8Array;
}

interface Check {
  name: string;
  pass: boolean;
  detail: string;
}

// ============================================================================
// NULLIFIER DERIVATION (mirrors src/lib/nullifier.ts)
// ============================================================================

const NULLIFIER_DOMAIN = "blindpulse-nullifier-v1";

/**
 * nullifier = BLAKE2b-256(domain || coinPublicKey || surveyId)
 * PRIVATE: coinPublicKey. PUBLIC: the 32-byte digest (disclosed by design).
 */
function deriveNullifier(
  coinPublicKey: Uint8Array,
  surveyIdBytes: Uint8Array,
): Uint8Array {
  if (coinPublicKey.length !== 32) {
    throw new Error(
      `coin public key must be 32 bytes, received ${coinPublicKey.length}`,
    );
  }
  if (surveyIdBytes.length !== 32) {
    throw new Error(
      `survey id must be 32 bytes, received ${surveyIdBytes.length}`,
    );
  }
  const domain = new TextEncoder().encode(NULLIFIER_DOMAIN);
  const input = new Uint8Array(
    domain.length + coinPublicKey.length + surveyIdBytes.length,
  );
  input.set(domain, 0);
  input.set(coinPublicKey, domain.length);
  input.set(surveyIdBytes, domain.length + coinPublicKey.length);
  return blake2b(input, { dkLen: 32 });
}

function hexToBytes32(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/, "");
  if (!/^[0-9a-fA-F]+$/.test(clean) || clean.length !== 64) {
    throw new Error(`expected 64 hex chars, received: ${hex.slice(0, 70)}`);
  }
  return new Uint8Array(clean.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
}

function bytesToHex(bytes: Uint8Array): string {
  return (
    "0x" +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

// ============================================================================
// TEST WALLET GENERATION (deterministic, seed-based)
// ============================================================================

function generateTestWallets(count: number): TestWallet[] {
  const wallets: TestWallet[] = [];
  for (let i = 0; i < count; i++) {
    const coinPublicKey = new Uint8Array(32);
    for (let j = 0; j < 32; j++) {
      coinPublicKey[j] = ((i + 1) * (j + 1)) % 256;
    }
    wallets.push({
      index: i,
      coinPublicKey,
      address: bytesToHex(coinPublicKey),
    });
  }
  return wallets;
}

function walletNullifier(wallet: TestWallet, surveyIdBytes: Uint8Array) {
  return deriveNullifier(wallet.coinPublicKey, surveyIdBytes);
}

// ============================================================================
// MOCK LEDGER (mirrors contract/blindpulse.compact exactly)
// ============================================================================
// submitResponse transition, as written in the .compact source:
//   1. assert surveyActive == true            -> "Survey is not active"
//   2. assert !nullifiers.member(nullifier)   -> "Nullifier already spent"
//   3. nullifiers.insert(nullifier)
//   4. for each question < questionCount: tallies[q][option].increment(1)
//      (tally cells are pre-created by the constructor; option >= 20 has no
//       cell on-chain and is enforced to < 20 in the UI)
//   5. participantCount.increment(1)
// A failed assertion reverts the whole circuit - hence the precheck below
// happens BEFORE any mutation.

const MAX_Q = 20;
const MAX_OPTIONS = 20;

function createMockLedger(): MockLedger {
  return {
    surveyActive: false,
    questionCount: 0,
    tallies: new Map(),
    participantCount: 0,
    nullifiers: new Set(),
    organizer: new Uint8Array(32),
  };
}

/** Mirrors the constructor: activate, set qCount, pre-create every tally cell. */
function simulateConstructor(
  ledger: MockLedger,
  qCount: number,
  organizer?: Uint8Array,
): void {
  ledger.surveyActive = true;
  ledger.questionCount = qCount;
  if (organizer) ledger.organizer = organizer;
  for (let q = 0; q < MAX_Q; q++) {
    ledger.tallies.set(q, new Map());
  }
}

type SubmitOutcome =
  | "ok"
  | "Survey is not active"
  | "Nullifier already spent"
  | "Tally cell missing (option index out of range)";

function simulateSubmitResponse(
  ledger: MockLedger,
  nullifier: Uint8Array,
  responses: number[],
): SubmitOutcome {
  if (!ledger.surveyActive) return "Survey is not active";

  const nullifierHex = bytesToHex(nullifier);
  if (ledger.nullifiers.has(nullifierHex)) return "Nullifier already spent";

  // Precheck (circuit asserts would revert, so nothing mutates on failure):
  // every option index must address a pre-created tally cell (< MAX_OPTIONS).
  for (let q = 0; q < ledger.questionCount; q++) {
    const optionIdx = responses[q] ?? 0;
    if (optionIdx < 0 || optionIdx >= MAX_OPTIONS) {
      return "Tally cell missing (option index out of range)";
    }
  }

  ledger.nullifiers.add(nullifierHex);
  for (let q = 0; q < MAX_Q; q++) {
    if (q < ledger.questionCount) {
      const optionIdx = responses[q] ?? 0;
      const row = ledger.tallies.get(q)!;
      row.set(optionIdx, (row.get(optionIdx) ?? 0) + 1);
    }
  }
  ledger.participantCount += 1;
  return "ok";
}

/** Mirrors closeSurvey(closeCaller): organizer-gated, flips surveyActive. */
function simulateCloseSurvey(
  ledger: MockLedger,
  closeCaller: Uint8Array,
): "ok" | "Only the organizer can close the survey" {
  if (bytesToHex(closeCaller) !== bytesToHex(ledger.organizer)) {
    return "Only the organizer can close the survey";
  }
  ledger.surveyActive = false;
  return "ok";
}

/** PUBLIC aggregate read: tallies + participant count, nothing else. */
function getLedgerResults(
  ledger: MockLedger,
  qCount: number,
): { tallies: Record<number, Record<number, number>>; totalParticipants: number } {
  const tallies: Record<number, Record<number, number>> = {};
  for (let qi = 0; qi < qCount; qi++) {
    tallies[qi] = {};
    for (const [oi, count] of ledger.tallies.get(qi)?.entries() ?? []) {
      tallies[qi][oi] = count;
    }
  }
  return { tallies, totalParticipants: ledger.participantCount };
}

// ============================================================================
// SHARED SURVEY IDS (same constants as test/multi-vote.test.ts)
// ============================================================================

const SURVEY_A = hexToBytes32(
  "92ef920564c1b67d8081f6eea8a880c7ac0904d601396ef87c16859b29ff8087",
);
const SURVEY_B = hexToBytes32(
  "c85d9e980809d76f7f0204be2730c752b0abfb5ae572c1fa038622c7a0ba7d4f",
);

// ============================================================================
// DEMO MODE
// ============================================================================

function generateUserResponses(questionCount: number, walletIndex: number): number[] {
  const responses: number[] = [];
  for (let i = 0; i < questionCount; i++) {
    responses.push((walletIndex + i) % 5); // Likert-scale 0-4
  }
  return responses;
}

async function runDemoMode(options: {
  users: number;
  questions: number;
}): Promise<TestResults> {
  const startTime = Date.now();
  stdout.write("🧪 Running in DEMO mode (in-memory simulation)\n");

  const ledger = createMockLedger();
  const wallets = generateTestWallets(options.users);
  stdout.write(`👥 Generated ${wallets.length} test wallet identities\n`);

  const surveyId = `demo-survey-${Date.now()}`;
  // Stable demo survey id: a real deployment's Bytes<32> contract address.
  const demoSurveyIdBytes = SURVEY_A;

  simulateConstructor(ledger, options.questions, wallets[0].coinPublicKey);
  stdout.write(
    `📝 Created test survey: ${surveyId} (${options.questions} questions)\n`,
  );

  const submissions: SubmissionResult[] = [];
  const nullifierOwners = new Map<string, string>();
  const allResponses: number[][] = [];

  for (const wallet of wallets) {
    stdout.write(`  👤 Wallet ${wallet.index + 1}: Submitting response... `);
    const responses = generateUserResponses(options.questions, wallet.index);
    const nullifier = walletNullifier(wallet, demoSurveyIdBytes);

    const result = simulateSubmitResponse(ledger, nullifier, responses);
    const success = result === "ok";

    allResponses.push(responses); // accumulate per-user responses
    if (success) nullifierOwners.set(bytesToHex(nullifier), `wallet-${wallet.index}`);

    submissions.push({ walletIndex: wallet.index, responses, success, error: success ? undefined : result });
    stdout.write(success ? "✅\n" : `❌ ${result}\n`);
  }

  const results = getLedgerResults(ledger, options.questions);

  return {
    surveyId,
    totalUsers: options.users,
    successfulSubmissions: submissions.filter((s) => s.success).length,
    totalParticipants: ledger.participantCount,
    tallies: results.tallies,
    nullifierOwners,
    nullifiers: [...ledger.nullifiers],
    executionTimeMs: Date.now() - startTime,
  };
}

// ============================================================================
// RESULTS DISPLAY (demo mode)
// ============================================================================

function displayResults(results: TestResults, mode: string): void {
  const line = "════════════════════════════════════════════════════════════════════════════════════";
  stdout.write(`\n${line}\n`);
  stdout.write(`        BlindPulse Multi-Response Test Results (${mode.toUpperCase()} mode)\n`);
  stdout.write(`${line}\n`);

  stdout.write("📊 Test Summary:\n");
  stdout.write(`   • Survey ID:              ${results.surveyId}\n`);
  stdout.write(`   • Total Users:            ${results.totalUsers}\n`);
  stdout.write(`   • Successful Submissions: ${results.successfulSubmissions}\n`);
  stdout.write(
    `   • Success Rate:           ${((results.successfulSubmissions / results.totalUsers) * 100).toFixed(1)}%\n`,
  );
  stdout.write(`   • Total Participants:     ${results.totalParticipants}\n`);
  stdout.write(`   • Execution Time:         ${results.executionTimeMs}ms\n`);

  stdout.write("\n📈 Aggregate Results:\n");
  for (const [qStr, tallyMap] of Object.entries(results.tallies)) {
    const questionIdx = parseInt(qStr, 10);
    const totalForQuestion = Object.values(tallyMap).reduce((s, c) => s + c, 0);
    stdout.write(`   Question ${questionIdx + 1}:\n`);
    const sortedOptions = Object.entries(tallyMap).sort(
      ([a], [b]) => Number(a) - Number(b),
    );
    for (const [optionStr, count] of sortedOptions) {
      const percentage = totalForQuestion > 0 ? (count / totalForQuestion) * 100 : 0;
      stdout.write(
        `     • Option ${parseInt(optionStr, 10) + 1}: ${count} votes (${percentage.toFixed(1)}%)\n`,
      );
    }
    if (totalForQuestion > 0) {
      stdout.write(`     └─ Total responses for this question: ${totalForQuestion}\n`);
    }
  }

  stdout.write("\n🔒 Privacy Verification:\n");
  const uniqueNullifiers = new Set(results.nullifiers).size;
  stdout.write(`   • Unique nullifiers: ${results.nullifiers.length}\n`);
  stdout.write(
    `   • Nullifiers are unique: ${uniqueNullifiers === results.nullifiers.length ? "✅" : "⚠️"}\n`,
  );
  stdout.write(
    "   • Nullifiers are one-way digests: respondent identities and answers stay private\n",
  );

  stdout.write("\n✅ Verification:\n");
  const expectedParticipants = results.successfulSubmissions;
  if (results.totalParticipants === expectedParticipants) {
    stdout.write(
      `   Participant count matches: ${results.totalParticipants} = ${expectedParticipants}\n`,
    );
  } else {
    stdout.write(
      `   ⚠️  Participant count mismatch: ${results.totalParticipants} ≠ ${expectedParticipants}\n`,
    );
  }

  let tallyConsistent = true;
  for (const tallyMap of Object.values(results.tallies)) {
    const tallySum = Object.values(tallyMap).reduce((s, c) => s + c, 0);
    if (tallySum !== results.totalParticipants) {
      tallyConsistent = false;
      break;
    }
  }
  if (results.totalParticipants === 0) {
    stdout.write("   Tally consistency: ℹ️  No participants recorded\n");
  } else if (tallyConsistent) {
    stdout.write("   Tally consistency: ✅ All question tallies sum to participant count\n");
  } else {
    stdout.write("   ⚠️  Tally inconsistency detected\n");
  }

  stdout.write(`${line}\n`);
  stdout.write(`🏁 Test completed in ${results.executionTimeMs}ms\n`);
}

// ============================================================================
// TEST MODE - COMPREHENSIVE ASSERTION SUITE
// ============================================================================

function tallySnapshot(ledger: MockLedger, qCount: number): string {
  return JSON.stringify(getLedgerResults(ledger, qCount).tallies);
}

function runTestMode(users: number): Check[] {
  const checks: Check[] = [];
  const check = (name: string, pass: boolean, detail: string): void => {
    checks.push({ name, pass, detail });
  };

  // --- Section A: submission & aggregation ---------------------------------

  // A1: one wallet, multi-question survey -> every tally cell correct
  {
    const ledger = createMockLedger();
    simulateConstructor(ledger, 3);
    const [alice] = generateTestWallets(1);
    const answers = [2, 0, 1];
    expectOk(
      simulateSubmitResponse(ledger, walletNullifier(alice, SURVEY_A), answers),
    );
    const { tallies } = getLedgerResults(ledger, 3);
    const pass =
      ledger.participantCount === 1 &&
      tallies[0][2] === 1 &&
      tallies[1][0] === 1 &&
      tallies[2][1] === 1;
    check(
      "A1 multi-question submission accumulates every tally cell",
      pass,
      `answers [2,0,1] -> q0:${JSON.stringify(tallies[0])} q1:${JSON.stringify(tallies[1])} q2:${JSON.stringify(tallies[2])}`,
    );
  }

  // A2: N users each vote once -> participantCount == N, every row sums to N
  {
    const ledger = createMockLedger();
    simulateConstructor(ledger, 3);
    const wallets = generateTestWallets(users);
    let allOk = true;
    for (const w of wallets) {
      const r = simulateSubmitResponse(
        ledger,
        walletNullifier(w, SURVEY_A),
        generateUserResponses(3, w.index),
      );
      if (r !== "ok") allOk = false;
    }
    const { tallies, totalParticipants } = getLedgerResults(ledger, 3);
    const rowsSum = Object.values(tallies).every((row) =>
      Object.values(row).reduce((s, c) => s + c, 0) === users,
    );
    check(
      "A2 multiple users are each counted exactly once",
      allOk && totalParticipants === users && rowsSum && ledger.nullifiers.size === users,
      `${users} wallets -> participants=${totalParticipants}, nullifiers=${ledger.nullifiers.size}, every tally row sums to ${users}: ${rowsSum}`,
    );
  }

  // A3: per-question independence (answers differ per question)
  {
    const ledger = createMockLedger();
    simulateConstructor(ledger, 2);
    const [w1, w2] = generateTestWallets(2);
    expectOk(simulateSubmitResponse(ledger, walletNullifier(w1, SURVEY_A), [0, 1]));
    expectOk(simulateSubmitResponse(ledger, walletNullifier(w2, SURVEY_A), [1, 0]));
    const { tallies } = getLedgerResults(ledger, 2);
    check(
      "A3 votes accumulate independently per question",
      tallies[0][0] === 1 && tallies[0][1] === 1 && tallies[1][0] === 1 && tallies[1][1] === 1,
      `q0=${JSON.stringify(tallies[0])} q1=${JSON.stringify(tallies[1])}`,
    );
  }

  // --- Section B: double-voting ---------------------------------------------

  const doubleVoteLedger = createMockLedger();
  simulateConstructor(doubleVoteLedger, 2);
  const [alice, bob] = generateTestWallets(2);

  // B1: same wallet, same answers -> rejected
  expectOk(
    simulateSubmitResponse(doubleVoteLedger, walletNullifier(alice, SURVEY_A), [1, 0]),
  );
  {
    const r = simulateSubmitResponse(
      doubleVoteLedger,
      walletNullifier(alice, SURVEY_A),
      [1, 0],
    );
    check(
      "B1 double-vote (same answers) is rejected by the nullifier set",
      r === "Nullifier already spent",
      `second submit -> "${r}"`,
    );
  }

  // B2: same wallet, DIFFERENT answers -> still rejected (ballot stuffing)
  {
    const before = tallySnapshot(doubleVoteLedger, 2);
    const r = simulateSubmitResponse(
      doubleVoteLedger,
      walletNullifier(alice, SURVEY_A),
      [0, 1],
    );
    const after = tallySnapshot(doubleVoteLedger, 2);
    check(
      "B2 double-vote with different answers is rejected and tallies untouched",
      r === "Nullifier already spent" && before === after,
      `second submit -> "${r}", tallies unchanged: ${before === after}`,
    );
  }

  // B3: a different wallet can still vote after a rejection
  {
    const r = simulateSubmitResponse(
      doubleVoteLedger,
      walletNullifier(bob, SURVEY_A),
      [1, 1],
    );
    check(
      "B3 distinct wallet is not blocked by someone else's spent nullifier",
      r === "ok" && doubleVoteLedger.participantCount === 2,
      `bob submit -> "${r}", participants=${doubleVoteLedger.participantCount}`,
    );
  }

  // B4: nullifier set size always equals accepted submissions
  {
    check(
      "B4 nullifier set size equals participant count",
      doubleVoteLedger.nullifiers.size === doubleVoteLedger.participantCount,
      `nullifiers=${doubleVoteLedger.nullifiers.size}, participants=${doubleVoteLedger.participantCount}`,
    );
  }

  // --- Section C: cross-survey unlinkability ---------------------------------

  // C1: same wallet participates in two surveys -> both accepted
  {
    const ledgerA = createMockLedger();
    const ledgerB = createMockLedger();
    simulateConstructor(ledgerA, 1);
    simulateConstructor(ledgerB, 1);
    const rA = simulateSubmitResponse(ledgerA, walletNullifier(alice, SURVEY_A), [0]);
    const rB = simulateSubmitResponse(ledgerB, walletNullifier(alice, SURVEY_B), [1]);
    check(
      "C1 same wallet can participate in two different surveys",
      rA === "ok" && rB === "ok" && ledgerA.participantCount === 1 && ledgerB.participantCount === 1,
      `survey A -> "${rA}", survey B -> "${rB}"`,
    );
  }

  // C2: nullifiers differ across surveys for EVERY wallet
  {
    const wallets = generateTestWallets(users);
    let allDiffer = true;
    for (const w of wallets) {
      if (bytesToHex(walletNullifier(w, SURVEY_A)) === bytesToHex(walletNullifier(w, SURVEY_B))) {
        allDiffer = false;
      }
    }
    check(
      "C2 nullifiers are unlinkable across surveys (differ for every wallet)",
      allDiffer,
      `${users}/${users} wallets produce distinct digests per survey`,
    );
  }

  // C3: nullifier is deterministic per (wallet, survey) - replay-safe by design
  {
    const [w] = generateTestWallets(1);
    const d1 = bytesToHex(walletNullifier(w, SURVEY_A));
    const d2 = bytesToHex(walletNullifier(w, SURVEY_A));
    check("C3 nullifier derivation is deterministic", d1 === d2, `digest stable across derivations`);
  }

  // C4: all (wallet, survey) digests are globally unique - no collisions/correlation
  {
    const wallets = generateTestWallets(users);
    const digests = new Set<string>();
    for (const w of wallets) {
      digests.add(bytesToHex(walletNullifier(w, SURVEY_A)));
      digests.add(bytesToHex(walletNullifier(w, SURVEY_B)));
    }
    check(
      "C4 no digest collisions across all (wallet, survey) pairs",
      digests.size === 2 * users,
      `${digests.size} unique digests for ${2 * users} pairs`,
    );
  }

  // --- Section D: survey state machine ----------------------------------------

  const stateLedger = createMockLedger();
  const [organizer, outsider] = generateTestWallets(2);
  simulateConstructor(stateLedger, 1, organizer.coinPublicKey);

  // D1: non-organizer cannot close
  {
    const r = simulateCloseSurvey(stateLedger, outsider.coinPublicKey);
    check(
      "D1 non-organizer cannot close the survey",
      r === "Only the organizer can close the survey" && stateLedger.surveyActive === true,
      `close as outsider -> "${r}", still active: ${stateLedger.surveyActive}`,
    );
  }

  // D2: organizer closes; submissions afterwards are rejected
  {
    const r = simulateCloseSurvey(stateLedger, organizer.coinPublicKey);
    const after = simulateSubmitResponse(
      stateLedger,
      walletNullifier(organizer, SURVEY_A),
      [0],
    );
    check(
      "D2 organizer closes the survey; later submissions are rejected",
      r === "ok" && stateLedger.surveyActive === false && after === "Survey is not active",
      `close -> "${r}", submit after close -> "${after}"`,
    );
  }

  // D3: option index >= MAX_OPTIONS has no tally cell -> rejected (UI enforces < 20)
  {
    const ledger = createMockLedger();
    simulateConstructor(ledger, 2);
    const [w] = generateTestWallets(1);
    const r = simulateSubmitResponse(ledger, walletNullifier(w, SURVEY_A), [0, 20]);
    check(
      "D3 out-of-range option index is rejected (no tally cell on-chain)",
      r === "Tally cell missing (option index out of range)" && ledger.participantCount === 0,
      `option 20 -> "${r}", participants=${ledger.participantCount}`,
    );
  }

  // D4: boundary option index 19 is accepted
  {
    const ledger = createMockLedger();
    simulateConstructor(ledger, 1);
    const [w] = generateTestWallets(1);
    const r = simulateSubmitResponse(ledger, walletNullifier(w, SURVEY_A), [19]);
    check(
      "D4 boundary option index 19 is accepted",
      r === "ok" && getLedgerResults(ledger, 1).tallies[0][19] === 1,
      `option 19 -> "${r}"`,
    );
  }

  // --- Section E: public-output privacy scan ----------------------------------

  // E1: the public aggregate read must not leak identities or digests
  {
    const ledger = createMockLedger();
    simulateConstructor(ledger, 3);
    const wallets = generateTestWallets(users);
    for (const w of wallets) {
      expectOk(
        simulateSubmitResponse(
          ledger,
          walletNullifier(w, SURVEY_A),
          generateUserResponses(3, w.index),
        ),
      );
    }
    const publicResults = getLedgerResults(ledger, 3);
    const serialized = JSON.stringify(publicResults);
    const leaks = wallets.some(
      (w) =>
        serialized.includes(w.address) ||
        serialized.includes(bytesToHex(w.coinPublicKey).slice(2)) ||
        serialized.includes(bytesToHex(walletNullifier(w, SURVEY_A)).slice(2)),
    );
    check(
      "E1 public aggregate output leaks no wallet addresses or nullifier digests",
      !leaks,
      `scanned ${serialized.length} chars of public output against ${users} wallets`,
    );
  }

  // E2: participant counter equals sum of per-question tallies
  {
    const { tallies, totalParticipants } = getLedgerResults(doubleVoteLedger, 2);
    const q0 = Object.values(tallies[0]).reduce((s, c) => s + c, 0);
    const q1 = Object.values(tallies[1]).reduce((s, c) => s + c, 0);
    check(
      "E2 tallies sum to participant count on every question",
      q0 === totalParticipants && q1 === totalParticipants,
      `q0=${q0}, q1=${q1}, participants=${totalParticipants}`,
    );
  }

  return checks;
}

function expectOk(outcome: SubmitOutcome): void {
  if (outcome !== "ok") {
    throw new Error(`expected submission to succeed, got: ${outcome}`);
  }
}

function displayTestResults(checks: Check[]): boolean {
  const line = "════════════════════════════════════════════════════════════════════";
  stdout.write(`\n${line}\n`);
  stdout.write("         BlindPulse Comprehensive Test Suite (TEST mode)\n");
  stdout.write(`${line}\n`);

  let lastSection = "";
  for (const c of checks) {
    const section = c.name.match(/^[A-Z]+/)?.[0] ?? "";
    if (section !== lastSection) {
      stdout.write(`\n  ${sectionTitle(section)}\n`);
      lastSection = section;
    }
    stdout.write(`  ${c.pass ? "✅" : "❌"} ${c.name}\n`);
    stdout.write(`     ${c.detail}\n`);
  }

  const failed = checks.filter((c) => !c.pass);
  stdout.write(`\n${line}\n`);
  stdout.write(
    `  Result: ${checks.length - failed.length}/${checks.length} checks passed\n`,
  );
  if (failed.length > 0) {
    stdout.write(`  ❌ FAILED: ${failed.map((c) => c.name.split(" ").slice(1).join(" ")).join("; ")}\n`);
  }
  stdout.write(`${line}\n`);
  return failed.length === 0;
}

function sectionTitle(prefix: string): string {
  const titles: Record<string, string> = {
    A: "Submission & aggregation",
    B: "Double-voting prevention",
    C: "Cross-survey unlinkability",
    D: "Survey state machine",
    E: "Public-output privacy",
  };
  return titles[prefix] ?? prefix;
}

// ============================================================================
// PARTICIPANT EXPORT (demo mode, Levels 5-6 evidence format)
// ============================================================================

function exportParticipants(results: TestResults): void {
  const exportData = {
    contract: results.surveyId,
    network: "demo",
    exportedAt: new Date().toISOString(),
    total: results.totalParticipants,
    // Demo-local labels only: on-chain, nullifier digests are unlinkable to
    // any address - that mapping exists here because WE generated the wallets.
    participants: results.nullifiers.map((nf, idx) => ({
      address: results.nullifierOwners.get(nf) ?? `wallet-${idx}`,
      nullifier: nf,
      at: Date.now() - results.executionTimeMs + idx,
    })),
  };

  mkdirSync("exports", { recursive: true });
  const filename = `exports/participants-demo-${Date.now()}.json`;
  writeFileSync(filename, JSON.stringify(exportData, null, 2));
  stdout.write(`💾 Participant data exported to: ${filename}\n`);
}

// ============================================================================
// ARGUMENT PARSING
// ============================================================================

interface Options {
  mode: "demo" | "test" | "preprod";
  users: number;
  questions: number;
  exportData: boolean;
  help: boolean;
}

function parseArgs(): Options {
  const args = argv.slice(2);
  const options: Options = {
    mode: "demo",
    users: 5,
    questions: 3,
    exportData: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--mode":
        options.mode = args[++i] as Options["mode"];
        break;
      case "--users":
        options.users = parseInt(args[++i], 10);
        break;
      case "--questions":
        options.questions = parseInt(args[++i], 10);
        break;
      case "--export":
        options.exportData = true;
        break;
      case "--help":
        options.help = true;
        break;
      default:
        if (arg.startsWith("--")) {
          stderr.write(`⚠️  Unknown option: ${arg}\n`);
        }
    }
  }

  if (options.users < 1) {
    stderr.write("❌ Number of users must be at least 1\n");
    exit(1);
  }
  if (options.questions < 1 || options.questions > MAX_Q) {
    stderr.write(`❌ Number of questions must be between 1 and ${MAX_Q}\n`);
    exit(1);
  }
  if (options.mode !== "demo" && options.mode !== "preprod" && options.mode !== "test") {
    stderr.write('❌ Mode must be either "demo", "test", or "preprod"\n');
    exit(1);
  }

  return options;
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  try {
    const options = parseArgs();

    if (options.help) {
      stdout.write("Usage: bun scripts/test-multi-response.ts [options]\n");
      stdout.write("\nOptions:\n");
      stdout.write("  --mode <demo|test|preprod>  Execution mode (default: demo)\n");
      stdout.write("  --users <number>            Number of test users (default: 5)\n");
      stdout.write("  --questions <number>        Number of questions in survey (default: 3)\n");
      stdout.write("  --export                    Export participant data to exports/ (demo mode)\n");
      stdout.write("  --help                      Show this help message\n");
      stdout.write("\nExamples:\n");
      stdout.write("  bun scripts/test-multi-response.ts --mode demo --users 3 --questions 2\n");
      stdout.write("  bun scripts/test-multi-response.ts --mode test --users 5\n");
      stdout.write("  bun scripts/test-multi-response.ts --mode demo --users 4 --export\n");
      exit(0);
    }

    stdout.write("🚀 BlindPulse Multi-Response Test Script\n");
    stdout.write(`   Mode: ${options.mode}\n`);
    stdout.write(`   Users: ${options.users}\n`);
    stdout.write(`   Questions per user: ${options.questions}\n`);
    stdout.write("\n");

    if (options.mode === "test") {
      const checks = runTestMode(options.users);
      const allPassed = displayTestResults(checks);
      if (allPassed) {
        stdout.write("\n🎉 All checks passed: double-voting rejected, surveys unlinkable, aggregates consistent.\n");
        exit(0);
      } else {
        stdout.write("\n⚠️  Some checks failed - see ❌ entries above.\n");
        exit(1);
      }
    }

    if (options.mode === "preprod") {
      stdout.write("⚠️  Preprod mode requires a browser environment with the Lace wallet.\n");
      stdout.write("   From the CLI, only demo and test modes are supported.\n");
      stdout.write("   For preprod end-to-end testing, use the DApp in a browser with your Lace wallet.\n");
      exit(0);
    }

    // Demo mode
    const results = await runDemoMode(options);
    displayResults(results, "demo");

    if (options.exportData && results.nullifiers.length > 0) {
      exportParticipants(results);
    }

    const success = results.successfulSubmissions === results.totalUsers;
    if (success) {
      stdout.write("\n🎉 All tests passed! The app correctly handles multiple responses.\n");
      exit(0);
    } else {
      stdout.write(
        `\n⚠️  Some tests failed. ${results.totalUsers - results.successfulSubmissions} out of ${results.totalUsers} submissions failed.\n`,
      );
      exit(1);
    }
  } catch (error) {
    const err = error as Error;
    stderr.write(`\n❌ Fatal error: ${err.message}\n`);
    if (process.env.DEBUG && err.stack) {
      stderr.write(`${err.stack}\n`);
    }
    exit(1);
  }
}

main();
