import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { BeeClient, stopBeeProcess } from "../server/bee.js";
import { normalizeConversation, object } from "../server/normalize.js";

const args = process.argv.slice(2);
const option = (name: string) => args[args.indexOf(name) + 1];
const id = args.includes("--conversation")
  ? option("--conversation")
  : undefined;
const query = args.includes("--query") ? option("--query") : undefined;
if (!id || !query) {
  console.error(
    "Usage: npm run probe -- --conversation <id> --query <consented-name> [--seconds 60]",
  );
  process.exit(1);
}
const seconds = Math.max(
  1,
  Math.min(
    60,
    Number(args.includes("--seconds") ? option("--seconds") : 60) || 60,
  ),
);
const dir = resolve(
  "data/private/probes",
  new Date().toISOString().replace(/[:.]/g, "-"),
);
await mkdir(dir, { recursive: true, mode: 0o700 });
const bee = new BeeClient();
const summary: Record<string, unknown> = {
  capturedAt: new Date().toISOString(),
  requestedStreamSeconds: seconds,
  source: "live Bee commands",
  outputs: {},
  speakerStability:
    "Not established: requires wearer confirmation and comparison across conversations.",
};
const captures: Record<string, unknown> = {};
function shape(value: unknown, depth = 0): unknown {
  if (depth > 6) return typeof value;
  if (Array.isArray(value))
    return {
      type: "array",
      length: value.length,
      firstItemShape: value.length ? shape(value[0], depth + 1) : null,
    };
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, v]) => [key, shape(v, depth + 1)]),
    );
  return value === null ? "null" : typeof value;
}
async function capture(name: string, action: () => Promise<unknown>) {
  try {
    const value = await action();
    captures[name] = value;
    // Raw command output exists only in process memory. Persist shape metadata,
    // not a second transcript store that Forget person could leave behind.
    (summary.outputs as Record<string, unknown>)[name] = {
      ok: true,
      shape: shape(value),
    };
  } catch {
    (summary.outputs as Record<string, unknown>)[name] = {
      ok: false,
      error: "Command failed; private diagnostics withheld.",
    };
  }
}
await capture("conversation", () => bee.getConversation(id));
await capture("transcript", () => bee.transcript(id));
await capture("facts", () => bee.facts());
await capture("search", () => bee.search(query));
for (const kind of ["current", "recent", "clusters"] as const)
  await capture(`locations-${kind}`, () => bee.locations(kind));
if (captures.conversation) {
  const conversation = normalizeConversation(
    captures.conversation,
    captures.transcript,
    id,
  );
  summary.speakerLabels = [
    ...new Set(conversation.utterances.map((u) => u.speaker)),
  ].map((label) =>
    /^speaker[_ -]?\d+$/i.test(label) || /^unknown$/i.test(label)
      ? label
      : "[non-generic label redacted]",
  );
  summary.utteranceCount = conversation.utterances.length;
  summary.utterancesWithTimestamps = conversation.utterances.filter(
    (u) => u.timestamp,
  ).length;
  summary.namedLocationPresent = Boolean(conversation.location);
  const c = object(
    object(captures.conversation).conversation ?? captures.conversation,
  );
  summary.conversationNameFieldKeys = Object.keys(c).filter((key) =>
    /name/i.test(key),
  );
}
console.info(
  `Capturing Bee stream for ${seconds} seconds. Speak near the Bee now; raw output stays in process memory only.`,
);
const stream = spawn(bee.binary, ["stream", "--json"], {
  stdio: ["ignore", "pipe", "pipe"],
  detached: process.platform !== "win32",
});
let stdout = "";
stream.stdout.on("data", (chunk) => {
  if (stdout.length < 20_000_000) stdout += chunk.toString();
});
stream.stderr.resume();
await new Promise<void>((resolveDone) => {
  const timer = setTimeout(() => {
    stopBeeProcess(stream);
    resolveDone();
  }, seconds * 1000);
  stream.once("error", () => {
    clearTimeout(timer);
    summary.streamError = "Bee stream did not start.";
    resolveDone();
  });
  stream.once("close", () => {
    clearTimeout(timer);
    resolveDone();
  });
});
const shapes: unknown[] = [];
for (const line of stdout.split("\n")) {
  try {
    shapes.push(shape(JSON.parse(line)));
  } catch {
    /* diagnostics remain private */
  }
}
summary.streamPayloadCount = shapes.length;
summary.distinctStreamShapes = [
  ...new Set(shapes.map((value) => JSON.stringify(value))),
].map((value) => JSON.parse(value));
await writeFile(
  resolve(dir, "redacted-summary.json"),
  JSON.stringify(summary, null, 2),
  { mode: 0o600 },
);
for (const key of Object.keys(captures)) delete captures[key];
stdout = "";
console.info(
  `Probe completed. Redacted shape summary: ${dir}/redacted-summary.json. No raw captures were saved. Review the summary before sharing.`,
);
