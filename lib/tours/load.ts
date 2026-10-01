import { dedupe, type Query, type SearchResult } from "./model";

export type SourceProgress = SearchResult & {
  status: "queued" | "loading" | "paused" | "error" | "done";
  pages: number;
};
type Options = {
  query: Query;
  ids: string[];
  previous?: Record<string, SourceProgress>;
  signal: AbortSignal;
  onUpdate: (id: string, progress: SourceProgress) => void;
  fetchPage: (id: string, query: Query, page: number, signal: AbortSignal) => Promise<SearchResult>;
  concurrency?: number;
  sourceSignals?: Record<string, AbortSignal>;
};

// One request at a time per source; independent sources share a bounded queue.
// `next` always points to the first unread page, including after failure/abort.
export async function loadSources({ query, ids, previous = {}, signal, onUpdate, fetchPage, concurrency = 4, sourceSignals = {} }: Options) {
  const state: Record<string, SourceProgress> = {};
  const queue = [...new Set(ids)].filter(id => previous[id]?.status !== "done");
  const emit = (id: string, progress: SourceProgress) => {
    state[id] = progress;
    onUpdate(id, progress);
  };
  for (const id of queue) emit(id, {
    ...(previous[id] ?? { provider: id, tours: [], scanned: 0, next: 1, fetchedAt: "", pages: 0 }),
    error: undefined, status: signal.aborted ? "paused" : "queued",
  });
  const pause = () => {
    for (const id of queue) if (["queued", "loading"].includes(state[id].status)) {
      emit(id, { ...state[id], status: "paused" });
    }
  };
  signal.addEventListener("abort", pause, { once: true });
  const cancelListeners = queue.map(id => {
    const sourceSignal=sourceSignals[id];
    const cancel=()=>{if(["queued","loading"].includes(state[id].status))emit(id,{...state[id],status:"paused"});};
    sourceSignal?.addEventListener("abort",cancel,{once:true});
    if(sourceSignal?.aborted)cancel();
    return ()=>sourceSignal?.removeEventListener("abort",cancel);
  });
  let index = 0;
  async function worker() {
    while (!signal.aborted && index < queue.length) {
      const id = queue[index++];
      const sourceSignal=sourceSignals[id]?AbortSignal.any([signal,sourceSignals[id]]):signal;
      while (!sourceSignal.aborted && state[id].next !== null) {
        const before = state[id], page = before.next!;
        emit(id, { ...before, status: "loading" });
        try {
          const result = await fetchPage(id, query, page, sourceSignal);
          if (sourceSignal.aborted) break; // Ignore late responses even when fetch ignores abort.
          if (result.error) throw new Error(result.error);
          if (result.provider !== id || !Array.isArray(result.tours) ||
              !Number.isFinite(result.scanned) || result.scanned < 0 ||
              (result.next !== null && (!Number.isInteger(result.next) || result.next <= page))) {
            throw new Error("來源分頁格式異常，已保留先前結果");
          }
          emit(id, {
            ...result, tours: dedupe([...before.tours, ...result.tours]),
            // Some sites end pagination with an empty response whose total resets to 0.
            total: result.next === null && result.total === 0 && before.tours.length > 0
              ? before.total : result.total ?? before.total,
            scanned: before.scanned + result.scanned, pages: before.pages + 1,
            status: result.next === null ? "done" : "loading",
          });
        } catch (error) {
          if (!sourceSignal.aborted) emit(id, {
            ...before, status: "error", error: error instanceof Error ? error.message : "來源暫時無法讀取",
          });
          break;
        }
      }
    }
  }
  try {
    await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), queue.length) }, worker));
  } finally {
    signal.removeEventListener("abort", pause);
    cancelListeners.forEach(remove=>remove());
  }
  return state;
}
