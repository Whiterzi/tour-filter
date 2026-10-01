import {validateQuery,type Query} from "@/lib/tours/model";
import {providers} from "@/lib/tours/providers";
import {searchProvider} from "@/lib/tours/fetch";
export async function POST(request:Request){
 let query:Query,provider:string,page:number;
 try{const body=await request.json() as {query:unknown;provider:string;page?:number};query=validateQuery(body.query);provider=body.provider;page=body.page??1;if(!providers.some(p=>p.id===provider&&p.live)||!Number.isSafeInteger(page)||page<1)throw new Error("來源或頁碼不正確");}
 catch(e){return Response.json({error:e instanceof Error?e.message:"請檢查搜尋條件"},{status:400});}
 try{return Response.json(await searchProvider(provider,query,page));}
 catch(e){return Response.json({provider,tours:[],scanned:0,next:null,fetchedAt:new Date().toISOString(),error:e instanceof Error?e.message:"來源暫時無法讀取"},{status:502});}
}
