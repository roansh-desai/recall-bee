import type { BeeClientContract, PromiseItem } from "../shared/types.js";

function todoId(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const r = value as Record<string, unknown>;
  if (typeof r.id === "string" || typeof r.id === "number") return String(r.id);
  if (typeof r.uuid === "string") return r.uuid;
  for (const key of ["todo", "data", "result"]) {
    const id = todoId(r[key]);
    if (id) return id;
  }
  return null;
}
/** Caller persists the returned record. Fixture records never leave the machine. */
export async function syncPromiseTodo(
  promise: PromiseItem,
  bee: BeeClientContract,
  isFixture = false,
): Promise<PromiseItem> {
  if (isFixture || promise.direction !== "i_owe") return promise;
  if (promise.syncError?.startsWith("Creation outcome unknown")) return promise;
  let p = { ...promise };
  if (!p.beeTodoId) {
    try {
      const response = await bee.createTodo(p.text, p.alarmAt);
      const id = todoId(response);
      if (!id)
        return {
          ...p,
          syncError:
            "Creation outcome unknown: Bee returned no todo id. Check Bee before retrying to avoid duplicates.",
        };
      p = { ...p, beeTodoId: id, syncError: null };
    } catch {
      return {
        ...p,
        syncError:
          "Creation outcome unknown: check Bee before retrying to avoid duplicates.",
      };
    }
  }
  if (p.completed) {
    try {
      await bee.completeTodo(p.beeTodoId!, true);
      return { ...p, syncError: null };
    } catch {
      return { ...p, syncError: "Bee completion failed. Tick again to retry." };
    }
  }
  return p;
}
/** Completion is saved only after Bee acknowledges it when a live Bee todo exists. */
export async function setPromiseCompleted(
  promise: PromiseItem,
  completed: boolean,
  bee: BeeClientContract,
  isFixture = false,
): Promise<PromiseItem> {
  if (isFixture || promise.direction !== "i_owe")
    return { ...promise, completed, syncError: null };
  let p = promise;
  if (!p.beeTodoId) {
    p = await syncPromiseTodo(p, bee, false);
    if (!p.beeTodoId) return p;
  }
  try {
    await bee.completeTodo(p.beeTodoId!, completed);
    return { ...p, completed, syncError: null };
  } catch {
    return {
      ...p,
      syncError:
        "Bee completion failed; local completion was not changed. Try again.",
    };
  }
}
