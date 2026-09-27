import { useEffect, useRef } from "react";

const SHORTCUTS: [string, string][] = [
  ["/", "Filter pairs"], ["↑ ↓", "Move through the ranked list"], ["Enter", "Open the focused pair"],
  ["M", "Switch Centers ↔ Closest"], ["?", "Show or hide this panel"], ["Esc", "Close"],
];

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal?.();
    if (!open && dialog.open) dialog.close?.();
  }, [open]);
  return (
    <dialog ref={ref} className="dialog" aria-label="Keyboard shortcuts" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      <header className="section-head"><span className="tag">KEYBOARD</span>
        <button type="button" className="icon-btn dialog__close" onClick={onClose} aria-label="Close">×</button></header>
      <dl className="shortcuts">
        {SHORTCUTS.map(([key, text]) => <div key={key}><dt><kbd>{key}</kbd></dt><dd>{text}</dd></div>)}
      </dl>
    </dialog>
  );
}
