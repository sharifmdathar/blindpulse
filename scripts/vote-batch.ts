#!/usr/bin/env bun
/**
 * BlindPulse batch CLI voter — many wallets, one vote each, on Preprod.
 *
 * WHY THIS EXISTS
 *  The contract enforces one wallet = one vote: the nullifier is
 *  deterministic per (wallet, survey), so re-running scripts/vote.ts with the
 *  SAME mnemonic always hits "Nullifier already spent" and participantCount
 *  never moves. N distinct participants therefore need N distinct wallets,
 *  each funded with its own tNIGHT + dust. This script generates those
 *  wallets and drives vote.ts once per wallet, reusing its per-wallet sync
 *  checkpoints (.wallet-state/<network>-<fingerprint>.json) so progress
 *  accumulates across runs and chunks.
 *
 * PRIVACY MODEL (identical to the DApp and vote.ts — see CLAUDE.md)
 *  PRIVATE (never leaves the machine, only enters the ZK circuit):
 *    - every wallet's mnemonic, secret keys, and coin public key
 *    - the individual answers in `responses`
 *  PUBLIC (written to the ledger by the circuit):
 *    - BLAKE2b-256(domain || coinPublicKey || surveyId) per wallet — one-way
 *    - the aggregate tally increments and participantCount
 *  This script prints unshielded (fee-paying) addresses and vote outcomes —
 *  both already public on-chain — and NEVER prints a mnemonic. Mnemonics live
 *  only in the wallets file below (gitignored, chmod 600).
 *
 * USAGE
 *   bun scripts/vote-batch.ts --generate [--count 50]
 *   bun scripts/vote-batch.ts --addresses
 *   # ...fund every printed address at https://faucet.preprod.midnight.network
 *   bun scripts/vote-batch.ts --vote [--survey <hex>] [--answers 0,1,2,3,4]
 *   bun scripts/vote-batch.ts --vote --offset 20 --limit 10   # chunked resume
 *
 * OPTIONS
 *   --generate            Create --count fresh 24-word mnemonics and save them
 *   --addresses           Print each wallet's funding address (offline, fast)
 *   --vote                One vote.ts run per wallet, sequentially
 *   --count <n>           Wallets to generate (default 50)
 *   --wallets-file <path> Wallet store (default .wallet-state/batch-wallets.json)
 *   --survey <hex>        Contract address (default: the App Feedback survey)
 *   --answers <a,b,c>     Cycle this list across wallets (default 0,1,2,3,4)
 *   --offset <n>          Start at wallet index n (default 0)
 *   --limit <n>           Vote with at most n wallets
 *   --force               Overwrite an existing wallets file on --generate
 *
 * CREDENTIALS
 *   None on the command line: the wallets file IS the credential store.
 *   Back it up; anyone holding it holds all 50 wallets. It must never be
 *   committed, pasted, or shared (gitignored + chmod 600 by construction).
 *
 * EXIT CODES
 *   0 every wallet voted or had already voted
 *   1 any wallet failed (or usage/generation error) — re-run the slice
 */

import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { argv, env, exit, stderr, stdout } from "node:process";
import { generateMnemonic } from "@scure/bip39";
import { wordlist as english } from "@scure/bip39/wordlists/english.js";
import { createKeystore } from "@midnight-ntwrk/wallet-sdk";
import { WalletSeeds } from "@midnight-ntwrk/testkit-js";

// ============================================================================
// CONFIG
// ============================================================================

/** Preprod only — CLAUDE.md hard constraint #3. */
const NETWORK_ID = "preprod";

/** Default target: the App Feedback survey ("rate 1–5", 1 question). */
const DEFAULT_SURVEY =
  "9b6e0eed1f8a8f2a79ed2db9fe35570e1ad30ab8f8c358c44bc4b7e06ed7eeff";

/** Compiled-script root, resolved from this file so cwd does not matter. */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VOTE_SCRIPT = path.join(ROOT, "scripts", "vote.ts");

/**
 * PRIVATE: the credential store — one mnemonic per wallet. Gitignored and
 * chmod 600; losing it means losing the wallets, sharing it means sharing
 * them. The funding addresses derived from it are PUBLIC (they appear on the
 * explorer as soon as they are funded).
 */
const DEFAULT_WALLETS_FILE = path.join(ROOT, ".wallet-state", "batch-wallets.json");

