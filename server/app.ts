import express from "express";
import { readFileSync } from "node:fs";
import type {
  BeeClientContract,
  Conversation,
  LiveStatus,
  Snapshot,
} from "../shared/types.js";
import { Store } from "./db.js";
import { extractConversation } from "./extract.js";
import { brief } from "./brief.js";
import { ask } from "./ask.js";
import { setPromiseCompleted, syncPromiseTodo } from "./todos.js";

export function createApp(
  store: Store,
  bee: BeeClientContract,
  fixture = false,
) {
  const app = express();
  const status: LiveStatus = {
    mode: fixture ? "fixture" : "live",
    connected: false,
    streamConnected: false,
    lastEvent: null,
    lastEventAt: null,
    lastSyncAt: null,
    error: null,
    conversations: 0,
    people: 0,
    openPromises: 0,
  };
  let sync = async () => {};
  let queue: Promise<unknown> = Promise.resolve();
  const serialize = <T>(action: () => Promise<T> | T): Promise<T> => {
    const next = queue.then(action, action);
    queue = next.catch(() => {});
    return next;
  };
  const snapshot = (): Snapshot => {
    const people = store.people(),
      promises = store.promises(),
      conversations = store.conversations();
    return {
      status: {
        ...status,
        people: people.length,
        conversations: conversations.length,
        openPromises: promises.filter((p) => !p.completed).length,
      },
      people,
      promises,
      conversations,
      mergeCandidates: store.candidates(),
    };
  };
  async function extract(c: Conversation) {
    const result = extractConversation(c, store.people());
    store.saveExtraction(c, result.people, result.mergeCandidates);
    for (const p of store
      .promises()
      .filter(
        (p) =>
          p.source.conversationId === c.id &&
          p.direction === "i_owe" &&
          !p.beeTodoId &&
          !p.completed,
      )) {
      store.savePromise(await syncPromiseTodo(p, bee, fixture));
    }
  }
  const ingest = (c: Conversation) =>
    serialize(async () => {
      if (store.saveConversation(c)) {
        await extract(c);
        status.lastSyncAt = new Date().toISOString();
      }
    });
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    const host = (req.headers.host || "").split(":")[0];
    if (!["127.0.0.1", "localhost"].includes(host)) {
      res.status(403).json({ error: "Local access only." });
      return;
    }
    const origin = req.headers.origin;
    if (origin) {
      try {
        const u = new URL(origin);
        if (
          !["127.0.0.1", "localhost"].includes(u.hostname) ||
          !["3210", "5173"].includes(u.port)
        )
          throw Error();
      } catch {
        res.status(403).json({ error: "Local origin required." });
        return;
      }
    }
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    next();
  });
  app.use(express.json({ limit: "32kb" }));
  const id = (req: express.Request) => String(req.params.id);
  const person = (req: express.Request) =>
    store.people().find((p) => p.id === id(req));
  const fail = (res: express.Response, message: string, code = 400) =>
    res.status(code).json({ error: message });
  app.get("/api/state", (_req, res) => res.json(snapshot()));
  app.get("/api/people/:id/brief", async (req, res) => {
    const p = person(req);
    if (!p) return fail(res, "Person not found.", 404);
    // Bee is queried first in live mode. The brief itself uses only locally stored sourced claims.
    if (!fixture) {
      try {
        await bee.search(p.name);
      } catch {
        status.error =
          "Bee search unavailable; brief uses previously synced sources.";
      }
    }
    res.json(brief(p, store.conversations()));
  });
  app.post("/api/ask", async (req, res) => {
    if (
      typeof req.body?.query !== "string" ||
      !req.body.query.trim() ||
      req.body.query.length > 500
    )
      return fail(res, "Enter a question of 1–500 characters.");
    const answer = await ask(
      req.body.query,
      bee,
      fixture ? store.conversations() : undefined,
    );
    answer.sources = answer.sources.filter(
      (s) => !store.isForgotten(s.conversationId),
    );
    answer.answer = answer.sources.length
      ? answer.sources.map((s) => `“${s.quote}”`).join("\n\n")
      : "I don't have that.";
    res.json(answer);
  });
  app.post("/api/sync", async (_req, res) => {
    await sync();
    res.json(snapshot());
  });
  app.put("/api/conversations/:id/speaker", async (req, res) => {
    const c = store.conversation(id(req));
    if (!c) return fail(res, "Conversation not found.", 404);
    const speaker = req.body?.speaker;
    if (
      typeof speaker !== "string" ||
      !c.utterances.some((u) => u.speaker === speaker)
    )
      return fail(res, "Choose a speaker present in this conversation.");
    if (!speaker.trim() || /^unknown$/i.test(speaker))
      return fail(
        res,
        "Bee has not separated speakers in this recording. Unknown cannot identify the wearer.",
      );
    await serialize(async () => {
      store.db
        .prepare("UPDATE conversations SET my_speaker=? WHERE id=?")
        .run(speaker, c.id);
      c.mySpeaker = speaker;
      await extract(c);
    });
    res.json(snapshot());
  });
  app.put("/api/people/:id", async (req, res) => {
    if (!person(req)) return fail(res, "Person not found.", 404);
    const name = req.body?.name;
    if (typeof name !== "string" || !name.trim() || name.length > 120)
      return fail(res, "Name must be 1–120 characters.");
    await serialize(() => store.rename(id(req), name.trim()));
    res.json(snapshot());
  });
  app.delete("/api/people/:id", async (req, res) => {
    if (!person(req)) return fail(res, "Person not found.", 404);
    await serialize(() => store.forget(id(req)));
    res.json(snapshot());
  });
  app.put("/api/promises/:id", async (req, res) => {
    if (typeof req.body?.completed !== "boolean")
      return fail(res, "Completed must be boolean.");
    const p = await serialize(async () => {
      const current = store.promises().find((p) => p.id === id(req));
      if (!current) return null;
      const updated = await setPromiseCompleted(
        current,
        req.body.completed,
        bee,
        fixture,
      );
      store.savePromise(updated);
      return updated;
    });
    if (!p) return fail(res, "Promise not found.", 404);
    if (p.syncError) return fail(res, p.syncError, 502);
    res.json(snapshot());
  });
  app.post("/api/merges/:id", async (req, res) => {
    if (!["merge", "separate"].includes(req.body?.action))
      return fail(res, "Choose merge or separate.");
    if (
      !store
        .candidates()
        .some((c) => c.id === id(req) && c.status === "pending")
    )
      return fail(res, "Candidate not found.", 404);
    await serialize(() => store.merge(id(req), req.body.action));
    res.json(snapshot());
  });
  app.get("/api/export", (_req, res) => {
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="recall-export.json"',
    );
    res.json(store.export());
  });
  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      res
        .status(500)
        .json({ error: "Request failed. Private diagnostics were withheld." });
    },
  );
  return {
    app,
    ingest,
    snapshot,
    setSync: (f: () => Promise<void>) => {
      sync = f;
    },
    updateStatus: (patch: Partial<LiveStatus>) => Object.assign(status, patch),
    async loadFixture() {
      const rows = JSON.parse(
        readFileSync(
          new URL("../fixtures/conversations.json", import.meta.url),
          "utf8",
        ),
      ) as Conversation[];
      for (const c of rows) await ingest(c);
    },
  };
}
