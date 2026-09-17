import type { ConnectedAPI } from "@midnight-ntwrk/dapp-connector-api";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { dappConnectorProvingProvider } from "@midnight-ntwrk/midnight-js-dapp-connector-proof-provider";
import { createProofProvider } from "@midnight-ntwrk/midnight-js-types";
import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js";
import type { Contract } from "@midnight-ntwrk/midnight-js-protocol/compact-js";
import {
  Transaction,
  encodeContractAddress,
  decodeContractAddress,
} from "@midnight-ntwrk/ledger-v8";
import type {
  MidnightProviders,
  PrivateStateProvider,
  WalletProvider,
  MidnightProvider,
} from "@midnight-ntwrk/midnight-js-types";
import { MidnightBech32m, ShieldedCoinPublicKey, ShieldedEncryptionPublicKey } from "@midnight-ntwrk/wallet-sdk-address-format";
import type { ContractAddress } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";
import { initOnchainRuntime } from "./wasm/onchain-runtime-v3";
import { initLedgerRuntime } from "./wasm/ledger-v8";
import { createZkConfigProvider } from "./zk-config-provider";

type ManagedModule = typeof import("../../managed/contract/index.js");
type BlindPulseWitnesses<T> =
  import("../../managed/contract/index.js").Witnesses<T>;

let _managed: ManagedModule | null = null;
let _compiledBlindPulse: CompiledContract.CompiledContract<
  Contract<undefined>,
  undefined,
  never
> | null = null;

async function getManaged(): Promise<ManagedModule> {
  if (typeof window === "undefined") {
    throw new Error("BlindPulse contract runtime is browser-only");
  }
  if (!_managed) _managed = await import("../../managed/contract/index.js");
  return _managed;
}

export async function getCompiledBlindPulse(): Promise<
  CompiledContract.CompiledContract<Contract<undefined>, undefined, never>
> {
  if (_compiledBlindPulse) return _compiledBlindPulse;

  const { Contract: BlindPulseContract } = await getManaged();

  const BlindPulseCtor = BlindPulseContract as unknown as new (
    witnesses: BlindPulseWitnesses<undefined>,
  ) => Contract<undefined>;

  _compiledBlindPulse = CompiledContract.withCompiledFileAssets(
    CompiledContract.withVacantWitnesses(
      CompiledContract.make("BlindPulse", BlindPulseCtor),
    ),
    "managed/contract",
  ) as unknown as CompiledContract.CompiledContract<
    Contract<undefined>,
    undefined,
    never
  >;

  return _compiledBlindPulse;
}



/** Circuit IDs matching managed/keys and managed/zkir filenames */
export type BlindPulseCircuits = "submitResponse" | "closeSurvey";

const NETWORK_ID = "preprod";

/**
 * The managed constructor, viewed at the deploy-compatible contract type.
 * The Compact compiler emits a generic `Contract<T, W>` class from which
 * TypeScript cannot infer matching type arguments (they collapse to `never`,
 * which deployContract rejects). At runtime the constructor simply takes a
 * witnesses object, so we annotate the intended type once here instead of
 * casting at every call site.
 */

/**
 * Compiled contract — used for deploy, call, and state decoding.
 * withVacantWitnesses: contract declares no witnesses, so none are required.
 * withCompiledFileAssets: erases the CompiledAssetsPath context so the
 * compiled contract is deploy-ready (deployContract requires R = never).
 *
 * NOTE: the final assertion only reconciles type parameters (`never` vs
 * `undefined` private state). At runtime deployContract reads
 * tag/circuits/initialState structurally, which the compiled contract
 * provides regardless of these parameters.
 */

/**
 * Minimal in-memory private state provider.
 * Our contract has an empty witness set, so no persistent state is needed.
 */
function createPrivateStateProvider(): PrivateStateProvider {
  const states = new Map<string, unknown>();
  const signingKeys = new Map<string, string>();
  return {
    setContractAddress: () => undefined,
    async set(id, state) {
      states.set(id, state);
    },
    async get(id) {
      return (states.get(id) as unknown) ?? null;
    },
    async remove(id) {
      states.delete(id);
    },
    async clear() {
      states.clear();
    },
    async setSigningKey(address, key) {
      signingKeys.set(encodeContractAddress(address).join(","), key);
    },
    async getSigningKey(address) {
      return signingKeys.get(encodeContractAddress(address).join(",")) ?? null;
    },
    async removeSigningKey(address) {
      signingKeys.delete(encodeContractAddress(address).join(","));
    },
    async clearSigningKeys() {
      signingKeys.clear();
    },
    async exportPrivateStates() {
      return {
        format: "midnight-private-state-export",
        encryptedPayload: "",
        salt: "",
      };
    },
    async importPrivateStates() {
      return { imported: 0, skipped: 0, overwritten: 0 };
    },
    async exportSigningKeys() {
      return {
        format: "midnight-signing-key-export",
        encryptedPayload: "",
        salt: "",
      };
    },
    async importSigningKeys() {
      return { imported: 0, skipped: 0, overwritten: 0 };
    },
  };
}

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

