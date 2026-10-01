"use client";
export const RESULTS_PER_PAGE=30;
export function ResultPagination({page,total,onChange,compact=false}:{page:number;total:number;onChange:(page:number)=>void;compact?:boolean}) {
 const pages=Math.max(1,Math.ceil(total/RESULTS_PER_PAGE));
 const wanted=[...new Set([1,page-1,page,page+1,pages])].filter(n=>n>=1&&n<=pages).sort((a,b)=>a-b);
 const mobile=[...new Set([1,page,pages])];
 const numbers=(values:number[])=>values.map((n,i)=><span className="page-number" key={n}>{i>0&&n>values[i-1]+1&&<span className="page-gap">…</span>}<button className={n===page?"current":""} aria-label={`第 ${n} 頁`} aria-current={n===page?"page":undefined} onClick={()=>onChange(n)}>{n}</button></span>);
 return <nav className={`result-pagination${compact?" compact":""}`} aria-label={compact?"列表快速換頁":"搜尋結果分頁"}>
  {!compact&&<span>{total?`${(page-1)*RESULTS_PER_PAGE+1}–${Math.min(page*RESULTS_PER_PAGE,total)} / ${total.toLocaleString("zh-TW")} 筆`:"0 筆"}</span>}
  <div><button disabled={page<=1} onClick={()=>onChange(page-1)} aria-label="上一頁">上一頁</button>
   {compact?<span>{page} / {pages}</span>:<><div className="page-numbers desktop">{numbers(wanted)}</div><div className="page-numbers mobile">{numbers(mobile)}</div></>}
   <button disabled={page>=pages} onClick={()=>onChange(page+1)} aria-label="下一頁">下一頁</button></div>
 </nav>;
}
