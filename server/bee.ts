import { execFile, spawn, type ChildProcess } from "node:child_process";
import { promisify } from "node:util";
import type { BeeClientContract } from "../shared/types.js";

const execFileAsync = promisify(execFile);
/** The npm CLI wrapper starts a native child. Stop the owned process group. */
export function stopBeeProcess(child: ChildProcess) {
  if (process.platform !== "win32" && child.pid) {
    try {
      process.kill(-child.pid, "SIGTERM");
      return;
    } catch {
      /* already exited or test child */
    }
  }
  child.kill("SIGTERM");
}
export class BeeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BeeError";
  }
}
export interface BeeOptions {
  binary?: string;
  proxyUrl?: string;
  token?: string;
  timeoutMs?: number;
}
/** CLI arguments never pass through a shell. Raw stderr may contain private data and is never exposed. */
export class BeeClient implements BeeClientContract {
  readonly binary: string;
  private readonly apiUrl: string;
  private readonly token?: string;
  private readonly timeoutMs: number;
  constructor(options: BeeOptions = {}) {
    this.binary = options.binary ?? process.env.BEE_BIN ?? "bee";
    this.apiUrl = (
      options.proxyUrl ??
      process.env.BEE_API_URL ??
      "http://127.0.0.1:8787"
    ).replace(/\/$/, "");
    this.token = options.token ?? process.env.BEE_TOKEN;
    this.timeoutMs = options.timeoutMs ?? 30_000;
    const url = new URL(this.apiUrl);
    const loopback =
      ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) &&
      url.protocol === "http:";
    const publicBee = url.origin === "https://api.developer.bee.amazon.dev";
    if (
      (!loopback && !publicBee) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.pathname !== "/" && url.pathname !== "")
    ) {
      throw new BeeError(
        "Bee API URL must be a loopback proxy or the official public HTTPS API.",
      );
    }
  }
  async command(args: string[]): Promise<unknown> {
    try {
      const { stdout } = await execFileAsync(this.binary, [...args, "--json"], {
        timeout: this.timeoutMs,
        maxBuffer: 20 * 1024 * 1024,
        windowsHide: true,
      });
      return JSON.parse(stdout.trim());
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT")
        throw new BeeError(
          "Bee CLI is not installed. Install @beeai/cli, enable Developer Mode, then run bee login.",
        );
      throw new BeeError(
        "Bee command failed. Check bee status, Developer Mode, and your connection. Private command output was withheld.",
      );
    }
  }
  status() {
    return this.command(["status"]);
  }
  listConversationsPage(cursor?: string): Promise<unknown> {
    return this.command([
      "conversations",
      "list",
      "--limit",
      "100",
      ...(cursor ? ["--cursor", cursor] : []),
    ]);
  }
  listConversations() {
    return this.listConversationsPage();
  }
  getConversation(id: string) {
    return this.command(["conversations", "get", id]);
  }
  transcript(id: string) {
    return this.command(["conversations", "transcript", id]);
  }
  facts() {
    return this.command(["facts", "list"]);
  }
  search(query: string) {
    return this.command([
      "search",
      "--query",
      query,
      "--filter",
      "conversations",
      "--limit",
      "20",
    ]);
  }
  locations(kind: "current" | "recent" | "clusters") {
    return this.command(["locations", kind]);
  }
  changed(cursor?: string) {
    return this.command(["changed", ...(cursor ? ["--cursor", cursor] : [])]);
  }
  stream(): ChildProcess {
    return spawn(
      this.binary,
      [
        "stream",
        "--types",
        "new-conversation,update-conversation,update-conversation-summary,update-location",
        "--json",
      ],
      {
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
        detached: process.platform !== "win32",
      },
    );
  }
  private async request(
    path: string,
    method: string,
    body: unknown,
  ): Promise<unknown> {
    try {
      const response = await fetch(`${this.apiUrl}/v1/${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
        redirect: "error",
      });
      if (!response.ok)
        throw new BeeError(
          `Bee API returned HTTP ${response.status}. Check login and the local proxy.`,
        );
      const content = await response.text();
      return content ? JSON.parse(content) : {};
    } catch (error) {
      if (error instanceof BeeError) throw error;
      throw new BeeError(
        "Bee API is unavailable. Start bee proxy --port 8787 and verify bee status.",
      );
    }
  }
  createTodo(text: string, alarmAt?: string | null) {
    return this.request("todos", "POST", {
      text,
      ...(alarmAt ? { alarm_at: alarmAt } : {}),
    });
  }
  completeTodo(id: string, completed: boolean) {
    return this.request(`todos/${encodeURIComponent(id)}`, "PUT", {
      completed,
    });
  }
}
