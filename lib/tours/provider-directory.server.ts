import "server-only";
import { providers } from "./providers";
import type { ProviderInfo } from "./provider-info";

export function getProviderDirectory(): ProviderInfo[] {
 return providers.filter(p=>p.live).sort((a,b)=>a.name.localeCompare(b.name,"zh-TW")).map(({id,name,url,live,focus})=>({id,name,url,live,focus}));
}
