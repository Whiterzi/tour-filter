import assert from 'node:assert/strict';

export async function verifyResultControls(server) {
 const m=await server.ssrLoadModule('/lib/tours/model.ts');
 const {loadSources}=await server.ssrLoadModule('/lib/tours/load.ts');
 const {searchProvider}=await server.ssrLoadModule('/lib/tours/fetch.ts');
 const {tourCountries}=await server.ssrLoadModule('/lib/tours/countries.ts');
 const {sortTours}=await server.ssrLoadModule('/lib/tours/result-display.ts');
 const sample={id:'one',provider:'lion',title:'岡山鳥取五日',url:'https://example.com',date:'2026-11-15',days:5,price:45000,airport:'TPE',status:'報名',available:true};
 const q={...m.defaults,minBudget:45000,budget:52000,airport:['TPE','KHH'],exclude:''};
 assert.deepEqual(m.validateQuery({...q,airport:'TPE'}).airport,['TPE']);
 assert.deepEqual(m.validateQuery({...q,airport:['KHH','TPE','KHH']}).airport,['TPE','KHH']);
 for(const airport of [[],['all','TPE'],['bad'],[null],null,{}]) assert.throws(()=>m.validateQuery({...q,airport}));
 assert(m.matches(sample,q));
 assert(m.matches({...sample,airport:'KHH'},q));
 assert(!m.matches({...sample,airport:'TSA'},q));
 assert(!m.matches({...sample,airport:'unknown'},{...q,airport:['TPE','TSA','KHH','RMQ']}));
 assert(m.matches({...sample,airport:'unknown'},{...q,airport:['all']}));
 // Search and destination exclusions include the same country labels shown on results.
 assert(m.matches(sample,{...q,keyword:'日本'})); // The title only names 岡山 and 鳥取.
 assert(!m.matches(sample,{...q,exclude:'日本'}));
 assert(!m.matches({...sample,title:'釜山五日'},{...q,keyword:'日本'}));
 assert(m.matches({...sample,title:'秘境溫泉五日',destination:'日本'},{...q,keyword:'日本'}));
 for(const keyword of ['新加坡','馬來西亞']) assert(m.matches({...sample,title:'新馬雙國五日'},{...q,keyword}));
 assert(!m.matches({...sample,title:'海外神秘之旅'},{...q,keyword:'日本'}));
 assert(m.matches(sample,{...q,keyword:'韓國、日本'}));
 assert(m.matches({...sample,title:'岡山 ＳＰＡ 五日'},{...q,keyword:'spa'}));
 for(const [title,labels] of [['山陰山陽～岡山後樂園、嚴島神社鳥居、島根鳥取名景',['日本']],['帛琉超值選～水母湖干貝城',['帛琉']],['關島自由行５天',['關島']],['荷比法１０日',['法國','荷蘭','比利時']],['新馬雙國',['馬來西亞','新加坡']],['印度尼西亞峇里島',['印尼']],['印度洋馬爾地夫',['馬爾地夫']],['擁抱峇里凱賓斯基酒店',['印尼']],['藏王樹冰紛',['日本']],['五星檳蘭',['馬來西亞']],['海外神秘之旅',[]]]) assert.deepEqual(tourCountries({title}),labels);
 assert.deepEqual(tourCountries({title:'泰國北海道村五日',destination:'泰國 曼谷'}),['泰國']);
 const rows=[sample,{...sample,id:'two',provider:'cola',title:'釜山五日',date:'2026-11-20',price:51000}];
 assert.equal(sortTours(rows,'price',{}).at(0).id,'one');
 assert.equal(sortTours(rows,'price-desc',{}).at(0).id,'two');
 assert.equal(sortTours(rows,'date',{}).at(0).id,'one');
 assert.equal(sortTours(rows,'date-desc',{}).at(0).id,'two');
 assert.equal(sortTours(rows,'provider',{lion:'B',cola:'A'}).at(0).provider,'cola');
 assert.equal(rows[0].id,'one'); // Sort never mutates loaded source data.
 assert.equal(sortTours([...rows].reverse(),'price',{}).at(0).id,'one');

 // Deselect a source both before it starts and during its request. Other sources continue.
 const controllers=Object.fromEntries(['a','b','c'].map(id=>[id,new AbortController()]));
 const state={},calls=[];let release;
 const result=id=>({provider:id,tours:[{...sample,provider:id}],scanned:1,next:null,fetchedAt:''});
 const pending=loadSources({query:q,ids:['a','b','c'],concurrency:1,signal:new AbortController().signal,sourceSignals:Object.fromEntries(Object.entries(controllers).map(([id,c])=>[id,c.signal])),onUpdate:(id,s)=>state[id]=s,fetchPage:async(id,query,page,signal)=>{
  calls.push(id);
  if(id==='a'){assert(!signal.aborted);return new Promise(resolve=>release=resolve);}
  return result(id);
 }});
 while(!release)await new Promise(resolve=>setTimeout(resolve,0));
 controllers.b.abort();controllers.a.abort();
 assert.equal(state.a.status,'paused');assert.equal(state.b.status,'paused');
 release(result('a'));await pending;
 assert.deepEqual(calls,['a','c']);assert.equal(state.a.tours.length,0);assert.equal(state.c.status,'done');
 const resumed=[];
 await loadSources({query:q,ids:['b'],previous:state,signal:new AbortController().signal,onUpdate:(id,s)=>state[id]=s,fetchPage:async(id)=>{resumed.push(id);return result(id);}});
 assert.deepEqual(resumed,['b']);assert.equal(state.b.status,'done');assert.equal(state.a.status,'paused');

 const originalFetch=globalThis.fetch;
 try {
  const requested=[];let fail=true;
  globalThis.fetch=async(url,options)=>{
   const b=JSON.parse(options.body);const a=b.DepartureID;requested.push(`${a}:${b.Page}`);
   if(a==='KHH'&&b.Page===2&&fail)throw new Error('temporary airport failure');
   return Response.json({Count:1,TotalCount:a==='TPE'?2:3,TotalPage:a==='TPE'?2:3,SingleGroupList:[{GroupID:`${a}:${b.Page}`,TourName:'日本岡山五日',GoDate:'2026-11-15',TourDays:5,DisplayPrice:{Price:46000},DirectionList:[{FlightList:[{DepartureAirportID:a}]}]}]});
  };
  let progress={};
  const run=previous=>loadSources({query:q,ids:['lion'],previous,signal:new AbortController().signal,onUpdate:(id,s)=>progress[id]=s,fetchPage:(id,query,page)=>searchProvider(id,query,page)});
  await run();
  assert.deepEqual(requested,['TPE:1','TPE:2','KHH:1','KHH:2']);
  assert.equal(progress.lion.status,'error');assert.equal(progress.lion.tours.length,3);
  fail=false;await run(progress);
  assert.deepEqual(requested,['TPE:1','TPE:2','KHH:1','KHH:2','KHH:2','KHH:3']);
  assert.equal(progress.lion.status,'done');assert.equal(progress.lion.tours.length,5);
  assert.equal(progress.lion.total,undefined);assert.equal(progress.lion.pages,5);
  assert.deepEqual([...new Set(progress.lion.tours.map(t=>t.airport))],['TPE','KHH']);

  // A no-matches region is not a failure, including in a fresh pagination worker.
  const seen=[];let allEmpty=false;
  globalThis.fetch=async(url,options)=>{
   const {variables:v}=JSON.parse(options.body);seen.push(`${v.travelCd}:${v.pageNo}`);
   return Response.json({data:{getGfgSearchGrup:allEmpty||v.travelCd!=='1A_ALL'?{error:{msgCode:'COM009'},data:null}:{error:null,data:{totalSize:11,totalPage:2,grup:[]}}}});
  };
  const sq={...q,airport:['TPE'],minBudget:45001};
  const first=await searchProvider('settour',sq,1);
  assert.equal(first.next,2);assert.equal(first.total,11);assert.equal(seen.length,7);
  const second=await searchProvider('settour',sq,2);
  assert.equal(second.next,null);assert.equal(second.total,11);assert.equal(seen.length,8);
  const freshPage=await searchProvider('settour',{...sq,minBudget:45002},2);
  assert.equal(freshPage.next,null);assert.equal(freshPage.total,11);
  allEmpty=true;
  const empty=await searchProvider('settour',{...sq,minBudget:45003},1);
  assert.equal(empty.next,null);assert.equal(empty.total,0);assert.deepEqual(empty.tours,[]);
  globalThis.fetch=async()=>Response.json({errors:[{message:'partial query failure'}],data:{getGfgSearchGrup:{error:{msgCode:'COM009'},data:null}}});
  await assert.rejects(()=>searchProvider('settour',{...sq,minBudget:45004},1),/查詢未完成/);
 } finally {globalThis.fetch=originalFetch;}
}
