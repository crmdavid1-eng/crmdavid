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

/** Ставится в <head> до гидрации, чтобы не мигало. */
export const themeScript = `try{var t=localStorage.getItem("${KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;