/** MAX_OPTIONS in contract/blindpulse.compact — answers must be 0..19. */
const MAX_OPTIONS = 20;

interface BatchWallets {
  version: 1;
  createdAt: string;
  count: number;
  wallets: Array<{ index: number; mnemonic: string }>;
}

interface Options {
  mode: "generate" | "addresses" | "vote" | null;
  count: number;
  walletsFile: string;
  survey: string;
  /** Answer lists cycle across wallets: wallet i uses list[i % list.length]. */
  answers: number[][];
  offset: number;
  limit: number | null;
  force: boolean;
}

// ============================================================================
// ARGUMENT PARSING
// ============================================================================

function parseArgs(): Options {
  const args = argv.slice(2);
  const opts: Options = {
    mode: null,
    count: 50,
    walletsFile: DEFAULT_WALLETS_FILE,
    survey: DEFAULT_SURVEY,
    answers: [[0], [1], [2], [3], [4]],
    offset: 0,
    limit: null,
    force: false,
  };

  let i = 0;
  const take = (flag: string): string => {
    const value = args[++i];
    if (!value || value.startsWith("--")) {
      stderr.write(`missing value for ${flag}\n`);
      exit(1);
    }
    return value;
  };

  for (; i < args.length; i++) {
    switch (args[i]) {
      case "--generate":
        opts.mode = "generate";
        break;
      case "--addresses":
        opts.mode = "addresses";
        break;
      case "--vote":
        opts.mode = "vote";
        break;
      case "--count":
        opts.count = parseInt(take("--count"), 10);
        break;
      case "--wallets-file":
        opts.walletsFile = path.resolve(ROOT, take("--wallets-file"));
        break;
      case "--survey":
        opts.survey = take("--survey").replace(/^0x/, "");
        break;
      case "--answers":
        opts.answers = take("--answers")
          .split(",")
          .map((n) => [parseInt(n.trim(), 10)]);
        break;
      case "--offset":
        opts.offset = parseInt(take("--offset"), 10);
        break;
      case "--limit":
        opts.limit = parseInt(take("--limit"), 10);
        break;
      case "--force":
        opts.force = true;
        break;
      case "--help":
      case "-h":
        stdout.write(
          "Usage: bun scripts/vote-batch.ts --generate [--count 50]\n" +
            "       bun scripts/vote-batch.ts --addresses\n" +
            "       bun scripts/vote-batch.ts --vote [--survey <hex>] [--answers 0,1,2,3,4]\n" +
            "                                [--offset N] [--limit N]\n" +
            "See the header of scripts/vote-batch.ts for the full reference.\n",
        );
        exit(0);
        break;
      default:
        stderr.write(`unknown option: ${args[i]}\n`);
        exit(1);
    }
  }

  if (opts.mode === null) {
    stderr.write("specify one of --generate, --addresses, or --vote (--help)\n");
    exit(1);
  }
  if (!Number.isInteger(opts.count) || opts.count < 1 || opts.count > 500) {
    stderr.write("--count must be an integer in 1..500\n");
    exit(1);
  }
  for (const [k, list] of opts.answers.entries()) {
    for (const a of list) {
      if (!Number.isInteger(a) || a < 0 || a >= MAX_OPTIONS) {
        stderr.write(
          `--answers entry ${k + 1} must be an integer in 0..${MAX_OPTIONS - 1}\n`,
        );
        exit(1);
      }
    }
  }
  if (!/^[0-9a-fA-F]{64}$/.test(opts.survey)) {
    stderr.write("survey id must be 64 hex chars\n");
    exit(1);
  }
  if (!Number.isInteger(opts.offset) || opts.offset < 0) {
    stderr.write("--offset must be >= 0\n");
    exit(1);
  }
  if (opts.limit !== null && (!Number.isInteger(opts.limit) || opts.limit < 1)) {
    stderr.write("--limit must be >= 1\n");
    exit(1);
  }
  return opts;
}

// ============================================================================
// WALLETS FILE + ADDRESS DERIVATION (PRIVATE store, PUBLIC addresses)
// ============================================================================

/**
 * Loads the credential store.
 * PRIVATE: returns mnemonics — callers must never print them.
 */
