import type {
  Brief,
  BriefLine,
  Conversation,
  Person,
  Source,
} from "../shared/types.js";

const clip = (s: string, n = 12) => {
  const w = s.split(/\s+/);
  return w.length > n ? w.slice(0, n).join(" ") + "…" : s;
};
export function brief(person: Person, conversations: Conversation[]): Brief {
  const lines: BriefLine[] = [];
  const add = (label: string, text: string, sources: Source[]) =>
    lines.push({ label, text, sources });
  const role = person.details.find((d) => d.kind === "role"),
    org = person.details.find((d) => d.kind === "org");
  add(
    "Who",
    role
      ? `${person.name} · ${clip(role.text, 7)}${org ? ` at ${clip(org.text, 5)}` : ""}`
      : "Introduced themselves in a conversation.",
    [role?.source || person.nameSource, ...(org ? [org.source] : [])],
  );
  const last = conversations
    .filter((c) => person.conversationIds.includes(c.id))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
  if (last) {
    const citation = [
      person.nameSource,
      ...person.details.map((d) => d.source),
      ...person.handles.map((h) => h.source),
      ...person.promises.map((p) => p.source),
    ].find((s) => s.conversationId === last.id);
    const introduction = last.utterances.find((u) =>
      u.text.toLocaleLowerCase().includes(person.name.toLocaleLowerCase()),
    );
    const lastSource =
      citation ||
      (introduction
        ? {
            conversationId: last.id,
            quote: introduction.text,
            speaker: introduction.speaker,
            ...(introduction.timestamp
              ? { timestamp: introduction.timestamp }
              : {}),
          }
        : null);
    if (lastSource)
      add(
        "Last met",
        `Last conversation on ${last.startedAt.slice(0, 10)}${last.location ? ` · ${clip(last.location, 6)}` : ""}`,
        [lastSource],
      );
  }
  const met = person.details.find((d) => d.kind === "met");
  if (met) add("Context", `You met ${clip(met.text, 8)}.`, [met.source]);
  const discussed = person.details
    .filter((d) => ["topic", "self"].includes(d.kind))
    .slice(0, 3);
  for (const d of discussed)
    add(
      "Discussed",
      d.kind === "topic"
        ? `The conversation covered ${clip(d.text, 10)}.`
        : `They said: “${clip(d.text, 12)}.”`,
      [d.source],
    );
  for (const direction of ["i_owe", "they_owe", "unknown"] as const) {
    const promises = person.promises.filter(
      (p) => p.direction === direction && !p.completed,
    );
    if (promises.length)
      add(
        direction === "i_owe"
          ? "I owe"
          : direction === "they_owe"
            ? "They owe me"
            : "Confirm speaker",
        clip(promises[0].text, 12) +
          (promises.length > 1 ? ` (+${promises.length - 1} more)` : ""),
        [promises[0].source],
      );
  }
  for (const h of person.handles.slice(0, 2))
    add(
      h.platform,
      h.handle || h.url || `Mentioned ${h.platform}; no handle given.`,
      [h.source],
    );
  const opener = discussed.find((d) => d.kind !== "met");
  if (opener)
    add(
      "Suggested opener",
      `“How is ${clip(opener.text.replace(/^I (?:am building|like|love|enjoy) /i, ""), 7)} going?”`,
      [opener.source],
    );
  return {
    personId: person.id,
    name: person.name,
    lines,
    wordCount: lines.reduce((n, l) => n + l.text.split(/\s+/).length, 0),
    isFixture: person.isFixture,
  };
}
