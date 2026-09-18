#!/usr/bin/env bun
/**
 * BlindPulse CLI voting client — one wallet, one vote, on Preprod.
 *
 * WHY THIS EXISTS
 *  The DApp votes through Lace (browser-only proving). This script reproduces
 *  the exact same vote from a terminal using the canonical Midnight CLI path:
 *
 *    wallet seed ──> MidnightWalletProvider (balances + submits)
 *    managed/     ──> NodeZkConfigProvider   (prover/verifier keys, zkIR)
 *    :6300        ──> httpClientProofProvider (local proof server)
 *
 *  It is deliberately NOT built on src/lib/midnight.ts: that module is
 *  browser-only (it fetches wasm over HTTP and proves via the DApp
 *  connector), so importing it from Node throws
 *  "BlindPulse contract runtime is browser-only".
 *
 * PRIVACY MODEL (identical to the DApp — see CLAUDE.md)
 *  PRIVATE (never leaves the machine, only enters the ZK circuit):
 *    - the wallet's coin public key (the nullifier preimage)
 *    - the individual answers in `responses`
 *  PUBLIC (written to the ledger by the circuit):
 *    - BLAKE2b-256(domain || coinPublicKey || surveyId) — one-way, so it
 *      cannot be linked back to the voter
 *    - the aggregate tally increments and participantCount
 *  This script prints the unshielded (fee-paying) address and the resulting
 *  nullifier digest — both already public on-chain — and NEVER the coin
 *  public key, the mnemonic, or the master seed.
 *
 * USAGE
 *   export BP_WALLET_MNEMONIC="<24-word mnemonic>"   # or put it in .env.local
 *   bun scripts/vote.ts --check-only                       # pre-flight only
 *   bun scripts/vote.ts --survey <hex> --answers 4         # cast one vote
 *   bun scripts/vote.ts --results                          # read public tallies
 *   bun scripts/vote.ts --deploy --questions 3             # fresh survey, then vote
 *
 * OPTIONS
 *   --survey <hex>      Contract address (default: the App Feedback survey)
 *   --answers <a,b,c>   One option index per question, in question order
 *   --answer <n>        Shorthand for a single-question survey
 *   --questions <n>     Question count when deploying (default 1)
 *   --deploy            Deploy a fresh survey, then vote on it
 *   --results           Print public aggregates and exit (no vote)
 *   --check-only        Print wallet + survey state and exit (no vote)
 *
 * CREDENTIALS
 *   BP_WALLET_MNEMONIC  BIP39 mnemonic (the same one your Lace wallet uses)
 *   BP_WALLET_SEED      Alternative: a 64-hex master seed
 *
 * PREREQUISITES
 *   1. Proof server:  podman compose up -d   (or docker compose up -d)
 *   2. A funded wallet: run --check-only to print the address, then drip
 *      tNIGHT from https://faucet.preprod.midnight.network (manual captcha).
 *
 * SYNC CHECKPOINTS
 *   The wallet SDK keeps no history on disk, so a cold run has to replay the
 *   whole chain: the shielded and dust wallets sync through the node relay and
 *   take many minutes (hours, for dust on Preprod). This script therefore saves
 *   a shielded + dust checkpoint to .wallet-state/ (gitignored) on every exit —
 *   including failed and timed-out runs — and resumes from it next time. The
 *   first run is the slow one; later runs start near the tip. Delete
 *   .wallet-state/ to force a full resync.
 *
 * EXIT CODES
 *   0 vote accepted (or --results/--check-only succeeded)
 *   1 any failure, including the contract rejecting a double vote
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { argv, env, exit, stderr, stdout } from "node:process";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { NodeZkConfigProvider } from "@midnight-ntwrk/midnight-js-node-zk-config-provider";
import type {
  MidnightProvider,
  MidnightProviders,
  PrivateStateProvider,
  WalletProvider,
} from "@midnight-ntwrk/midnight-js-types";
import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js";
import type { Contract } from "@midnight-ntwrk/midnight-js-protocol/compact-js";
import {
  DustSecretKey,
  LedgerParameters,
  ZswapSecretKeys,
  unshieldedToken,
} from "@midnight-ntwrk/midnight-js-protocol/ledger";
import { ttlOneHour } from "@midnight-ntwrk/midnight-js-utils";
import {
  DustWallet,
  ShieldedWallet,
  createKeystore,
  type UnshieldedKeystore,
} from "@midnight-ntwrk/wallet-sdk";
import {
  encodeContractAddress,
  decodeContractAddress,
} from "@midnight-ntwrk/ledger-v8";
import type { ContractAddress } from "@midnight-ntwrk/ledger-v8";
import {
  DEFAULT_DUST_OPTIONS,
  FluentWalletBuilder,
  WalletFactory,
  WalletSeeds,
  inMemoryPrivateStateProvider,
} from "@midnight-ntwrk/testkit-js";
import type { FacadeState, WalletFacade } from "@midnight-ntwrk/wallet-sdk-facade";
import {
  ContractTypeError,
  deployContract,
  getPublicStates,
  submitCallTx,
  verifyContractState,
} from "@midnight-ntwrk/midnight-js-contracts";
import { ledger, Contract as BlindPulseContract } from "../managed/contract/index.js";
import type { Ledger } from "../managed/contract/index.js";
import { deriveNullifier } from "../src/lib/nullifier";

// ============================================================================
// CONFIG
// ============================================================================

/** Preprod only — CLAUDE.md hard constraint #3. */
const NETWORK_ID = "preprod";
const INDEXER = "https://indexer.preprod.midnight.network/api/v4/graphql";
const INDEXER_WS = "wss://indexer.preprod.midnight.network/api/v4/graphql/ws";
const NODE = "https://rpc.preprod.midnight.network";
const NODE_WS = "wss://rpc.preprod.midnight.network";

