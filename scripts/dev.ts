import { spawn, type ChildProcess } from "node:child_process";
import "dotenv/config";
const fixture = process.env.RECALL_MODE === "fixture";
const children: ChildProcess[] = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const c of children) {
    try {
      if (process.platform !== "win32" && c.pid)
        process.kill(-c.pid, "SIGTERM");
      else c.kill("SIGTERM");
    } catch {}
  }
  setTimeout(() => process.exit(code), 800);
}
function run(command: string, args: string[]) {
  const c = spawn(command, args, {
    stdio: "inherit",
    env: process.env,
    detached: process.platform !== "win32",
  });
  children.push(c);
  c.on("error", () => {
    console.error(`Could not start ${command}. See README setup.`);
    stop(1);
  });
  c.on("exit", (code) => {
    if (!stopping) stop(code || 0);
  });
  return c;
}
console.log(
  `Recall ${fixture ? "FAKE FIXTURE" : "LIVE BEE"} mode. Local app: http://127.0.0.1:5173`,
);
if (!fixture && process.env.RECALL_MANAGE_PROXY !== "false")
  run("bee", ["proxy", "--port", "8787"]);
run(process.execPath, ["--import", "tsx", "server/index.ts"]);
run(process.execPath, [
  "node_modules/vite/bin/vite.js",
  "--host",
  "127.0.0.1",
  "--port",
  "5173",
  "--strictPort",
]);
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
