import type { ReactNode } from "react";

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function Badge({ tone, children }: { tone: "ok" | "danger" | "muted" | "warn"; children: ReactNode }) {
  return <span className={cx("badge", `badge-${tone}`)}>{children}</span>;
}

export function Empty({ text }: { text: string }) {
  return <p className="empty-hint">{text}</p>;
}
