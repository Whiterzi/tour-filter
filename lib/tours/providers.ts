import type { ProviderInfo } from "./provider-info";

export type Provider = ProviderInfo;
export const providers: Provider[] = [
  {
    "id": "bwt",
    "name": "百威旅遊",
    "url": "https://www.bwt.com.tw/Search",
    "live": true,
    "focus": "綜合行程"
  },
  {
    "id": "cola",
    "name": "可樂旅遊",
    "url": "https://tour.colatour.com.tw/search",
    "live": true,
    "focus": "綜合行程"
  },
  {
    "id": "fantasy",
    "name": "上順旅行社",
    "url": "https://www.fantasy-tours.com/",
    "live": true,
    "focus": "日本、歐洲"
  },
  {
    "id": "galilee",
    "name": "加利利旅遊",
    "url": "https://www.galilee.com.tw/",
    "live": true,
    "focus": "歐洲、蜜月"
  },
  {
    "id": "lion",
    "name": "雄獅旅遊",
    "url": "https://travel.liontravel.com/search",
    "live": true,
    "focus": "綜合行程"
  },
  {
    "id": "mitravel",
    "name": "華友旅行",
    "url": "https://www.mitravel.com.tw/",
    "live": true,
    "focus": "歐洲、深度旅遊"
  },
  {
    "id": "phoenix",
    "name": "鳳凰旅遊",
    "url": "https://www.travel.com.tw/",
    "live": true,
    "focus": "綜合、長程旅遊"
  },
  {
    "id": "settour",
    "name": "東南旅遊",
    "url": "https://tour.settour.com.tw/search",
    "live": true,
    "focus": "綜合行程"
  },
  {
    "id": "spunk",
    "name": "世邦旅遊",
    "url": "https://www.4p.com.tw/",
    "live": true,
    "focus": "綜合行程"
  },
  {
    "id": "sunday",
    "name": "晴天旅遊",
    "url": "https://www.sundaytour.com.tw/",
    "live": true,
    "focus": "深度、長程旅遊"
  },
  {
    "id": "travel4u",
    "name": "山富旅遊",
    "url": "https://www.travel4u.com.tw/group/search/",
    "live": true,
    "focus": "綜合行程"
  }
];
export const providerById=Object.fromEntries(providers.map(p=>[p.id,p]));
