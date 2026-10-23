import "dotenv/config";
import { Store } from "./db.js";
import { BeeClient } from "./bee.js";
import { createApp } from "./app.js";
import { startIngest } from "./ingest.js";

const fixture = process.env.RECALL_MODE === "fixture";
const store = new Store();
const runtime = createApp(store, new BeeClient(), fixture);
if (fixture) await runtime.loadFixture();
const worker = fixture
  ? null
  : startIngest({
      onConversation: runtime.ingest,
      onStatus: runtime.updateStatus,
      isForgotten: (id) => store.isForgotten(id),
    });
if (worker) runtime.setSync(worker.sync);
const port = Number(process.env.RECALL_PORT || 3210);
const server = runtime.app.listen(port, "127.0.0.1", () =>
  console.info(
    `Recall API listening on http://127.0.0.1:${port} (${fixture ? "FAKE FIXTURE" : "live Bee"})`,
  ),
);
function stop() {
  worker?.stop();
  server.close(() => {
    store.close();
    process.exit(0);
  });
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
