import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

export async function verifyCola(server) {
 const c=await server.ssrLoadModule('/lib/tours/cola.ts');
 const m=await server.ssrLoadModule('/lib/tours/model.ts');
 const {searchProvider}=await server.ssrLoadModule('/lib/tours/fetch.ts');
 const rows=JSON.parse(await readFile('tests/fixtures/cola-departures.json','utf8'));
 const flight=(records,noData=false)=>{
  const stream='22:'+JSON.stringify(['$','$L26',null,{data:{noData,TourData_List:records,initialRenderData:records.slice(0,20).map((_,i)=>`$22:props:data:TourData_List:${i}`)}}])+'\n';
  // Source transport splits JSON across script tags, including inside strings.
  return [stream.slice(0,53),stream.slice(53,1021),stream.slice(1021)].map(chunk=>`<script>self.__next_f.push([1,${JSON.stringify(chunk)}])</script>`).join('');
 };
 const tours=c.parseCola(flight(rows));
 assert.equal(tours.length,4);assert.equal(tours[0].date,'2026-11-15');
 assert.equal(tours[0].price,24888);assert.equal(tours[0].days,5);assert.equal(tours[0].airport,'TPE');
 assert.equal(tours[0].available,true);assert.equal(tours[1].available,false);assert.equal(tours[2].available,false);
 assert.match(tours[3].status,/APP限定/);
 assert.equal(new URL(tours[0].url).searchParams.get('TourCode'),'NKF111505BR6');
 assert.equal(new URL(tours[0].url).searchParams.get('TourDate'),'2026/11/15');
 const dates=c.parseCola(flight([rows[0],{...rows[0],Tour_Date:'2026/11/22',Retail_Price:26888}]));
 assert.notEqual(dates[0].id,dates[1].id);assert.equal(dates[1].price,26888);
 const unknown=c.parseCola(flight([{...rows[0],Available_Pax:'洽詢',Sign_Up:'請洽',Departure_Airport:''}]))[0];
 assert.equal(unknown.available,null);assert.equal(unknown.airport,'unknown');
 const many=Array.from({length:123},(_,i)=>({...rows[0],Tour_Code:`tour-${i}`}));
 assert.equal(c.parseCola(flight(many)).length,123); // Not initialRenderData or the 50 visible rows.
 assert.deepEqual(c.parseCola(flight(rows,true)),[]); // No matches, even if recommendations follow.
 assert.deepEqual(c.parseCola(flight([],true)),[]);
 for(const html of ['<html>Access denied</html>',flight(rows).slice(0,-100),flight([{...rows[0],Tour_Date:'bad'}])])assert.throws(()=>c.parseCola(html));
 const refStream='1:'+JSON.stringify(rows[0])+'\n2:'+JSON.stringify({noData:false,TourData_List:['$1']})+'\n';
 assert.equal(c.parseCola(`<script>self.__next_f.push([1,${JSON.stringify(refStream)}])</script>`)[0].price,24888);
 for(const [airport,expected]of Object.entries({TPE:'TAO',TSA:'TSA',RMQ:'TXG',KHH:'KHH',all:''}))assert.equal(new URL(c.colaSearchUrl({...m.defaults,airport},'B')).searchParams.get('DepartureCity'),expected);
 const params=new URL(c.colaSearchUrl({...m.defaults,airport:'TPE',minBudget:18000},'B')).searchParams;
 assert.equal(params.get('PriceRange'),'18000,26000');assert.equal(params.get('StartDate'),'2026/11/10');assert.equal(params.get('EndDate'),'2026/12/31');
 assert.equal(params.get('TourDay'),'5');assert.equal(params.get('Booking'),'all');
 for(const [days,bucket]of [[2,null],[3,'5'],[5,'5'],[6,'8'],[9,'11'],[14,'14'],[18,'20'],[21,null]])assert.equal(new URL(c.colaSearchUrl({...m.defaults,airport:'TPE',days},'A')).searchParams.get('TourDay'),bucket);
 // Every day is covered exactly once whether whole ranges complete or split to days.
 for(const [start,end]of [['2026-11-10','2026-11-10'],['2026-11-10','2026-11-14'],['2028-02-28','2028-03-01']]){
  const q={...m.defaults,start,end};let page=1,regions=[];
  do{const batch=c.colaBatch(q,page);regions.push(batch.region[0]);assert.equal(batch.start,start);assert.equal(batch.end,end);page=batch.next;}while(page);
  assert.deepEqual(regions,c.colaRegions.map(r=>r[0]));
  page=1;const leaves=[];
  do{const batch=c.colaBatch(q,page);if(batch.splitNext!==null)page=batch.splitNext;else{leaves.push(`${batch.region[0]}:${batch.start}`);page=batch.next;}}while(page);
  assert.equal(leaves.length,c.colaRegions.length*((Date.parse(end)-Date.parse(start))/86400000+1));
  assert.equal(new Set(leaves).size,leaves.length);
 }
 const originalFetch=globalThis.fetch;const requests=[];
 try{
  const q={...m.defaults,start:'2026-11-15',end:'2026-11-16',minBudget:17000};
  globalThis.fetch=async url=>{
   const p=new URL(url).searchParams;requests.push(p);
   return new Response(flight(p.get('StartDate')===p.get('EndDate')?rows:many.concat(Array.from({length:377},(_,i)=>({...rows[0],Tour_Code:`extra-${i}`})))));
  };
  const capped=await searchProvider('cola',q,1);assert.equal(capped.next,2);assert.equal(capped.scanned,500);assert.equal(capped.tours.length,0);
  const left=await searchProvider('cola',q,capped.next);assert.equal(left.next,3);assert.equal(left.tours.length,4);
  const right=await searchProvider('cola',q,left.next);assert.equal(right.next,4);
  assert.equal(requests[1].get('StartDate'),'2026/11/15');assert.equal(requests[1].get('EndDate'),'2026/11/15');assert.equal(requests[2].get('StartDate'),'2026/11/16');
  assert(requests.every(p=>p.get('PriceRange')==='17000,26000'));
  globalThis.fetch=async()=>new Response(flight(Array.from({length:500},(_,i)=>({...rows[0],Tour_Code:String(i)}))));
  await assert.rejects(()=>searchProvider('cola',{...q,start:q.end},1),/尚未讀完/);
  globalThis.fetch=async()=>new Response('temporarily unavailable',{status:503});
  await assert.rejects(()=>searchProvider('cola',q,4),/HTTP 503/);
  globalThis.fetch=async()=>new Response(flight([],true));
  const retry=await searchProvider('cola',q,4);assert.equal(retry.next,7); // Failed batches are not cached as empty.
  const lastPage=(2*2-1)*(c.colaRegions.length-1)+1;
  assert.equal((await searchProvider('cola',q,lastPage)).next,null);
 }finally{globalThis.fetch=originalFetch;}
}
