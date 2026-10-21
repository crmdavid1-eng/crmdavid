"use client";

import { useSyncExternalStore } from "react";

export type Toast = { id: number; text: string; tone: "ok" | "error"; action?: { label: string; run: () => void } };

let toasts: Toast[] = [];
let seq = 0;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export function toast(text: string, opts: Partial<Omit<Toast, "id" | "text">> = {}) {
  const t: Toast = { id: ++seq, text, tone: opts.tone ?? "ok", action: opts.action };
  toasts = [...toasts.slice(-2), t];
  emit();
  setTimeout(() => dismiss(t.id), t.action ? 6000 : 3000);
}

export function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

const empty: Toast[] = [];
export function useToasts() {
  return useSyncExternalStore(
    (f) => { subs.add(f); return () => subs.delete(f); },
    () => toasts,
    () => empty,
  );
}
