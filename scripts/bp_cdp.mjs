/**
 * Minimal CDP driver for trusted input + eval against the DApp page.
 *
 * Usage:
 *   bun scripts/bp_cdp.mjs eval '<js>'     — evaluate expression (awaited)
 *   bun scripts/bp_cdp.mjs click '<text>'  — trusted mouse click on the
 *     center of the first visible clickable element whose text matches
 *   bun scripts/bp_cdp.mjs targets         — list CDP targets
 *
 * Input.dispatchMouseEvent produces trusted user activation, which
 * extension approval popups require (synthetic el.click() does not).
 * Requires Chromium started with --remote-debugging-port=9222.
 */
const DEV = "http://localhost:9222";

const [cmd, ...rest] = process.argv.slice(2);
// Optional last arg: substring to select the target (default: the DApp page).
const TARGET_MATCH = process.argv.includes("--target")
  ? process.argv[process.argv.indexOf("--target") + 1]
  : "localhost:3000";

async function getTargets() {
  return await (await fetch(`${DEV}/json/list`)).json();
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) reject(new Error(m.error.message));
      else resolve(m.result);
    }
  };
  const ready = new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = () => rej(new Error("ws connect failed"));
  });
  const send = (method, params = {}) =>
    ready.then(() => {
      const myId = ++id;
      ws.send(JSON.stringify({ id: myId, method, params }));
      return new Promise((resolve, reject) =>
        pending.set(myId, { resolve, reject }),
      );
    });
  return { ws, send };
}

async function withPage(fn, match = "localhost:3000") {
  const targets = await getTargets();
  const page =
    targets.find((t) => t.type === "page" && t.url.includes(match)) ??
    targets.find((t) => t.type === "page");
  if (!page) throw new Error(`no page target matching "${match}"`);
  const { ws, send } = connect(page.webSocketDebuggerUrl);
  try {
    await send("Runtime.enable");
    return await fn(send, page);
  } finally {
    ws.close();
  }
}

async function evalExpr(send, expr) {
  const r = await send("Runtime.evaluate", {
    expression: expr,
    awaitPromise: true,
    returnByValue: true,
  });
  if (r.exceptionDetails) {
    const d = r.exceptionDetails;
    throw new Error(
      d.exception?.description ?? JSON.stringify(d).slice(0, 400),
    );
  }
  return r.result?.value;
}

/** Trusted click on the center of the first clickable element matching text. */
async function trustedClick(send, text) {
  const box = await evalExpr(
    send,
    `(() => {
      const els = Array.from(document.querySelectorAll('button, a, [role=button], input[type=submit]'));
      const el = els.find(e => (e.textContent || e.value || '').trim().toLowerCase().includes(${JSON.stringify(text.toLowerCase())}) && e.offsetParent !== null);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, label: (el.textContent || el.value || '').trim().slice(0, 40) };
    })()`,
  );
  if (!box) throw new Error(`no clickable element matching "${text}"`);
  for (const type of ["mousePressed", "mouseReleased"]) {
    await send("Input.dispatchMouseEvent", {
      type,
      x: box.x,
      y: box.y,
      button: "left",
      clickCount: 1,
    });
  }
  return box.label;
}

const targets = await getTargets();
if (cmd === "targets") {
  for (const t of targets)
    console.log(t.type, "|", t.title.slice(0, 55), "|", t.url.slice(0, 90));
  process.exit(0);
}
if (!cmd || !["eval", "click"].includes(cmd)) {
  console.error(
    "usage: bun scripts/bp_cdp.mjs eval '<js>' | click '<text>' | targets",
  );
  process.exit(1);
}

await withPage(async (send) => {
  if (cmd === "eval") {
    console.log(String(await evalExpr(send, rest[0])));
  } else {
    const label = await trustedClick(send, rest[0]);
    console.log(`trusted-clicked: ${label}`);
  }
}, TARGET_MATCH);
