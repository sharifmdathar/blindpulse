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
    const deployed = await deployContract(providers, {
      compiledContract,
      args: [new Uint8Array(32), BigInt(questionCount)],
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
 * PRIVATE: nullifier, responses — NEVER written to ledger directly.
 * PUBLIC: nullifier is disclosed (one-way hash, unlinkable),
 *         only aggregate tally updates hit the ledger.
 */
export async function submitResponse(
  surveyId: string,
  nullifier: Uint8Array,
  responses: number[],
): Promise<void> {
  const api = getConnectedApi();
  if (!api) return;

  try {
    const providers = await createContractProviders(api);
    const compiledContract = await getCompiledBlindPulse();
    const found = await findDeployedContract(providers, {
      compiledContract,
      contractAddress: hexToContractAddress(surveyId),
    });
    const padded = Array.from({ length: MAX_Q }, (_, i) =>
      BigInt(responses[i] ?? 0),
    );
    await found.callTx.submitResponse(nullifier, padded);
  } catch (err) {
    // On-chain submission unavailable — caller stores locally as fallback.
    // Surface the real cause in the console so failures are never silent.
    console.error(
      "On-chain submitResponse failed, falling back to local store:",
      err,
    );
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
          row[oi] = Number(inner.lookup(BigInt(oi)).read());
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
