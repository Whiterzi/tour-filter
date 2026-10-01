import { splitTerms, type Tour } from "./model";
const normalize = (value: string) => value.normalize("NFKC").toLowerCase();

export function excludedFromResults(tour: Tour, keywords: string) {
  const text = normalize(`${tour.title} ${tour.destination || ""}`);
  return splitTerms(keywords).some(word => text.includes(normalize(word)));
}

export function tourSearchQuery(provider: string, tour: Pick<Tour, "title" | "destination">) {
  const title = tour.title.normalize("NFKC");
  const region = title.match(/濟州(?:島)?|濟洲(?:島)?|釜山|首爾|清州|大邱|北海道|沖繩|東京|大阪|京都|九州|福岡|熊本|名古屋|四國|北陸|東北|青森|仙台|富國島|峴港|會安|河內|下龍灣|胡志明|芽莊|北越|中越|南越|曼谷|清邁|普吉(?:島)?|芭達雅|峇里島|峇里|沙巴|吉隆坡|檳城|馬六甲|長灘島|宿霧|薄荷島|帛琉|關島|上海|北京|張家界|九寨溝|桂林|黃山|新疆|西藏|巴黎|倫敦|羅馬|布拉格|德瑞|奧捷|法瑞義|法瑞|荷比法|克斯|紐西蘭|冰島|芬蘭|阿拉斯加|夏威夷/)?.[0];
  const country = title.match(/日本|韓國|越南|泰國|馬來西亞|新加坡|印尼|菲律賓|中國|香港|澳門|土耳其|埃及|希臘|義大利|意大利|法國|瑞士|德國|奧地利|捷克|英國|荷蘭|比利時|西班牙|葡萄牙|克羅埃西亞|挪威|瑞典|丹麥|澳洲|美國|加拿大|印度|尼泊爾|不丹|斯里蘭卡|馬爾地夫|杜拜/)?.[0];
  const place = (region || tour.destination?.trim() || country || title).replace(/濟[州洲]島?/, "濟州");
  return `${provider} ${place}`;
}
