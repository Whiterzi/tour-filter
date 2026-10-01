import {parseBegonia,parseGalilee,parsePhoenix,parseSunday,parseMitravel} from "./html-parsers";
import {type Query,type SingleAirportQuery,type SearchResult,dedupe,airportSelection,airports} from "./model";
import {parseLion,parseSettours,parseTravel4u,parseBwt,type Row} from "./parsers";
import {settourQuery} from "./settour-query";
import {colaBatch,colaSearchUrl,parseCola,COLA_RESULT_LIMIT} from "./cola";

const cache=new Map<string,{at:number;result:SearchResult}>();
const regionPages=new Map<string,{at:number;regions:Map<string,{totalPage:number;totalSize:number}>}>();
const headers={"User-Agent":"Mozilla/5.0","Accept":"application/json,text/html,text/event-stream"};
async function request(url:string,body?:unknown){
 const response=await fetch(url,{headers:body?{...headers,"Content-Type":"application/json;charset=utf-8"}:headers,method:body?"POST":"GET",body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(35000)});
 if(!response.ok)throw new Error(`來源暫時無法讀取（HTTP ${response.status}）`);
 return response;
}
// Each selected airport has its own stateless pagination lane. Complete one
// before advancing, so a short airport list never truncates another's results.
const airportPageStride=1_000_000;
export async function searchProvider(provider:string,q:Query,page=1):Promise<SearchResult>{
 const selected=["galilee","sunday","mitravel"].includes(provider)?["all"]:airportSelection(q.airport);
 const lane=Math.floor((page-1)/airportPageStride),sourcePage=(page-1)%airportPageStride+1;
 if(!Number.isSafeInteger(page)||page<1||lane>=selected.length)throw new Error("搜尋批次不正確");
 const airport=selected[lane];
 const result=await searchSingleAirport(provider,{...q,airport},sourcePage);
 if(result.next!==null&&result.next>=airportPageStride)throw new Error("來源分頁超出可處理範圍，結果尚未讀完");
 return {...result,
  total:selected.length>1?undefined:result.total,
  next:result.next!==null?lane*airportPageStride+result.next:lane+1<selected.length?(lane+1)*airportPageStride+1:null,
  note:selected.length>1?`${airports[airport]}出發。${result.note||""}`:result.note,
 };
}
async function searchSingleAirport(provider:string,q:SingleAirportQuery,page=1):Promise<SearchResult>{
 const key=JSON.stringify([provider,q.start,q.end,q.days,q.minBudget,q.budget,q.airport,page]);const existing=cache.get(key);
 if(existing&&Date.now()-existing.at<300000)return existing.result;
 let out:SearchResult={provider,tours:[],scanned:0,next:null,fetchedAt:new Date().toISOString()};
 if(provider==="cola"){
  const batch=colaBatch(q,page);
  const tours=parseCola(await (await request(colaSearchUrl({...q,start:batch.start,end:batch.end},batch.region[0]))).text());
  const capped=tours.length>=COLA_RESULT_LIMIT;
  if(capped&&batch.splitNext===null)throw new Error("可樂單日搜尋已達官網 500 筆上限，此來源尚未讀完；請縮小天數或團費範圍後重試");
  out={...out,tours:capped?[]:tours,scanned:tours.length,next:capped?batch.splitNext:batch.next,note:`依官網日期、天數區間、機場與團費初篩，再精確過濾。本批：${batch.region[1]} ${batch.start}–${batch.end}。${capped?"達單次回傳上限，自動拆分日期繼續查詢。":"已取回本區間完整團期；價格對應各出發日期。"}`};
 }else if(provider==="lion"){
  const data:Row=await (await request("https://travel.liontravel.com/search/singlegrouplistinfojson",{DepartureID:q.airport==="all"?"":q.airport,GoDateStart:q.start,GoDateEnd:q.end,Days:String(q.days),PriceList:[{PriceStart:q.minBudget,PriceEnd:q.budget}],Page:page,PageSize:100,SortType:1,TravelType:1})).json();
  out={...out,tours:parseLion(data),scanned:data.Count,total:data.TotalCount,next:page<data.TotalPage?page+1:null,note:"每頁 100 筆，自動接續至最後一頁。團費未包含所有額外費用。"};
 }else if(provider==="travel4u"){
  const params=new URLSearchParams({date_start:q.start,date_end:q.end,length_start:String(q.days),length_end:String(q.days),dep_location:q.airport==="all"?"":`ARP_${q.airport}`});
  const html=await (await request("https://www.travel4u.com.tw/group/search/?"+params)).text();const tours=parseTravel4u(html);
  out={...out,tours,scanned:tours.length,note:"官網列表顯示各行程的代表團期與起價，其他團期請點回官網；不是全部團期。"};
 }else if(provider==="settour"){
  const regions=["1A_ALL","1C_ALL","1E_ALL","1B_ALL","1G_ALL","1D_ALL","1F_ALL"];
  const regionKey=JSON.stringify([q.start,q.end,q.days,q.minBudget,q.budget,q.airport]);
  const saved=regionPages.get(regionKey);
  const bounds=page>1&&saved&&Date.now()-saved.at<300000?saved.regions:new Map<string,{totalPage:number;totalSize:number}>();
  const responses=await Promise.allSettled(regions.map(async travelCd=>{
   const known=bounds.get(travelCd);
   if(known&&page>known.totalPage)return {...known,grup:[]};
   const variables={depCityCd:q.airport==="all"?"":q.airport,travelCd,begDt:q.start.replaceAll("-",""),endDt:q.end.replaceAll("-",""),keyWord:"",isOrder:false,isMiniTour:true,portTp:"B2C",pageNo:page,sort:"PA",minPrice:q.minBudget||-1,maxPrice:q.budget,tourDays:String(q.days),companyNo:"",memberNo:"",week:"",airLine:"",grupStatus:"",isOffer:false,isMkt:false,isPakFly:false,isChaFly:false,isNoShopping:false,isNoPay:false,isGoEarly:false,isLateReturn:false,isOnlyMiniTour:false,isB2C:true,hideB2ePrice:true};
   const json:Row=await (await request("https://gql.settour.com.tw/graphql",{query:settourQuery,variables})).json();const result=json.data?.getGfgSearchGrup;
   // The official API reports an empty region as COM009 (查無資料).
   // Only that code is an empty result; all other failures remain retryable.
   if(json.errors?.length)throw new Error("東南查詢未完成");
   const empty=result?.error?.msgCode==="COM009"&&!result?.data;
   if(!empty&&(result?.error||!result?.data))throw new Error(`東南部分地區未回傳資料${result?.error?.msgCode?`（${String(result.error.msgCode).slice(0,30)}）`:""}`);
   const d=empty?{totalPage:0,totalSize:0,grup:[]}:result.data;
   if(!Number.isInteger(d.totalPage)||!Number.isFinite(d.totalSize))throw new Error("東南分頁資料格式變更");
   bounds.set(travelCd,{totalPage:d.totalPage,totalSize:d.totalSize});return d;
  }));
  // A failed region must be retried with this page, never silently skipped.
  const failure=responses.find(r=>r.status==="rejected");
  if(failure?.status==="rejected")throw new Error(`東南部分地區讀取失敗：${failure.reason instanceof Error?failure.reason.message:"請稍後重試"}。可接續重試本頁`);
  const data=responses.flatMap(r=>r.status==="fulfilled"?[r.value]:[]);
  if(regionPages.size>=100)regionPages.delete(regionPages.keys().next().value!);
  regionPages.set(regionKey,{at:Date.now(),regions:bounds});
  const tours=dedupe(data.flatMap(parseSettours));out={...out,tours,scanned:tours.length,total:data.reduce((n,d)=>n+d.totalSize,0),next:data.some(d=>page<d.totalPage)?page+1:null,note:"依官網七大地區逐頁查詢，每頁每區 10 筆；已讀完的地區不再重複查詢。"};
 }else if(provider==="bwt"){
  const sse=await (await request("https://ncapi.bwt.com.tw/Shop/Present/GetSearchInfoSSE",{mainGroupCode:"",areaCode:"",startDate:q.start.replaceAll("-","/"),endDate:q.end.replaceAll("-","/"),soon:"0",signUp:"0",guarantee:"0",airPt:q.airport==="all"?"ALL":q.airport,Keyword:""})).text();const tours=parseBwt(sse);
  out={...out,tours,scanned:tours.length,total:tours.length,note:"讀取官網所回傳的團期、團費及可售席次。"};
 }else if(provider==="spunk"||provider==="fantasy"){
  const origin=provider==="spunk"?"https://www.4p.com.tw":"https://www.fantasy-tours.com";
  const params=new URLSearchParams({sdate:q.start,edate:q.end,port_cd:q.airport==="all"?"":q.airport,days:`${q.days}-${q.days}`,prices:`${q.minBudget}-${q.budget}`,page:String(page)});
  const parsed=parseBegonia(await (await request(origin+"/products/group/search?"+params)).text(),provider,origin,page);
  out={...out,...parsed,scanned:parsed.tours.length,note:"逐頁讀取官網團期與起價。"};
 }else if(provider==="galilee"){
  const params=new URLSearchParams({Partial:"true",Page:String(page),DepartureDate:q.start,ArrivalDate:q.end,Days:q.days<=5?"0-5":q.days<=9?"6-9":"10-999"});
  const parsed=parseGalilee(await (await request("https://www.galilee.com.tw/Search?"+params)).text(),page);
  out={...out,...parsed,scanned:parsed.tours.length,note:"依官網日期與天數範圍逐頁讀取，再依你的條件精確篩選。"};
 }else if(provider==="phoenix"){
  const form=new URLSearchParams({sdate:q.start.replaceAll("-","/"),edate:q.end.replaceAll("-","/"),depart:q.airport==="TPE"?"TPE":q.airport==="all"?"":"TCK",linecode:"0",page:String(page)});
  const r=await fetch("https://www.travel.com.tw/TOU/TOU0010List",{method:"POST",headers:{...headers,"Content-Type":"application/x-www-form-urlencoded"},body:form,signal:AbortSignal.timeout(35000)});
  if(!r.ok)throw new Error(`鳳凰暫時無法讀取（HTTP ${r.status}）`);
  const parsed=parsePhoenix(await r.text(),q.airport,page);out={...out,...parsed,scanned:parsed.tours.length,note:"每頁 20 筆；官網可能含迷你團與自由行商品。非台北出發的列表未細分機場，需選不限機場查看。"};
 }else if(provider==="sunday"){
  const params=new URLSearchParams({strdate:q.start,enddate:q.end});
  const tours=parseSunday(await (await request("https://www.sundaytour.com.tw/zh-tw/tours/alllist.php?"+params)).text());
  out={...out,tours,scanned:tours.length,note:"官網總表未提供出發機場；此來源需選不限機場才會納入結果。"};
 }else if(provider==="mitravel"){
  const params=new URLSearchParams({startdate:q.start,enddate:q.end});
  const tours=parseMitravel(await (await request("https://www.mitravel.com.tw/tw/search?"+params)).text());
  out={...out,tours,scanned:tours.length,note:"官網總表未提供出發機場；需選不限機場查看。天數依商品名稱辨識，無法辨識的商品不納入。"};
 }else throw new Error("此旅行社尚未接通團期資料");
 out.tours=dedupe(out.tours);
 if(cache.size>50)cache.delete(cache.keys().next().value!);
 cache.set(key,{at:Date.now(),result:out});return out;
}
