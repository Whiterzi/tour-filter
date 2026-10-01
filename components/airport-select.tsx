"use client";
import { airports, airportSelection, type Query } from "@/lib/tours/model";
import { Checkbox } from "./ui/checkbox";

export function AirportSelect({value,onChange}:{value:Query["airport"];onChange:(value:string[])=>void}) {
 const selected=airportSelection(value);
 const toggle=(id:string)=>{
  if(id==="all"){onChange(["all"]);return;}
  const next=selected.includes(id)?selected.filter(code=>code!==id):[...selected.filter(code=>code!=="all"),id];
  onChange(next.length?Object.keys(airports).filter(code=>next.includes(code)):["all"]);
 };
 return <fieldset className="airport-select"><legend>出發機場 <span>可複選</span></legend>
  <div>{Object.entries(airports).map(([id,name])=><label key={id} className={selected.includes(id)?"selected":""}><Checkbox aria-label={id==="all"?"不限出發機場":`${name}出發`} checked={selected.includes(id)} onCheckedChange={()=>toggle(id)}/>{id==="all"?"不限機場":name}</label>)}</div>
 </fieldset>;
}
