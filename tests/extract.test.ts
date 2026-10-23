import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { extractConversation } from "../server/extract.js";
import { brief } from "../server/brief.js";
import { ask } from "../server/ask.js";
import { setPromiseCompleted, syncPromiseTodo } from "../server/todos.js";
import type { BeeClientContract, Conversation } from "../shared/types.js";
const fixtures = JSON.parse(
  readFileSync(
    new URL("../fixtures/conversations.json", import.meta.url),
    "utf8",
  ),
) as Conversation[];
const c = fixtures[0];
const fakeBee = (
  overrides: Partial<BeeClientContract> = {},
): BeeClientContract => ({
  listConversations: async () => [],
  getConversation: async () => ({}),
  transcript: async () => [],
  facts: async () => [],
  search: async () => [],
  locations: async () => [],
  createTodo: async () => ({ id: "todo-test" }),
  completeTodo: async () => ({}),
  ...overrides,
});

test("self introduction, details, both promises and spoken handle are sourced", () => {
  const { people } = extractConversation(c);
  assert.equal(people.length, 1);
  const p = people[0];
  assert.equal(p.name, "Priya Shah");
  assert.equal(
    p.details.find((d) => d.kind === "role")?.text,
    "product designer",
  );
  assert.equal(p.details.find((d) => d.kind === "org")?.text, "Example Studio");
  assert.deepEqual(
    p.promises.map((p) => p.direction),
    ["i_owe", "they_owe"],
  );
  assert.equal(p.handles[0].url, "https://instagram.com/recall_fake_priya_000");
  for (const item of [...p.details, ...p.handles, ...p.promises])
    assert.ok(c.utterances.some((u) => u.text === item.source.quote));
});
test("wearer is explicitly chosen per conversation, never same speaker assumed", () => {
  const a = extractConversation({ ...c, mySpeaker: null });
  assert.ok(
    a.people.every((p) => p.promises.every((v) => v.direction === "unknown")),
  );
  const b = extractConversation(fixtures[1]);
  assert.equal(b.people[0].name, "Noah Chen");
  assert.equal(b.people[0].promises[0].direction, "i_owe");
});
test("same name across conversations only proposes a merge", () => {
  const a = extractConversation(c);
  const b = extractConversation({ ...c, id: "another" }, a.people);
  assert.notEqual(a.people[0].id, b.people[0].id);
  assert.equal(b.mergeCandidates.length, 1);
  assert.equal(b.mergeCandidates[0].status, "pending");
});
test("generic labels alone never resolve people and name-free LinkedIn has no link", () => {
  const p = extractConversation(fixtures[1]).people[0];
  assert.equal(p.handles[0].url, null);
  assert.equal(p.handles[0].handle, null);
  const unknown = {
    ...c,
    utterances: [
      {
        id: "u",
        speaker: "speaker_2",
        text: "I love hiking. I will send you the notes.",
      },
    ],
  };
  assert.equal(extractConversation(unknown).people.length, 0);
});
test("different self introductions on one label suppress ambiguous identity", () => {
  const conflicting = {
    ...c,
    utterances: [
      ...c.utterances,
      {
        id: "conflict",
        speaker: "speaker_2",
        text: "My name is Dana Example.",
      },
    ],
  };
  assert.equal(extractConversation(conflicting).people.length, 0);
});
test("relative due hints do not invent timezone alarms; explicit ISO works", () => {
  const p = extractConversation(c).people[0];
  assert.equal(p.promises[0].alarmAt, null);
  assert.equal(p.promises[0].dueHint, "by Friday");
  const dated = {
    ...c,
    utterances: [
      ...c.utterances,
      {
        id: "iso",
        speaker: "speaker_1",
        text: "I'll send the notes by 2026-10-24T12:00:00+05:30.",
      },
    ],
  };
  assert.equal(
    extractConversation(dated).people[0].promises.at(-1)?.alarmAt,
    "2026-10-24T06:30:00.000Z",
  );
});
test("spoken due times need an explicit zone; tomorrow uses conversation date in that zone", () => {
  const withText = (text: string) =>
    extractConversation({
      ...c,
      utterances: [
        ...c.utterances,
        { id: "spoken", speaker: "speaker_1", text },
      ],
    }).people[0].promises.at(-1)!;
  assert.equal(
    withText("I'll send the notes tomorrow at 5 pm IST.").alarmAt,
    "2026-10-24T11:30:00.000Z",
  );
  assert.equal(
    withText("I'll send the notes on 2026-10-24 at 17:00 +05:30.").alarmAt,
    "2026-10-24T11:30:00.000Z",
  );
  assert.equal(withText("I'll send the notes tomorrow at 5 pm.").alarmAt, null);
  assert.equal(withText("I'll send the notes tomorrow.").dueHint, "tomorrow");
});
test("work-as role and organization are extracted from self-report", () => {
  const other = {
    ...c,
    utterances: [
      {
        id: "r1",
        speaker: "speaker_2",
        text: "My name is Dana Demo. I work as an engineer at Example Lab.",
      },
    ],
  };
  const p = extractConversation(other).people[0];
  assert.equal(p.details.find((d) => d.kind === "role")?.text, "engineer");
  assert.equal(p.details.find((d) => d.kind === "org")?.text, "Example Lab");
});
test("brief includes sources and no invented location", () => {
  const b = brief(extractConversation(c).people[0], fixtures);
  assert.ok(b.wordCount < 110);
  assert.ok(b.lines.every((l) => l.sources.length));
  assert.ok(
    !b.lines.find((l) => l.label === "Last met")?.text.includes("Mumbai"),
  );
});
test("Ask searches Bee first, quotes supported snippet, and abstains for no evidence", async () => {
  let called = false;
  const bee = fakeBee({
    search: async () => {
      called = true;
      return {
        results: [
          {
            conversation_id: "c1",
            snippet: "Priya discussed accessible onboarding.",
          },
        ],
      };
    },
  });
  const a = await ask("What did Priya discuss?", bee);
  assert.ok(called);
  assert.equal(a.method, "bee-search");
  assert.equal(a.sources[0].conversationId, "c1");
  assert.equal((await ask("Unicorns?", bee)).answer, "I don't have that.");
});
test("fixture Ask never calls Bee; uncited live content is not evidence", async () => {
  const bee = fakeBee({
    search: async () => {
      throw Error("must not call");
    },
  });
  assert.equal((await ask("Priya", bee, fixtures)).method, "fixture");
  assert.equal(
    (
      await ask(
        "Priya",
        fakeBee({ search: async () => ({ snippet: "Priya likes hikes" }) }),
      )
    ).sources.length,
    0,
  );
});
test("todo creation and completion are fixture-safe and keep live failures visible", async () => {
  let creates = 0,
    completes = 0;
  const bee = fakeBee({
    createTodo: async () => {
      creates++;
      return { todo: { id: "bee-1" } };
    },
    completeTodo: async () => {
      completes++;
      return {};
    },
  });
  const p = extractConversation(c).people[0].promises[0];
  await syncPromiseTodo(p, bee, true);
  assert.equal(creates, 0);
  const made = await syncPromiseTodo(p, bee, false);
  assert.equal(made.beeTodoId, "bee-1");
  assert.equal(creates, 1);
  const done = await setPromiseCompleted(made, true, bee, false);
  assert.equal(done.completed, true);
  assert.equal(completes, 1);
  const failed = await setPromiseCompleted(
    made,
    true,
    fakeBee({
      completeTodo: async () => {
        throw Error("offline");
      },
    }),
  );
  assert.equal(failed.completed, false);
  assert.ok(failed.syncError);
});
test("ambiguous creation failure never silently creates duplicates", async () => {
  let n = 0;
  const bee = fakeBee({
    createTodo: async () => {
      n++;
      throw Error("timeout");
    },
  });
  const p = extractConversation(c).people[0].promises[0];
  const failed = await syncPromiseTodo(p, bee);
  await syncPromiseTodo(failed, bee);
  assert.equal(n, 1);
});
