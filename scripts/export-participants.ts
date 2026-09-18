/**
 * Export participant wallet addresses for a BlindPulse survey — the
 * verifiable-address list required by Levels 5–6.
 *
 * Source: the participant ledger the DApp records at submit time
 * (localStorage key `blindpulse_participants`): one entry per address per
 * survey with the tx id, exported from the organizer's browser via
 *   localStorage.getItem("blindpulse_participants")
 *
 * Each entry is verifiable on-chain: the address is the tx fee-payer,
 * visible on the explorer for that transaction; the on-chain evidence
 * that they participated is the nullifier + tally increments in that tx.
 * PRIVATE: responses, nullifier preimage, and coin keys are never stored
 * here — only public-by-design data.
 *
 * Usage:
 *   bun scripts/export-participants.ts --file ledger.json [--contract <hex>] [--format json]
 */
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
function argOf(flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

const FILE = argOf("--file");
const CONTRACT =
  argOf("--contract") ??
  "d9a1605a0ada136ffe075736784a28b6e58c876ad53825fe1be0d23dfda5f132";
const FORMAT = (argOf("--format") ?? "text").toLowerCase();

if (!FILE) {
  console.error(
    "usage: bun scripts/export-participants.ts --file ledger.json [--contract <hex>] [--format json]\n" +
      "In the organizer's browser console run:\n" +
      '  copy(localStorage.getItem("blindpulse_participants"))\nand save the clipboard to ledger.json',
  );
  process.exit(1);
}

interface Entry {
  address: string;
  txId: string | null;
  at: number;
}

interface TxStatus {
  ok: boolean;
  confirmed: boolean;
}

/** Explorer check: does the recorded tx exist and is it confirmed? */
async function checkTx(txId: string): Promise<TxStatus> {
  try {
    const res = await fetch(
      `https://explorer.1am.xyz/api/tx/${txId}?network=preprod`,
      { headers: { accept: "application/json" } },
    );
    if (!res.ok) return { ok: false, confirmed: false };
    const data = (await res.json()) as { status?: string; confirmed?: boolean };
    return {
      ok: true,
      confirmed: Boolean(data.confirmed ?? data.status === "confirmed"),
    };
  } catch {
    return { ok: false, confirmed: false };
  }
}

async function main(): Promise<void> {
  if (!FILE) throw new Error("unreachable");
  const raw = JSON.parse(readFileSync(FILE, "utf8")) as Record<string, Entry[]>;
  const entries = raw[CONTRACT] ?? [];
  if (entries.length === 0) {
    console.error(
      `no participants recorded for ${CONTRACT} — recorded surveys: ${Object.keys(raw).join(", ") || "(none)"}`,
    );
    process.exit(1);
  }

  const participants = [] as Array<
    Entry & { explorerTxUrl: string | null; txConfirmed?: boolean }
  >;
  for (const e of entries) {
    let txConfirmed: boolean | undefined;
    if (e.txId) {
      const s = await checkTx(e.txId);
      txConfirmed = s.ok ? s.confirmed : undefined;
    }
    participants.push({
      ...e,
      explorerTxUrl: e.txId
        ? `https://explorer.1am.xyz/tx/${e.txId}?network=preprod`
        : null,
      txConfirmed,
    });
  }

  if (FORMAT === "json") {
    console.log(
      JSON.stringify(
        {
          contract: CONTRACT,
          network: "preprod",
          exportedAt: new Date().toISOString(),
          total: participants.length,
          participants,
        },
        null,
        2,
      ),
    );
  } else {
    console.log("=== BlindPulse participants (Preprod) ===");
    console.log(`contract: ${CONTRACT}`);
    console.log(`count:    ${participants.length}\n`);
    for (const p of participants) {
      console.log(`- ${p.address}`);
      console.log(
        `  tx: ${p.explorerTxUrl ?? "(id not captured)"}${txNote(p.txConfirmed)}`,
      );
      console.log(`  at: ${new Date(p.at).toISOString()}`);
    }
    console.log(
      "\nVerifiability: each address is the fee-payer of its listed tx; the tx contains the contract's nullifier insert + tally increments. Nullifier digests are one-way and unlinkable by design.",
    );
  }
}

function txNote(confirmed?: boolean): string {
  if (confirmed === undefined) return " · (tx status not checked)";
  return confirmed ? " · confirmed" : " · (status unknown)";
}

main().catch((err) => {
  console.error("export-participants failed:", err);
  process.exit(1);
});
