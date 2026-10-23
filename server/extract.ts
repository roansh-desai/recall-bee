import { createHash } from "node:crypto";
import type {
  Conversation,
  Detail,
  ExtractionResult,
  Handle,
  Person,
  Source,
  Utterance,
} from "../shared/types.js";

const key = (...parts: string[]) =>
  createHash("sha256").update(parts.join("\0")).digest("hex").slice(0, 24);
const clean = (text: string) =>
  text
    .trim()
    .replace(/[.!?,;:]+$/, "")
    .trim();
function source(c: Conversation, u: Utterance): Source {
  return {
    conversationId: c.id,
    quote: u.text,
    speaker: u.speaker,
    ...(u.timestamp ? { timestamp: u.timestamp } : {}),
  };
}
function due(
  text: string,
  startedAt: string,
): { dueHint: string | null; alarmAt: string | null } {
  const iso = text.match(
    /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})\b/,
  )?.[0];
  if (iso && !Number.isNaN(Date.parse(iso)))
    return { dueHint: iso, alarmAt: new Date(iso).toISOString() };
  const dueHint =
    text
      .match(
        /\b(?:(?:by|before|on)\s+)?(?:tomorrow|today|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|\d{4}-\d{2}-\d{2})(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*(?:IST|UTC|GMT|[+-]\d{2}:\d{2})?)?/i,
      )?.[0]
      ?.trim() || null;
  const spoken = text.match(
    /\b(tomorrow|today|\d{4}-\d{2}-\d{2})\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s+(IST|UTC|GMT|[+-]\d{2}:\d{2})\b/i,
  );
  if (!spoken) return { dueHint, alarmAt: null };
  const [, day, h, m, meridiem, zone] = spoken;
  let hour = Number(h);
  const minute = Number(m || 0);
  if (minute > 59 || hour > 23 || (meridiem && (hour < 1 || hour > 12)))
    return { dueHint, alarmAt: null };
  if (meridiem) hour = (hour % 12) + (meridiem.toLowerCase() === "pm" ? 12 : 0);
  const offset =
    zone.toUpperCase() === "IST"
      ? 330
      : /^(UTC|GMT)$/i.test(zone)
        ? 0
        : (zone[0] === "-" ? -1 : 1) *
          (Number(zone.slice(1, 3)) * 60 + Number(zone.slice(4, 6)));
  if (
    Math.abs(offset) > 14 * 60 ||
    (/^[+-]/.test(zone) && Number(zone.slice(4, 6)) > 59)
  )
    return { dueHint, alarmAt: null };
  let date = day;
  if (/^(today|tomorrow)$/i.test(day)) {
    const anchor = Date.parse(startedAt);
    if (Number.isNaN(anchor)) return { dueHint, alarmAt: null };
    date = new Date(
      anchor +
        offset * 60_000 +
        (day.toLowerCase() === "tomorrow" ? 86_400_000 : 0),
    )
      .toISOString()
      .slice(0, 10);
  }
  const local = Date.parse(
    `${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00Z`,
  );
  if (
    Number.isNaN(local) ||
    new Date(local).toISOString().slice(0, 10) !== date
  )
    return { dueHint, alarmAt: null };
  return { dueHint, alarmAt: new Date(local - offset * 60_000).toISOString() };
}
function introducedName(text: string): string | null {
  const explicit = text.match(
    /\b(?:my name is|call me)\s+([\p{L}][\p{L}'’-]*(?:\s+[\p{L}][\p{L}'’-]*){0,3})/iu,
  );
  const casual = text.match(
    /\bI(?:'m| am|’m)\s+([A-Z][\p{L}'’-]*(?:\s+[A-Z][\p{L}'’-]*){0,2})(?=[,.!;]|\s+(?:and|from|at|a|an)\b|$)/u,
  );
  const value = (explicit?.[1] || casual?.[1])
    ?.split(/\s+(?:and|from|at|a|an|I|i|we|with)\b/)[0]
    .trim();
  if (
    !value ||
    /^(?:not\b|a\b|an\b|on\b|the\b)|^(?:happy|glad|working|going|here|designer|developer|engineer|student|sorry|sure|excited|fine|good|tomorrow|today|later)$/i.test(
      value,
    )
  )
    return null;
  return value;
}
function socialHandles(
  text: string,
): Array<{ platform: string; handle: string | null; url: string | null }> {
  const results: Array<{
    platform: string;
    handle: string | null;
    url: string | null;
  }> = [];
  const platforms = [
    ["Instagram", "instagram", "instagram.com"],
    ["LinkedIn", "linkedin", "linkedin.com"],
    ["GitHub", "github", "github.com"],
    ["X", "(?:twitter|\\bX\\b)", "x.com"],
  ] as const;
  for (const [platform, pattern, domain] of platforms) {
    const mention = new RegExp(pattern, "i").exec(text);
    const urlMatch = text.match(
      new RegExp(
        `https?:\\/\\/(?:www\\.)?${domain.replace(".", "\\.")}\\/[^\\s<>"']+`,
        "i",
      ),
    );
    if (!mention && !urlMatch) continue;
    if (urlMatch) {
      const url = clean(urlMatch[0]);
      results.push({ platform, handle: null, url });
      continue;
    }
    // Only accept a handle in the same clause after the platform name. Never infer it from a name.
    const tail = text
      .slice((mention?.index || 0) + (mention?.[0].length || 0))
      .split(/[;!\n]/)[0];
    const handle =
      tail.match(/(?:@)([A-Za-z0-9_.-]+)/)?.[1]?.replace(/[.]+$/, "") || null;
    let url = handle
      ? `https://${domain}/${platform === "LinkedIn" ? "in/" : ""}${encodeURIComponent(handle)}`
      : null;
    if (platform === "LinkedIn" && !handle) url = null;
    results.push({ platform, handle: handle ? `@${handle}` : null, url });
  }
  return results;
}
export function extractConversation(
  c: Conversation,
  existingPeople: Person[] = [],
): ExtractionResult {
  const identities = new Map<string, { name: string; u: Utterance }>();
  const conflicted = new Set<string>();
  for (const u of c.utterances) {
    const name = introducedName(u.text);
    if (!name || u.speaker === c.mySpeaker) continue;
    const previous = identities.get(u.speaker);
    if (previous && previous.name.toLowerCase() !== name.toLowerCase()) {
      conflicted.add(u.speaker);
      continue;
    }
    identities.set(u.speaker, previous || { name, u });
  }
  // A changing identity behind one generic speaker label is ambiguous. Do not assign claims to it.
  for (const speaker of conflicted) identities.delete(speaker);
  const people: Person[] = [...identities.entries()].map(
    ([speaker, { name, u }]) => ({
      id: key("person", c.id, speaker, name.toLowerCase()),
      name,
      lastSeen: c.startedAt,
      createdAt: c.startedAt,
      nameSource: source(c, u),
      details: [],
      handles: [],
      promises: [],
      conversationIds: [c.id],
      isFixture: c.isFixture,
    }),
  );
  const bySpeaker = new Map(
    [...identities.keys()].map((speaker, i) => [speaker, people[i]]),
  );
  for (const u of c.utterances) {
    const person = bySpeaker.get(u.speaker);
    if (person) {
      const add = (kind: Detail["kind"], text: string) => {
        if (text.trim())
          person.details.push({
            id: key("detail", c.id, u.id, kind, text),
            personId: person.id,
            kind,
            text: clean(text),
            source: source(c, u),
          });
      };
      for (const sentence of u.text.split(/(?<=[.!?])\s+/)) {
        const role = sentence.match(
          /\b(?:I(?:'m| am|’m)\s+(?:a|an)|I work as(?: an?)?)\s+(.+?)(?:\s+at\s+|[.!]|$)/i,
        );
        if (role) add("role", role[1]);
        const org = sentence.match(
          /\b(?:I work (?:at|for)|I(?:'m| am|’m) (?:a|an) .+? at|I work as .+? at)\s+(.+?)(?:[.!]|$)/i,
        );
        if (org) add("org", org[1]);
        const topic = sentence.match(
          /\b(?:we (?:talked|spoke) about|we discussed|let(?:'s| us) discuss)\s+(.+?)(?:[.!]|$)/i,
        );
        if (topic) add("topic", topic[1]);
        const self = sentence.match(
          /\bI (?:like|love|enjoy|am building|(?:'m|’m) building|am working on|study|care about)\s+(.+?)(?:[.!]|$)/i,
        );
        if (self) add("self", sentence);
        const met = sentence.match(
          /\b(?:we met|we first met)\s+(.+?)(?:[.!]|$)/i,
        );
        if (met) add("met", met[1]);
      }
      for (const h of socialHandles(u.text))
        person.handles.push({
          id: key("handle", c.id, u.id, h.platform),
          personId: person.id,
          ...h,
          source: source(c, u),
        });
    }
    if (
      !/\b(?:I(?:'ll| will|’ll)|I promise to|I owe you|let me)\s+/i.test(u.text)
    )
      continue;
    // Promise attribution requires a self-introduced speaker, or the explicitly chosen wearer.
    let target = person;
    if (u.speaker === c.mySpeaker) {
      const addressed = people.filter((p) =>
        new RegExp(
          `\\b${p.name.split(" ")[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
          "i",
        ).test(u.text),
      );
      target =
        addressed.length === 1
          ? addressed[0]
          : people.length === 1
            ? people[0]
            : undefined;
    }
    if (!target) continue;
    const promiseText = u.text.match(
      /\b(?:I(?:'ll| will|’ll)|I promise to|I owe you|let me)\s+(.+)/i,
    )?.[1];
    if (!promiseText || /^(?:be|go|see|have|think|try)\b/i.test(promiseText))
      continue;
    // Alarm parsing requires a date and time with an explicit supported timezone; never guess a zone.
    const { dueHint, alarmAt } = due(u.text, c.startedAt);
    target.promises.push({
      id: key("promise", c.id, u.id),
      personId: target.id,
      personName: target.name,
      direction: c.mySpeaker
        ? u.speaker === c.mySpeaker
          ? "i_owe"
          : "they_owe"
        : "unknown",
      text: clean(promiseText),
      dueHint,
      alarmAt,
      completed: false,
      beeTodoId: null,
      syncError: null,
      source: source(c, u),
    });
  }
  const mergeCandidates: ExtractionResult["mergeCandidates"] = [];
  for (const p of people)
    for (const other of existingPeople) {
      if (p.id === other.id || other.conversationIds.includes(c.id)) continue;
      const sameName =
        p.name.toLocaleLowerCase() === other.name.toLocaleLowerCase();
      const sameHandle = p.handles.some(
        (h) =>
          h.url &&
          other.handles.some(
            (o) => o.platform === h.platform && o.url === h.url,
          ),
      );
      if (sameName || sameHandle) {
        const pair = [p.id, other.id].sort();
        mergeCandidates.push({
          id: key("merge", ...pair),
          personA: other.id,
          personB: p.id,
          reason: sameHandle
            ? "Same explicitly spoken social link; confirm identity."
            : "Same transcribed name in different conversations; confirm identity.",
          status: "pending",
        });
      }
    }
  return { people, mergeCandidates };
}
