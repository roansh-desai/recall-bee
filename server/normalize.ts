import type { Conversation, Utterance } from "../shared/types.js";
export type JsonObject = Record<string, unknown>;
export function object(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}
function string(value: unknown): string | undefined {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : typeof value === "number"
      ? String(value)
      : undefined;
}
export function dateString(value: unknown): string | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d{10,13}(\.\d+)?$/.test(value)
        ? Number(value)
        : undefined;
  // A small number may be a relative offset, not an epoch timestamp. Do not invent a date.
  if (
    numeric !== undefined &&
    (!Number.isFinite(numeric) || numeric < 1_000_000_000)
  )
    return undefined;
  const input =
    numeric !== undefined
      ? numeric < 100_000_000_000
        ? numeric * 1000
        : numeric
      : String(value);
  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}
export function conversationId(value: unknown): string | undefined {
  const row = object(value);
  return string(
    row.id ??
      row.conversation_id ??
      row.conversationId ??
      row.uuid ??
      row.conversation_uuid,
  );
}
export function conversationPage(value: unknown): {
  items: unknown[];
  nextCursor?: string;
} {
  if (Array.isArray(value)) return { items: value };
  const outer = object(value);
  const row = Object.keys(object(outer.data)).length
    ? object(outer.data)
    : outer;
  const items = [row.conversations, row.items, row.results, row.data].find(
    Array.isArray,
  ) as unknown[] | undefined;
  const pagination = object(row.pagination);
  if (!items) throw new Error("Unrecognized Bee conversation list response.");
  return {
    items,
    nextCursor: string(
      row.next_cursor ??
        row.nextCursor ??
        pagination.next_cursor ??
        pagination.nextCursor,
    ),
  };
}
function transcriptRows(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const row = object(value);
  if (Array.isArray(row.transcriptions))
    return row.transcriptions.flatMap(transcriptRows);
  for (const key of ["utterances", "transcript", "segments", "data"]) {
    if (Array.isArray(row[key])) return row[key] as unknown[];
    if (row[key] && typeof row[key] === "object") {
      const nested = transcriptRows(row[key]);
      if (nested.length) return nested;
    }
  }
  if (row.conversation) return transcriptRows(row.conversation);
  return [];
}
export function normalizeConversation(
  raw: unknown,
  transcript?: unknown,
  fallbackId?: string,
): Conversation {
  const outer = object(raw);
  const row = object(outer.conversation ?? outer.data ?? raw);
  const id = conversationId(row) ?? fallbackId;
  if (!id) throw new Error("Bee conversation response has no id.");
  const rows = transcriptRows(transcript);
  const utterances: Utterance[] = (
    rows.length ? rows : transcriptRows(row)
  ).flatMap((value, index) => {
    const entry = object(value);
    const text = string(entry.text ?? entry.content);
    if (!text) return [];
    const speaker =
      string(entry.speaker ?? entry.speaker_id ?? entry.speakerId) ?? "unknown";
    // spoken_at is the actual live transcript field; created_at is processing time.
    // Relative start/end offsets are not wall-clock timestamps.
    const timestamp = dateString(
      entry.spoken_at ??
        entry.spokenAt ??
        entry.timestamp ??
        entry.start_time ??
        entry.startTime,
    );
    return [
      {
        id: string(entry.id ?? entry.uuid) ?? `${id}:${index}`,
        speaker,
        text,
        ...(timestamp ? { timestamp } : {}),
      },
    ];
  });
  const startedAt =
    dateString(
      row.start_time ??
        row.startTime ??
        row.started_at ??
        row.startedAt ??
        row.created_at ??
        row.createdAt,
    ) ??
    utterances[0]?.timestamp ??
    "";
  const updatedAt =
    dateString(
      row.updated_at ?? row.updatedAt ?? row.end_time ?? row.endTime,
    ) ?? startedAt;
  const place = object(row.location);
  return {
    id,
    title: string(row.title) ?? "Untitled conversation",
    startedAt,
    updatedAt,
    mySpeaker: null,
    location: string(place.name) ?? null,
    utterances,
    isFixture: false,
  };
}
export interface StreamShape {
  kind: string;
  conversationId?: string;
  location?: string;
}
/** Raw CLI JSON deliberately does not include the SSE event name. Do not invent one. */
export function streamShape(raw: unknown): StreamShape | null {
  const row = object(raw);
  if (row.conversation)
    return {
      kind: "conversation update",
      conversationId: conversationId(row.conversation),
    };
  if (row.location && row.conversation_id !== undefined)
    return {
      kind: "location update",
      conversationId: string(row.conversation_id),
      location: string(object(row.location).name),
    };
  if (row.short_summary !== undefined && row.conversation_id !== undefined)
    return {
      kind: "summary update",
      conversationId: string(row.conversation_id),
    };
  if (row.utterance)
    return {
      kind: "utterance received",
      conversationId: string(row.conversation_uuid),
    };
  if (row.connected === true || row.status === "connected")
    return { kind: "connected" };
  // Observed live payload proves the stream delivered data, but is not proof
  // of a new conversation. Do not invent a more specific SSE event name.
  if (Object.keys(row).length === 1 && typeof row.timestamp === "number")
    return { kind: "stream signal" };
  return null;
}