function loadWallets(walletsFile: string): BatchWallets {
  if (!existsSync(walletsFile)) {
    stderr.write(
      `no wallets file at ${path.relative(ROOT, walletsFile)}\n` +
        "run --generate first.\n",
    );
    exit(1);
  }
  try {
    const parsed = JSON.parse(readFileSync(walletsFile, "utf8")) as BatchWallets;
    if (
      parsed.version !== 1 ||
      !Array.isArray(parsed.wallets) ||
      parsed.wallets.length === 0
    ) {
      throw new Error("version or wallets missing");
    }
    return parsed;
  } catch (err) {
    stderr.write(
      `cannot read wallets file: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    exit(1);
  }
}

/**
 * Derives the funding address for one mnemonic without touching the network.
 * PUBLIC: the returned bech32 address is the fee-payer shown on the explorer.
 * PRIVATE: the mnemonic — hashed into keys in memory, never logged.
 */
function deriveAddress(mnemonic: string): string {
  const seeds = WalletSeeds.fromMnemonic(mnemonic);
  return createKeystore(seeds.unshielded, NETWORK_ID).getBech32Address().asString();
}

// ============================================================================
// COMMANDS
// ============================================================================

/**
 * Creates N fresh wallets.
 * PRIVATE: writes mnemonics to a chmod-600 gitignored file; prints only the
 *          PUBLIC funding addresses.
 */
function cmdGenerate(opts: Options): void {
  if (existsSync(opts.walletsFile) && !opts.force) {
    stderr.write(
      `wallets file already exists: ${path.relative(ROOT, opts.walletsFile)}\n` +
        "refusing to overwrite (would orphan funded wallets). " +
        "Use --force to replace it, or --wallets-file for a second set.\n",
    );
    exit(1);
  }
  const wallets = Array.from({ length: opts.count }, (_, index) => ({
    index,
    // 256-bit entropy -> 24 words, matching the Lace phrases vote.ts expects.
    mnemonic: generateMnemonic(english, 256),
  }));
  const store: BatchWallets = {
    version: 1,
    createdAt: new Date().toISOString(),
    count: opts.count,
    wallets,
  };
  mkdirSync(path.dirname(opts.walletsFile), { recursive: true });
  writeFileSync(opts.walletsFile, JSON.stringify(store, null, 2));
  chmodSync(opts.walletsFile, 0o600);

  stdout.write(`🔑 generated ${opts.count} wallets -> ${path.relative(ROOT, opts.walletsFile)} (chmod 600, gitignored)\n`);
  stdout.write("Fund EVERY address below before voting:\n");
  stdout.write("https://faucet.preprod.midnight.network (manual captcha, one drip each)\n\n");
  for (const w of wallets) {
    stdout.write(`  [${w.index}] ${deriveAddress(w.mnemonic)}\n`);
  }
  stdout.write(
    `\nNext: bun scripts/vote-batch.ts --addresses  (re-print this list)\n` +
      `Then: bun scripts/vote-batch.ts --vote [--survey <hex>]\n` +
      `Each unfunded wallet fails fast with "No tNIGHT" and is retried next run.\n`,
  );
}

/**
 * Prints funding addresses (offline).
 * PUBLIC: addresses only — safe to paste into the faucet or share.
 */
function cmdAddresses(opts: Options): void {
  const store = loadWallets(opts.walletsFile);
  stdout.write(`📬 ${store.wallets.length} batch wallets (from ${path.relative(ROOT, opts.walletsFile)})\n`);
  for (const w of store.wallets) {
    stdout.write(`  [${w.index}] ${deriveAddress(w.mnemonic)}\n`);
  }
  stdout.write(
    `\nFund unfunded ones at https://faucet.preprod.midnight.network\n`,
  );
}

// ============================================================================
// VOTING (one vote.ts child per wallet)
// ============================================================================

interface VoteOutcome {
  index: number;
  answer: number[];
  status: "voted" | "already" | "failed";
  detail: string;
}

/** Forwards Ctrl-C to the running child so vote.ts can checkpoint first. */
let currentChild: ReturnType<typeof spawn> | null = null;
let aborted = false;

/**
 * Runs vote.ts for one wallet and streams its output live.
 * PRIVATE: the mnemonic travels only via the child's environment.
 * PUBLIC: the child's printed addresses, nullifier digest, and tx id.
 */
function runOneVote(
  mnemonic: string,
  survey: string,
  answer: number[],
): Promise<{ code: number | null; output: string }> {
  return new Promise((resolve) => {
    const childEnv: NodeJS.ProcessEnv = { ...env };
    childEnv.BP_WALLET_MNEMONIC = mnemonic;
    // A stale seed in the parent env would take precedence in vote.ts.
    delete childEnv.BP_WALLET_SEED;
    const child = spawn(
      "bun",
      [VOTE_SCRIPT, "--survey", survey, "--answers", answer.join(",")],
      { cwd: ROOT, env: childEnv },
    );
    currentChild = child;
    let output = "";
    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
      stdout.write(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      output += chunk.toString();
      stderr.write(chunk);
    });
    child.on("close", (code) => {
      currentChild = null;
      resolve({ code, output });
    });
    child.on("error", (err) => {
      currentChild = null;
      resolve({ code: null, output: `spawn failed: ${err.message}\n` });
    });
  });
}