/** Local proof server (docker-compose.yml) — the CLI has no Lace to prove for it. */
const PROOF_SERVER =
  env.NEXT_PUBLIC_PROOF_SERVER_URL ?? "http://localhost:6300";

/** Default target: the App Feedback survey the CLI was built for. */
const DEFAULT_SURVEY =
  "9b6e0eed1f8a8f2a79ed2db9fe35570e1ad30ab8f8c358c44bc4b7e06ed7eeff";

/** Compiled artifacts, resolved from this file so cwd does not matter. */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MANAGED_DIR = path.join(ROOT, "managed");

/**
 * Sync checkpoints, so votes do not replay the chain from genesis every run.
 * Gitignored: it contains wallet state, not credentials (the mnemonic is never
 * written anywhere). Keyed by a one-way fingerprint of the wallet seed.
 */
const STATE_DIR = path.join(ROOT, ".wallet-state");

/** testkit's wallet configuration, recovered without importing its type. */
type WalletConfiguration = Parameters<typeof WalletFactory.createWalletFacade>[0];
/** The dust wallet's configuration, which adds cost parameters on top. */
type DustConfiguration = Parameters<typeof WalletFactory.createDustWallet>[0];

/** Circuit IDs, matching managed/keys/*.prover and managed/zkir/*.bzkir */
type CircuitId = "submitResponse" | "closeSurvey";

/** MAX_Q in contract/blindpulse.compact — responses is a fixed Vector<20, Uint<8>> */
const MAX_Q = 20;
/** MAX_OPTIONS in contract/blindpulse.compact — tally cells pre-created 0..19 */
const MAX_OPTIONS = 20;

type Providers = MidnightProviders<CircuitId, string, unknown>;

interface Options {
  survey: string;
  answers: number[];
  questions: number;
  deploy: boolean;
  results: boolean;
  checkOnly: boolean;
}

// ============================================================================
// ARGUMENT PARSING
// ============================================================================

/**
 * Rejects instead of hanging forever. The wallet facade's own
 * waitForSyncedState() has no timeout, and testkit's syncWallet() times out
 * after only 90s — too short for a from-scratch Preprod sync — so we time the
 * untimed one ourselves with a budget that matches a cold sync.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${what} did not finish within ${ms / 1000}s`)),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      },
    );
  });
}

function parseArgs(): Options {
  const args = argv.slice(2);
  const opts: Options = {
    survey: DEFAULT_SURVEY,
    answers: [],
    questions: 1,
    deploy: false,
    results: false,
    checkOnly: false,
  };

  // Declared outside the loop so `take` can advance it.
  let i = 0;
  // Consumes the flag's value by advancing the loop index — without this the
  // value would be re-read as the next flag ("unknown option: 3").
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
      case "--survey":
        opts.survey = take("--survey");
        break;
      case "--answers":
        opts.answers = take("--answers")
          .split(",")
          .map((n) => parseInt(n.trim(), 10));
        break;
      case "--answer":
        opts.answers = [parseInt(take("--answer"), 10)];
        break;
      case "--questions":
        opts.questions = parseInt(take("--questions"), 10);
        break;
      case "--deploy":
        opts.deploy = true;
        break;
      case "--results":
        opts.results = true;
        break;
      case "--check-only":
        opts.checkOnly = true;
        break;
      case "--help":
      case "-h":
        stdout.write(
          "Usage: bun scripts/vote.ts [--survey <hex>] [--answers 4,3,5]\n" +
            "                        [--answer 4] [--deploy --questions 3]\n" +
            "                        [--results | --check-only]\n" +
            "See the header of scripts/vote.ts for the full reference.\n",
        );
        exit(0);
        break;
      default:
        stderr.write(`unknown option: ${args[i]}\n`);
        exit(1);
    }
  }

  for (const [i, answer] of opts.answers.entries()) {
    if (!Number.isInteger(answer) || answer < 0 || answer >= MAX_OPTIONS) {
      stderr.write(
        `answer ${i + 1} must be an integer in 0..${MAX_OPTIONS - 1}, received ${answer}\n`,
      );
      exit(1);
    }
  }
  if (opts.questions < 1 || opts.questions > MAX_Q) {
    stderr.write(`--questions must be between 1 and ${MAX_Q}\n`);
    exit(1);
  }
  return opts;
}

// ============================================================================
// BYTE / ADDRESS HELPERS (PUBLIC: contract addresses only)
// ============================================================================

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex: string): Uint8Array {
  return new Uint8Array(
    hex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) ?? [],
  );
}

function contractAddressToHex(address: ContractAddress): string {
  return bytesToHex(encodeContractAddress(address));
}

function hexToContractAddress(hex: string): ContractAddress {
  const clean = hex.replace(/^0x/, "");
  if (!/^[0-9a-fA-F]{64}$/.test(clean)) {
    throw new Error(`survey id must be 64 hex chars, received: ${hex}`);
  }
  return decodeContractAddress(hexToBytes(clean));
}

// ============================================================================
// WALLET
// ============================================================================

/** Minimal structural type for the wallet SDK's RxJS observables. */
interface Subscribable<T> {
  subscribe(observer: {
    next: (value: T) => void;
    error: (err: unknown) => void;
  }): { unsubscribe: () => void };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * One-shot read of a wallet-state observable.
 *
 * We deliberately do NOT use the SDK's waitForSyncedState() here: it requires
 * the shielded AND dust wallets to be *strictly* complete, and a cold Preprod
 * replay of those two takes many minutes (the SDK keeps transaction history in
 * memory only, so every run replays from genesis). That flag must not gate
 * reading a value we already hold.
 */
function snapshot<T>(observable: Subscribable<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const subscription = observable.subscribe({
      next: (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
        queueMicrotask(() => subscription.unsubscribe());
      },
      error: (err) => {
        if (settled) return;
        settled = true;
        reject(err);
      },
    });
  });
}

