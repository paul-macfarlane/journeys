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
 */
export function readResponse(step: Step, raw: unknown): ResponseReading {
  if (step.prompt === null) return { kind: "skipped" };

  const text = typeof raw === "string" ? raw.trim() : "";
  if (text.length === 0) {
    return step.prompt.required ? { kind: "missing" } : { kind: "skipped" };
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
