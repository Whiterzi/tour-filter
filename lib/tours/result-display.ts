import type { Tour } from "./model";
import {tourCountries} from "./countries";
export const resultSorts:Record<string,string>={price:"團費由低到高","price-desc":"團費由高到低",date:"出發日期由近到遠","date-desc":"出發日期由遠到近",provider:"依旅行社名稱",country:"依國家／地區"};
export function sortTours(tours:Tour[],sort:string,providerNames:Record<string,string>){
 const countryNames=sort==="country"?new Map(tours.map(t=>[t,tourCountries(t).join("、")||"待確認"])):new Map();
 return [...tours].sort((a,b)=>{
  const order=sort==="price-desc"?b.price-a.price:sort==="date"?a.date.localeCompare(b.date):sort==="date-desc"?b.date.localeCompare(a.date):sort==="provider"?(providerNames[a.provider]||a.provider).localeCompare(providerNames[b.provider]||b.provider,"zh-TW"):sort==="country"?countryNames.get(a)!.localeCompare(countryNames.get(b)!,"zh-TW"):a.price-b.price;
  return order||a.date.localeCompare(b.date)||a.price-b.price||a.provider.localeCompare(b.provider)||a.id.localeCompare(b.id);
 });
}
const colors:Record<string,string>={lion:"#ad3d49",settour:"#26745d",cola:"#854ba0",travel4u:"#356ab5",bwt:"#b36d27",spunk:"#547c37",fantasy:"#386f8f",galilee:"#756135",phoenix:"#aa4d2d",sunday:"#2f7f87",mitravel:"#6367a6"};
export const providerColor=(id:string)=>colors[id]||"#526b7d";