/**
 * Retries an operation whose failure is commonly a dropped node WebSocket.
 * Preprod's RPC socket closes intermittently ("1000:: Normal Closure"), which
 * aborts an in-flight submission even though the connection recovers a moment
 * later — so a retry is the difference between working and not.
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  attempts: number,
  what: string,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;
      const message = err instanceof Error ? err.message : String(err);
      stdout.write(
        `│  ${what}: attempt ${attempt}/${attempts} failed (${message.split("\n")[0].slice(0, 100)})\n`,
      );
      if (attempt < attempts) await delay(5_000);
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`${what} failed after ${attempts} attempts`);
}

/**
 * Ensures the wallet can pay fees, registering NIGHT UTXOs for dust when none
 * are registered yet. Dust is the fee token on Midnight, and NIGHT only
 * generates it once each UTXO is registered.
 *
 * PRIVATE: the keystore signs the registration; secret keys stay in memory.
 * PUBLIC: the registration transaction and the resulting dust are on-chain.
 */
async function ensureDust(
  wallet: WalletFacade,
  keystore: UnshieldedKeystore,
): Promise<void> {
  const nightRaw = unshieldedToken().raw;
  const before = await snapshot<FacadeState>(wallet.state());
  if (before.dust.balance(new Date()) > 0n) return;

  const unregistered = before.unshielded.availableCoins.filter(
    (coin) =>
      coin.utxo.type === nightRaw && !coin.meta.registeredForDustGeneration,
  );

  if (unregistered.length > 0) {
    stdout.write(
      `├─ registering ${unregistered.length} NIGHT UTXO(s) for dust (the fee token)...\n`,
    );
    const txId = await withRetry(
      async () => {
        const recipe = await wallet.registerNightUtxosForDustGeneration(
          unregistered,
          keystore.getPublicKey(),
          (payload) => keystore.signData(payload),
        );
        return wallet.submitTransaction(await wallet.finalizeRecipe(recipe));
      },
      4,
      "dust registration",
    );
    stdout.write(`│  dust registration tx: ${txId}\n`);
  } else {
    stdout.write(
      "├─ NIGHT already registered for dust; waiting for dust to accrue...\n",
    );
  }

  // Dust accrues from the registration over subsequent blocks, and the dust
  // wallet has to replay the chain to see it. Poll the balance: it is the
  // value that actually gates paying a fee, unlike the "strictly complete"
  // sync flag.
  const deadline = Date.now() + 12 * 60_000;
  while (Date.now() < deadline) {
    const state = await snapshot<FacadeState>(wallet.state());
    const balance = state.dust.balance(new Date());
    if (balance > 0n) {
      stdout.write(`│  dust available: ${balance}\n`);
      return;
    }
    stdout.write(
      `│  waiting for dust... (dust wallet replayed index ${state.dust.state.progress.appliedIndex})\n`,
    );
    await delay(15_000);
  }
  throw new Error(
    "no dust available after 12 minutes — the wallet cannot pay a transaction " +
      "fee yet. Re-run; the NIGHT UTXOs are now registered, so dust accrues.",
  );
}

/** Shielded + dust sync checkpoints, so later runs resume instead of replaying. */
interface SavedWalletState {
  version: 2;
  shielded: string;
  dust: string;
  /** Chain indices the wallet had replayed, for reporting and validation. */
  shieldedApplied: string;
  dustApplied: string;
  savedAt: string;
}

/**
 * One-way fingerprint of the wallet credential, so each wallet gets its own
 * checkpoint without the file itself being reversible to the mnemonic.
 */
function walletStatePath(credential: string): string {
  const fingerprint = createHash("sha256")
    .update(credential)
    .digest("hex")
    .slice(0, 16);
  return path.join(STATE_DIR, `${NETWORK_ID}-${fingerprint}.json`);
}

/**
 * Loads a previous run's checkpoints, or null to sync from genesis.
 * A corrupt or version-mismatched file is ignored rather than fatal.
 */
