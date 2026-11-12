import type { StudioDocument } from '../types';

/** Independent debounce queues; changing tabs never cancels another document's pending save. */
export function createAutosaveCoordinator(
  persist: (doc: StudioDocument) => Promise<unknown>,
  onError: (error: unknown) => void,
  delay = 1000,
) {
  const pending = new Map<string, {doc: StudioDocument; timer: ReturnType<typeof setTimeout>}>();
  const writes = new Map<string, Promise<void>>();
  const flush = (id: string) => {
    const item = pending.get(id);
    if (!item) return;
    clearTimeout(item.timer); pending.delete(id);
    const previous = writes.get(id) ?? Promise.resolve();
    const write = previous.catch(() => {}).then(() => persist(item.doc)).then(() => {}, error => { onError(error); });
    writes.set(id, write);
    void write.finally(() => { if (writes.get(id) === write) writes.delete(id); });
  };
  return {
    schedule(doc: StudioDocument) {
      const old = pending.get(doc.id); if (old) clearTimeout(old.timer);
      const snapshot = structuredClone(doc);
      pending.set(doc.id, {doc:snapshot,timer:setTimeout(() => flush(doc.id), delay)});
    },
    flushAll() { for (const id of [...pending.keys()]) flush(id); },
  };
}
