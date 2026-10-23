import "dotenv/config";
import { Store } from "../server/db.js";
const id = process.argv[2];
if (!id) {
  console.error(
    "Usage: npm run forget -- <person-id> (stop the app first; use RECALL_MODE=fixture for fixtures)",
  );
  process.exit(1);
}
const store = new Store();
try {
  const count = store.forget(id);
  console.log(
    `Forgot person and ${count} source conversations locally. Backfill is blocked for those conversation IDs. Bee originals and todos are unchanged.`,
  );
} finally {
  store.close();
}
