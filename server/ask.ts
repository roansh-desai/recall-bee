import type {
  AskAnswer,
  BeeClientContract,
  Conversation,
  Source,
} from "../shared/types.js";

const stop = new Set(
  "who is what did does do i you me we they them their his her a an the about tell know said say have has was were to for of it on in with and my".split(
    " ",
  ),
);
const words = (s: string) =>
  s
    .toLowerCase()
    .match(/[\p{L}\p{N}_]+/gu)
    ?.filter((w) => w.length > 1 && !stop.has(w)) || [];
export function searchSources(value: unknown): Source[] {
  const found: Source[] = [];
  const visit = (v: unknown, parentId?: string, depth = 0) => {
    if (depth > 8 || !v || typeof v !== "object") return;
    if (Array.isArray(v)) {
      for (const x of v) visit(x, parentId, depth + 1);
      return;
    }
    const r = v as Record<string, unknown>;
    const rawId = [
      r.conversation_uuid,
      r.conversation_id,
      r.conversationId,
      parentId,
    ].find((x) => typeof x === "string" || typeof x === "number");
    const cid = rawId === undefined ? undefined : String(rawId);
    const nestedId =
      cid ||
      ((typeof r.id === "string" || typeof r.id === "number") &&
      (r.type === "conversation" || r.kind === "conversation")
        ? String(r.id)
        : undefined);
    const quote = [r.quote, r.snippet, r.text, r.content, r.summary].find(
      (x) => typeof x === "string" && x.trim(),
    ) as string | undefined;
    if (nestedId && quote)
      found.push({
        conversationId: nestedId,
        quote,
        ...(typeof r.speaker === "string" ? { speaker: r.speaker } : {}),
      });
    for (const [k, x] of Object.entries(r))
      if (x && typeof x === "object")
        visit(
          x,
          nestedId ||
            (k === "conversations" && typeof r.id === "string"
              ? r.id
              : undefined),
          depth + 1,
        );
  };
  visit(value);
  return found;
}
export async function ask(
  query: string,
  bee: BeeClientContract,
  fixtureConversations?: Conversation[],
  excludedConversationIds: ReadonlySet<string> = new Set(),
): Promise<AskAnswer> {
  const terms = words(query);
  if (!terms.length)
    return {
      answer: "I don't have that.",
      sources: [],
      method: fixtureConversations ? "fixture" : "unavailable",
    };
  let sources: Source[] = [];
  if (fixtureConversations) {
    sources = fixtureConversations.flatMap((c) =>
      c.utterances.map((u) => ({
        conversationId: c.id,
        quote: u.text,
        speaker: u.speaker,
        ...(u.timestamp ? { timestamp: u.timestamp } : {}),
      })),
    );
  } else {
    try {
      sources = searchSources(await bee.search(query));
    } catch {
      return {
        answer: "I don't have that. Bee search is unavailable.",
        sources: [],
        method: "unavailable",
        error: "Check Bee login and connection.",
      };
    }
  }
  const scored = sources
    .filter((s) => !excludedConversationIds.has(s.conversationId))
    .map((s) => ({
      s,
      score: terms.filter((t) => words(s.quote).includes(t)).length,
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  if (!scored.length)
    return {
      answer: "I don't have that.",
      sources: [],
      method: fixtureConversations ? "fixture" : "bee-search",
    };
  // Return retrieved words verbatim; no generated factual claims or person inference.
  const selected = scored.slice(0, 3).map((x) => x.s);
  return {
    answer: selected.map((s) => `“${s.quote}”`).join("\n\n"),
    sources: selected,
    method: fixtureConversations ? "fixture" : "bee-search",
  };
}
