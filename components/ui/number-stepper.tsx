"use client";

import { Minus, Plus } from "lucide-react";
import { Input } from "./input";

export function NumberStepper({ id, label, value, min, max, onChange }: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const change = (amount: number) => onChange(Math.max(min, Math.min(max, (Number.isFinite(value) ? value : min) + amount)));
  return <div className="number-stepper">
    <button type="button" aria-label={`減少${label}`} disabled={value <= min} onClick={() => change(-1)}><Minus size={14}/></button>
    <Input id={id} aria-label={label} type="number" inputMode="numeric" min={min} max={max} step={1} value={value} onChange={event => onChange(Number(event.target.value))}/>
    <button type="button" aria-label={`增加${label}`} disabled={value >= max} onClick={() => change(1)}><Plus size={14}/></button>
  </div>;
}
