/**
 * Tiny CDP eval helper for driving the BlindPulse DApp during e2e runs.
 *
 * Usage: bun scripts/bp_eval.mjs '<js expression>'
 *   Evaluates the expression (awaited) in the localhost:3000 page and
 *   prints the JSON result. Read-only driver — clicks the same buttons
 *   a user would; never extracts wallet secrets.
 *
 * Requires Chromium started with --remote-debugging-port=9222.
 */
const DEV = "http://localhost:9222";

const expr = process.argv[2];
if (!expr) {
  console.error("usage: bun scripts/bp_eval.mjs '<js expression>'");
  process.exit(1);
}

const targets = await (await fetch(`${DEV}/json/list`)).json();
const page =
  targets.find((t) => t.type === "page" && t.url.includes("localhost:3000")) ??
  targets.find((t) => t.type === "page");
if (!page) {
  console.error("no page target; is Chromium running with CDP on 9222?");
  process.exit(2);
}

const ws = new WebSocket(page.webSocketDebuggerUrl);
const send = (msg) => ws.send(JSON.stringify(msg));
const recv = () =>
  new Promise((resolve, reject) => {
    const to = setTimeout(
      () => reject(new Error("ws recv timeout (60s)")),
      60_000,
    );
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id === 1) {
        clearTimeout(to);
        resolve(m);
      }
    };
    ws.onerror = (e) => {
      clearTimeout(to);
      reject(new Error(`ws error: ${e.message ?? e}`));
    };
  });

await new Promise((res, rej) => {
  ws.onopen = res;
  ws.onerror = (e) => rej(new Error(`ws open failed: ${e.message ?? e}`));
});
send({
  id: 1,
  method: "Runtime.evaluate",
  params: { expression: expr, awaitPromise: true, returnByValue: true },
});
const reply = await recv();
ws.close();

const r = reply.result ?? {};
if (r.exceptionDetails) {
  const d = r.exceptionDetails;
  console.error(
    "EXCEPTION:",
    d.exception?.description ?? JSON.stringify(d).slice(0, 500),
  );
  process.exit(3);
}
const v = r.result?.value;
console.log(v === undefined ? "undefined" : JSON.stringify(v, null, 2));
process.exit(0);
