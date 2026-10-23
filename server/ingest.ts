import { createInterface } from "node:readline";
import type { ChildProcess } from "node:child_process";
import type { Conversation, LiveStatus } from "../shared/types.js";
import { BeeClient, stopBeeProcess } from "./bee.js";
import {
  conversationId,
  conversationPage,
  normalizeConversation,
  streamShape,
} from "./normalize.js";

export interface IngestOptions {
  onConversation: (conversation: Conversation) => void | Promise<void>;
  onStatus: (patch: Partial<LiveStatus>) => void;
  isForgotten: (id: string) => boolean;
  client?: BeeClient;
  backfillMs?: number;
}
/** Stream is at-most-once, so startup and periodic paginated backfills are mandatory. */
export function startIngest(options: IngestOptions): {
  stop(): void;
  sync(): Promise<void>;
} {
  const client = options.client ?? new BeeClient();
  let stopped = false;
  let stream: ChildProcess | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let retryMs = 2_000;
  let syncing: Promise<void> | undefined;
  let queue: Promise<void> = Promise.resolve();
  const pending = new Map<string, { again: boolean; task: Promise<void> }>();
  const locations = new Map<string, string>();
  const status = (patch: Partial<LiveStatus>) => {
    if (!stopped) options.onStatus(patch);
  };
  const refresh = async (id: string) => {
    if (stopped || options.isForgotten(id)) return;
    const raw = await client.getConversation(id);
    const transcript = await client.transcript(id);
    if (stopped || options.isForgotten(id)) return;
    const conversation = normalizeConversation(raw, transcript, id);
    if (options.isForgotten(conversation.id)) return;
    if (!conversation.location && locations.has(id))
      conversation.location = locations.get(id)!;
    await options.onConversation(conversation);
  };
  const enqueue = (id: string): Promise<void> => {
    if (options.isForgotten(id) || stopped) return Promise.resolve();
    const existing = pending.get(id);
    if (existing) {
      existing.again = true;
      return existing.task;
    }
    const entry = { again: false, task: Promise.resolve() };
    entry.task = queue
      .catch(() => {})
      .then(async () => {
        do {
          entry.again = false;
          await refresh(id);
        } while (entry.again && !stopped);
      })
      .finally(() => pending.delete(id));
    pending.set(id, entry);
    // Serialize all source refreshes so an older response cannot overwrite a newer one.
    queue = entry.task.catch(() => {});
    return entry.task;
  };
  const sync = (): Promise<void> => {
    if (stopped) return Promise.resolve();
    if (syncing) return syncing;
    syncing = (async () => {
      let cursor: string | undefined;
      const cursors = new Set<string>();
      let failures = 0;
      do {
        const page = conversationPage(
          await client.listConversationsPage(cursor),
        );
        status({ connected: true });
        for (const item of page.items) {
          if (stopped) return;
          const id = conversationId(item);
          if (!id || options.isForgotten(id)) continue;
          try {
            await enqueue(id);
          } catch {
            failures++;
          }
        }
        cursor = page.nextCursor;
        if (cursor && cursors.has(cursor))
          throw new Error("Repeated pagination cursor");
        if (cursor) cursors.add(cursor);
        if (cursors.size > 1000)
          throw new Error("Conversation backfill page limit");
      } while (cursor && !stopped);
      if (failures) {
        status({
          error: `${failures} conversation refreshes failed; the next backfill will retry.`,
        });
      } else {
        status({ lastSyncAt: new Date().toISOString(), error: null });
      }
    })()
      .catch(() => {
        status({
          connected: false,
          error:
            "Bee backfill unavailable. Enable Developer Mode, run bee login and bee status, then Sync.",
        });
      })
      .finally(() => {
        syncing = undefined;
      });
    return syncing;
  };
  const connect = () => {
    if (stopped) return;
    try {
      stream = client.stream();
    } catch {
      status({
        streamConnected: false,
        error: "Could not start Bee stream. Check Bee CLI installation.",
      });
      scheduleRetry();
      return;
    }
    const current = stream;
    const lines = current.stdout
      ? createInterface({ input: current.stdout })
      : undefined;
    // Never log stderr: Bee diagnostics may contain account information or transcript text.
    current.stderr?.resume();
    let failed = false;
    const disconnect = () => {
      if (failed || stopped) return;
      failed = true;
      lines?.close();
      status({
        streamConnected: false,
        error: "Bee stream disconnected; reconnecting with backfill.",
      });
      scheduleRetry();
    };
    current.once("error", disconnect);
    current.once("close", disconnect);
    lines?.on("line", (line: string) => {
      if (stopped || line.length > 2_000_000) return;
      try {
        const shape = streamShape(JSON.parse(line));
        if (!shape) return;
        retryMs = 2_000;
        const isSignal =
          shape.kind === "stream signal" || shape.kind === "connected";
        status({
          connected: true,
          streamConnected: true,
          ...(!isSignal
            ? {
                lastEvent: shape.kind,
                lastEventAt: new Date().toISOString(),
                error: null,
              }
            : {}),
        });
        // Only event categories and receipt times are printed, never private payloads.
        console.info(`[Bee stream] ${new Date().toISOString()} ${shape.kind}`);
        if (shape.conversationId) {
          if (shape.location)
            locations.set(shape.conversationId, shape.location);
          void enqueue(shape.conversationId).catch(() => {
            status({
              error:
                "A conversation refresh failed. Periodic backfill will retry; check bee status.",
            });
          });
        }
      } catch {
        /* Ignore non-JSON CLI diagnostics, without exposing them. */
      }
    });
  };
  const scheduleRetry = () => {
    if (stopped || retry) return;
    retry = setTimeout(() => {
      retry = undefined;
      connect();
      void sync();
    }, retryMs);
    retry.unref();
    retryMs = Math.min(retryMs * 2, 30_000);
  };
  connect();
  void sync();
  const periodic = setInterval(() => {
    void sync();
  }, options.backfillMs ?? 60_000);
  periodic.unref();
  return {
    sync,
    stop() {
      stopped = true;
      clearInterval(periodic);
      if (retry) clearTimeout(retry);
      if (stream) stopBeeProcess(stream);
      locations.clear();
    },
  };
}
