import { useEffect, useId, useRef, useState, type ReactNode } from "react";

interface Props {
  label: ReactNode;
  ariaLabel?: string;
  className?: string;
  align?: "left" | "right";
  children: (close: () => void) => ReactNode;
}

/** Button + anchored panel; closes on outside click and Escape (returns focus to the button). */
export function Popover({ label, ariaLabel, className = "", align = "left", children }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); button.current?.focus(); } };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div className={`popover ${className}`} ref={root}>
      <button ref={button} type="button" className="btn" aria-expanded={open} aria-controls={id} aria-label={ariaLabel}
              onClick={() => setOpen((o) => !o)}>
        {label} <span className="caret" aria-hidden="true">▾</span>
      </button>
      {open && <div id={id} className={`popover__panel popover__panel--${align}`}>{children(() => setOpen(false))}</div>}
    </div>
  );
}
