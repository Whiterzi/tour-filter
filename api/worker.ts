import { validateQuery, type Query } from "../lib/tours/model";
import { providers } from "../lib/tours/providers";
import { searchProvider } from "../lib/tours/fetch";

type Env = { ALLOWED_ORIGINS: string };
const maxBodyBytes = 8192;

export async function handleRequest(request:Request, env:Env):Promise<Response> {
  const url = new URL(request.url);
  const origin = request.headers.get("Origin");
  const allowed = new Set((env.ALLOWED_ORIGINS || "").split(",").map(s=>s.trim()).filter(Boolean));
  const headers = new Headers({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Vary": "Origin" });
  const reply = (body:unknown, status=200) => Response.json(body, { status, headers });
  if (origin && origin !== url.origin && !allowed.has(origin)) return reply({ error:"此網站未開放查詢" },403);
  if (origin) headers.set("Access-Control-Allow-Origin",origin);
  if (request.method === "GET" && url.pathname === "/health") return reply({ ok:true });
  if (url.pathname !== "/api/search") return reply({ error:"找不到此服務" },404);
  if (request.method === "OPTIONS") {
    const method=request.headers.get("Access-Control-Request-Method");
    const requestedHeaders=(request.headers.get("Access-Control-Request-Headers")||"").split(",").map(s=>s.trim().toLowerCase()).filter(Boolean);
    if (method !== "POST" || requestedHeaders.some(h=>h!=="content-type")) return reply({ error:"不支援的查詢方式" },403);
    headers.set("Access-Control-Allow-Methods","POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers","Content-Type");
    headers.set("Access-Control-Max-Age","600");
    return new Response(null,{ status:204,headers });
  }
  if (request.method !== "POST") { headers.set("Allow","POST, OPTIONS"); return reply({ error:"請使用 POST 查詢" },405); }
  if (request.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() !== "application/json") return reply({error:"請使用 JSON 搜尋條件"},415);
  if (Number(request.headers.get("Content-Length")) > maxBodyBytes) return reply({error:"搜尋條件過長"},413);
  let query:Query,provider:string,page:number;
  try {
    const reader=request.body?.getReader();
    if (!reader) return reply({error:"請提供搜尋條件"},400);
    const chunks:Uint8Array[]=[];let size=0;
    while (true) {
      const part=await reader.read();if(part.done)break;
      size+=part.value.byteLength;
      if(size>maxBodyBytes) { await reader.cancel();return reply({error:"搜尋條件過長"},413); }
      chunks.push(part.value);
    }
    const bytes=new Uint8Array(size);let offset=0;
    for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
    const body=JSON.parse(new TextDecoder().decode(bytes)) as {query:unknown;provider:string;page?:number};
    query=validateQuery(body.query);provider=body.provider;page=body.page??1;
    if(!providers.some(p=>p.id===provider&&p.live)||!Number.isSafeInteger(page)||page<1) throw new Error("來源或頁碼不正確");
  } catch(e) { return reply({error:e instanceof SyntaxError?"搜尋條件不是有效的 JSON":e instanceof Error?e.message:"請檢查搜尋條件"},400); }
  try { return reply(await searchProvider(provider,query,page)); }
  catch(e) { return reply({provider,tours:[],scanned:0,next:null,fetchedAt:new Date().toISOString(),error:e instanceof Error?e.message:"來源暫時無法讀取"},502); }
}

export default { fetch:handleRequest };
