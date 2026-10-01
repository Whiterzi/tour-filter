"use client";
import { useState } from "react";
import { Search, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { tourSearchQuery } from "@/lib/tours/result-filters";
import type { Tour } from "@/lib/tours/model";

export function TourSearchShortcut({ provider, tour }: { provider: string; tour: Tour }) {
  const [keywords, setKeywords] = useState(() => tourSearchQuery(provider, tour));
  const url = `https://www.google.com/search?${new URLSearchParams({ q: keywords.trim() })}`;
  return <details className="tour-search-shortcut">
    <summary>查找相關資訊</summary>
    <div className="tour-search-controls">
      <Input aria-label={`${provider}的搜尋關鍵字`} value={keywords} onChange={event => setKeywords(event.target.value)} maxLength={300}/>
      {keywords.trim() ? <a href={url} target="_blank" rel="noreferrer"><Search size={13}/>Google 搜尋<ExternalLink size={11}/></a> : <span>請輸入關鍵字</span>}
    </div>
  </details>;
}
