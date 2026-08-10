import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Serves the Midnight wasm runtime binaries (onchain-runtime-v3, ledger-v8)
 * that the client shims instantiate at runtime. The packages ship wasm that
 * webpack's bundled decoder cannot parse, so we never bundle it — we serve it
 * here instead and fetch it in the browser.
 *
 * PUBLIC: serves opaque wasm binaries only. No survey data, no ledger state.
 */

/** Strict allowlist — nothing outside these files is ever served. */
const WASM_FILES: Record<string, string> = {
  "onchain-runtime-v3/midnight_onchain_runtime_wasm_bg.wasm":
    "@midnight-ntwrk/onchain-runtime-v3/midnight_onchain_runtime_wasm_bg.wasm",
  "ledger-v8/midnight_ledger_wasm_bg.wasm":
    "@midnight-ntwrk/ledger-v8/midnight_ledger_wasm_bg.wasm",
};

export async function GET(
  _request: NextRequest,
  { params }: { params: { path: string[] } },
) {
  const joined = (params.path ?? []).join("/");
  const rel = WASM_FILES[joined];
  if (!rel) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const bytes = await readFile(
      path.join(process.cwd(), "node_modules", rel),
    );
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": "application/wasm",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
