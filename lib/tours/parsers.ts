import {amount,airportCode,normalDate,type Tour} from "./model";
// External agency payloads vary; each parser validates its required collection.
export type Row=Record<string,any>;
export function parseLion(data:Row):Tour[]{
 if(!Array.isArray(data.SingleGroupList))throw new Error("雄獅回傳格式已變更");
 return data.SingleGroupList.map((t:Row)=>({id:t.GroupID,provider:"lion",title:t.TourName,url:`https://travel.liontravel.com/detail?${new URLSearchParams({NormGroupID:t.NormGroupID,GroupID:t.GroupID})}`,date:normalDate(t.GoDate),days:Number(t.TourDays),price:amount(t.DisplayPrice?.Price),airport:t.DirectionList?.[0]?.FlightList?.[0]?.DepartureAirportID||"unknown",status:t.StatusText||"請洽旅行社",available:t.QuotaSeats>0?true:/候補|額滿|截止/.test(t.StatusText)?false:null,destination:t.DirectionList?.[0]?.FlightList?.[0]?.ArriveCityName}));
}
export function parseSettours(data:Row):Tour[]{
 if(!Array.isArray(data.grup))throw new Error("東南回傳格式已變更");
 return data.grup.map((t:Row)=>({id:t.grupNo,provider:"settour",title:t.grupNm,url:`https://tour.settour.com.tw/product/${encodeURIComponent(t.prodNo)}/${encodeURIComponent(t.grupNo)}`,date:normalDate(t.begDt),days:Number(t.tourDays),price:Number(t.price?.b2cPrice),airport:airportCode(t.depCity),status:t.grupStatus||(t.allowQty>0?`可售 ${t.allowQty} 位`:"請洽旅行社"),available:t.saleStatus==="N"||t.allowQty<=0?false:t.allowQty>0?true:null}));
}
export function plain(s:string){return s.replace(/<[^>]*>/g," ").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n))).replace(/\s+/g," ").trim();}
const attr=(s:string,name:string)=>s.match(new RegExp(`${name}=["']([^"']*)["']`))?.[1]||"";
export function parseTravel4u(html:string):Tour[]{
 const blocks=html.split(/<div class="col-lg-12 mb-30 bg-transparent product"/).slice(1);
 if(!blocks.length&&!/搜尋結果.*?0\s*筆|查無|沒有符合/.test(plain(html)))throw new Error("山富搜尋格式已變更，請開啟官網確認");
 return blocks.flatMap(b=>{const href=b.match(/href="(\/group\/product\/[^"?]+)"/)?.[1],title=b.match(/<h6 class="tourCard name">([\s\S]*?)<\/h6>/)?.[1];if(!href||!title)return[];const text=plain(b),seats=text.match(/可售\s*(-?\d+)/);return[{id:href,provider:"travel4u",title:plain(title),url:"https://www.travel4u.com.tw"+href,image:b.match(/<img src="(https:[^"]+)" class="tour-img"/)?.[1],date:normalDate(attr(b,"data-date")),days:amount(attr(b,"data-dlength")),price:amount(attr(b,"data-price")),priceKind:"from" as const,airport:airportCode(attr(b,"data-dep")),status:/本日已滿團/.test(text)?"已滿團":seats?`可售 ${seats[1]} 位`:"請洽旅行社",available:/本日已滿團/.test(text)?false:seats?Number(seats[1])>0:null}];});
}
export function parseBwt(sse:string):Tour[]{
 const mains=new Map<string,Row>();let complete=false;
 for(const line of sse.split("\n")){
  if(line.trim()==="data: [DONE]"||line.startsWith("event: complete"))complete=true;
  if(!line.startsWith("data: {"))continue;
  const e=JSON.parse(line.slice(6));
  if(e.step==="step1")for(const m of e.data)mains.set(m.mainGroupCode,m);
  if(e.step==="step2")for(const m of e.data)mains.set(m.mainGroupCode,{...mains.get(m.mainGroupCode),...m});
  if(e.step==="step3")complete=true;
 }
 if(!complete)throw new Error("百威資料未傳輸完成，請稍後重試");
 return [...mains.values()].flatMap(m=>(m.groups||[]).filter((t:Row)=>t.groupCode&&t.price>0&&t.price<9999999).map((t:Row)=>({id:t.groupCode,provider:"bwt",title:t.groupName||m.groupName,url:`https://www.bwt.com.tw/tour/${encodeURIComponent(t.groupCode)}`,image:m.picture,date:normalDate(t.leaveDate),days:Number(t.groupDay),price:Number(t.price),airport:airportCode(t.airport),status:t.remainSeat>0?`可售 ${t.remainSeat} 位`:"候補／洽詢",available:t.remainSeat>0,destination:[m.areaName,m.subAreaName].filter(Boolean).join(" ")})));
}
