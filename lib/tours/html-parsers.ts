import {load} from "cheerio/slim";
import {amount,airportCode,normalDate,dedupe,type Tour} from "./model";
const clean=(s:string)=>s.replace(/\s+/g," ").trim();
export function parseBegonia(html:string,provider:string,origin:string,page:number){
 const $=load(html),tours:Tour[]=[];
 $('figure.block_style').each((_,el)=>{
  const row=$(el),a=row.find('a.w-100[href]').first(),href=a.attr('href');
  if(!href||!row.find(".price_box").length)return;
  const u=new URL(href,origin);if(u.origin!==origin||!u.pathname.toLowerCase().includes('/products/group/detail'))return;
  const count=row.find('.available').not('.d-none').first().find('span').text(),status=clean(row.find('a.btn-primary').first().text());
  const title=clean(a.find('h4').text());if(!title)return;
  tours.push({id:u.searchParams.get('id')||href,provider,title,url:u.href,date:normalDate(row.find('.go-date').first().text()),days:amount(row.find('.item_days').first().text()),price:amount(row.find('.price_box .text-danger').first().text()),priceKind:'from',airport:airportCode(row.find('.airport').first().text()),status:count?`可售 ${count} 位`:status||'請洽旅行社',available:/候補|額滿|截止/.test(status)?false:count?Number(count)>0:null});
 });
 if(!tours.length&&!/查無|沒有符合|無符合|找不到|沒有搜尋|0\s*(?:筆|個)/.test($.text()))throw new Error('此旅行社搜尋格式已變更');
 const pages=$(".pagination a[onclick]").filter((_,el)=>!$(el).closest(".disabled, [aria-disabled=\"true\"]").length).toArray().map(el=>Number($(el).attr("onclick")?.match(/getPage\('([0-9]+)'\)/)?.[1]||0));
 return {tours:dedupe(tours),next:pages.some(n=>n>page)?page+1:null};
}
export function parseGalilee(html:string,page:number){
 if(html.trim()==='END')return {tours:[],next:null};
 const $=load(html),tours:Tour[]=[];
 $('.PageListRow').each((_,el)=>{const row=$(el),title=clean(row.find('[data-layer="itemName"]').text()),href=row.find('.aCoverLink').attr('href');if(!href||!title)return;const status=clean(row.find('.hasCTA').text()),url=new URL(href,'https://www.galilee.com.tw');
  if(url.origin!=='https://www.galilee.com.tw')return;
  tours.push({id:url.pathname,provider:'galilee',title,url:url.href,date:normalDate(row.find('.tr .date').first().text()),days:Number(title.normalize('NFKC').match(/(\d+)\s*[天日]/)?.[1]||0),price:amount(row.find('[data-layer="itemPrice"]').first().text()),airport:airportCode(row.find('.to .airport span').first().text()),status,available:/候補|額滿|截止/.test(status)?false:/預定|預訂|報名/.test(status)?true:null});
 });
 if(!tours.length)throw new Error('加利利搜尋格式已變更');
 return {tours,next:page+1};
}
export function parsePhoenix(html:string,airport:string,page:number){
 const $=load(html),tours:Tour[]=[];
 $('table.table-hover tr').each((_,el)=>{const cells=$(el).children('td'),a=cells.eq(1).find('a'),href=a.attr('href');if(!href?.startsWith('/TOU/TOU0020/'))return;const status=clean(cells.eq(11).text());
 tours.push({id:href.split('/').at(-1)!,provider:'phoenix',title:clean(a.text()),url:'https://www.travel.com.tw'+href,date:normalDate(cells.eq(3).text().replaceAll('.','-')),days:amount(cells.eq(5).text()),price:amount(cells.eq(6).text()),airport:airport==='TPE'?'TPE':'unknown',status:status||'請洽旅行社',available:/候補|截止|額滿/.test(status)?false:/報名/.test(status)?true:null});});
 const total=Number(clean($.text()).match(/共\s*([\d,]+)\s*筆/)?.[1]?.replaceAll(',','')||0);
 if(!tours.length&&!/查無|沒有符合|共\s*0\s*筆/.test($.text()))throw new Error('鳳凰搜尋格式已變更');
 return {tours,total,next:page*20<total?page+1:null};
}
export function parseSunday(html:string){
 const $=load(html),tours:Tour[]=[];
 $('.tours-list ol>li').each((_,el)=>{const row=$(el),parts=row.find('.tl-itinerary').children('span'),a=parts.eq(1).find('a').first(),href=a.attr('href');if(!href?.startsWith('itinerary.php?'))return;const status=clean(row.find('.tl-tours>span').eq(2).text());
 tours.push({id:href,provider:'sunday',title:clean(a.text()),url:new URL(href,'https://www.sundaytour.com.tw/zh-tw/tours/').href,date:normalDate(parts.eq(0).text()),days:amount(parts.eq(2).text()),price:amount(row.find('.tl-flight>span').eq(1).text()),airport:'unknown',status,available:/截止|滿團|候補/.test(status)?false:/報名|成團/.test(status)?true:null});});
 if(!tours.length&&!/查無|沒有符合|無相關/.test($.text()))throw new Error('晴天搜尋格式已變更');
 return tours;
}
export function parseMitravel(html:string){
 const $=load(html),tours:Tour[]=[];
 $('a.flights-table-list').each((_,el)=>{const row=$(el),cells=row.children('div'),href=row.attr('href');if(!href?.startsWith('tw/journey/daily/'))return;
 const title=clean(cells.eq(1).children('div').find('p').first().text()),status=clean(cells.eq(4).children('div').text());
 tours.push({id:href,provider:'mitravel',title,url:new URL(href,'https://www.mitravel.com.tw/').href,date:normalDate(cells.eq(0).children('p').last().text()),days:Number(title.normalize('NFKC').match(/(\d+)\s*[天日]/)?.[1]||0),price:amount(cells.eq(3).children('p').last().text()),airport:'unknown',status,available:/滿團|截止|候補/.test(status)?false:/報名|成團|席次/.test(status)?true:null});});
 if(!tours.length&&!/共\s*0\s*筆|查無|沒有符合/.test($.text()))throw new Error('華友搜尋格式已變更');
 return tours;
}
