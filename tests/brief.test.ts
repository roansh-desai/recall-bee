import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { brief } from "../server/brief.js";
import { extractConversation } from "../server/extract.js";
import { ask, searchSources } from "../server/ask.js";
import {
  syncPromiseTodo as ensureBeeTodo,
  setPromiseCompleted as setBeeTodoCompleted,
} from "../server/todos.js";
import type {
  BeeClientContract,
  Conversation,
  PromiseItem,
} from "../shared/types.js";
const conversations: Conversation[] = JSON.parse(
  readFileSync(
    new URL("../fixtures/conversations.json", import.meta.url),
    "utf8",
  ),
);
const person = extractConversation(conversations[0]).people[0];
const bee = (
  overrides: Partial<BeeClientContract> = {},
): BeeClientContract => ({
  listConversations: async () => [],
  getConversation: async () => ({}),
  transcript: async () => ({}),
  facts: async () => [],
  search: async () => [],
  locations: async () => [],
  createTodo: async () => ({ id: "bee-todo" }),
  completeTodo: async () => ({}),
  ...overrides,
});

test("brief is short and every line sourced, absent locations stay absent", () => {
  const result = brief(person, conversations);
  assert.ok(result.wordCount <= 110);
  assert.ok(result.wordCount >= 40);
  assert.ok(result.lines.every((l) => l.sources.length > 0));
  assert.ok(
    result.lines
      .find((l) => l.label === "Suggested opener")
      ?.sources[0].quote.includes("accessible onboarding"),
  );
  assert.ok(
    !result.lines.find((l) => l.label === "Last met")?.text.includes(" · "),
  );
});
test("Ask uses Bee search first and returns only retrieved quotes", async () => {
  let query = "";
  const client = bee({
    search: async (q) => {
      query = q;
      return {
        results: [{ conversation_id: "c1", snippet: "Priya loves bookshops." }],
      };
    },
  });
  const answer = await ask("What does Priya love?", client);
  assert.equal(query, "What does Priya love?");
  assert.equal(answer.method, "bee-search");
  assert.equal(answer.answer, "“Priya loves bookshops.”");
  assert.equal(answer.sources[0].conversationId, "c1");
});
test("Ask rejects unsupported unsourced results and reports offline without hallucinating", async () => {
  assert.deepEqual(
    searchSources({
      results: [{ id: "ambiguous-fact", text: "Priya works at Acme" }],
    }),
    [],
  );
  assert.equal(
    (
      await ask(
        "Priya",
        bee({
          search: async () => ({ results: [{ snippet: "Priya builds apps" }] }),
        }),
      )
    ).sources.length,
    0,
  );
  const answer = await ask(
    "Priya",
    bee({
      search: async () => {
        throw new Error("private server output");
      },
    }),
  );
  assert.equal(answer.method, "unavailable");
  assert.ok(!JSON.stringify(answer).includes("private server output"));
});
test("Ask fixture mode is explicit and never calls Bee", async () => {
  const result = await ask(
    "library app",
    bee({
      search: async () => {
        throw new Error("must not call");
      },
    }),
    conversations,
  );
  assert.equal(result.method, "fixture");
  assert.ok(result.sources.length > 0);
});
test("Ask removes forgotten sources before building its answer and accepts numeric IDs", async () => {
  const client = bee({
    search: async () => ({
      results: [
        { conversation_id: 12, snippet: "Priya said private detail." },
        { conversation_id: 13, snippet: "Priya said public detail." },
      ],
    }),
  });
  const result = await ask("Priya", client, undefined, new Set(["12"]));
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0].conversationId, "13");
  assert.ok(!result.answer.includes("private"));
});
test("todo writes use due time, reuse ID and await remote completion", async () => {
  const p: PromiseItem = {
    ...person.promises[0],
    source: { ...person.promises[0].source, conversationId: "live-c1" },
  };
  let creates = 0;
  let completed = false;
  const client = bee({
    createTodo: async (text, alarm) => {
      creates++;
      assert.ok(text.includes("deck"));
      assert.equal(alarm, p.alarmAt);
      return { todo: { id: "remote-1" } };
    },
    completeTodo: async (id, value) => {
      assert.equal(id, "remote-1");
      completed = value;
      return {};
    },
  });
  const linked = await ensureBeeTodo(p, client);
  assert.equal(linked.beeTodoId, "remote-1");
  await ensureBeeTodo(linked, client);
  assert.equal(creates, 1);
  const done = await setBeeTodoCompleted(linked, true, client);
  assert.equal(done.completed, true);
  assert.equal(completed, true);
});
test("fixture, their promises, and uncertain creates are never sent again", async () => {
  let calls = 0;
  const client = bee({
    createTodo: async () => {
      calls++;
      throw new Error("auth details");
    },
  });
  await ensureBeeTodo(person.promises[0], client, true);
  await ensureBeeTodo(person.promises[1], client, true);
  assert.equal(calls, 0);
  const live = {
    ...person.promises[0],
    source: { ...person.promises[0].source, conversationId: "live-c1" },
  };
  const failed = await ensureBeeTodo(live, client);
  assert.equal(calls, 1);
  assert.ok(failed.syncError?.startsWith("Creation outcome unknown"));
  await ensureBeeTodo(failed, client);
  assert.equal(calls, 1);
  assert.ok(!JSON.stringify(failed).includes("auth details"));
});
test("failed remote completion does not falsely check the local promise", async () => {
  const live = {
    ...person.promises[0],
    source: { ...person.promises[0].source, conversationId: "live-c1" },
    beeTodoId: "remote-1",
  };
  const result = await setBeeTodoCompleted(
    live,
    true,
    bee({
      completeTodo: async () => {
        throw new Error("no network");
      },
    }),
  );
  assert.equal(result.completed, false);
  assert.ok(result.syncError);
});
