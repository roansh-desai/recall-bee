import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { request } from "node:http";
import { Store } from "../server/db.js";
import { createApp } from "../server/app.js";
import type { BeeClientContract } from "../shared/types.js";

test("fixture HTTP flow: sourced brief, completion, export, forget and backfill suppression", async () => {
  const dir = mkdtempSync(join(tmpdir(), "recall-test-"));
  const store = new Store(join(dir, "test.sqlite"));
  const noCall = async () => {
    throw Error("Fixture must not call Bee");
  };
  const bee: BeeClientContract = {
    listConversations: noCall,
    getConversation: noCall,
    transcript: noCall,
    facts: noCall,
    search: noCall,
    locations: noCall,
    createTodo: noCall,
    completeTodo: noCall,
  };
  const runtime = createApp(store, bee, true);
  await runtime.loadFixture();
  const server = runtime.app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  const address = server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}`;
  const req = async (
    path: string,
    method = "GET",
    body?: unknown,
    headers: Record<string, string> = {},
  ) =>
    fetch(base + path, {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  try {
    const state = await (await req("/api/state")).json();
    assert.equal(state.people.length, 2);
    assert.equal(state.status.mode, "fixture");
    const p = state.people.find((p: any) => p.name === "Priya Shah");
    assert.ok(p);
    const result = await (await req(`/api/people/${p.id}/brief`)).json();
    assert.ok(result.lines.every((l: any) => l.sources.length));
    const promise = p.promises.find((p: any) => p.direction === "i_owe");
    assert.ok(promise);
    assert.equal(
      (await req(`/api/promises/${promise.id}`, "PUT", { completed: true }))
        .status,
      200,
    );
    assert.equal(
      store.promises().find((p) => p.id === promise.id)?.completed,
      true,
    );
    assert.equal(
      (await req("/api/sync", "POST", {}, { Origin: "https://evil.example" }))
        .status,
      403,
    );
    const rebindingStatus = await new Promise<number | undefined>(
      (resolve, reject) => {
        const r = request(
          base + "/api/state",
          { headers: { host: "evil.example" } },
          (response) => {
            response.resume();
            resolve(response.statusCode);
          },
        );
        r.on("error", reject);
        r.end();
      },
    );
    assert.equal(rebindingStatus, 403);
    const exported = await (await req("/api/export")).json();
    assert.equal(exported.people.length, 2);
    const original = store.conversation(p.conversationIds[0])!;
    store.saveConversation({
      ...original,
      utterances: [
        ...original.utterances,
        {
          id: "unknown-example",
          speaker: "Unknown",
          text: "An unattributed utterance.",
        },
      ],
    });
    assert.equal(
      (
        await req(`/api/conversations/${original.id}/speaker`, "PUT", {
          speaker: "Unknown",
        })
      ).status,
      400,
    );
    assert.equal((await req(`/api/people/${p.id}`, "DELETE")).status, 200);
    await runtime.ingest(original);
    assert.equal(
      store.people().some((p) => p.name === "Priya Shah"),
      false,
    );
    assert.equal(JSON.stringify(store.export()).includes("pitch deck"), false);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
