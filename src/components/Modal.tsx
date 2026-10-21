"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        className={`sheet-in flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-panel shadow-xl sm:rounded-2xl ${wide ? "sm:max-w-2xl" : "sm:max-w-md"}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="btn-ghost -mr-2 p-1.5" aria-label="Закрыть">
            <X size={18} />
          </button>
        </header>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}
