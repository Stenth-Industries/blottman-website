"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { CHARGE_OPTIONS } from "@/lib/content";

// Styled replacement for <select name="charge">. A native select opens the
// operating system's own white menu, which CSS cannot reach, so this draws its
// own dark/gold list instead. Follows the WAI-ARIA "select-only combobox"
// pattern: focus stays on the trigger, arrows move the highlight, Enter/Space
// pick, Escape closes, and typing a letter jumps to the first matching charge.
export default function ChargeSelect({
  value,
  onChange,
  invalid = false,
  placeholder = "What were you charged with?",
  icon,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  placeholder?: string;
  icon?: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const id = useId();
  const listId = `${id}-list`;
  const optionId = (i: number) => `${id}-opt-${i}`;

  const selectedIndex = CHARGE_OPTIONS.findIndex((o) => o.value === value);
  const selected = selectedIndex >= 0 ? CHARGE_OPTIONS[selectedIndex] : null;

  function openList() {
    setActive(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  }

  function pick(i: number) {
    onChange(CHARGE_OPTIONS[i].value);
    setOpen(false);
    triggerRef.current?.focus();
  }

  // Tapping or clicking anywhere outside closes the list without choosing.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  // Keep the highlighted option visible while arrowing through a scrolled list.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`#${CSS.escape(optionId(active))}`);
    el?.scrollIntoView({ block: "nearest" });
  }, [open, active]); // optionId only depends on the stable useId value

  function onKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    const last = CHARGE_OPTIONS.length - 1;

    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((i) => Math.min(i + 1, last));
        return;
      case "ArrowUp":
        e.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
        return;
      case "Home":
        e.preventDefault();
        setActive(0);
        return;
      case "End":
        e.preventDefault();
        setActive(last);
        return;
      case "Enter":
      case " ":
        e.preventDefault();
        pick(active);
        return;
      case "Escape":
        // Close just the list; stop the popup's own Escape handler from
        // closing the whole dialog.
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        return;
      case "Tab":
        setOpen(false);
        return;
    }

    if (e.key.length === 1 && /\S/.test(e.key)) {
      const ch = e.key.toLowerCase();
      const next = CHARGE_OPTIONS.findIndex((o, i) => i > active && o.label.toLowerCase().startsWith(ch));
      const wrap = CHARGE_OPTIONS.findIndex((o) => o.label.toLowerCase().startsWith(ch));
      const hit = next >= 0 ? next : wrap;
      if (hit >= 0) setActive(hit);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      {icon}
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? optionId(active) : undefined}
        aria-label={selected ? `Charge: ${selected.label}` : placeholder}
        aria-invalid={invalid || undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className={`${className} flex items-center pr-10 text-left ${open ? "border-gold/50 bg-white/[0.07]" : ""} ${
          invalid && !open ? "border-red-400/60" : ""
        }`}
      >
        <span className={`truncate ${selected ? "text-white" : "text-white/50"}`}>
          {selected ? selected.label : placeholder}
        </span>
      </button>
      <div className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-white/70">
        <svg
          viewBox="0 0 24 24"
          className={`h-5 w-5 transition-transform duration-200 ${open ? "rotate-180 text-gold" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </div>

      <ul
        ref={listRef}
        id={listId}
        role="listbox"
        aria-label={placeholder}
        hidden={!open}
        className="absolute inset-x-0 top-[calc(100%+6px)] z-20 max-h-64 overflow-y-auto overscroll-contain rounded-xl border border-gold/30 bg-[#151515] py-1.5 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.95)] animate-fade-in motion-reduce:animate-none"
      >
        {CHARGE_OPTIONS.map((o, i) => {
          const isSelected = o.value === value;
          return (
            <li
              key={o.value}
              id={optionId(i)}
              role="option"
              aria-selected={isSelected}
              // Keep focus on the trigger so the keyboard handler stays in charge.
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => pick(i)}
              onPointerMove={() => setActive(i)}
              className={`mx-1.5 flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-[14px] transition-colors sm:text-[15px] ${
                i === active ? "bg-white/[0.07]" : ""
              } ${isSelected ? "text-gold" : "text-white/85"}`}
            >
              {o.label}
              {isSelected && (
                <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.25" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
