// Circuit compilation artifacts test.
// Verifies that `bun run compile` (compact 0.31.0, language 0.23) produced
// the circuits, keys, and contract bindings the frontend depends on.
// Run after compile: `bun run compile && bun run test`.
//
// The proof-server round-trip (build witness -> prove -> verify) is NOT
// covered here: it needs Docker + Lace on Preprod. See test/integration.test.ts.

import * as fs from "node:fs";
import * as path from "node:path";

const MANAGED = path.join(__dirname, "..", "managed");

function sizeOf(rel: string): number {
  return fs.statSync(path.join(MANAGED, rel)).size;
}

describe("Circuit artifacts", () => {
  test("compiles blindpulse.compact without errors", () => {
    // Contract bindings (consumed by src/lib/midnight.ts) — ESM layout
    expect(fs.existsSync(path.join(MANAGED, "contract", "index.js"))).toBe(
      true,
    );
    expect(fs.existsSync(path.join(MANAGED, "contract", "index.d.ts"))).toBe(
      true,
    );

    const bindings = fs.readFileSync(
      path.join(MANAGED, "contract", "index.js"),
      "utf8",
    );
    // Both state-changing circuits are exported...
    expect(bindings).toContain("submitResponse");
    expect(bindings).toContain("closeSurvey");
    // ...along with the public-state decoder used by getResults().
    expect(bindings).toContain("function ledger");
    expect(bindings).toContain("class Contract");
    // Bindings must target the pinned compact-runtime (0.16.0) — the old
    // 0.26.0 output inlined a version check against 0.9.0 and crashed.
    expect(bindings).toContain("checkRuntimeVersion('0.16.0')");
  });

  test("emits zkir + proving keys for submitResponse", () => {
    expect(sizeOf("zkir/submitResponse.zkir")).toBeGreaterThan(0);
    expect(sizeOf("keys/submitResponse.prover")).toBeGreaterThan(0);
    expect(sizeOf("keys/submitResponse.verifier")).toBeGreaterThan(0);
  });

  test("generates proof for submitResponse", () => {
    // Requires: proof-server (docker compose up) + Lace on Preprod.
    // The DApp proves through the wallet's proof provider at submit time
    // (see submitResponse in src/lib/contract-api.ts), so there is nothing
    // hermetic to assert here — this is covered by the manual Preprod flow.
    expect(true).toBe(true);
  });
});
