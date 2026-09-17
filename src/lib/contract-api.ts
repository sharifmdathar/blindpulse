/**
 * Contract interaction layer.
 * PUBLIC: All exported functions interact with on-chain contract state.
 * PRIVATE: submitResponse builds a private witness (credential, responses, nullifier)
 *          that NEVER enters the public ledger — only the ZK circuit sees it.
 */

import type { Survey, SurveyResults } from "./types";
import { getSurvey } from "./survey-store";
import { getConnectedApi } from "./wallet";
import {
  createContractProviders,
  getCompiledBlindPulse,
  contractAddressToHex,
  ensureMidnightRuntime,
  hexToContractAddress,
  buildNullifier,
  getWalletIdentity,
} from "./midnight";
import { deployContract, findDeployedContract, getPublicStates } from "@midnight-ntwrk/midnight-js-contracts";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import type { StateValue } from "@midnight-ntwrk/compact-runtime";

type LedgerFn = typeof import("../../managed/contract/index.js").ledger;
let _ledger: LedgerFn | null = null;

async function getLedger(): Promise<LedgerFn> {
  if (typeof window === "undefined") {
    throw new Error("BlindPulse contract runtime is browser-only");
  }
  if (!_ledger) {
    ({ ledger: _ledger } = await import("../../managed/contract/index.js"));
  }
  return _ledger;
}

/**
 * Decode public ledger state from indexer data.
 * PUBLIC: only aggregate tallies, participant count, survey metadata.
 *
 * NOTE: older generated ledger() types typed its parameter as StateValue only;
 * the current bindings accept `StateValue | ChargedState` — exactly what
 * getPublicStates returns — so this cast is now only a belt-and-braces bridge.
 */
async function decodeLedger(data: unknown) {
  const ledger = await getLedger();
  return ledger(data as unknown as StateValue);
}

/** MAX_Q — must match contract constant */
const MAX_Q = 20;

const RESPONSES_KEY = "blindpulse_responses";

