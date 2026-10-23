import { it } from "node:test";
import assert from "node:assert/strict";
import { BeeClient } from "../server/bee.js";

it("uses the documented todo REST contract without exposing credentials in errors", async () => {
  const original = globalThis.fetch;
  const requests: { url: string; init: RequestInit }[] = [];
  globalThis.fetch = async (url, init) => {
    requests.push({ url: String(url), init: init! });
    return new Response(JSON.stringify({ todo: { id: 7 } }), { status: 200 });
  };
  try {
    const bee = new BeeClient({ token: "invented-test-credential" });
    await bee.createTodo("Send the sample deck", "2026-10-24T04:30:00Z");
    await bee.completeTodo("7", true);
    assert.equal(requests[0].url, "http://127.0.0.1:8787/v1/todos");
    assert.equal(requests[0].init.method, "POST");
    assert.deepEqual(JSON.parse(requests[0].init.body as string), {
      text: "Send the sample deck",
      alarm_at: "2026-10-24T04:30:00Z",
    });
    assert.equal(requests[1].init.method, "PUT");
    assert.deepEqual(JSON.parse(requests[1].init.body as string), {
      completed: true,
    });
    globalThis.fetch = async () => {
      throw new Error("private payload invented-test-credential");
    };
    await assert.rejects(
      bee.createTodo("test"),
      (error) =>
        error instanceof Error &&
        !error.message.includes("invented-test-credential") &&
        !error.message.includes("private payload"),
    );
  } finally {
    globalThis.fetch = original;
  }
});
