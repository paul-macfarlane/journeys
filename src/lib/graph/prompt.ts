import type { Step } from "@/lib/graph/document";

/**
 * The runner's one rule about a Prompt: what the text a Participant posted
 * with their Choice means for the Step it came from. Pure and database-free
 * like the rest of `src/lib/graph` — the first-Choice action, the step
 * action, and Preview's action all read a form through this, so the three
 * cannot disagree about when an answer is required.
 */

/**
 * How long a Response may be. A Prompt asks for a reflection, not an essay,
 * and a Response is one row's worth of text: the textbox stops at this many
 * characters, and a crafted request past it is refused rather than cut.
 */
export const MAX_RESPONSE_LENGTH = 2000;

/**
 * True when a Step's Prompt decides the next Step (ticket 43 F3): it needs
 * two or more Choices to do that, since a judge with fewer than two has
 * nothing to pick between. A stale `decides: true` left over from a Step
 * whose Choices dropped to one, or to none (an Ending), is read as not
 * deciding here — this is the one place that rule is enforced, so the
 * runner, the Editor, and the publish check cannot disagree about it.
 */
export function isDeciding(step: Step): boolean {
  return step.prompt?.decides === true && step.choices.length >= 2;
}

export type ResponseReading =
  /** Text to store against the Run and this Step. */
  | { kind: "answered"; text: string }
  /** Nothing to store: no Prompt on this Step, or an optional one left blank. */
  | { kind: "skipped" }
  /** A required Prompt left blank: the move is refused. */
  | { kind: "missing" }
  /** Past `MAX_RESPONSE_LENGTH`: the move is refused. */
  | { kind: "too-long" };

/**
 * Reads the `response` field of a form posted from `step`. Only a string is
 * text a Participant typed — a repeated field or a file is not — and only the
 * ends are trimmed, so the lines of a longer answer stay as written. A Step
 * with no Prompt never stores anything, whatever travelled with the form.
 *
 * A genuinely deciding Prompt (`isDeciding`, ticket 43) is read as required
 * whatever its stored `required` flag says: a blank Response gives the judge
 * nothing to decide from, so the Run cannot advance on it and the
 * Participant is sent back exactly as for any other required Prompt left
 * blank. `setStepPrompt` already forces `required: true` when `decides` is
 * true; the `|| isDeciding(step)` here is the same rule read defensively,
 * for a document that reached this function some other way — and it reads
 * `false` for a Step whose Choices have dropped below two, where `decides`
 * is stale and there is nothing left to judge.
 */
export function readResponse(step: Step, raw: unknown): ResponseReading {
  if (step.prompt === null) return { kind: "skipped" };

  const text = typeof raw === "string" ? raw.trim() : "";
  if (text.length === 0) {
    return step.prompt.required || isDeciding(step)
      ? { kind: "missing" }
      : { kind: "skipped" };
  }
  if (text.length > MAX_RESPONSE_LENGTH) return { kind: "too-long" };

  return { kind: "answered", text };
}

/**
 * The `?notice=` a refused reading sends the Participant back with, or null
 * when nothing was refused. One place, so the three actions that read a form
 * name the same notices the pages show.
 */
export function refusalNotice(
  reading: ResponseReading,
): "response-required" | "response-too-long" | null {
  if (reading.kind === "missing") return "response-required";
  if (reading.kind === "too-long") return "response-too-long";
  return null;
}