function getResponses(): Record<string, number[][]> {
  try {
    return JSON.parse(localStorage.getItem(RESPONSES_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveResponse(surveyId: string, responses: number[]): void {
  const all = getResponses();
  if (!all[surveyId]) all[surveyId] = [];
  all[surveyId].push(responses);
  localStorage.setItem(RESPONSES_KEY, JSON.stringify(all));
}

function tallyResponses(surveyId: string, questionCount: number): Record<number, Record<number, number>> {
  const all = getResponses();
  const surveyResponses = all[surveyId] ?? [];
  const tallies: Record<number, Record<number, number>> = {};
  for (const resp of surveyResponses) {
    for (let qi = 0; qi < questionCount && qi < resp.length; qi++) {
      if (!tallies[qi]) tallies[qi] = {};
      const optionIdx = resp[qi];
      tallies[qi][optionIdx] = (tallies[qi][optionIdx] ?? 0) + 1;
    }
  }
  return tallies;
}

function randomId(): string {
  return "0x" + Math.random().toString(16).slice(2);
}

/** Read-only indexer provider for on-chain reads without a wallet */
function readOnlyPublicDataProvider() {
  const indexerUri =
    process.env.NEXT_PUBLIC_INDEXER_URL ??
    "https://indexer.preprod.midnight.network/api/v4/graphql";
  const indexerWsUri =
    process.env.NEXT_PUBLIC_INDEXER_WS_URL ??
    "wss://indexer.preprod.midnight.network/api/v4/graphql/ws";
  return indexerPublicDataProvider(indexerUri, indexerWsUri);
}

/**
 * Deploy a new survey contract (constructor call).
 *
 * Two modes:
 * - Wallet connected: real Preprod deploy via Midnight.js. Any failure throws
 *   (the UI shows it) — we never masquerade a local id as an on-chain address.
 * - No wallet: local demo mode, returns a random local-only id.
 */
export async function createSurvey(questionCount: number): Promise<Survey> {
  const api = getConnectedApi();
  if (!api) {
    return {
      id: randomId(),
      questionCount,
      active: true,
      organizer: "",
      participantCount: 0,
    };
  }

  const providers = await createContractProviders(api);
  const compiledContract = await getCompiledBlindPulse();
  try {
    // The organizer is the DEPLOYING WALLET's coin public key — stored in
    // ledger state (public by design) and later matched in-circuit against
    // the caller's private witness when closeSurvey is invoked.
    const { coinPublicKey } = await getWalletIdentity(api);
    const deployed = await deployContract(providers, {
      compiledContract,
      args: [coinPublicKey, BigInt(questionCount)],
    });

    const contractAddress = deployed.deployTxData.public.contractAddress;
    return {
      id: contractAddressToHex(contractAddress),
      questionCount,
      active: true,
      organizer: "",
      participantCount: 0,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Contract deploy failed: ${msg}`, { cause: err });
  }
}

/**
 * Submit responses with ZK proof of eligibility.
 *
 * The nullifier is derived INSIDE this function from the connected wallet's
 * coin public key (BLAKE2b-256, domain-separated, bound to this survey) —
 * deterministic per wallet per survey, one-way, unlinkable. The coin key
 * never leaves the client; only the digest is disclosed on-chain.
 *
 * PRIVATE: nullifier preimage, responses — NEVER written to ledger directly.
 * PUBLIC: nullifier digest (one-way, unlinkable), aggregate tally updates.
 */
export async function submitResponse(
  surveyId: string,
  responses: number[],
): Promise<void> {
  const api = getConnectedApi();
  if (!api) {
    throw new Error(
      "Connect your Lace wallet to submit — anonymous on-chain responses require a wallet-proofed transaction.",
    );
  }

  const nullifier = await buildNullifier(api, surveyId);

  const providers = await createContractProviders(api);
  const compiledContract = await getCompiledBlindPulse();
  try {
    const found = await findDeployedContract(providers, {
      compiledContract,
      contractAddress: hexToContractAddress(surveyId),
    });
    const padded = Array.from({ length: MAX_Q }, (_, i) =>
      BigInt(responses[i] ?? 0),
    );
    const result = await found.callTx.submitResponse(nullifier, padded);
    // Defensive: tx id shape varies across midnight-js versions.
    const txId =
      (result as unknown as { txHash?: string })?.txHash ??
      (result as unknown as { txId?: string })?.txId ??
      null;
    await recordParticipant(surveyId, txId);
  } catch (err) {
    // With a wallet connected, an on-chain failure must be visible — never
    // masquerade as success while only storing locally.
    console.error("On-chain submitResponse failed:", err);
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Response submission failed: ${msg}`, { cause: err });
  }
}

/** localStorage key for the per-survey verifiable participant ledger */
const PARTICIPANTS_KEY = "blindpulse_participants";

/**
 * Record a successful submit for the verifiable participant list
 * (Levels 5–6 require a list of wallet addresses checkable on-chain).
 * The unshielded address is the tx fee-payer — public data, visible on
 * the explorer for this tx — so recording it locally discloses nothing
 * the chain doesn't already show. Stored: address, tx id, timestamp.
 * PRIVATE: never stored — responses, nullifier preimage, coin key.
 */
async function recordParticipant(surveyId: string, txId: string | null): Promise<void> {
  try {
    const api = getConnectedApi();
    if (!api) return;
    const { unshieldedAddress } = await api.getUnshieldedAddress();
    const all: Record<string, Array<{ address: string; txId: string | null; at: number }>> =
      JSON.parse(localStorage.getItem(PARTICIPANTS_KEY) ?? "{}");
    const list = all[surveyId] ?? [];
    // one entry per address per survey — mirrors the on-chain nullifier rule
    if (list.some((p) => p.address === unshieldedAddress)) return;
    list.push({ address: unshieldedAddress, txId, at: Date.now() });
    all[surveyId] = list;
    localStorage.setItem(PARTICIPANTS_KEY, JSON.stringify(all));
  } catch {
    // non-fatal: the on-chain submit already succeeded
  }
}

/**
 * Close a survey — deactivates it on-chain so no further responses are
 * accepted. Intended for the organizer (the wallet that deployed).
 * PUBLIC: surveyActive flips to false on the ledger — a public flag.
 * PRIVATE: nothing — no witness data is involved in this transition.
 *
 * Note: the current contract circuit does not gate closeSurvey on the
 * organizer identity, so anyone with a wallet could technically close a
 * survey; the UI surfaces this action only on the organizer's dashboard.
 */
export async function closeSurvey(surveyId: string): Promise<void> {
  const api = getConnectedApi();
  if (!api) {
    throw new Error("Connect your Lace wallet to close the survey.");
  }

  const providers = await createContractProviders(api);
  const compiledContract = await getCompiledBlindPulse();
  try {
    // PRIVATE WITNESS: the caller's coin public key — a circuit argument
    // compared in ZK against the stored organizer. It is never disclosed;
    // only the surveyActive=false flip becomes public.
    const { coinPublicKey } = await getWalletIdentity(api);
    const found = await findDeployedContract(providers, {
      compiledContract,
      contractAddress: hexToContractAddress(surveyId),
    });
    await found.callTx.closeSurvey(coinPublicKey);
  } catch (err) {
    console.error("On-chain closeSurvey failed:", err);
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to close survey: ${msg}`, { cause: err });
  }
}

/** Store response locally for demo purposes */
export function storeResponseLocally(surveyId: string, responses: number[]): void {
  saveResponse(surveyId, responses);
}

/** Read aggregate tallies — on-chain when deployed, local store otherwise */
export async function getResults(surveyId: string): Promise<SurveyResults> {
  const stored = getSurvey(surveyId);
  const questionCount = stored?.questionCount ?? 0;

  try {
    await ensureMidnightRuntime();
    const states = await getPublicStates(
      readOnlyPublicDataProvider(),
      hexToContractAddress(surveyId),
    );
    const state = await decodeLedger(states.contractState.data);
    const tallies: Record<number, Record<number, number>> = {};
    const qCount = Number(state.questionCount);
    for (let qi = 0; qi < qCount; qi++) {
      const inner = state.tallies.lookup(BigInt(qi));
      const row: Record<number, number> = {};
      for (let oi = 0; oi < MAX_Q; oi++) {
        if (inner.member(BigInt(oi))) {
          const count = Number(inner.lookup(BigInt(oi)).read());
          // All MAX_Q option cells are pre-created by the constructor, so
          // member() is always true — only surface options with votes.
          // (Zero entries are rendered client-side from stored metadata.)
          if (count > 0) row[oi] = count;
        }
      }
      tallies[qi] = row;
    }
    return {
      tallies,
      totalParticipants: Number(state.participantCount),
    };
  } catch {
    const tallies = tallyResponses(surveyId, questionCount);
    const participantCount = (getResponses()[surveyId] ?? []).length;
    return { tallies, totalParticipants: participantCount };
  }
}

/**
 * Read public survey metadata straight from the ledger.
 * PUBLIC: questionCount, surveyActive, participantCount are ledger fields.
 * PRIVATE: nothing — this is the same data anyone can read from the chain.
 *
 * Used by /survey and /results when the off-chain survey metadata (title,
 * question text, options) is not present in this browser's localStorage —
 * e.g. a respondent or a member of the public opening a shared link.
 */
export async function getSurveyMetadata(
  surveyId: string,
): Promise<{
  questionCount: number;
  surveyActive: boolean;
  participantCount: number;
} | null> {
  try {
    await ensureMidnightRuntime();
    const states = await getPublicStates(
      readOnlyPublicDataProvider(),
      hexToContractAddress(surveyId),
    );
    const state = await decodeLedger(states.contractState.data);
    return {
      questionCount: Number(state.questionCount),
      surveyActive: state.surveyActive,
      participantCount: Number(state.participantCount),
    };
  } catch {
    // Not found on-chain (bad address / no deployment / indexer unreachable)
    return null;
  }
}

/** Read public participant count */
export async function getParticipantCount(surveyId: string): Promise<number> {
  try {
    await ensureMidnightRuntime();
    const states = await getPublicStates(
      readOnlyPublicDataProvider(),
      hexToContractAddress(surveyId),
    );
    const state = await decodeLedger(states.contractState.data);
    return Number(state.participantCount);
  } catch {
    return (getResponses()[surveyId] ?? []).length;
  }
}
