import { it } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { setTimeout as delay } from "node:timers/promises";
import type { ChildProcess } from "node:child_process";
import { startIngest } from "../server/ingest.js";
import { BeeClient } from "../server/bee.js";
import type { Conversation } from "../shared/types.js";

function fakeStream() {
  const child = new EventEmitter() as ChildProcess;
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = () => {
    child.stdout?.destroy();
    child.stderr?.destroy();
    return true;
  };
  return child;
}
async function until(check: () => boolean) {
  for (let i = 0; i < 100; i++) {
    if (check()) return;
    await delay(5);
  }
  throw new Error("Timed out waiting for worker");
}
it("backfills every page and suppresses forgotten sources", async () => {
  const stream = fakeStream();
  const seen: Conversation[] = [];
  const cursors: unknown[] = [];
  const client = {
    stream: () => stream,
    listConversationsPage: async (cursor?: string) => {
      cursors.push(cursor);
      return cursor
        ? { items: [{ id: "forgotten" }] }
        : { items: [{ id: "one" }], next_cursor: "second" };
    },
    getConversation: async (id: string) => ({ id }),
    transcript: async () => ({
      utterances: [{ speaker: "speaker_1", text: "My name is Test Person." }],
    }),
  } as unknown as BeeClient;
  const worker = startIngest({
    client,
    onConversation: (c) => {
      seen.push(c);
    },
    onStatus: () => {},
    isForgotten: (id) => id === "forgotten",
  });
  try {
    await worker.sync();
    assert.deepEqual(cursors, [undefined, "second"]);
    assert.deepEqual(
      seen.map((c) => c.id),
      ["one"],
    );
  } finally {
    worker.stop();
  }
});
it("a stream update arriving during a fetch triggers a fresh read instead of being lost", async () => {
  const stream = fakeStream();
  const seen: Conversation[] = [];
  let reads = 0;
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const client = {
    stream: () => stream,
    listConversationsPage: async () => ({ items: [] }),
    getConversation: async (id: string) => {
      reads++;
      if (reads === 1) await gate;
      return { id };
    },
    transcript: async () => ({
      utterances: [{ speaker: "speaker_1", text: `revision ${reads}` }],
    }),
  } as unknown as BeeClient;
  const worker = startIngest({
    client,
    onConversation: (c) => {
      seen.push(c);
    },
    onStatus: () => {},
    isForgotten: () => false,
  });
  try {
    (stream.stdout as PassThrough).write(
      JSON.stringify({ conversation: { id: 1 } }) + "\n",
    );
    await until(() => reads === 1);
    (stream.stdout as PassThrough).write(
      JSON.stringify({ conversation_id: 1, short_summary: "updated" }) + "\n",
    );
    release!();
    await until(() => seen.length === 2);
    assert.equal(reads, 2);
    assert.equal(seen[1].utterances[0].text, "revision 2");
  } finally {
    worker.stop();
  }
});
it("Bee client rejects remote proxy and credential-bearing URLs", () => {
  for (const url of [
    "http://example.com",
    "https://example.com",
    "http://user:secret@localhost:8787",
    "https://api.developer.bee.amazon.dev/other",
  ])
    assert.throws(() => new BeeClient({ proxyUrl: url }));
  assert.doesNotThrow(
    () => new BeeClient({ proxyUrl: "http://127.0.0.1:8787" }),
  );
});
it("does not persist an in-flight fetch after the conversation is forgotten", async () => {
  const stream = fakeStream();
  const seen: Conversation[] = [];
  let forgotten = false;
  let entered = false;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const client = {
    stream: () => stream,
    listConversationsPage: async () => ({ items: [{ id: "one" }] }),
    getConversation: async () => {
      entered = true;
      await gate;
      return { id: "one" };
    },
    transcript: async () => ({
      utterances: [{ text: "My name is Test Person.", speaker: "speaker_1" }],
    }),
  } as unknown as BeeClient;
  const worker = startIngest({
    client,
    onConversation: (c) => {
      seen.push(c);
    },
    onStatus: () => {},
    isForgotten: () => forgotten,
  });
  try {
    await until(() => entered);
    forgotten = true;
    release();
    await worker.sync();
    assert.equal(seen.length, 0);
  } finally {
    worker.stop();
  }
});
it("a stream signal establishes delivery without claiming a conversation event", async () => {
  const stream = fakeStream();
  const patches: Record<string, unknown>[] = [];
  const client = {
    stream: () => stream,
    listConversationsPage: async () => ({ items: [] }),
  } as unknown as BeeClient;
  const worker = startIngest({
    client,
    onConversation: () => {},
    onStatus: (p) => patches.push(p),
    isForgotten: () => false,
  });
  try {
    (stream.stdout as PassThrough).write(
      JSON.stringify({ timestamp: 1792778400000 }) + "\n",
    );
    await until(() => patches.some((p) => p.streamConnected === true));
    const signal = patches.find((p) => p.streamConnected === true)!;
    assert.equal(signal.lastEvent, undefined);
    assert.equal(signal.lastEventAt, undefined);
  } finally {
    worker.stop();
  }
});
