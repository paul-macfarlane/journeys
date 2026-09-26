import { useId, type ReactNode } from "react";

/**
 * Something stored that fails its contract and so cannot be shown (ticket
 * 73): said plainly in place of what would have rendered, with what the
 * Author can do about it when there is anything. Generic on purpose — a
 * Draft that cannot be read is the first, and an unreadable Published
 * Version is the next (ticket 83).
 */
export function CannotBeRead({
  title,
  children,
  action,
}: {
  title: string;
  /** What happened, naming what cannot be read. */
  children: ReactNode;
  /** The way back, when there is one: a Restore, typically. */
  action?: ReactNode;
}) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className="flex max-w-xl flex-col gap-3 rounded-xl px-5 py-4 ring-1 ring-destructive/30"
    >
      <h2 id={headingId} className="font-medium">
        {title}
      </h2>
      <div className="text-muted-foreground text-sm">{children}</div>
      {action ? <div>{action}</div> : null}
    </section>
  );
}
