import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  conversationPage,
  normalizeConversation,
  streamShape,
} from "../server/normalize.js";
describe("Bee normalization", () => {
  it("uses raw stream payload structural keys, not an invented event field", () => {
    assert.deepEqual(
      streamShape({ conversation: { id: 42, state: "processed" } }),
      { kind: "conversation update", conversationId: "42" },
    );
    assert.deepEqual(
      streamShape({ conversation_id: 42, short_summary: "Private words" }),
      { kind: "summary update", conversationId: "42" },
    );
    assert.equal(streamShape({ event: "new-conversation" }), null);
  });
  it("does not infer wearer, location, timestamps or names from labels", () => {
    const c = normalizeConversation({
      id: 42,
      utterances: [{ speaker: "speaker_1", text: "Hello" }],
    });
    assert.equal(c.mySpeaker, null);
    assert.equal(c.startedAt, "");
    assert.equal(c.location, null);
    assert.equal(c.utterances[0].timestamp, undefined);
    assert.equal(c.utterances[0].speaker, "speaker_1");
    const offset = normalizeConversation({
      id: 42,
      utterances: [{ speaker: "speaker_1", text: "Hello", startTime: 12 }],
    });
    assert.equal(offset.utterances[0].timestamp, undefined);
  });
  it("normalizes wrappers and epoch milliseconds without dropping transcript", () => {
    const c = normalizeConversation(
      { conversation: { id: 4, start_time: 1792778400000 } },
      {
        utterances: [
          {
            id: 8,
            text: "I am Alex Example.",
            speaker: "speaker_2",
            timestamp: 1792778400000,
          },
        ],
      },
    );
    assert.equal(c.id, "4");
    assert.equal(c.utterances[0].id, "8");
    assert.equal(
      c.utterances[0].timestamp,
      new Date(1792778400000).toISOString(),
    );
    assert.equal(c.isFixture, false);
  });
  it("keeps pagination cursors for complete backfill", () => {
    assert.deepEqual(
      conversationPage({
        data: { conversations: [{ id: 1 }], next_cursor: "page2" },
      }),
      { items: [{ id: 1 }], nextCursor: "page2" },
    );
  });
  it("handles the live transcription nesting and uses spoken time, not processing time", () => {
    const spoken = 1792778400000;
    const c = normalizeConversation({
      conversation: {
        id: 17,
        transcriptions: [
          {
            utterances: [
              {
                id: 9,
                text: "Invented test",
                speaker: "0",
                start: 1.2,
                spoken_at: spoken,
                created_at: spoken + 5000,
              },
            ],
          },
        ],
      },
    });
    assert.equal(c.utterances.length, 1);
    assert.equal(c.utterances[0].timestamp, new Date(spoken).toISOString());
    assert.equal(c.mySpeaker, null);
    const noTime = normalizeConversation({
      id: 18,
      utterances: [{ text: "Invented test", created_at: spoken, start: 1.2 }],
    });
    assert.equal(noTime.utterances[0].timestamp, undefined);
  });
  it("keeps timestamp-only stream signals distinct from conversation updates", () => {
    assert.deepEqual(streamShape({ timestamp: 1792778400000 }), {
      kind: "stream signal",
    });
  });
});