/**
 * Votes once per wallet, sequentially.
 *
 * Sequential is deliberate: each run proves (30–90s) against the local proof
 * server and replays chain state; parallel runs would contend on both and
 * interleave checkpoints. Resume with --offset/--limit; wallets that already
 * voted are reported, not retried as failures.
 */
async function cmdVote(opts: Options): Promise<number> {
  const store = loadWallets(opts.walletsFile);
  const sliceEnd =
    opts.limit === null ? store.wallets.length : opts.offset + opts.limit;
  const wallets = store.wallets.slice(opts.offset, sliceEnd);
  if (wallets.length === 0) {
    stderr.write("nothing to do: --offset/--limit selected zero wallets\n");
    return 1;
  }

  process.on("SIGINT", () => {
    aborted = true;
    if (currentChild) currentChild.kill("SIGINT");
  });

  stdout.write(
    `🗳  batch vote: ${wallets.length} wallet(s) on survey ${opts.survey}\n` +
      `   answers cycle [${opts.answers.map((a) => a.join(",")).join(" | ")}] across wallet indexes\n` +
      `   wallet state: ${path.relative(ROOT, opts.walletsFile)}\n`,
  );

  const outcomes: VoteOutcome[] = [];
  for (const [pos, w] of wallets.entries()) {
    if (aborted) break;
    // Cycle by GLOBAL index so chunked runs stay consistent with full runs.
    const answer = opts.answers[w.index % opts.answers.length]!;
    stdout.write(`\n=== [${pos + 1}/${wallets.length}] wallet ${w.index} answers ${answer.join(",")} ===\n`);
    const started = Date.now();
    const { code, output } = await runOneVote(w.mnemonic, opts.survey, answer);
    const took = `${((Date.now() - started) / 1000).toFixed(0)}s`;
    if (code === 0) {
      outcomes.push({ index: w.index, answer, status: "voted", detail: took });
    } else if (/already voted|Nullifier already spent/i.test(output)) {
      outcomes.push({ index: w.index, answer, status: "already", detail: "nullifier spent" });
    } else {
      const tail = output.trim().split("\n").slice(-3).join(" / ").slice(0, 200);
      outcomes.push({ index: w.index, answer, status: "failed", detail: `${tail} (${took})` });
    }
  }

  const voted = outcomes.filter((o) => o.status === "voted");
  const already = outcomes.filter((o) => o.status === "already");
  const failed = outcomes.filter((o) => o.status === "failed");
  stdout.write(
    `\n── batch result: ${voted.length} voted, ${already.length} already voted, ${failed.length} failed ──\n`,
  );
  for (const o of failed) {
    stdout.write(`  ❌ wallet ${o.index}: ${o.detail}\n`);
  }
  if (failed.length > 0 || aborted) {
    const nextOffset = opts.offset + outcomes.length;
    stdout.write(
      `Resume the remainder with: bun scripts/vote-batch.ts --vote --offset ${nextOffset}` +
        (opts.limit !== null ? ` --limit ${opts.limit}` : "") +
        `\nUnfunded wallets fail fast ("No tNIGHT") — fund them, then re-run the same slice.\n`,
    );
    return 1;
  }
  stdout.write("✅ batch complete.\n");
  return 0;
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  const opts = parseArgs();
  if (opts.mode === "generate") {
    cmdGenerate(opts);
    return;
  }
  if (opts.mode === "addresses") {
    cmdAddresses(opts);
    return;
  }
  exit(await cmdVote(opts));
}

main().catch((err) => {
  stderr.write(`\n❌ ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`);
  exit(1);
});