/**
 * Builds WalletProvider + MidnightProvider bridges from the Lace DApp
 * Connector ConnectedAPI. The wallet balances and submits transactions.
 */
async function createWalletBridge(
  api: ConnectedAPI,
): Promise<{ walletProvider: WalletProvider; midnightProvider: MidnightProvider }> {
  const addresses = await api.getShieldedAddresses();
  const coinPk = ShieldedCoinPublicKey.codec.decode(
    NETWORK_ID,
    MidnightBech32m.parse(addresses.shieldedCoinPublicKey),
  );
  const encPk = ShieldedEncryptionPublicKey.codec.decode(
    NETWORK_ID,
    MidnightBech32m.parse(addresses.shieldedEncryptionPublicKey),
  );
  const coinPublicKey = coinPk.toHexString();
  const encryptionPublicKey = encPk.toHexString();

  const walletProvider: WalletProvider = {
    async balanceTx(tx, _ttl) {
      const { tx: balancedHex } = await api.balanceUnsealedTransaction(
        bytesToHex(tx.serialize()),
      );
      return Transaction.deserialize(
        "signature",
        "proof",
        "binding",
        hexToBytes(balancedHex),
      );
    },
    getCoinPublicKey() {
      return coinPublicKey;
    },
    getEncryptionPublicKey() {
      return encryptionPublicKey;
    },
  };

  const midnightProvider: MidnightProvider = {
    async submitTx(tx) {
      await api.submitTransaction(bytesToHex(tx.serialize()));
      // midnight-js watches for finalization via the indexer using the value
      // returned here as a TransactionOffset identifier. The indexer matches
      // on tx *identifiers* (intent hashes), NOT the raw serialized tx nor
      // the tx hash — returning anything else makes watchForTxData poll
      // forever even though the tx confirmed on-chain.
      return tx.identifiers()[0];
    },
  };

  return { walletProvider, midnightProvider };
}

/**
 * Builds the full ContractProviders set from a connected wallet.
 * PUBLIC: indexer (query/subscribe), proof provider (wallet-proven).
 * PRIVATE: private state provider keeps only signing keys.
 */
/**
 * Bootstraps the Compact runtime + ledger wasm (instantiated once per load).
 * PRIVATE: no ledger state read or written here.
 */
export async function ensureMidnightRuntime(): Promise<void> {
  await Promise.all([initOnchainRuntime(), initLedgerRuntime()]);
}

export async function createContractProviders(
  api: ConnectedAPI,
): Promise<MidnightProviders<BlindPulseCircuits, string, unknown>> {
  setNetworkId(NETWORK_ID);
  await ensureMidnightRuntime();

  const configuration = await api.getConfiguration();

  const publicDataProvider = indexerPublicDataProvider(
    configuration.indexerUri,
    configuration.indexerWsUri,
  );

  const zkConfigProvider = createZkConfigProvider<BlindPulseCircuits>();

  const proofProvider = createProofProvider(
    await dappConnectorProvingProvider(api, zkConfigProvider),
  );

  const { walletProvider, midnightProvider } = await createWalletBridge(api);

  const privateStateProvider = createPrivateStateProvider();

  return {
    privateStateProvider,
    publicDataProvider,
    zkConfigProvider,
    proofProvider,
    walletProvider,
    midnightProvider,
  };
}

/** PUBLIC: contract address ↔ hex string helpers for survey ids */
export function contractAddressToHex(address: ContractAddress): string {
  return bytesToHex(encodeContractAddress(address));
}

export function hexToContractAddress(hex: string): ContractAddress {
  return decodeContractAddress(hexToBytes(hex));
}

/** PRIVATE: coin public key used to build nullifiers from wallet identity */
export async function getWalletIdentity(
  api: ConnectedAPI,
): Promise<{ coinPublicKey: Uint8Array; encryptionPublicKey: Uint8Array }> {
  const addresses = await api.getShieldedAddresses();
  const coinPk = ShieldedCoinPublicKey.codec.decode(
    NETWORK_ID,
    MidnightBech32m.parse(addresses.shieldedCoinPublicKey),
  );
  const encPk = ShieldedEncryptionPublicKey.codec.decode(
    NETWORK_ID,
    MidnightBech32m.parse(addresses.shieldedEncryptionPublicKey),
  );
  return {
    coinPublicKey: hexToBytes(coinPk.toHexString()),
    encryptionPublicKey: hexToBytes(encPk.toHexString()),
  };
}
