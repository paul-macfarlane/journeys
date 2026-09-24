"use client";

import { useFormStatus } from "react-dom";

/**
 * The deciding form's one button (ticket 49): "Continue" until the form is
 * submitted, then "Deciding…" and disabled for as long as the judge runs —
 * up to `DECISION_TIMEOUT_MS`, which a Participant would otherwise spend
 * looking at a button that did nothing. `useFormStatus` reads the enclosing
 * form's pending state, so this is a client component and renders inside
 * the form; it is the only client island `StepView` has, and it stays that
 * one button. The class comes from the caller so the button matches the
 * Choices it stands in for without this bundle importing `step-view`.
 */
export function DecideSubmit({ className }: { className: string }) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? "Deciding…" : "Continue"}
    </button>
  );
}
