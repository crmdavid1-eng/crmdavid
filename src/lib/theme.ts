"use client";

import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark" | "system";
const KEY = "crm.theme";
const subs = new Set<() => void>();

function read(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

export function setTheme(t: Theme) {
  try {
    if (t === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, t);
  } catch {}
  if (t === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", t);
  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute("content", getComputedStyle(document.documentElement).getPropertyValue("--c-bg").trim());
  subs.forEach((f) => f());
}

export function useTheme() {
  return useSyncExternalStore(
    (f) => { subs.add(f); return () => subs.delete(f); },
    read,
    () => "system" as Theme,
  );
}

export const ACCENTS = [
  { id: "blue", label: "Синий", color: "#2f5bff" },
  { id: "violet", label: "Фиолетовый", color: "#7a3cf0" },
  { id: "teal", label: "Бирюзовый", color: "#0e9384" },
  { id: "pink", label: "Розовый", color: "#dd2590" },
  { id: "orange", label: "Оранжевый", color: "#e8590c" },
] as const;
export type Accent = (typeof ACCENTS)[number]["id"];
const ACCENT_KEY = "crm.accent";

function readAccent(): Accent {
  try {
    const v = localStorage.getItem(ACCENT_KEY);
    return ACCENTS.some((a) => a.id === v) ? (v as Accent) : "blue";
  } catch {
    return "blue";
  }
}

export function setAccent(a: Accent) {
  try {
    if (a === "blue") localStorage.removeItem(ACCENT_KEY);
    else localStorage.setItem(ACCENT_KEY, a);
  } catch {}
  if (a === "blue") document.documentElement.removeAttribute("data-accent");
  else document.documentElement.setAttribute("data-accent", a);
  subs.forEach((f) => f());
}

export function useAccent() {
  return useSyncExternalStore(
    (f) => { subs.add(f); return () => subs.delete(f); },
    readAccent,
    () => "blue" as Accent,
  );
}

/** Ставится в <head> до гидрации, чтобы не мигало. */
export const themeScript = `try{var d=document.documentElement,t=localStorage.getItem("${KEY}"),a=localStorage.getItem("${ACCENT_KEY}");if(t==="light"||t==="dark")d.setAttribute("data-theme",t);if(a)d.setAttribute("data-accent",a)}catch(e){}`;
