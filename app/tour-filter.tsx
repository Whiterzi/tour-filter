"use client";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Search, ExternalLink, LoaderCircle, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TourSearchShortcut } from "@/components/tour-search-shortcut";
import { excludedFromResults } from "@/lib/tours/result-filters";
import { DestinationChips } from "@/components/destination-chips";
import { AirportSelect } from "@/components/airport-select";
import { ResultPagination, RESULTS_PER_PAGE } from "@/components/result-pagination";
import { NumberStepper } from "@/components/ui/number-stepper";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { airports, airportLabel, defaults, validateQuery, matches, dedupe, type Query, type SearchResult, type Tour } from "@/lib/tours/model";
import { tourCountries } from "@/lib/tours/countries";
import { resultSorts, sortTours, providerColor } from "@/lib/tours/result-display";
import { loadSources, type SourceProgress } from "@/lib/tours/load";
import { registerTourTools, type TourPageBridge } from "@/lib/tours/webmcp";
import type { ProviderInfo } from "@/lib/tours/provider-info";

const money = (n:number) => n.toLocaleString("zh-TW");
const weekday = (s:string) => `週${"日一二三四五六"[new Date(s).getUTCDay()]}`;
const tourKey = (t:Tour) => `${t.provider}:${t.id}`;
const agencyStyle = (id:string) => ({"--agency-color":providerColor(id),"--agency-tint":`${providerColor(id)}09`} as CSSProperties);
function Choice({value,onChange,items,label}:{value:string;onChange:(v:string)=>void;items:Record<string,string>;label:string}) {
 return <Select value={value} onValueChange={v => v && onChange(v)}><SelectTrigger aria-label={label}><SelectValue/></SelectTrigger><SelectContent>{Object.entries(items).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>;
}
const sourceState = (r?:SourceProgress) => !r ? "尚未讀取" : r.status === "loading" ? `讀取第 ${r.pages + 1} 批` : r.status === "queued" ? "等待讀取" : r.status === "error" ? "讀取中斷" : r.status === "paused" ? "已暫停" : "列表已讀完";

export default function TourFilter({ providers }: { providers: ProviderInfo[] }) {
 const liveIds = useMemo(() => providers.filter(p => p.live).map(p => p.id), [providers]);
 const providerById = useMemo(() => Object.fromEntries(providers.map(p => [p.id, p])), [providers]);
 const providerNames = useMemo(() => Object.fromEntries(providers.map(p => [p.id, p.name])), [providers]);
 const [query,setQuery] = useState<Query>(defaults), [active,setActive] = useState<Query>(defaults);
 const [selected,setSelected] = useState<string[]>(liveIds), [records,setRecords] = useState<Record<string,SourceProgress>>({});
 const [busy,setBusy] = useState(false), [started,setStarted] = useState(false), [ready,setReady] = useState(false);
 const [tab,setTab] = useState("results"), [sort,setSort] = useState("price"), [agencySort,setAgencySort] = useState("default"), [agencySearch,setAgencySearch] = useState("");
 const [resultExclude,setResultExclude] = useState(""), [sidebarCollapsed,setSidebarCollapsed] = useState(false);
 const [country,setCountry] = useState("all"), [page,setPage] = useState(1), [error,setError] = useState("");
 const run = useRef(0), controller = useRef<AbortController|null>(null);
 const sourceControllers = useRef<Record<string,AbortController>>({}), selectedRef = useRef(selected);
 const listTop = useRef<HTMLDivElement|null>(null);
 const resultsTop = useRef<HTMLElement|null>(null);
 useEffect(() => {
  try {
   const saved = JSON.parse(localStorage.getItem("tour-filter-v1") || "null");
   if (saved) {
    // Hydrate browser-only preferences after the server render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery(validateQuery(saved.query));
    if (typeof saved.sidebarCollapsed === "boolean") setSidebarCollapsed(saved.sidebarCollapsed);
    if (Array.isArray(saved.selected)) {
     const ids=saved.selected.filter((id:unknown) => typeof id === "string" && liveIds.includes(id));
     selectedRef.current=ids; setSelected(ids);
    }
   }
  } catch {}
  setReady(true);
  return () => controller.current?.abort();
 },[liveIds]);
 useEffect(() => {if (ready) try {localStorage.setItem("tour-filter-v1",JSON.stringify({query,selected,sidebarCollapsed}));} catch {}},[query,selected,sidebarCollapsed,ready]);
 const patch = (key:keyof Query,value:Query[keyof Query]) => setQuery(q => ({...q,[key]:value}));
 function selectProviders(ids:string[]) {
  const allowed=[...new Set(ids)].filter(id=>liveIds.includes(id));
  for(const [id,abort] of Object.entries(sourceControllers.current)) if(!allowed.includes(id)) abort.abort();
  selectedRef.current=allowed; setSelected(allowed); setPage(1);
 }
 const toggle = (id:string) => selectProviders(selectedRef.current.includes(id) ? selectedRef.current.filter(x => x !== id) : [...selectedRef.current,id]);
 const sourceIds = selected.filter(id => providerById[id]?.live);
 const loadedTours = useMemo(() => dedupe(selected.flatMap(id => records[id]?.tours || [])).filter(t => matches(t,active)),[selected,records,active]);
 const countriesByTour = useMemo(() => new Map(loadedTours.map(t=>[tourKey(t),tourCountries(t)])),[loadedTours]);
 const keywordTours = useMemo(() => loadedTours.filter(t => !excludedFromResults(t,resultExclude)),[loadedTours,resultExclude]);
 const categories = useMemo(() => {
  const counts=new Map<string,number>();
  for(const t of keywordTours) {
   const labels=countriesByTour.get(tourKey(t))||[];
   for(const label of labels.length?labels:["待確認"]) counts.set(label,(counts.get(label)||0)+1);
  }
  return [...counts].sort((a,b)=>a[0]==="待確認"?1:b[0]==="待確認"?-1:a[0].localeCompare(b[0],"zh-TW"));
 },[keywordTours,countriesByTour]);
 const tours = useMemo(() => sortTours(keywordTours.filter(t=>{
  const labels=countriesByTour.get(tourKey(t))||[];
  return country==="all"||(country==="待確認"?!labels.length:labels.includes(country));
 }),sort,providerNames),[keywordTours,countriesByTour,country,sort,providerNames]);
 const currentPage = Math.min(page,Math.max(1,Math.ceil(tours.length/RESULTS_PER_PAGE)));
 if(page!==currentPage)setPage(currentPage);
 const agencies = useMemo(() => providers.filter(p => (p.name+p.focus).includes(agencySearch)).sort((a,b) => agencySort === "name" ? a.name.localeCompare(b.name,"zh-TW") : 0),[providers,agencySearch,agencySort]);
 const remaining = sourceIds.filter(id => records[id]?.status !== "done");
 const completed = sourceIds.length-remaining.length;
 const readCount = sourceIds.reduce((sum,id) => sum+(records[id]?.tours.length || 0),0);
 const failed = sourceIds.filter(id => records[id]?.status === "error").length;
 const dirty = started && JSON.stringify(query) !== JSON.stringify(active);
 async function fetchSources(q:Query,ids:string[],previous:Record<string,SourceProgress> = {}) {
  const ticket = ++run.current;
  controller.current?.abort();
  const abort = new AbortController(); controller.current = abort;
  const allowed=ids.filter(id=>selectedRef.current.includes(id)&&liveIds.includes(id));
  const perSource=Object.fromEntries(allowed.map(id=>[id,new AbortController()]));
  sourceControllers.current=perSource;
  setBusy(true); setError("");
  try {
   await loadSources({query:q,ids:allowed,previous,signal:abort.signal,
    sourceSignals:Object.fromEntries(Object.entries(perSource).map(([id,c])=>[id,c.signal])),
    onUpdate:(id,progress) => {if (ticket === run.current) setRecords(s => ({...s,[id]:progress}));},
    fetchPage:async(id,q,page,signal) => {
     const response = await fetch("/api/search",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({provider:id,query:q,page}),signal});
     const result = await response.json() as SearchResult;
     if (!response.ok) throw new Error(result.error || "來源暫時無法讀取");
     return result;
    },
   });
  } finally {if (ticket === run.current) {setBusy(false);sourceControllers.current={};}}
 }
 function search(input=query,ids=sourceIds) {
  try {
   const q = validateQuery(input);
   if (!ids.length) throw new Error("請至少選擇一家旅行社");
   setQuery(q); setActive(q); setStarted(true); setRecords({}); setResultExclude(""); setCountry("all"); setPage(1); setTab("results");
   if(window.matchMedia("(max-width: 760px)").matches){
    setSidebarCollapsed(true);
    requestAnimationFrame(()=>requestAnimationFrame(()=>resultsTop.current?.scrollIntoView({block:"start"})));
   }
   return fetchSources(q,ids);
  } catch(e) {setError(e instanceof Error ? e.message : "請檢查條件");}
 }
 const bridge = useRef<TourPageBridge|null>(null);
 useEffect(() => {bridge.current = {
  read:limit => ({query:active,selected,resultExclude,country,sort,page:currentPage,total:tours.length,results:tours.slice(0,limit),sources:sourceIds.map(id => ({id,status:records[id]?.status,scanned:records[id]?.scanned,next:records[id]?.next,error:records[id]?.error,note:records[id]?.note}))}),
  search:async(q,ids) => {if (busy) throw new Error("A search is already running"); selectProviders(ids); await search(q,ids); await new Promise(resolve => setTimeout(resolve,0)); return bridge.current?.read(30);},
 };});
 useEffect(() => registerTourTools(() => bridge.current,liveIds),[liveIds]);
 function stop() {controller.current?.abort(); setBusy(false);}
 function changePage(next:number) {setPage(next);listTop.current?.scrollIntoView({block:"start"});}
 function changeCountry(next:string) {setCountry(next);setPage(1);}

 return <main>
  <header className="site-header"><h1>旅行團快篩</h1><span>{liveIds.length} 家旅行社</span></header>
  <div className={`workspace${sidebarCollapsed ? " sidebar-collapsed" : ""}`}>
   <aside>
    <div className="sidebar-heading">{!sidebarCollapsed && <h2>搜尋條件</h2>}<button type="button" className="sidebar-toggle" aria-label={sidebarCollapsed ? "展開篩選側欄" : "收合篩選側欄"} title={sidebarCollapsed ? "展開篩選側欄" : "收合篩選側欄"} aria-expanded={!sidebarCollapsed} aria-controls="search-options" onClick={() => setSidebarCollapsed(value => !value)}>{sidebarCollapsed ? <PanelLeftOpen size={18}/> : <PanelLeftClose size={18}/>}<span>{sidebarCollapsed ? "展開篩選" : "收合"}</span></button></div>
    <div id="search-options" hidden={sidebarCollapsed}>
    <form onSubmit={e => {e.preventDefault(); void search();}}>
     <AirportSelect value={query.airport} onChange={value=>patch("airport",value)}/>
     <div className="field days-field"><label htmlFor="tour-days">旅遊天數</label><NumberStepper id="tour-days" label="旅遊天數" min={1} max={40} value={query.days} onChange={value => patch("days",value)}/></div>
     <fieldset className="date-fields"><legend>出發日期</legend><Input type="date" aria-label="最早出發日" value={query.start} onChange={e => patch("start",e.target.value)}/><span className="to">至</span><Input type="date" aria-label="最晚出發日" value={query.end} onChange={e => patch("end",e.target.value)}/></fieldset>
     <fieldset><legend>每人團費（NT$）</legend><div className="two"><label className="field">下限<Input type="number" min="0" max="1000000" aria-label="團費下限" value={query.minBudget} onChange={e => patch("minBudget",Number(e.target.value))}/></label><label className="field">上限<Input type="number" min="1" max="1000000" aria-label="團費上限" value={query.budget} onChange={e => patch("budget",Number(e.target.value))}/></label></div><p className="note">不含小費、簽證與其他加價。</p></fieldset>
     <label className="field">目的地或行程關鍵字<Input value={query.keyword} onChange={e => patch("keyword",e.target.value)} placeholder="釜山、泰國、溫泉" maxLength={100}/><small>多個詞用頓號分隔，符合其中一個即可。</small></label>
     <div className="field"><label htmlFor="excluded-destinations">排除目的地</label><DestinationChips id="excluded-destinations" value={query.exclude} onChange={value => patch("exclude",value)}/></div>
     <label className="check"><Checkbox checked={query.weekend} onCheckedChange={v => patch("weekend",v === true)}/>行程包含週六或週日</label>
     <label className="check"><Checkbox checked={query.available} onCheckedChange={v => patch("available",v === true)}/>隱藏已知額滿團期</label>
     {error && <p className="error" role="alert">{error}</p>}
     <Button type="submit" className="search" disabled={busy}>{busy ? <LoaderCircle size={16} className="spin"/> : <Search size={16}/>} {busy ? "搜尋中" : "搜尋"}</Button>
     {busy && <button type="button" className="cancel" onClick={stop}>暫停讀取</button>}
    </form>
    <section className="agency-select"><div className="section-line"><h2>旅行社</h2><span>已選 {selected.length} 家</span></div>
     <div className="quick-actions"><button onClick={() => selectProviders(liveIds)}>全選</button><button onClick={() => selectProviders([])}>清除</button></div>
     <div className="agency-checks">{providers.map(p => <label key={p.id} style={agencyStyle(p.id)}><Checkbox checked={selected.includes(p.id)} onCheckedChange={() => toggle(p.id)}/><i className="agency-dot" aria-hidden="true"/>{p.name}</label>)}</div>
     <button className="text-link" onClick={() => setTab("agencies")}>查看旅行社資料</button>
     <p className="local-note">條件與選擇會保留在這台裝置。</p>
    </section>
    </div>
   </aside>
   <section className="results" ref={resultsTop}>
    <nav className="tabs" aria-label="頁面"><button className={tab === "results" ? "active" : ""} onClick={() => setTab("results")}>行程</button><button className={tab === "agencies" ? "active" : ""} onClick={() => setTab("agencies")}>旅行社資料</button></nav>
    {tab === "results" ? <>
     <div className="result-title"><div><h2>{started ? `${money(tours.length)} 筆符合` : "行程搜尋"}</h2><p className="result-meta">{started ? `${active.days} 天 · ${airportLabel(active.airport)}出發 · NT$ ${money(active.minBudget)}–${money(active.budget)}` : "設定條件後，各旅行社的團期會列在這裡。"}</p></div><Choice value={sort} onChange={value=>{setSort(value);setPage(1);}} items={resultSorts} label="行程排序"/></div>
     {dirty && <p className="notice">條件已修改，按「搜尋」套用。目前顯示上一次搜尋。</p>}
     {started && <section className="coverage" aria-label="資料讀取進度">
      <details className="source-list"><summary><span className="progress-dot" data-state={failed?"error":busy?"loading":"done"}/>{busy?"讀取中":remaining.length?"尚未讀完":"讀取完成"}<span>{completed}/{sourceIds.length} 家完成{failed > 0 && ` · ${failed} 家中斷`}</span></summary>
       <p className="coverage-note">已讀 {money(readCount)} 筆；讀取中會持續更新結果。以下為各旅行社進度與資料範圍。</p>
       {sourceIds.map(id => {const r = records[id]; return <details key={id} className="source-row">
        <summary><span className="source-name">{providerById[id].name}</span><span className={r?.status === "error" ? "source-state error" : "source-state"}>{r?.status === "loading" && <LoaderCircle size={12} className="spin"/>}{sourceState(r)}</span><span className="source-count">{money(tours.filter(t => t.provider === id).length)} 筆符合</span></summary>
        <div className="source-detail">{r ? <><p>{r.error || r.note}</p><p>已讀取 {money(r.scanned)} 筆，去重後 {money(r.tours.length)} 筆{r.total !== undefined ? ` / 官網回報約 ${money(r.total)} 筆` : ""} · {r.pages} 批{r.fetchedAt && ` · ${new Date(r.fetchedAt).toLocaleString("zh-TW",{hour12:false})}`}</p>{r.status === "error" && <button disabled={busy} onClick={() => void fetchSources(active,[id],records)}>重試第 {r.pages + 1} 批</button>}</> : <p>接續讀取後會加入此旅行社的團期。</p>}</div>
       </details>;})}
      </details>
      <div className="coverage-action">{busy ? <button onClick={stop}>暫停</button> : remaining.length > 0 && <button onClick={() => void fetchSources(active,remaining,records)}>接續讀取</button>}</div>
     </section>}
     {started && loadedTours.length > 0 && <>
      <nav className="country-categories" aria-label="依國家或地區分類">
       <button aria-pressed={country==="all"} onClick={()=>changeCountry("all")}>全部 <span>{money(keywordTours.length)}</span></button>
       {categories.map(([label,count])=><button key={label} aria-pressed={country===label} onClick={()=>changeCountry(label)}>{label} <span>{money(count)}</span></button>)}
       {country!=="all"&&!categories.some(([label])=>label===country)&&<button aria-pressed="true" onClick={()=>changeCountry("all")}>{country} <span>0</span></button>}
      </nav>
      <div className="result-toolbar" ref={listTop}>
       <section className="result-filter" aria-label="結果內篩選"><label htmlFor="result-exclusions" className="sr-only">排除含指定字詞的行程</label><DestinationChips compact id="result-exclusions" value={resultExclude} onChange={value => {setResultExclude(value);setPage(1);}} label="結果排除關鍵字" placeholder="排除字詞：彩妝、購物、自費（Enter 加入）"/>{resultExclude && <button type="button" onClick={() => {setResultExclude("");setPage(1);}}>清除</button>}</section>
       {tours.length>0&&<ResultPagination compact page={currentPage} total={tours.length} onChange={changePage}/>}
      </div>
     </>}
     {!started ? <div className="welcome"><p>選好日期、天數與團費後，按左側「搜尋」。</p><p>晴天、華友未提供出發機場，選「不限」才會列入。</p></div> : <>
      {!tours.length && <div className="empty"><h3>{loadedTours.length ? "目前分類與排除條件沒有符合行程" : busy ? "尚未讀到符合的團期" : "已讀資料中沒有符合的團期"}</h3><p>{loadedTours.length ? "切換「全部」或移除排除字詞，即可查看其他行程。" : remaining.length ? "仍有來源尚未讀完，可接續讀取或調整條件重新搜尋。" : "可以調整日期、團費或目的地後重新搜尋。"}</p></div>}
      {tours.length > 0 && <div className="tour-list"><div className="list-heading"><span>出發 / 天數</span><span>行程</span><span>每人團費</span></div>{tours.slice((currentPage-1)*RESULTS_PER_PAGE,currentPage*RESULTS_PER_PAGE).map(t => {
       const labels=countriesByTour.get(tourKey(t))||[];
       return <article className="tour-row" style={agencyStyle(t.provider)} key={tourKey(t)}>
        <div className="tour-date"><time dateTime={t.date}>{t.date}</time><span>{weekday(t.date)} · {t.days} 天</span></div>
        <div className="tour-main"><h3><a href={t.url} target="_blank" rel="noreferrer">{t.title}</a></h3><p><span className="agency-badge">{providerById[t.provider].name}</span><span className="country-tags" aria-label="國家／地區" title="依官網目的地與行程名稱辨識">{(labels.length?labels:["待確認"]).map(label=><span key={label}>{label}</span>)}</span><span>{airports[t.airport] || "機場待確認"}出發</span><span>{t.status || (t.available === null ? "席次待確認" : "")}</span></p><TourSearchShortcut provider={providerById[t.provider].name} tour={t}/></div>
        <div className="tour-price"><strong>{money(t.price)}{t.priceKind === "from" && <small> 起</small>}</strong><a href={t.url} target="_blank" rel="noreferrer">官網行程<ExternalLink size={12}/></a></div>
       </article>;
      })}</div>}
      {tours.length > 0 && <ResultPagination page={currentPage} total={tours.length} onChange={changePage}/>}
     </>}
     <p className="footer-note">山富提供代表團期與起價；列表讀完不代表取得各站所有可售日期。國家／地區標籤依官網目的地與標題辨識。團費、名額與成團狀態請至官網確認。</p>
    </> : <>
     <div className="result-title"><h2>旅行社資料</h2></div>
     <div className="agency-tools"><Input aria-label="搜尋旅行社" placeholder="搜尋名稱或路線" value={agencySearch} onChange={e => setAgencySearch(e.target.value)}/><Choice value={agencySort} onChange={setAgencySort} items={{default:"預設順序",name:"依旅行社名稱"}} label="旅行社排序"/></div>
     <div className="agency-list">{agencies.map(p => <article className="agency-row" key={p.id} style={agencyStyle(p.id)}><div className="agency-top"><label><Checkbox checked={selected.includes(p.id)} onCheckedChange={() => toggle(p.id)}/><i className="agency-dot" aria-hidden="true"/><strong>{p.name}</strong></label><a href={p.url} target="_blank" rel="noreferrer" aria-label={`${p.name}官網`}><ExternalLink size={14}/></a></div><p className="muted">{p.focus}</p></article>)}</div>
     {!agencies.length && <div className="empty">沒有符合名稱的旅行社</div>}
    </>}
   </section>
  </div>
  <footer>旅行團快篩 · 實際訂購請洽旅行社</footer>
 </main>;
}
