import "dotenv/config";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { mkdir, writeFile } from "node:fs/promises";
import { BeeClient, stopBeeProcess } from "../server/bee.js";
import { streamShape } from "../server/normalize.js";

// Immediate all-event probe: never logs or stores transcript/identity values.
const seconds = Math.max(1, Math.min(60, Number(process.argv[2]) || 60));
const bee = new BeeClient();
const startedAt = new Date().toISOString();
const child = spawn(bee.binary, ["stream", "--json"], {
  stdio: ["ignore", "pipe", "pipe"],
  detached: process.platform !== "win32",
});
const shapes: unknown[] = [];
const kinds: Record<string, number> = {};
function shape(v: unknown): unknown {
  if (Array.isArray(v))
    return {
      array: true,
      length: v.length,
      first: v.length ? shape(v[0]) : null,
    };
  if (v && typeof v === "object")
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shape(x)]));
  return v === null ? "null" : typeof v;
}
const lines = createInterface({ input: child.stdout });
child.stderr.resume();
lines.on("line", (line) => {
  try {
    const v = JSON.parse(line);
    const kind = streamShape(v)?.kind || "other payload";
    kinds[kind] = (kinds[kind] || 0) + 1;
    const s = shape(v);
    if (shapes.length < 200) shapes.push(s);
    console.info(`${new Date().toISOString()} ${kind}`);
  } catch {
    /* no raw diagnostics */
  }
});
console.info(
  `All-event stream probe running for ${seconds}s. Speak now. No raw payloads retained.`,
);
let failed = false;
await new Promise<void>((done) => {
  const timer = setTimeout(() => {
    stopBeeProcess(child);
    done();
  }, seconds * 1000);
  child.once("error", () => {
    failed = true;
    clearTimeout(timer);
    done();
  });
  child.once("close", () => {
    clearTimeout(timer);
    done();
  });
});
lines.close();
const summary = {
  startedAt,
  finishedAt: new Date().toISOString(),
  requestedSeconds: seconds,
  failed,
  kinds,
  shapes: [...new Set(shapes.map((s) => JSON.stringify(s)))].map((s) =>
    JSON.parse(s),
  ),
};
await mkdir("data/private/probes", { recursive: true, mode: 0o700 });
await writeFile(
  "data/private/probes/latest-stream-summary.json",
  JSON.stringify(summary, null, 2),
  { mode: 0o600 },
);
console.info(JSON.stringify(summary));
