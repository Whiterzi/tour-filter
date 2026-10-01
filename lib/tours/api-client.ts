import type { Query, SearchResult } from "./model";

export function normalizeApiBase(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new Error("請設定 VITE_API_URL 為已部署的查詢 API 網址");
  const url = new URL(value);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if ((url.protocol !== "https:" && !(local && url.protocol === "http:")) || url.username || url.password || url.search || url.hash) {
    throw new Error("VITE_API_URL 必須是 HTTPS 網址，不得包含帳密、查詢參數或片段");
  }
  return url.href.replace(/\/+$/, "");
}

export async function fetchTourPage(base:string, provider:string, query:Query, page:number, signal:AbortSignal):Promise<SearchResult> {
  const response = await fetch(`${base}/api/search`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, query, page }), signal,
    credentials: "omit",
  });
  if (!response.headers.get("Content-Type")?.includes("application/json")) {
    throw new Error("查詢服務暫時無法連線，請稍後再試");
  }
  const result = await response.json() as SearchResult;
  if (!response.ok) throw new Error(result.error || "來源暫時無法讀取");
  return result;
}
