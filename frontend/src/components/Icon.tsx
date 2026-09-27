// 1.5px line icons (16px). Decorative: always paired with a visible or accessible label.
const PATHS = {
  pairs: "M3.5 4.5a1.5 1.5 0 1 0 0-.01M12.5 11.5h-3v-3h3zM5 5.5l4 4",
  changes: "M3 5.5h9l-2.5-2.5M13 10.5H4l2.5 2.5",
  quality: "M8 1.8l5 1.8v4c0 3.2-2.2 5.5-5 6.6-2.8-1.1-5-3.4-5-6.6v-4zM5.8 8l1.6 1.6 3-3.2",
  search: "M7 12A5 5 0 1 0 7 2a5 5 0 0 0 0 10zM10.8 10.8L14 14",
  help: "M8 14.5A6.5 6.5 0 1 0 8 1.5a6.5 6.5 0 0 0 0 13zM6.3 6.2a1.8 1.8 0 1 1 2.4 1.7c-.5.2-.7.6-.7 1.1v.5M8 11.3v.1",
  sidebar: "M2.5 3h11v10h-11zM6 3v10",
  gear: "M8 10.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4zM8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name }: { name: IconName }) {
  return (
    <svg className="icon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={PATHS[name]} />
    </svg>
  );
}
