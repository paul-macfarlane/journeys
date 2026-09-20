import { isEnding, type GraphDocument } from "@/lib/graph/document";

/**
 * A Draft at a glance: how much of a Journey there is, and what shape it is
 * in. Read-only — the editor that changes any of it arrives with ticket 08 —
 * so this renders the document it is handed and nothing more.
 */

/** "1 step", "44 steps": the count and the noun that agrees with it. */
function counted(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/** The Journey status badge's styling, applied to a Step's own labels. */
function StepBadge({ children }: { children: string }) {
  return (
    <span className="inline-flex w-fit shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-medium text-muted-foreground">
      {children}
    </span>
  );
}

export function DraftSummary({ document }: { document: GraphDocument }) {
  const steps = Object.values(document.steps);
  const summary = [
    counted(steps.length, "step"),
    counted(Object.keys(document.outcomes).length, "outcome"),
  ].join(" · ");

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-medium tracking-tight">Draft</h2>
        <p className="text-muted-foreground text-sm">{summary}</p>
      </div>

      {/* role="list" is explicit: the flex layout strips the list marker, and
          some browsers drop the implicit role with it. */}
      <ul role="list" aria-label="Steps" className="flex flex-col gap-2">
        {steps.map((step) => (
          <li
            key={step.id}
            className="flex flex-wrap items-center gap-2 rounded-xl px-4 py-3 ring-1 ring-foreground/10"
          >
            <span className="font-medium">{step.title}</span>
            {/* A brand-new Draft's one Step is both the Start and an Ending,
                and says so: it is where a participant would begin and, with
                no choices on it yet, where they would stop. */}
            {step.id === document.startStepId ? (
              <StepBadge>Start</StepBadge>
            ) : null}
            {isEnding(step) ? <StepBadge>Ending</StepBadge> : null}
            {step.choices.length > 0 ? (
              <span className="text-muted-foreground text-sm">
                {counted(step.choices.length, "choice")}
              </span>
            ) : null}
          </li>
        ))}
      </ul>

      <p className="text-muted-foreground text-sm">
        Editing steps and choices arrives with a later ticket.
      </p>
    </section>
  );
}
