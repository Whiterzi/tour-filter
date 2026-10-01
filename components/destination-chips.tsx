"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { splitTerms } from "@/lib/tours/model";

type Entry = { chips: string[]; draft: string };
const separators = /[、,，;；\n\r]/;
const unique = (items: string[]) => {
  const seen = new Set<string>();
  return items.map(item => item.trim()).filter(item => {
    const key = item.normalize("NFKC").toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key); return true;
  });
};

export function DestinationChips({ id, value, onChange, maxLength = 300, label = "新增排除目的地", placeholder = "新增目的地", compact = false }: {
  id: string; value: string; onChange: (value: string) => void; maxLength?: number; label?: string; placeholder?: string; compact?:boolean;
}) {
  const [entry, setEntry] = useState<Entry>(() => ({ chips: unique(splitTerms(value)), draft: "" }));
  const [message, setMessage] = useState("");
  const current = useRef(entry), published = useRef(value), composing = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    // Saved preferences and tool-driven searches can replace the whole value.
    if (value !== published.current) {
      const next = { chips: unique(splitTerms(value)), draft: "" };
      current.current = next; published.current = value; setEntry(next); setMessage("");
    }
  }, [value]);
  function publish(next: Entry) {
    const serialized = [...next.chips, ...(next.draft ? [next.draft] : [])].join("、");
    if (serialized.length > maxLength) {
      setMessage(`合計最多 ${maxLength} 字，請縮短後再加入。`); return false;
    }
    current.current = next; published.current = serialized; setEntry(next); setMessage("");
    // Include uncommitted text, so clicking Search or reloading cannot lose it.
    onChange(serialized); return true;
  }
  function commit(text = current.current.draft) {
    return publish({ chips: unique([...current.current.chips, ...splitTerms(text)]), draft: "" });
  }
  function edit(text: string) {
    if (!composing.current && separators.test(text)) {
      const parts = text.split(/[、,，;；\n\r]/);
      const draft = parts.pop() || "";
      publish({ chips: unique([...current.current.chips, ...parts]), draft });
    } else publish({ ...current.current, draft: text });
  }
  function remove(chip: string) {
    publish({ ...current.current, chips: current.current.chips.filter(item => item !== chip) });
    input.current?.focus();
  }
  return <div className="destination-chips-field">
    <div className="destination-chips" onClick={event => { if (event.target === event.currentTarget) input.current?.focus(); }}>
      {entry.chips.map(chip => <span className="destination-chip" key={chip}>
        <span>{chip}</span><button type="button" aria-label={`移除${chip}`} onMouseDown={event => event.preventDefault()} onClick={() => remove(chip)}><X size={13}/></button>
      </span>)}
      <Input ref={input} id={id} aria-label={label} aria-describedby={`${id}-help${message ? ` ${id}-message` : ""}`} aria-invalid={message ? true : undefined}
        value={entry.draft} placeholder={placeholder} autoComplete="off" enterKeyHint="done"
        maxLength={Math.max(0, maxLength - entry.chips.join("、").length - (entry.chips.length ? 1 : 0))}
        onChange={event => edit(event.target.value)}
        onCompositionStart={() => { composing.current = true; }}
        onCompositionEnd={event => { composing.current = false; edit(event.currentTarget.value); }}
        onBlur={() => { if (!composing.current) commit(); }}
        onKeyDown={event => {
          if (composing.current || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
          if (event.key === "Enter") { event.preventDefault(); commit(); }
          if (event.key === "Backspace" && !current.current.draft && current.current.chips.length) {
            event.preventDefault(); publish({ chips: current.current.chips.slice(0, -1), draft: "" });
          }
        }}
        onPaste={event => {
          const pasted = event.clipboardData.getData("text");
          if (!separators.test(pasted) || composing.current) return;
          event.preventDefault();
          const field = event.currentTarget;
          const text = entry.draft.slice(0, field.selectionStart ?? 0) + pasted + entry.draft.slice(field.selectionEnd ?? entry.draft.length);
          commit(text);
        }}/>
    </div>
    <small className={compact?"sr-only":undefined} id={`${id}-help`}>按 Enter 加入，也可用頓號或逗號分隔。</small>
    {message && <p className="error" id={`${id}-message`} role="alert">{message}</p>}
  </div>;
}