function readWalletState(statePath: string): SavedWalletState | null {
  if (!existsSync(statePath)) return null;
  try {
    const parsed = JSON.parse(readFileSync(statePath, "utf8")) as SavedWalletState;
    if (parsed.version !== 2 || !parsed.shielded || !parsed.dust) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Writes the shielded + dust sync checkpoints for the next run.
 *
 * PRIVATE: this file holds wallet sync state derived from the seed. It lives in
 * a gitignored directory and must never be committed or shared. It is written
 * even when a run fails or times out, so a partial sync is never thrown away.
 */
async function persistWalletState(
  wallet: WalletFacade,
  statePath: string,
): Promise<void> {
  try {
    const progress = await snapshot<FacadeState>(wallet.state());
    const state: SavedWalletState = {
      version: 2,
      shielded: await wallet.shielded.serializeState(),
      dust: await wallet.dust.serializeState(),
      shieldedApplied: progress.shielded.state.progress.appliedIndex.toString(),
      dustApplied: progress.dust.state.progress.appliedIndex.toString(),
      savedAt: new Date().toISOString(),
    };
    mkdirSync(STATE_DIR, { recursive: true });
    writeFileSync(statePath, JSON.stringify(state));
    stdout.write(
      `│  checkpoint saved: shielded at ${state.shieldedApplied}, dust at ${state.dustApplied}\n`,
    );
  } catch (err) {
    stderr.write(
      `⚠️  could not save wallet sync state: ${
        err instanceof Error ? err.message : String(err)
      }\n   (the next run will sync again — the vote is unaffected)\n`,
    );
  }
}

/**
 * Builds the funded wallet that will pay for and sign the vote, and bridges it
 * to the providers Midnight.js expects.
 *
 * PRIVATE: mnemonic / master seed, the derived secret keys, and the coin public
 *          key (only ever a hash input, and never logged).
 * PUBLIC: the unshielded address — the same address that already appears on the
 *         explorer for any transaction this wallet sends.
 */
async function buildWallet(): Promise<{
  walletProvider: WalletProvider;
  midnightProvider: MidnightProvider;
  wallet: WalletFacade;
  unshieldedAddress: string;
  /**
   * PRIVATE (32 raw bytes): this wallet's identity, used only as a hash input
   * to derive the nullifier. Never logged, never sent to any provider other
   * than the ZK prover.
   */
  coinPublicKeyBytes: Uint8Array;
  /** PRIVATE: signs the dust registration and the vote transaction. */
  keystore: UnshieldedKeystore;
  /** Where the sync checkpoints for this wallet live. */
  statePath: string;
}> {
  const mnemonic = env.BP_WALLET_MNEMONIC?.trim();
  const masterSeed = env.BP_WALLET_SEED?.trim();
  if (!mnemonic && !masterSeed) {
    stderr.write(
      "No wallet credential found.\n\n" +
        "Set the mnemonic of a funded Preprod wallet (the same BIP39 phrase\n" +
        "your Lace wallet uses):\n\n" +
        '  export BP_WALLET_MNEMONIC="word word ... word"\n\n' +
        "or put it in .env.local (gitignored), then run --check-only to print\n" +
        "the address to fund at https://faucet.preprod.midnight.network\n",
    );
    exit(1);
  }

  // testkit types walletNetworkId as the NetworkId enum, whose PreProd member
  // IS the string "preprod" (the same value setNetworkId() above enforces),
  // but does not re-export the enum or the EnvironmentConfiguration type from
  // its package root — hence the single cast at this boundary.
  const environment = {
    walletNetworkId: NETWORK_ID,
    networkId: NETWORK_ID,
    indexer: INDEXER,
    indexerWS: INDEXER_WS,
    node: NODE,
    nodeWS: NODE_WS,
    proofServer: PROOF_SERVER,
    // The faucet API is captcha-gated: leave it undefined so waitForFunds()
    // never attempts an automatic drip and instead reports the balance.
    faucet: undefined,
  } as unknown as Parameters<typeof FluentWalletBuilder.forEnvironment>[0];

  const builder = FluentWalletBuilder.forEnvironment(environment);
  // The builder owns the SDK configuration (indexer, relay, proving server,
  // fee margins) but does not expose it, and testkit does not re-export the
  // mapper that builds it. Reading the field keeps a single source of truth
  // rather than copying mapEnvironmentToConfiguration() here to drift.
  const config = (builder as unknown as { config?: WalletConfiguration }).config;
  if (!config) {
    throw new Error(
      "testkit's FluentWalletBuilder no longer exposes its configuration; " +
        "this script needs it to rebuild the wallet from a sync checkpoint",
    );
  }

  // withSeed() takes a 64-hex master seed; withMnemonic() takes BIP39 words.
  const seeds = masterSeed
    ? WalletSeeds.fromMasterSeed(masterSeed)
    : WalletSeeds.fromMnemonic(mnemonic!);
  const keystore = createKeystore(seeds.unshielded, NETWORK_ID);

  // Same cost parameters WalletFactory.createDustWallet would apply (the
  // builder's defaults). Ledger parameters are passed to the dust wallet at
  // call time, not through this config, so they are not repeated here.
  const dustConfig: DustConfiguration = {
    ...config,
    costParameters: {
      additionalFeeOverhead: DEFAULT_DUST_OPTIONS.additionalFeeOverhead,
      feeBlocksMargin: DEFAULT_DUST_OPTIONS.feeBlocksMargin,
    },
  };

  // Resume from the last run's checkpoints when we have them. This is the whole
  // point of the state file: the shielded and dust wallets sync through the
  // node relay and replay the chain from genesis otherwise, which takes hours
  // on Preprod for dust.
  const statePath = walletStatePath(masterSeed ?? mnemonic!);
  const saved = readWalletState(statePath);
  const wallet = await WalletFactory.createWalletFacade(
    config,
    saved
      ? ShieldedWallet(config).restore(saved.shielded)
      : ShieldedWallet(config).startWithSeed(seeds.shielded),
    // The unshielded wallet syncs through the indexer in seconds, so it is
    // always built fresh — only the slow node-relay wallets are restored.
    WalletFactory.createUnshieldedWallet(config, keystore),
    saved
      ? DustWallet(dustConfig).restore(saved.dust)
      : DustWallet(dustConfig).startWithSeed(
          seeds.dust,
          LedgerParameters.initialParameters().dust,
        ),
  );

  const zswapSecretKeys = ZswapSecretKeys.fromSeed(seeds.shielded);
  const dustSecretKey = DustSecretKey.fromSeed(seeds.dust);

  await wallet.start(zswapSecretKeys, dustSecretKey);

  stdout.write(
    saved
      ? `├─ resuming from sync checkpoint: ${path.relative(ROOT, statePath)} ` +
          `(shielded ${saved.shieldedApplied}, dust ${saved.dustApplied}, saved ${saved.savedAt})\n`
      : "├─ no sync checkpoint yet: first run syncs from genesis and saves one\n",
  );

  // restore() deserializes through an Either and does not throw, so a state it
  // cannot use silently yields a fresh wallet. Detect that here rather than
  // letting a run quietly re-sync from genesis and think it resumed.
  if (saved) {
    const restored = await snapshot<FacadeState>(wallet.state());
    const restoredIndex = restored.shielded.state.progress.appliedIndex;
    if (restoredIndex < BigInt(saved.shieldedApplied)) {
      stderr.write(
        `⚠️  the saved checkpoint was not applied (shielded index ${restoredIndex} ` +
          `< saved ${saved.shieldedApplied}); this run syncs from genesis\n`,
      );
    }
  }

  // Bridges the wallet facade to the provider interfaces Midnight.js expects,
  // mirroring testkit's MidnightWalletProvider — with one deliberate change:
  // only unshielded + dust are balanced. The CLI wallet is unshielded-only by
  // construction (the Preprod faucet drips unshielded tNIGHT), so asking the
  // shielded wallet to balance would require syncing it for no benefit.
  const walletProvider: WalletProvider = {
    async balanceTx(tx, ttl = ttlOneHour()) {
      const recipe = await wallet.balanceUnboundTransaction(
        tx,
        { shieldedSecretKeys: zswapSecretKeys, dustSecretKey },
        { ttl, tokenKindsToBalance: ["unshielded", "dust"] },
      );
      const signed = await wallet.signRecipe(recipe, (payload) =>
        keystore.signData(payload),
      );
      return wallet.finalizeRecipe(signed);
    },
    getCoinPublicKey: () => zswapSecretKeys.coinPublicKey,
    getEncryptionPublicKey: () => zswapSecretKeys.encryptionPublicKey,
  };

  const midnightProvider: MidnightProvider = {
    // Returns the tx identifier: midnight-js matches the indexer on
    // identifiers, so returning anything else would poll forever.
    submitTx: (tx) => wallet.submitTransaction(tx),
  };

  // ZswapSecretKeys.coinPublicKey is a 64-char hex string (CoinPublicKey =
  // string in ledger-v8); the circuit wants the 32 raw bytes behind it.
  const coinPublicKeyBytes = hexToBytes(zswapSecretKeys.coinPublicKey);
  if (coinPublicKeyBytes.length !== 32) {
    throw new Error(
      `expected a 32-byte coin public key, got ${coinPublicKeyBytes.length} bytes`,
    );
  }

  return {
    walletProvider,
    midnightProvider,
    wallet,
    unshieldedAddress: keystore.getBech32Address().asString(),
    coinPublicKeyBytes,
    keystore,
    statePath,
  };
}

/**
 * Waits for the unshielded wallet — the only sub-wallet this script needs to
 * block on. It syncs through the indexer in seconds, unlike the shielded and
 * dust wallets, which replay through the node relay.
 *
 * PUBLIC: returns the NIGHT balance at the wallet's unshielded address.
 * PRIVATE: nothing — no key material is read here.
 */
async function syncUnshielded(wallet: WalletFacade): Promise<bigint> {
  stdout.write("├─ syncing unshielded state (NIGHT balance)...\n");
  const state = await withTimeout(
    wallet.unshielded.waitForSyncedState(),
    5 * 60_000,
    "unshielded sync",
  );
  return state.balances[unshieldedToken().raw] ?? 0n;
}

/**
 * Keeps the wallet's background sync running for the whole process.
 *
 * The shielded and dust sync services only advance while something observes
 * the facade state. A run that waits solely on unshielded.waitForSyncedState()
 * (a subscription to the unshielded sub-wallet) leaves them idle, so the
 * checkpoint would record almost no progress and every run would replay from
 * genesis — exactly the problem this file exists to avoid. The returned handle
 * must be unsubscribed before stopping the wallet.
 *
 * PUBLIC: subscribes to wallet state; no data leaves the process.
 */
function keepWalletSyncing(wallet: WalletFacade): { unsubscribe: () => void } {
  return wallet.state().subscribe({
    next: () => undefined,
    error: () => undefined,
  });
}

/**
 * Reads the fee token available right now. Two caveats, both benign:
 * a restored checkpoint may be ahead of what this reports, and a fresh wallet
 * reports 0 until its registration is replayed.
 *
 * PUBLIC: the dust balance of this wallet's dust address.
 * PRIVATE: nothing — no key material is read here.
 */
async function readDustBalance(wallet: WalletFacade): Promise<bigint> {
  const state = await snapshot<FacadeState>(wallet.state());
  return state.dust.balance(new Date());
}

// ============================================================================
// PROVIDERS (mirrors testkit's initializeMidnightProviders, without the
// on-disk LevelDB: this contract declares no witnesses, so private state is
// genuinely empty and in-memory is the honest implementation)
// ============================================================================

/**
 * PUBLIC: indexer reads, ZK circuit artifacts from managed/, and proofs
 *         generated by the local proof server.
 * PRIVATE: the wallet provider holds the signing keys and builds witnesses;
 *          no witness value is passed to any provider other than the prover.
 */
function createProviders(
  walletProvider: WalletProvider,
  midnightProvider: MidnightProvider,
): Providers {
  const zkConfigProvider = new NodeZkConfigProvider<CircuitId>(MANAGED_DIR);
  const privateStateProvider = inMemoryPrivateStateProvider() as PrivateStateProvider;

  return {
    privateStateProvider,
    publicDataProvider: indexerPublicDataProvider(INDEXER, INDEXER_WS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(PROOF_SERVER, zkConfigProvider),
    walletProvider,
    midnightProvider,
  };
}

/**
 * Binds the generated Compact bindings into a deploy-ready compiled contract.
 *
 * PUBLIC: the contract constructor, its circuit names, and the path to the
 *         compiled assets in managed/ (all shipped in this repo).
 * PRIVATE: none — no witness is attached here because the contract declares
 *          none; submitResponse's arguments are supplied per call instead.
 */
function getCompiledBlindPulse(): CompiledContract.CompiledContract<
  Contract<undefined>,
  undefined,
  never
> {
  const Ctor = BlindPulseContract as unknown as new (
    witnesses: unknown,
  ) => Contract<undefined>;

  return CompiledContract.withCompiledFileAssets(
    CompiledContract.withVacantWitnesses(CompiledContract.make("BlindPulse", Ctor)),
    path.join(MANAGED_DIR, "contract"),
  ) as unknown as CompiledContract.CompiledContract<
    Contract<undefined>,
    undefined,
    never
  >;
}

// ============================================================================
// PUBLIC LEDGER READS
// ============================================================================

interface SurveyState {
  surveyActive: boolean;
  questionCount: number;
  participantCount: number;
  organizerHex: string;
  /** question index -> option index -> count */
  tallies: Record<number, Record<number, number>>;
  /**
   * PRIVATE INPUT, PUBLIC OUTPUT: whether this wallet has already voted.
   * Computed by the caller from the wallet's coin key; the ledger only ever
   * stores the one-way digest.
   */
  hasVoted(nullifier: Uint8Array): boolean;
}

/**
 * Reads the contract's public ledger state.
 * PUBLIC: every field returned here is readable by anyone via the indexer.
 * PRIVATE: nothing — no witness ever reaches this path.
 */
async function readSurveyState(
  providers: Providers,
  surveyHex: string,
): Promise<SurveyState> {
  const { contractState } = await getPublicStates(
    providers.publicDataProvider,
    hexToContractAddress(surveyHex),
  );
  const state = ledger(contractState.data) as unknown as Ledger;

  const questionCount = Number(state.questionCount);
  const tallies: Record<number, Record<number, number>> = {};
  for (let q = 0; q < questionCount; q++) {
    const row = state.tallies.lookup(BigInt(q));
    tallies[q] = {};
    for (let option = 0; option < MAX_OPTIONS; option++) {
      // The constructor pre-creates every cell, so member() is always true;
      // only surface options that actually received votes.
      const count = Number(row.lookup(BigInt(option)).read());
      if (count > 0) tallies[q][option] = count;
    }
  }

  return {
    surveyActive: state.surveyActive,
    questionCount,
    participantCount: Number(state.participantCount),
    organizerHex: bytesToHex(state.organizer as unknown as Uint8Array),
    tallies,
    hasVoted: (nullifier: Uint8Array) => state.nullifiers.member(nullifier),
  };
}

/**
 * Confirms one circuit's verifier key matches the deployed contract before we
 * invoke it.
 *
 * midnight-js's findDeployedContract() instead validates EVERY circuit of the
 * compiled contract, so a survey deployed before a later circuit changed
 * becomes uncallable even for circuits that still match the deployed bytecode
 * exactly. Contract 9b6e0eed… predates the organizer gate on closeSurvey: its
 * submitResponse matches, but the whole-set check throws ContractTypeError
 * naming closeSurvey. Scoping the check to the circuit we are about to run
 * keeps the guarantee that matters without refusing a sound vote.
 *
 * PUBLIC: on-chain verifier keys and the compiled verifier key (both public).
 * PRIVATE: none — no witness data reaches this function.
 */
async function assertCircuitDeployed(
  providers: Providers,
  contractAddress: ContractAddress,
  circuitId: CircuitId,
): Promise<void> {
  const [{ contractState }, verifierKeys] = await Promise.all([
    getPublicStates(providers.publicDataProvider, contractAddress),
    providers.zkConfigProvider.getVerifierKeys([circuitId]),
  ]);
  try {
    verifyContractState(verifierKeys, contractState);
  } catch (err) {
    if (err instanceof ContractTypeError) {
      throw new Error(
        `survey ${contractAddressToHex(contractAddress)} was deployed from an ` +
          `earlier build of the BlindPulse contract, so its "${circuitId}" ` +
          `circuit no longer matches this build. A deployed contract is ` +
          `immutable, so that circuit cannot be called — deploy a fresh ` +
          `survey instead of retrying this one.`,
        { cause: err },
      );
    }
    throw err;
  }
}

/** One line per question, e.g. "question 1: option 4 → 1 (100%)" */
function formatTallies(state: SurveyState): string[] {
  const lines: string[] = [];
  for (let q = 0; q < state.questionCount; q++) {
    const row = state.tallies[q] ?? {};
    const entries = Object.entries(row).sort(([a], [b]) => Number(a) - Number(b));
    const total = entries.reduce((sum, [, count]) => sum + count, 0);
    lines.push(
      `question ${q + 1}: ${
        entries.length === 0
          ? "no votes yet"
          : entries
              .map(
                ([option, count]) =>
                  `option ${option} → ${count} (${((count / total) * 100).toFixed(0)}%)`,
              )
              .join("  ")
      }`,
    );
  }
  return lines;
}

// ============================================================================
// MAIN
// ============================================================================

/**
 * Runs one CLI invocation and returns its exit status.
 *
 * Returns a status rather than calling exit() directly so the sync-checkpoint
 * write in the finally block always runs — process.exit() would skip it, and a
 * run that bails out early is exactly when that progress matters.
 */
async function runVote(opts: Options): Promise<number> {
  setNetworkId(NETWORK_ID);

  stdout.write("🗳  BlindPulse CLI vote (Preprod)\n");
  stdout.write(`├─ proof server: ${PROOF_SERVER}\n`);

  const {
    walletProvider,
    midnightProvider,
    wallet,
    unshieldedAddress,
    coinPublicKeyBytes,
    keystore,
    statePath,
  } = await buildWallet();

  const syncing = keepWalletSyncing(wallet);

  // A long first sync is the norm, so honour Ctrl-C (and CI timeouts) by
  // checkpointing before quitting — otherwise an interrupted run throws away
  // everything it replayed.
  const onSignal = (): void => {
    void (async () => {
      stderr.write("\n⚠️  interrupted — saving the sync checkpoint first\n");
      await persistWalletState(wallet, statePath);
      syncing.unsubscribe();
      await wallet.stop();
      exit(130);
    })();
  };
  // process.on, not a destructured import: the listener methods need the
  // EventEmitter receiver (Bun throws "Can only call ... on instances" otherwise).
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);

  try {
    const nightBalance = await syncUnshielded(wallet);
    const dustBalance = await readDustBalance(wallet);

    stdout.write(`├─ unshielded address: ${unshieldedAddress}\n`);
    stdout.write(`├─ NIGHT balance:      ${nightBalance}\n`);
    stdout.write(
      `├─ dust balance:       ${dustBalance}` +
        (dustBalance === 0n ? "  (NIGHT must be registered for dust to pay fees)" : "") +
        "\n",
    );
    if (nightBalance === 0n) {
      stdout.write(
        "\n⚠️  No tNIGHT at the address above. Drip it once at\n" +
          "   https://faucet.preprod.midnight.network (manual captcha), then re-run.\n",
      );
      return 1;
    }

    const providers = createProviders(walletProvider, midnightProvider);
    const compiledContract = getCompiledBlindPulse();

    // ---- resolve the survey -------------------------------------------------
    let surveyHex = opts.survey;
    if (opts.deploy) {
      stdout.write(`├─ deploying fresh survey (${opts.questions} questions)...\n`);
      const deployed = await deployContract(providers, {
        compiledContract,
        // PRIVATE WITNESS: the deploying wallet's coin public key. The circuit
        // discloses it into the public `organizer` field by design — it gates
        // closeSurvey and is never the nullifier preimage on the ledger.
        args: [coinPublicKeyBytes, BigInt(opts.questions)],
      });
      surveyHex = contractAddressToHex(deployed.deployTxData.public.contractAddress);
      stdout.write(`├─ deployed at: ${surveyHex}\n`);
    }

    // ---- pre-flight: public state + whether we already voted ----------------
    const before = await readSurveyState(providers, surveyHex);
    // PRIVATE: the coin public key stays on this machine.
    // PUBLIC: the digest below is what the circuit discloses on-chain.
    const nullifier = deriveNullifier(coinPublicKeyBytes, hexToBytes(surveyHex));

    stdout.write(`│\n├─ survey ${surveyHex}\n`);
    stdout.write(`│  active:       ${before.surveyActive}\n`);
    stdout.write(`│  questions:    ${before.questionCount}\n`);
    stdout.write(`│  participants: ${before.participantCount}\n`);
    stdout.write(`│  your nullifier: ${bytesToHex(nullifier)}\n`);
    for (const line of formatTallies(before)) stdout.write(`│  ${line}\n`);

    if (before.hasVoted(nullifier)) {
      stdout.write(
        "\n⛔ This wallet has already voted on this survey (nullifier spent).\n" +
          "   One wallet = one vote is enforced by the contract's nullifier set.\n" +
          "   Use a different wallet, or vote on another survey.\n",
      );
      return 1;
    }

    if (opts.checkOnly) {
      stdout.write(
        "\n✅ pre-flight: wallet funded, survey reachable, no vote cast yet.\n" +
          (before.surveyActive
            ? ""
            : "⚠️  but the survey is closed, so a vote would be rejected.\n") +
          (dustBalance === 0n
            ? "\nℹ️  No dust yet: the first vote will register your NIGHT UTXOs for\n" +
              "   dust generation and then wait for it to accrue (several minutes).\n"
            : ""),
      );
      return 0;
    }

    if (opts.results) return 0;

    if (!before.surveyActive) {
      stderr.write("\n⛔ Survey is closed — the circuit would reject this vote.\n");
      return 1;
    }

    // ---- build the private witness -----------------------------------------
    if (opts.answers.length === 0) {
      stderr.write(
        `\nmissing --answers (${before.questionCount} question(s): ` +
          "one option index each, comma-separated)\n",
      );
      return 1;
    }
    if (opts.answers.length !== before.questionCount) {
      stderr.write(
        `\n--answers has ${opts.answers.length} value(s) but the survey has ` +
          `${before.questionCount} question(s)\n`,
      );
      return 1;
    }
    // Fixed Vector<20, Uint<8>>: pad with zeros. The circuit only reads the
    // first questionCount slots, so padding never affects the tallies.
    // PRIVATE WITNESS: these indices are never written to the ledger.
    const responses = Array.from({ length: MAX_Q }, (_, i) =>
      BigInt(opts.answers[i] ?? 0),
    );

    // ---- pay for it: dust is the fee token --------------------------------
    if (dustBalance === 0n) await ensureDust(wallet, keystore);

    // ---- cast the vote ------------------------------------------------------
    // findDeployedContract() would reject this survey outright (it checks every
    // circuit, and closeSurvey predates the organizer gate here), so verify only
    // the circuit being invoked. See assertCircuitDeployed for the rationale.
    const contractAddress = hexToContractAddress(surveyHex);
    await assertCircuitDeployed(providers, contractAddress, "submitResponse");
    stdout.write(`├─ proving + submitting (30-90s)...\n`);
    let txId: string | null = null;
    try {
      // PRIVATE WITNESS: nullifier + responses enter the circuit here and are
      // never written to public state. PUBLIC: the aggregate tally increments,
      // the disclosed nullifier digest, and the tx id below.
      const result = await withRetry(
        () =>
          submitCallTx(providers, {
            compiledContract,
            contractAddress,
            circuitId: "submitResponse",
            args: [nullifier, responses],
          }),
        3,
        "vote submission",
      );
      txId = result.public.txId;
    } catch (err) {
      // The node relay can drop mid-submission. If the nullifier is spent now,
      // the vote landed on-chain regardless of the error we saw.
      const afterFailure = await readSurveyState(providers, surveyHex);
      if (!afterFailure.hasVoted(nullifier)) throw err;
      stdout.write(
        "│  submission reported an error, but the vote IS on-chain (nullifier spent) — continuing\n",
      );
    }
    stdout.write(`├─ tx: ${txId ?? "(landed; id unavailable — see indexer)"}\n`);

    // ---- confirm the aggregate moved, and only the aggregate ----------------
    const after = await readSurveyState(providers, surveyHex);
    stdout.write("│\n├─ survey after the vote\n");
    stdout.write(`│  participants: ${after.participantCount}\n`);
    for (const line of formatTallies(after)) stdout.write(`│  ${line}\n`);

    if (after.participantCount !== before.participantCount + 1) {
      stderr.write(
        `\n⚠️  participantCount did not advance (${before.participantCount} → ` +
          `${after.participantCount}); check the tx on the indexer.\n`,
      );
      return 1;
    }

    stdout.write(
      "\n✅ Vote accepted. The ledger now holds the aggregate only — your\n" +
        "   answers and coin key never left this machine.\n",
    );

    return 0;
  } finally {
    // Save the sync checkpoints even on failure, so a run that times out still
    // moves the next one forward instead of starting over.
    process.off("SIGINT", onSignal);
    process.off("SIGTERM", onSignal);
    await persistWalletState(wallet, statePath);
    syncing.unsubscribe();
    await wallet.stop();
  }
}

async function main(): Promise<void> {
  exit(await runVote(parseArgs()));
}

main().catch((err) => {
  stderr.write(
    `\n❌ ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`,
  );
  exit(1);
});
