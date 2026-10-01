import { tourCountries } from "./countries";

export type Query = { start:string; end:string; days:number; minBudget:number; budget:number; airport:string|string[]; keyword:string; exclude:string; weekend:boolean; available:boolean };
export type SingleAirportQuery = Omit<Query,"airport"> & {airport:string};
export type Tour = { id:string; provider:string; title:string; url:string; image?:string; date:string; days:number; price:number; airport:string; status:string; available:boolean|null; priceKind?:"from"; destination?:string };
export type SearchResult = { provider:string; tours:Tour[]; scanned:number; total?:number; next:number|null; fetchedAt:string; note?:string; error?:string };
export const defaults:Query={start:"2026-11-10",end:"2026-12-31",days:5,minBudget:0,budget:26000,airport:["TPE"],keyword:"",exclude:"北越、馬來西亞、濟州",weekend:true,available:true};
export const airports:Record<string,string>={all:"不限",TPE:"桃園",TSA:"松山",RMQ:"台中",KHH:"高雄"};
export const airportSelection=(value:Query["airport"]):string[]=>Array.isArray(value)?value:[value];
export const airportLabel=(value:Query["airport"])=>airportSelection(value).map(id=>airports[id]).join("、");
export function validDate(s:unknown):s is string {return typeof s==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;}
export function validateQuery(v:unknown):Query {
 if(!v||typeof v!=="object")throw new Error("請提供搜尋條件");
 const q=v as Query;
 const minBudget=q.minBudget===undefined?0:q.minBudget;
 if(!validDate(q.start)||!validDate(q.end)||q.end<q.start||Date.parse(q.end)-Date.parse(q.start)>366*86400000)throw new Error("請選擇正確的出發日期，範圍最多一年");
 if(!Number.isInteger(q.days)||q.days<1||q.days>40)throw new Error("天數請填 1–40 天");
 if(!Number.isFinite(q.budget)||q.budget<1||q.budget>1000000)throw new Error("請填寫有效的團費上限");
 if(!Number.isFinite(minBudget)||minBudget<0||minBudget>q.budget)throw new Error("團費下限須為 0 以上，且不能高於上限");
 const selected=airportSelection(q.airport);
 if(!selected.length||selected.length>5||selected.some(id=>typeof id!=="string"||!Object.hasOwn(airports,id))||(selected.includes("all")&&selected.length>1))throw new Error("請選擇出發機場；不限機場不能與個別機場並選");
 const airport=Object.keys(airports).filter(id=>selected.includes(id));
 if(typeof q.keyword!=="string"||typeof q.exclude!=="string"||q.keyword.length>100||q.exclude.length>300||typeof q.weekend!=="boolean"||typeof q.available!=="boolean")throw new Error("搜尋條件格式不正確");
 return {start:q.start,end:q.end,days:q.days,minBudget,budget:q.budget,airport,keyword:q.keyword.trim(),exclude:q.exclude.trim(),weekend:q.weekend,available:q.available};
}
export const normalDate=(s:unknown)=>{const m=String(s??"").match(/(20\d{2})[-/]?(\d{2})[-/]?(\d{2})/);return m?`${m[1]}-${m[2]}-${m[3]}`:"";};
export const amount=(s:unknown)=>Number(String(s??"").replace(/[^\d.]/g,""));
const aliases:Record<string,string[]>={北越:["北越","河內","下龍","陸龍","沙壩","沙霸"],馬來西亞:["馬來西亞","馬來","檳蘭","吉隆坡","檳城","沙巴","馬六甲","蘭卡威","新馬"],濟州:["濟州","濟洲"],濟州島:["濟州","濟洲"],韓國:["韓國","南韓","釜山","首爾","清州","大邱","濟州"],日本:["日本","東京","大阪","九州","北海道","沖繩","關西","關東","名古屋","四國","北陸","東北","熊本","福岡"]};
export const splitTerms=(s:string)=>s.split(/[、,，;；\n\r]+/).map(x=>x.trim()).filter(Boolean);
export function matches(t:Tour,q:Query){
 if(!validDate(t.date)||t.date<q.start||t.date>q.end||t.days!==q.days||!Number.isFinite(t.price)||t.price<=0||t.price<q.minBudget||t.price>q.budget)return false;
 const selected=airportSelection(q.airport);
 if(!selected.includes("all")&&!selected.includes(t.airport))return false;
 if(q.available&&t.available===false)return false;
 const text=[t.title,t.destination||"",...tourCountries(t)].join(" ").normalize("NFKC").toLowerCase();
 const hit=(word:string)=>(aliases[word]||[word]).some(x=>text.includes(x.normalize("NFKC").toLowerCase()));
 if(splitTerms(q.exclude).some(hit))return false;
 if(q.keyword&&!splitTerms(q.keyword).some(hit))return false;
 if(q.weekend&&!Array.from({length:t.days},(_,i)=>(new Date(Date.parse(t.date)+i*86400000)).getUTCDay()).some(x=>x===0||x===6))return false;
 return true;
}
export function airportCode(s:unknown){const t=String(s??"");return /桃園|TPE/.test(t)?"TPE":/松山|TSA/.test(t)?"TSA":/高雄|小港|KHH/.test(t)?"KHH":/台中|臺中|RMQ/.test(t)?"RMQ":"unknown";}
export function dedupe(tours:Tour[]){return [...new Map(tours.map(t=>[`${t.provider}:${t.id}`,t])).values()];}
