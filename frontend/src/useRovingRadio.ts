// WAI-ARIA radio group keyboard model: one tab stop, arrow keys move and select.
import type { KeyboardEvent } from "react";

const NEXT: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

export function radioProps<T extends string>(options: readonly T[], value: T, onChange: (next: T) => void, option: T) {
  return {
    role: "radio" as const,
    "aria-checked": value === option,
    tabIndex: value === option ? 0 : -1,
    onClick: () => onChange(option),
    onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => {
      const step = NEXT[event.key];
      if (!step) return;
      event.preventDefault();
      const index = (options.indexOf(value) + step + options.length) % options.length;
      onChange(options[index]);
      const group = event.currentTarget.parentElement;
      (group?.children[index] as HTMLElement | undefined)?.focus();
    },
  };
}
