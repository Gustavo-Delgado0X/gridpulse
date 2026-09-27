import type { ReactNode } from "react";

interface Props {
  tag: string;
  title: string;
  children?: ReactNode;
  tone?: "warn" | "danger" | "ok" | "neutral";
}

export function InsetAlertCard({ tag, title, children, tone = "neutral" }: Props) {
  return (
    <div className={`inset inset--${tone}`} role={tone === "danger" ? "alert" : undefined}>
      <span className="tag">{tag}</span>
      <p className="inset__title">{title}</p>
      {children && <div className="inset__body">{children}</div>}
    </div>
  );
}
