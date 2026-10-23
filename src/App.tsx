import React, { useCallback, useEffect, useRef, useState } from "react";
import { animate, motion, useReducedMotion } from "motion/react";
import type {
  AskAnswer,
  Brief,
  Conversation,
  Person,
  PromiseItem,
  Snapshot,
  Source,
} from "../shared/types";

const ease = [0.16, 1, 0.3, 1] as const;
import icon0 from "../node_modules/@phosphor-icons/core/assets/regular/arrow-up-right.svg?url";
import icon1 from "../node_modules/@phosphor-icons/core/assets/regular/arrow-right.svg?url";
import icon2 from "../node_modules/@phosphor-icons/core/assets/regular/instagram-logo.svg?url";
import icon3 from "../node_modules/@phosphor-icons/core/assets/regular/linkedin-logo.svg?url";
import icon4 from "../node_modules/@phosphor-icons/core/assets/regular/link.svg?url";
import icon5 from "../node_modules/@phosphor-icons/core/assets/regular/check.svg?url";
import icon6 from "../node_modules/@phosphor-icons/core/assets/regular/arrow-clockwise.svg?url";
import icon7 from "../node_modules/@phosphor-icons/core/assets/regular/magnifying-glass.svg?url";
import icon8 from "../node_modules/@phosphor-icons/core/assets/regular/lock-simple.svg?url";
import icon9 from "../node_modules/@phosphor-icons/core/assets/regular/export.svg?url";
import icon10 from "../node_modules/@phosphor-icons/core/assets/regular/trash.svg?url";
const iconFiles: Record<string, string> = {
  "arrow-up-right": icon0,
  "arrow-right": icon1,
  "instagram-logo": icon2,
  "linkedin-logo": icon3,
  link: icon4,
  check: icon5,
  "arrow-clockwise": icon6,
  "magnifying-glass": icon7,
  "lock-simple": icon8,
  export: icon9,
  trash: icon10,
};
function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="icon"
      style={{
        width: size,
        height: size,
        maskImage: `url("${iconFiles[name]}")`,
      }}
    />
  );
}
async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const r = await fetch(`/api${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Could not complete that action.");
  return data;
}
const date = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Not recorded";
const time = (value: string | null) =>
  value
    ? new Date(value).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Not synced";
const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0])
    .join("");

function Ambient() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current!;
    const media = matchMedia("(hover: hover) and (pointer: fine)");
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0,
      slow = 0,
      last = 0,
      disabled = false;
    let x = innerWidth * 0.65,
      y = innerHeight * 0.15,
      tx = x,
      ty = y;
    const reset = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      el.style.transform = "translate(0px, 0px)";
    };
    const tick = (now: number) => {
      frame = 0;
      if (document.hidden || disabled || !media.matches || reduced.matches)
        return;
      if (last && now - last > 32) slow++;
      else slow = 0;
      last = now;
      if (slow >= 30) {
        disabled = true;
        reset();
        return;
      }
      x += (tx - x) * 0.075;
      y += (ty - y) * 0.075;
      el.style.setProperty("--mx", `${x - innerWidth * 0.65}px`);
      el.style.setProperty("--my", `${y - innerHeight * 0.15}px`);
      el.style.transform = "translate(var(--mx), var(--my))";
      if (Math.abs(tx - x) + Math.abs(ty - y) > 0.2)
        frame = requestAnimationFrame(tick);
    };
    const pointer = (event: PointerEvent) => {
      if (!media.matches || reduced.matches || disabled || document.hidden)
        return;
      tx = event.clientX;
      ty = event.clientY;
      if (!frame) {
        last = 0;
        frame = requestAnimationFrame(tick);
      }
    };
    const visibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(frame);
        frame = 0;
      } else last = 0;
    };
    const preference = () => {
      if (reduced.matches || !media.matches) reset();
    };
    window.addEventListener("pointermove", pointer, { passive: true });
    document.addEventListener("visibilitychange", visibility);
    media.addEventListener("change", preference);
    reduced.addEventListener("change", preference);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", pointer);
      document.removeEventListener("visibilitychange", visibility);
      media.removeEventListener("change", preference);
      reduced.removeEventListener("change", preference);
    };
  }, []);
  return (
    <div className="ambient" aria-hidden="true">
      <div ref={ref} className="ambient-light" />
    </div>
  );
}
function Count({ value }: { value: number }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const from = prev.current;
    prev.current = value;
    if (reduced || from === value) {
      setShown(value);
      return;
    }
    const controls = animate(from, value, {
      duration: 0.55,
      ease,
      onUpdate: (v) => setShown(Math.round(v)),
    });
    return () => controls.stop();
  }, [value, reduced]);
  return <span className="count">{shown}</span>;
}
function SourceQuote({
  source,
  expanded = false,
}: {
  source: Source;
  expanded?: boolean;
}) {
  return (
    <details className="source" open={expanded}>
      <summary>
        Source · {source.timestamp ? time(source.timestamp) : "conversation"}{" "}
        <Icon name="arrow-up-right" size={12} />
      </summary>
      <blockquote>“{source.quote}”</blockquote>
      <span className="source-id">
        {source.conversationId}
        {source.speaker ? ` · ${source.speaker}` : ""}
      </span>
    </details>
  );
}
function Empty({
  title = "No conversations yet",
  text = "Record a consented conversation near your Bee. Recall will pick it up here.",
}: {
  title?: string;
  text?: string;
}) {
  return (
    <div className="empty">
      <span className="label">{title}</span>
      <p>{text}</p>
    </div>
  );
}
function Handles({ person }: { person: Person }) {
  return (
    <div className="handles">
      {person.handles.map((h) => (
        <div key={h.id} className="handle">
          {h.url && /^https?:\/\//i.test(h.url) ? (
            <a href={h.url} target="_blank" rel="noreferrer">
              <Icon
                name={
                  h.platform.toLowerCase().includes("instagram")
                    ? "instagram-logo"
                    : h.platform.toLowerCase().includes("linkedin")
                      ? "linkedin-logo"
                      : "link"
                }
              />
              {h.handle || h.platform}
              <Icon name="arrow-up-right" size={13} />
            </a>
          ) : (
            <span>
              Mentioned {h.platform}
              {h.handle ? ` · ${h.handle}` : ""}
            </span>
          )}
          <SourceQuote source={h.source} />
        </div>
      ))}
    </div>
  );
}
function PromiseRow({
  promise,
  onToggle,
  busy,
}: {
  promise: PromiseItem;
  onToggle: (p: PromiseItem) => void;
  busy: boolean;
}) {
  return (
    <article className={`promise ${promise.completed ? "completed" : ""}`}>
      <label className="promise-main">
        <input
          type="checkbox"
          checked={promise.completed}
          disabled={busy}
          onChange={() => onToggle(promise)}
        />
        <span>{promise.text}</span>
      </label>
      <div className="promise-meta">
        <span>{promise.personName}</span>
        {promise.dueHint && <span>Due: {promise.dueHint}</span>}
        {promise.beeTodoId && (
          <span>Bee todo {promise.completed ? "complete" : "linked"}</span>
        )}
      </div>
      <SourceQuote source={promise.source} expanded />
      {promise.syncError && <p className="small muted">{promise.syncError}</p>}
    </article>
  );
}
function SpeakerSetting({
  conversation,
  onChange,
}: {
  conversation: Conversation;
  onChange: (id: string, speaker: string) => void;
}) {
  const speakers = [...new Set(conversation.utterances.map((u) => u.speaker))];
  const identifiable = speakers.some((s) => !/^unknown$/i.test(s.trim()));
  return (
    <div className="speaker-setting">
      <div>
        <span className="label">{date(conversation.startedAt)}</span>
        <h4>{conversation.title || "Conversation"}</h4>
        <p className="small muted">
          Choose your label using the quotes. Bee does not identify people by
          voice.
        </p>
      </div>
      <label className="label">
        Which speaker is me?
        <select
          disabled={!identifiable}
          value={conversation.mySpeaker || ""}
          onChange={(e) => {
            if (e.target.value && !/^unknown$/i.test(e.target.value.trim()))
              onChange(conversation.id, e.target.value);
          }}
        >
          <option value="">Not set — choose your speaker</option>
          {speakers.map((s) => (
            <option key={s} value={s} disabled={/^unknown$/i.test(s.trim())}>
              {s}
            </option>
          ))}
        </select>
      </label>
      {!identifiable && (
        <p className="small muted speaker-warning">
          Bee has not separated speakers in this recording. Promise direction
          stays unconfirmed.
        </p>
      )}
      <div className="speaker-quotes">
        {speakers.map((s) => (
          <p key={s}>
            <span className="label">{s}</span> “
            {conversation.utterances.find((u) => u.speaker === s)?.text}”
          </p>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [state, setState] = useState<Snapshot | null>(null);
  const [loadError, setLoadError] = useState("");
  const [page, setPage] = useState<"people" | "promises" | "privacy">("people");
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [brief, setBrief] = useState<Brief | null>(null);
  const [searchMessage, setSearchMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [askQuery, setAskQuery] = useState("");
  const [answer, setAnswer] = useState<AskAnswer | null>(null);
  const [rename, setRename] = useState("");
  const [scroll, setScroll] = useState(false);
  const [preMeeting, setPreMeeting] = useState(false);
  const lastSync = useRef<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduced = useReducedMotion();
  const briefRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (brief)
      requestAnimationFrame(() =>
        briefRef.current?.scrollIntoView({
          behavior: reduced ? "auto" : "smooth",
          block: "start",
        }),
      );
  }, [brief, reduced]);
  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4000);
  }, []);
  const refresh = useCallback(async () => {
    try {
      const next = await api<Snapshot>("/state");
      setState(next);
      setLoadError("");
      if (
        lastSync.current &&
        next.status.lastSyncAt &&
        next.status.lastSyncAt !== lastSync.current
      )
        notify("Conversation sync complete");
      lastSync.current = next.status.lastSyncAt;
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, [notify]);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 3000);
    const onScroll = () => setScroll(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearInterval(timer);
      window.removeEventListener("scroll", onScroll);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [refresh]);
  const mutate = async (
    path: string,
    method: string,
    body: unknown,
    message: string,
  ) => {
    setBusy(true);
    try {
      await api(path, method, body);
      await refresh();
      notify(message);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const openPerson = (person: Person) => {
    setSelected(person.id);
    setRename(person.name);
    setBrief(null);
    setPage("people");
  };
  const lookup = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!state || !query.trim()) return;
    setBusy(true);
    setBrief(null);
    setSelected(null);
    setSearchMessage("");
    try {
      const name = query
        .replace(/^who\s+is\s+/i, "")
        .replace(/\?$/, "")
        .trim()
        .toLowerCase();
      const matches = state.people.filter((p) =>
        p.name.toLowerCase().includes(name),
      );
      if (matches.length === 1) {
        setBrief(
          await api<Brief>(
            `/people/${encodeURIComponent(matches[0].id)}/brief`,
          ),
        );
      } else if (matches.length > 1) {
        setFilter(name);
        setSearchMessage(
          "More than one person matches. Choose a person below.",
        );
      } else
        setSearchMessage(
          "I don't have that. Try a name from your people below.",
        );
    } catch (e) {
      setSearchMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const toggle = (p: PromiseItem) =>
    void mutate(
      `/promises/${encodeURIComponent(p.id)}`,
      "PUT",
      { completed: !p.completed },
      p.completed ? "Promise reopened" : "Promise updated",
    );
  const forget = async (person: Person) => {
    if (
      !window.confirm(
        `Forget ${person.name}? Recall will delete every stored conversation containing this person and all details derived from those conversations, including shared details. This cannot be undone. Bee originals and Bee todos remain in Bee.`,
      )
    )
      return;
    await mutate(
      `/people/${encodeURIComponent(person.id)}`,
      "DELETE",
      undefined,
      "Person and source conversations forgotten",
    );
    setSelected(null);
    setBrief(null);
  };
  const person = state?.people.find((p) => p.id === selected);
  const visiblePeople =
    state?.people.filter((p) =>
      `${p.name} ${p.details.map((d) => d.text).join(" ")}`
        .toLowerCase()
        .includes(filter.toLowerCase()),
    ) || [];
  const isLive =
    state?.status.mode === "live" &&
    state.status.connected &&
    state.status.streamConnected;
  return (
    <>
      <Ambient />
      <header className={`topbar ${scroll ? "scrolled" : ""}`}>
        <div className="topbar-inner">
          <a
            className="wordmark"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setPage("people");
              setSelected(null);
              setBrief(null);
            }}
          >
            recall<span className="wordmark-period">.</span>
          </a>
          <nav aria-label="Main navigation">
            <button
              className={page === "people" ? "active" : ""}
              onClick={() => setPage("people")}
            >
              People {state && <Count value={state.people.length} />}
            </button>
            <button
              className={page === "promises" ? "active" : ""}
              onClick={() => setPage("promises")}
            >
              Promises {state && <Count value={state.status.openPromises} />}
            </button>
            <button
              className={page === "privacy" ? "active" : ""}
              onClick={() => setPage("privacy")}
            >
              Privacy
            </button>
            <button
              aria-label="Sync"
              className="sync-button"
              disabled={busy}
              onClick={() => void mutate("/sync", "POST", {}, "Sync requested")}
            >
              <Icon name="arrow-clockwise" size={15} />
              <span>Sync</span>
            </button>
          </nav>
          <div className={`live-badge ${isLive ? "live" : ""}`}>
            <span className="status-dot" />
            <span>
              {state?.status.mode === "fixture"
                ? "FAKE FIXTURE"
                : isLive
                  ? "CONNECTED TO BEE"
                  : "BEE NOT CONNECTED"}
            </span>
            <span className="badge-time">
              {time(state?.status.lastSyncAt || null)}
            </span>
          </div>
        </div>
      </header>
      <main>
        <div className="workspace-bar">
          <span className="label">Your people. Remembered.</span>
          <span className="label local">
            <Icon name="lock-simple" size={13} /> Local memory
          </span>
        </div>
        {loadError && (
          <div className="notice" role="alert">
            Cannot reach the local Recall server. Start it with{" "}
            <code>npm run dev</code>. {loadError}
          </div>
        )}
        {state?.status.error && (
          <div className="notice">{state.status.error}</div>
        )}
        {state?.status.mode === "fixture" && (
          <p className="fixture-note label">
            Invented people · local fixture · no live Bee data
          </p>
        )}
        {!state ? (
          <div className="loading" aria-busy="true">
            <span className="label">Opening your local memory…</span>
          </div>
        ) : (
          <>
            {page === "people" && (
              <>
                <section className="hero">
                  <div className="hero-top">
                    <span className="label">
                      {preMeeting
                        ? "Before you meet again"
                        : "A little context goes a long way"}
                    </span>
                    <button
                      className={`text-button ${preMeeting ? "selected" : ""}`}
                      onClick={() => setPreMeeting(!preMeeting)}
                    >
                      Pre-meeting {preMeeting ? "on" : "brief"}{" "}
                      <Icon name="arrow-up-right" size={13} />
                    </button>
                  </div>
                  <div className="hero-question" aria-hidden="true">
                    who is
                  </div>
                  <form className="hero-search" onSubmit={lookup}>
                    <label className="sr-only" htmlFor="who">
                      Who is…?
                    </label>
                    <input
                      id="who"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="…?"
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <button
                      className="search-submit"
                      type="submit"
                      aria-label="Find person brief"
                      disabled={busy || !query.trim()}
                    >
                      <Icon name="arrow-right" size={30} />
                    </button>
                  </form>
                  <div className="hero-bottom">
                    <p>
                      {preMeeting
                        ? "Walk in with the details that matter."
                        : "Names fade. The conversation doesn’t have to."}
                    </p>
                    <span className="label">A brief, with receipts.</span>
                  </div>
                  {searchMessage && (
                    <p className="search-message" role="status">
                      {searchMessage}
                    </p>
                  )}
                </section>
                {brief && (
                  <motion.section
                    ref={briefRef}
                    className="brief-card"
                    key={`${brief.personId}-${preMeeting}`}
                    initial={
                      reduced
                        ? false
                        : { opacity: 0, filter: "blur(8px)", y: 8 }
                    }
                    animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
                    transition={{ duration: 0.9, ease }}
                    aria-label="Person brief"
                  >
                    <div className="section-top">
                      <span className="label">
                        {preMeeting
                          ? "Your pre-meeting brief"
                          : "Back in context"}
                      </span>
                      <span className="label">
                        {brief.wordCount} words · sourced
                      </span>
                    </div>
                    <h1>{brief.name}</h1>
                    {/^unknown$/i.test(
                      state.people
                        .find((p) => p.id === brief.personId)
                        ?.nameSource.speaker?.trim() || "",
                    ) && (
                      <p className="attribution-note">
                        Speaker attribution is unconfirmed. Bee labeled these
                        quotes Unknown; review the details before using them.
                      </p>
                    )}
                    <div className="brief-lines">
                      {brief.lines.map((line, i) => (
                        <div className="brief-line" key={i}>
                          <span className="label">{line.label}</span>
                          <div>
                            <p>{line.text}</p>
                            {line.sources.map((source, j) => (
                              <SourceQuote key={j} source={source} />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    {state.people.find((p) => p.id === brief.personId) && (
                      <Handles
                        person={state.people.find(
                          (p) => p.id === brief.personId,
                        )!}
                      />
                    )}
                    <button
                      className="text-button"
                      onClick={() => {
                        const p = state.people.find(
                          (p) => p.id === brief.personId,
                        );
                        if (p) openPerson(p);
                      }}
                    >
                      Open person card <Icon name="arrow-right" />
                    </button>
                  </motion.section>
                )}
                {person ? (
                  <section className="person-card">
                    <div className="section-top">
                      <button
                        className="text-button"
                        onClick={() => setSelected(null)}
                      >
                        ← All people
                      </button>
                      <span className="label">Person memory</span>
                    </div>
                    <div className="person-head">
                      <div className="avatar large">
                        {initials(person.name)}
                      </div>
                      <div>
                        <h1>{person.name}</h1>
                        <p className="muted">
                          Last met {date(person.lastSeen)}
                        </p>
                        <SourceQuote source={person.nameSource} />
                      </div>
                    </div>
                    {/^unknown$/i.test(
                      person.nameSource.speaker?.trim() || "",
                    ) && (
                      <p className="attribution-note">
                        Speaker attribution is unconfirmed. Bee labeled these
                        quotes Unknown; review the details before using them.
                      </p>
                    )}
                    <div className="person-grid">
                      <section>
                        <h3 className="label">Things to remember</h3>
                        {person.details.length ? (
                          person.details.map((d) => (
                            <div className="detail" key={d.id}>
                              <p>{d.text}</p>
                              <SourceQuote source={d.source} />
                            </div>
                          ))
                        ) : (
                          <p className="muted">
                            No additional details recorded.
                          </p>
                        )}
                        <Handles person={person} />
                      </section>
                      <section>
                        <h3 className="label">Open loops</h3>
                        {person.promises.length ? (
                          person.promises.map((p) => (
                            <PromiseRow
                              key={p.id}
                              promise={p}
                              onToggle={toggle}
                              busy={busy}
                            />
                          ))
                        ) : (
                          <p className="muted">No promises recorded.</p>
                        )}
                      </section>
                    </div>
                    <section className="timeline">
                      <h3 className="label">
                        Conversation timeline & speaker settings
                      </h3>
                      {state.conversations
                        .filter((c) => person.conversationIds.includes(c.id))
                        .map((c) => (
                          <SpeakerSetting
                            key={c.id}
                            conversation={c}
                            onChange={(id, speaker) =>
                              void mutate(
                                `/conversations/${encodeURIComponent(id)}/speaker`,
                                "PUT",
                                { speaker },
                                "Your speaker setting is saved",
                              )
                            }
                          />
                        ))}
                    </section>
                    <form
                      className="rename-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (rename.trim())
                          void mutate(
                            `/people/${encodeURIComponent(person.id)}`,
                            "PUT",
                            { name: rename.trim() },
                            "Name updated",
                          );
                      }}
                    >
                      <label className="label" htmlFor="rename">
                        Correct a transcribed name
                      </label>
                      <div>
                        <input
                          id="rename"
                          value={rename}
                          onChange={(e) => setRename(e.target.value)}
                          maxLength={120}
                        />
                        <button
                          className="button"
                          disabled={busy || !rename.trim()}
                        >
                          Save name
                        </button>
                      </div>
                    </form>
                    <button
                      className="text-button forget"
                      onClick={() => void forget(person)}
                    >
                      <Icon name="trash" size={15} /> Forget this person
                    </button>
                  </section>
                ) : (
                  <section className="people-section">
                    <div className="section-top">
                      <h2>
                        Your people{" "}
                        <span className="muted">
                          / <Count value={state.people.length} />
                        </span>
                      </h2>
                      <label className="list-search">
                        <Icon name="magnifying-glass" size={15} />
                        <span className="sr-only">Filter people</span>
                        <input
                          placeholder="Find a name or detail"
                          value={filter}
                          onChange={(e) => setFilter(e.target.value)}
                        />
                      </label>
                    </div>
                    {!state.people.length ? (
                      <Empty />
                    ) : visiblePeople.length ? (
                      <div className="people-list">
                        {visiblePeople.map((p, index) => (
                          <button
                            key={p.id}
                            className="person-row"
                            onClick={() => openPerson(p)}
                          >
                            <span className="row-index label">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            <span className="avatar">{initials(p.name)}</span>
                            <span className="person-row-text">
                              <strong>{p.name}</strong>
                              <span>
                                {p.details.find(
                                  (d) => d.kind === "role" || d.kind === "org",
                                )?.text ||
                                  p.details[0]?.text ||
                                  "A conversation worth remembering"}
                              </span>
                            </span>
                            <span className="person-last label">
                              {date(p.lastSeen)}
                            </span>
                            <Icon name="arrow-up-right" size={18} />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <Empty
                        title="No matching people"
                        text="Try a different name or detail."
                      />
                    )}
                  </section>
                )}
                {state.mergeCandidates.some((m) => m.status === "pending") && (
                  <section className="confirm-section">
                    <h2>Unsure — same person?</h2>
                    <p className="muted">
                      Recall never merges people across conversations without
                      your confirmation.
                    </p>
                    {state.mergeCandidates
                      .filter((m) => m.status === "pending")
                      .map((m) => (
                        <div className="merge-row" key={m.id}>
                          <div>
                            <strong>
                              {
                                state.people.find((p) => p.id === m.personA)
                                  ?.name
                              }{" "}
                              /{" "}
                              {
                                state.people.find((p) => p.id === m.personB)
                                  ?.name
                              }
                            </strong>
                            <p className="small muted">{m.reason}</p>
                          </div>
                          <div className="button-group">
                            <button
                              className="button"
                              disabled={busy}
                              onClick={() =>
                                void mutate(
                                  `/merges/${m.id}`,
                                  "POST",
                                  { action: "merge" },
                                  "People merged by your confirmation",
                                )
                              }
                            >
                              Same person
                            </button>
                            <button
                              className="text-button"
                              disabled={busy}
                              onClick={() =>
                                void mutate(
                                  `/merges/${m.id}`,
                                  "POST",
                                  { action: "separate" },
                                  "Kept as separate people",
                                )
                              }
                            >
                              Keep separate
                            </button>
                          </div>
                        </div>
                      ))}
                  </section>
                )}
                {!person &&
                  !brief &&
                  state.conversations.some((c) => !c.mySpeaker) && (
                    <details className="confirm-section speaker-review">
                      <summary>
                        Review speaker settings (
                        {state.conversations.filter((c) => !c.mySpeaker).length}
                        )
                      </summary>
                      <h2>Make the promises yours.</h2>
                      <p className="muted">
                        Set your speaker label in each conversation to tell “I
                        owe” from “they owe me”.
                      </p>
                      {state.conversations
                        .filter((c) => !c.mySpeaker)
                        .map((c) => (
                          <SpeakerSetting
                            key={c.id}
                            conversation={c}
                            onChange={(id, speaker) =>
                              void mutate(
                                `/conversations/${encodeURIComponent(id)}/speaker`,
                                "PUT",
                                { speaker },
                                "Your speaker setting is saved",
                              )
                            }
                          />
                        ))}
                    </details>
                  )}
                <section className="ask-section">
                  <span className="label">Ask your conversations</span>
                  <h2>What did we say about…</h2>
                  <form
                    className="ask-form"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!askQuery.trim()) return;
                      setBusy(true);
                      try {
                        setAnswer(
                          await api<AskAnswer>("/ask", "POST", {
                            query: askQuery,
                          }),
                        );
                      } catch (error) {
                        notify((error as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <label className="sr-only" htmlFor="ask">
                      Ask a question
                    </label>
                    <input
                      id="ask"
                      placeholder="A topic, a promise, a detail"
                      value={askQuery}
                      onChange={(e) => setAskQuery(e.target.value)}
                    />
                    <button
                      className="button"
                      disabled={busy || !askQuery.trim()}
                    >
                      Ask <Icon name="arrow-right" size={16} />
                    </button>
                  </form>
                  <p className="small muted">
                    Answers come with the original quote. If it isn’t there,
                    Recall says so.
                  </p>
                  {answer && (
                    <div className="answer" role="status">
                      <p>{answer.answer}</p>
                      {answer.sources.map((s, i) => (
                        <SourceQuote key={i} source={s} />
                      ))}
                      <p className="label">
                        {answer.method === "fixture"
                          ? "Fixture search"
                          : answer.method === "bee-search"
                            ? "Retrieved with Bee search"
                            : "No verified answer"}
                      </p>
                      {answer.error && (
                        <p className="small muted">{answer.error}</p>
                      )}
                    </div>
                  )}
                </section>
              </>
            )}
            {page === "promises" && (
              <section className="page-section">
                <span className="label">Follow through</span>
                <h1>
                  Small promises.
                  <br />
                  Long memories.
                </h1>
                <p className="intro muted">
                  The things you said you’d do, and the things coming your way.
                </p>
                <div className="promises-board">
                  {(["i_owe", "they_owe"] as const).map((direction) => (
                    <section key={direction}>
                      <div className="section-top">
                        <h2>
                          {direction === "i_owe" ? "I owe" : "They owe me"}
                        </h2>
                        <Count
                          value={
                            state.promises.filter(
                              (p) => p.direction === direction && !p.completed,
                            ).length
                          }
                        />
                      </div>
                      {state.promises
                        .filter((p) => p.direction === direction)
                        .map((p) => (
                          <PromiseRow
                            key={p.id}
                            promise={p}
                            onToggle={toggle}
                            busy={busy}
                          />
                        ))}
                      {!state.promises.some(
                        (p) => p.direction === direction,
                      ) && (
                        <Empty
                          title="Nothing outstanding"
                          text="Promises from your conversations will appear here."
                        />
                      )}
                    </section>
                  ))}
                </div>
                {state.promises.some((p) => p.direction === "unknown") && (
                  <section className="unknown-promises">
                    <h2>Set your speaker first</h2>
                    <p className="muted">
                      These promises have a source, but the direction needs your
                      confirmation on the person card.
                    </p>
                    {state.promises
                      .filter((p) => p.direction === "unknown")
                      .map((p) => (
                        <PromiseRow
                          key={p.id}
                          promise={p}
                          onToggle={toggle}
                          busy={busy}
                        />
                      ))}
                  </section>
                )}
              </section>
            )}
            {page === "privacy" && (
              <section className="page-section privacy">
                <span className="label">Yours to keep. Yours to forget.</span>
                <h1>
                  Memory, on
                  <br />
                  your terms.
                </h1>
                <div className="privacy-copy">
                  <h2>What stays here</h2>
                  <p>
                    Recall stores processed conversation text, people, source
                    quotes, social handles you heard, and promises in a local
                    SQLite database under <code>data/private/</code> on this
                    computer. No analytics. No cloud database. No transcripts
                    sent to an LLM.
                  </p>
                  <h2>What connects to Bee</h2>
                  <p>
                    Recall calls Bee to retrieve your conversations, search your
                    history, and keep up with new events. “I owe” promises can
                    be written back to Bee as todos. Bee processes and stores
                    its own data; local-only describes Recall’s database, not
                    Bee’s service.
                  </p>
                  <h2>You choose who is you</h2>
                  <p>
                    Bee provides generic speaker labels. Recall does not
                    identify voices, access raw audio, or guess social profiles.
                    Set your speaker for each conversation and confirm possible
                    matches yourself.
                  </p>
                  <h2>Take it with you</h2>
                  <p>
                    Export your local memory as JSON. This file contains private
                    conversation details — keep it somewhere you trust.
                  </p>
                  <a className="button" href="/api/export" download>
                    <Icon name="export" /> Export my data
                  </a>
                  <h2>Forget a person</h2>
                  <p>
                    Forgetting removes every local conversation containing that
                    person and all details derived from those conversations.
                    Shared details may also disappear. Those conversations are
                    excluded from future backfills. Bee originals and Bee todos
                    remain in Bee.
                  </p>
                  <div className="forget-list">
                    {state.people.map((p) => (
                      <div key={p.id}>
                        <span>{p.name}</span>
                        <button
                          className="text-button"
                          disabled={busy}
                          onClick={() => void forget(p)}
                        >
                          <Icon name="trash" size={15} /> Forget person
                        </button>
                      </div>
                    ))}
                  </div>
                  {!state.people.length && (
                    <p className="muted">There are no people stored yet.</p>
                  )}
                </div>
              </section>
            )}
          </>
        )}
        <footer>
          <span className="label">Recall · made possible by Bee</span>
          <span className="label">
            {state?.status.lastEvent
              ? `Latest: ${state.status.lastEvent} · ${time(state.status.lastEventAt)}`
              : "Waiting for a stream event"}
          </span>
        </footer>
      </main>
      {toast && (
        <div className="toast" role="status" key={toast}>
          <Icon name="check" size={16} />
          {toast}
        </div>
      )}
    </>
  );
}
