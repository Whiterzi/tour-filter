import { airportCode, amount, normalDate, validDate, type Query, type SingleAirportQuery, type Tour } from "./model";

// Country groups from the official ListRegionData response (2026-10-01).
// Each response embeds the full list; the site's 50-row paging is client-side.
export const colaRegions = [
  ["A", "日本"], ["B", "韓國"], ["C", "泰國"], ["D", "馬新"],
  ["E", "印尼"], ["P", "菲律賓"], ["F", "中南半島"], ["H", "港澳廣東"],
  ["G", "中國大陸"], ["L", "歐洲"], ["I", "美加"], ["K", "紐澳"],
  ["M", "南亞中東非洲"], ["J", "太平洋印度洋島嶼"], ["N", "全球郵輪"],
] as const;

export const COLA_RESULT_LIMIT = 500;
const dayMs = 86400000;

// A stateless cursor walks a preorder date tree for each region. An uncapped
// response skips its entire subtree; a capped one visits its two disjoint halves.
// This keeps retry/resume correct across Workers and after cache eviction.
export function colaBatch(q: Query, page: number) {
  const startTime = Date.parse(q.start), days = Math.round((Date.parse(q.end) - startTime) / dayMs) + 1;
  const span = 2 * days - 1, regionIndex = Math.floor((page - 1) / span);
  const region = colaRegions[regionIndex];
  if (!Number.isSafeInteger(page) || page < 1 || !region) throw new Error("可樂查詢批次不正確");
  let offset = (page - 1) % span, start = 0, length = days;
  while (offset > 0) {
    offset--;
    const leftLength = Math.ceil(length / 2), leftSpan = 2 * leftLength - 1;
    if (offset < leftSpan) length = leftLength;
    else { offset -= leftSpan; start += leftLength; length -= leftLength; }
  }
  const next = page + 2 * length - 1;
  return {
    region, start: new Date(startTime + start * dayMs).toISOString().slice(0, 10),
    end: new Date(startTime + (start + length - 1) * dayMs).toISOString().slice(0, 10),
    next: next <= span * colaRegions.length ? next : null,
    splitNext: length > 1 ? page + 1 : null,
  };
}

export function colaSearchUrl(q: SingleAirportQuery, region: string) {
  // Colatour city codes: TAO is Taoyuan; TPE means both Taipei airports.
  const departures: Record<string, string> = { all: "", TPE: "TAO", TSA: "TSA", RMQ: "TXG", KHH: "KHH" };
  const params = new URLSearchParams({
    RegionCode: region, bound: "out", DepartureCity: departures[q.airport],
    StartDate: q.start.replaceAll("-", "/"), EndDate: q.end.replaceAll("-", "/"),
    TourType: "Tour", PriceRange: `${q.minBudget},${q.budget}`,
    // Preserve unknown and app-only availability; matches() hides known full departures.
    Booking: "all",
  });
  // Official ranges, not exact days. Leave unverified ranges broad to avoid omissions.
  if (q.days >= 3 && q.days <= 20) params.set("TourDay", String([5, 8, 11, 14, 17, 20].find(end => q.days <= end)));
  return `https://tour.colatour.com.tw/search?${params}`;
}

type Row = Record<string, unknown>;
const isRecord = (value: unknown): value is Row => !!value && typeof value === "object" && !Array.isArray(value);
const formatError = () => new Error("可樂搜尋資料格式變更或傳輸未完成，請稍後重試");

export function parseCola(html: string): Tour[] {
  // Read JSON only. Never evaluate scripts from the external page.
  const chunks = [...html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)]
    .map(match => JSON.parse(match[1]) as string).join("");
  const models = new Map<string, unknown>();
  for (const line of chunks.split("\n")) {
    const match = line.match(/^([\da-f]+):([\[{].*)$/);
    if (!match) continue;
    try { models.set(match[1], JSON.parse(match[2])); } catch { /* Truncated models cannot supply a valid result. */ }
  }
  const resolve = (value: unknown, depth = 0): unknown => {
    if (typeof value !== "string" || !value.startsWith("$") || value.startsWith("$$")) return value;
    if (depth > 20) throw formatError();
    const ref = value.match(/^\$([\da-f]+)((?::[^:]+)*)$/);
    if (!ref || !models.has(ref[1])) throw formatError();
    let target = models.get(ref[1]);
    for (const key of ref[2].split(":").slice(1)) {
      target = resolve(target, depth + 1);
      if (Array.isArray(target)) target = target[key === "props" ? 3 : Number(key)];
      else if (isRecord(target) && Object.hasOwn(target, key)) target = target[key];
      else throw formatError();
    }
    return resolve(target, depth + 1);
  };
  let data: Row | undefined;
  const visit = (value: unknown) => {
    if (isRecord(value) && Object.hasOwn(value, "TourData_List")) data = value;
    else if (Array.isArray(value)) value.forEach(visit);
    else if (isRecord(value)) Object.values(value).forEach(visit);
  };
  models.forEach(visit);
  if (!data || typeof data.noData !== "boolean") throw formatError();
  const rows = resolve(data.TourData_List);
  if (!Array.isArray(rows)) throw formatError();
  // Recommendations offered on an empty search are not search hits.
  if (data.noData) return [];
  if (!rows.length) throw formatError();
  const tours = rows.map(value => {
    const row = resolve(value);
    if (!isRecord(row)) throw formatError();
    const text = (field: string) => {
      const v = resolve(row[field]);
      return typeof v === "string" ? v.replace(/^\$\$/, "$").trim() : typeof v === "number" ? String(v) : "";
    };
    const code = text("Tour_Code"), title = text("Tour_Name"), date = normalDate(text("Tour_Date"));
    const days = Number(text("Tour_Days"));
    if (!code || !title || !validDate(date) || !Number.isInteger(days) || days < 1 || !Object.hasOwn(row, "Retail_Price")) throw formatError();
    const status = text("Sign_Up"), seatsText = text("Available_Pax");
    const seats = /^-?\d+$/.test(seatsText) ? Number(seatsText) : null;
    const closed = /關團|額滿|滿團|候補|截止/.test(status) || /滿/.test(seatsText) || (seats !== null && seats <= 0);
    return {
      id: `${code}:${date}`, provider: "cola", title,
      url: `https://tour.colatour.com.tw/itinerary?${new URLSearchParams({ TourCode: code, TourDate: date.replaceAll("-", "/") })}`,
      date, days, price: amount(text("Retail_Price")), airport: airportCode(text("Departure_Airport")),
      status: `${status || "請洽旅行社"}${!closed && seats !== null ? ` · 可售 ${seats} 位` : ""}`,
      available: closed ? false : seats !== null && seats > 0 ? true : null,
      destination: [text("Line_CodeAndName"), text("Region_CodeAndName")].map(s => s.replace(/^[^_]*_/, "")).filter(Boolean).join(" "),
    } satisfies Tour;
  });
  return tours;
}
