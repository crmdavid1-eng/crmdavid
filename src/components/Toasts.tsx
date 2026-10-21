"use client";

import { dismiss, useToasts } from "@/lib/toast";

export function Toasts() {
  const list = useToasts();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
      {list.map((t) => (
        <div
          key={t.id}
          className={`toast-in pointer-events-auto flex max-w-md items-center gap-3 rounded-xl px-4 py-2.5 text-sm shadow-lg ${
            t.tone === "error" ? "bg-red-700 text-white" : "bg-ink text-white"
          }`}
        >
          <span>{t.text}</span>
          {t.action && (
            <button
              className="font-semibold text-[#9db4ff] hover:underline"
              onClick={() => { t.action!.run(); dismiss(t.id); }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
