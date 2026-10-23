import Database from "better-sqlite3";
import { mkdirSync, readFileSync, chmodSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type {
  Conversation,
  Person,
  PromiseItem,
  MergeCandidate,
} from "../shared/types.js";

export class Store {
  db: Database.Database;
  constructor(
    path = process.env.RECALL_DB ||
      `data/private/${process.env.RECALL_MODE === "fixture" ? "fixture" : "recall"}.sqlite`,
  ) {
    const full = resolve(path);
    mkdirSync(dirname(full), { recursive: true, mode: 0o700 });
    this.db = new Database(full);
    chmodSync(full, 0o600);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("secure_delete = ON");
    this.db.exec(
      readFileSync(new URL("../shared/schema.sql", import.meta.url), "utf8"),
    );
  }
  conversations(): Conversation[] {
    return (
      this.db
        .prepare("SELECT * FROM conversations ORDER BY started_at DESC")
        .all() as any[]
    ).map((r) => ({
      id: r.id,
      title: r.title,
      startedAt: r.started_at,
      updatedAt: r.updated_at,
      mySpeaker: r.my_speaker,
      location: r.location,
      utterances: JSON.parse(r.utterances_json),
      isFixture: !!r.is_fixture,
    }));
  }
  conversation(id: string) {
    return this.conversations().find((c) => c.id === id);
  }
  isForgotten(id: string) {
    return !!this.db
      .prepare("SELECT id FROM forgotten_conversations WHERE id=?")
      .get(id);
  }
  saveConversation(c: Conversation) {
    if (this.isForgotten(c.id)) return false;
    const previous = this.conversation(c.id);
    if (previous?.mySpeaker) c.mySpeaker = previous.mySpeaker;
    this.db
      .prepare(
        "INSERT INTO conversations VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,started_at=excluded.started_at,updated_at=excluded.updated_at,my_speaker=excluded.my_speaker,location=excluded.location,utterances_json=excluded.utterances_json,is_fixture=excluded.is_fixture",
      )
      .run(
        c.id,
        c.title,
        c.startedAt,
        c.updatedAt,
        c.mySpeaker,
        c.location,
        JSON.stringify(c.utterances),
        Number(c.isFixture),
      );
    return true;
  }
  promises(): PromiseItem[] {
    return (
      this.db
        .prepare(
          "SELECT p.*,people.name FROM promises p JOIN people ON p.person_id=people.id ORDER BY p.completed,p.id",
        )
        .all() as any[]
    ).map((r) => ({
      id: r.id,
      personId: r.person_id,
      personName: r.name,
      direction: r.direction,
      text: r.text,
      dueHint: r.due_hint,
      alarmAt: r.alarm_at,
      completed: !!r.completed,
      beeTodoId: r.bee_todo_id,
      syncError: r.sync_error,
      source: JSON.parse(r.source_json),
    }));
  }
  people(): Person[] {
    const promises = this.promises();
    return (
      this.db
        .prepare("SELECT * FROM people ORDER BY last_seen DESC,name")
        .all() as any[]
    ).map((r) => ({
      id: r.id,
      name: r.name,
      lastSeen: r.last_seen,
      createdAt: r.created_at,
      nameSource: JSON.parse(r.name_source_json),
      isFixture: !!r.is_fixture,
      details: (
        this.db
          .prepare("SELECT * FROM details WHERE person_id=?")
          .all(r.id) as any[]
      ).map((d) => ({
        id: d.id,
        personId: d.person_id,
        kind: d.kind,
        text: d.text,
        source: JSON.parse(d.source_json),
      })),
      handles: (
        this.db
          .prepare("SELECT * FROM handles WHERE person_id=?")
          .all(r.id) as any[]
      ).map((h) => ({
        id: h.id,
        personId: h.person_id,
        platform: h.platform,
        handle: this.getSetting(`handle:${h.id}`) || h.handle,
        url: this.getSetting(`handle-url:${h.id}`) || h.url,
        source: JSON.parse(h.source_json),
      })),
      promises: promises.filter((p) => p.personId === r.id),
      conversationIds: (
        this.db
          .prepare(
            "SELECT conversation_id FROM person_conversations WHERE person_id=?",
          )
          .all(r.id) as any[]
      ).map((c) => c.conversation_id),
    }));
  }
  candidates(): MergeCandidate[] {
    return (
      this.db.prepare("SELECT * FROM merge_candidates").all() as any[]
    ).map((r) => ({
      id: r.id,
      personA: r.person_a,
      personB: r.person_b,
      reason: r.reason,
      status: r.status,
    }));
  }
  getSetting(key: string) {
    return (
      this.db.prepare("SELECT value FROM settings WHERE key=?").get(key) as
        { value: string } | undefined
    )?.value;
  }
  setSetting(key: string, value: string) {
    this.db
      .prepare(
        "INSERT INTO settings VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      )
      .run(key, value);
  }
  saveExtraction(
    c: Conversation,
    people: Person[],
    candidates: MergeCandidate[],
  ) {
    this.db.transaction(() => {
      const prev = this.people();
      const promiseState = new Map(this.promises().map((p) => [p.id, p]));
      // Refresh claims for this conversation while preserving completion/write-back state.
      for (const table of ["details", "handles", "promises"])
        this.db
          .prepare(
            `DELETE FROM ${table} WHERE json_extract(source_json,'$.conversationId')=?`,
          )
          .run(c.id);
      this.db
        .prepare("DELETE FROM person_conversations WHERE conversation_id=?")
        .run(c.id);
      for (const p of people) {
        const alias = this.getSetting(`merged:${p.id}`);
        const id = alias || p.id;
        const old = prev.find((v) => v.id === id);
        const rename = this.getSetting(`name:${id}`);
        this.db
          .prepare(
            "INSERT INTO people VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,last_seen=MAX(people.last_seen,excluded.last_seen)",
          )
          .run(
            id,
            rename || old?.name || p.name,
            p.lastSeen,
            p.createdAt,
            JSON.stringify(old?.nameSource || p.nameSource),
            Number(p.isFixture),
          );
        this.db
          .prepare("INSERT OR IGNORE INTO person_conversations VALUES (?,?)")
          .run(id, c.id);
        for (const d of p.details)
          this.db
            .prepare("INSERT OR REPLACE INTO details VALUES (?,?,?,?,?)")
            .run(d.id, id, d.kind, d.text, JSON.stringify(d.source));
        for (const h of p.handles)
          this.db
            .prepare("INSERT OR REPLACE INTO handles VALUES (?,?,?,?,?,?)")
            .run(
              h.id,
              id,
              h.platform,
              h.handle,
              h.url,
              JSON.stringify(h.source),
            );
        for (const promise of p.promises) {
          const oldPromise = promiseState.get(promise.id);
          this.savePromise({
            ...promise,
            personId: id,
            completed: oldPromise?.completed || false,
            beeTodoId: oldPromise?.beeTodoId || null,
            syncError: oldPromise?.syncError || null,
          });
        }
      }
      this.db
        .prepare(
          "DELETE FROM people WHERE id NOT IN (SELECT person_id FROM person_conversations)",
        )
        .run();
      for (const m of candidates) {
        const a = this.getSetting(`merged:${m.personA}`) || m.personA,
          b = this.getSetting(`merged:${m.personB}`) || m.personB;
        if (a === b) continue;
        if (
          this.db.prepare("SELECT id FROM people WHERE id=?").get(a) &&
          this.db.prepare("SELECT id FROM people WHERE id=?").get(b)
        )
          this.db
            .prepare(
              "INSERT OR IGNORE INTO merge_candidates VALUES (?,?,?,?,?)",
            )
            .run(m.id, a, b, m.reason, m.status);
      }
    })();
  }
  savePromise(p: PromiseItem) {
    this.db
      .prepare("INSERT OR REPLACE INTO promises VALUES (?,?,?,?,?,?,?,?,?,?)")
      .run(
        p.id,
        p.personId,
        p.direction,
        p.text,
        p.dueHint,
        p.alarmAt,
        Number(p.completed),
        p.beeTodoId,
        p.syncError,
        JSON.stringify(p.source),
      );
  }
  rename(id: string, name: string) {
    this.db.prepare("UPDATE people SET name=? WHERE id=?").run(name, id);
    this.setSetting(`name:${id}`, name);
  }
  merge(id: string, action: "merge" | "separate") {
    const candidate = this.candidates().find(
      (m) => m.id === id && m.status === "pending",
    );
    if (!candidate) throw new Error("Merge candidate not found");
    this.db.transaction(() => {
      if (action === "merge") {
        const a = candidate.personA,
          b = candidate.personB;
        for (const table of ["details", "handles", "promises"])
          this.db
            .prepare(`UPDATE ${table} SET person_id=? WHERE person_id=?`)
            .run(a, b);
        this.db
          .prepare(
            "INSERT OR IGNORE INTO person_conversations SELECT ?,conversation_id FROM person_conversations WHERE person_id=?",
          )
          .run(a, b);
        this.setSetting(`merged:${b}`, a);
        this.db
          .prepare("UPDATE settings SET value=? WHERE key LIKE ? AND value=?")
          .run(a, "merged:%", b);
        this.db
          .prepare(
            "UPDATE people SET last_seen=MAX(last_seen,(SELECT last_seen FROM people WHERE id=?)) WHERE id=?",
          )
          .run(b, a);
        this.db.prepare("DELETE FROM people WHERE id=?").run(b);
      } else
        this.db
          .prepare("UPDATE merge_candidates SET status=? WHERE id=?")
          .run("separate", id);
    })();
  }
  forget(id: string) {
    const person = this.people().find((p) => p.id === id);
    if (!person) throw new Error("Person not found");
    this.db.transaction(() => {
      // Delete entire source conversations: retaining raw source would retain the forgotten person.
      for (const cid of person.conversationIds) {
        this.db
          .prepare("INSERT OR IGNORE INTO forgotten_conversations VALUES (?)")
          .run(cid);
        for (const table of ["details", "handles", "promises"])
          this.db
            .prepare(
              `DELETE FROM ${table} WHERE json_extract(source_json,'$.conversationId')=?`,
            )
            .run(cid);
        this.db.prepare("DELETE FROM conversations WHERE id=?").run(cid);
      }
      this.db
        .prepare(
          "DELETE FROM people WHERE id=? OR id NOT IN (SELECT person_id FROM person_conversations)",
        )
        .run(id);
      for (const p of this.people()) {
        if (person.conversationIds.includes(p.nameSource.conversationId)) {
          // A surviving identity whose name came from a deleted source is also erased.
          this.db.prepare("DELETE FROM people WHERE id=?").run(p.id);
        }
      }
      this.db
        .prepare(
          "DELETE FROM settings WHERE key LIKE 'name:%' OR key LIKE 'merged:%' OR key LIKE 'handle:%' OR key LIKE 'handle-url:%'",
        )
        .run();
    })();
    this.db.pragma("wal_checkpoint(TRUNCATE)");
    this.db.exec("VACUUM");
    return person.conversationIds.length;
  }
  export() {
    return {
      exportedAt: new Date().toISOString(),
      people: this.people(),
      conversations: this.conversations(),
      mergeCandidates: this.candidates(),
      note: "Local Recall data. Bee originals and Bee todos are stored separately by Bee.",
    };
  }
  close() {
    this.db.close();
  }
}
