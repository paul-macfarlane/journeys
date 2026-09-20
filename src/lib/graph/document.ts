import { z } from "zod";

import { contentSchema, sanitizeContent } from "@/lib/graph/content";

/**
 * The graph document: the whole of a Journey's Draft, and the whole of every
 * Published Version, in one validated shape. Deliberately no `server-only` —
 * the editor, the participant runner, the seed script, and the e2e specs all
 * read it. See `docs/adr/0001-graph-as-one-json-document.md`.
 */

/**
 * Ids are opaque non-empty strings. App code mints them with
 * `crypto.randomUUID()`; readable ids such as `step-07` stay valid so the
 * seed script and the fixtures can be read by a person.
 */
export const idSchema = z.string().min(1);

/**
 * A Choice leads a participant from one Step to another. `condition` and
 * `effect` are reserved for a later ticket: nothing reads them today, and
 * nothing should start to without a decision to do so.
 */
export const choiceSchema = z.object({
  id: idSchema,
  label: z.string(),
  targetStepId: idSchema,
  condition: z.string().nullable().default(null),
  effect: z.string().nullable().default(null),
});

/**
 * An optional question a participant may answer before choosing. `type` is a
 * discriminator reserved for later kinds of Prompt; free text is the only
 * accepted value today.
 */
export const promptSchema = z.object({
  type: z.literal("free_text"),
  label: z.string(),
  required: z.boolean(),
});

/** An Author-defined label that groups Endings for analysis. */
export const outcomeSchema = z.object({
  id: idSchema,
  label: z.string(),
});

/**
 * Everything about a Step except how strictly its rich text is read. The
 * write path reads content loosely so it can sanitize before storing; every
 * other caller reads it strictly.
 */
function stepSchemaWith<C extends z.ZodType>(content: C) {
  return z.object({
    id: idSchema,
    title: z.string().max(200),
    content,
    choices: z.array(choiceSchema),
    prompt: promptSchema.nullable(),
    outcomeId: idSchema.nullable(),
    position: z.object({ x: z.number(), y: z.number() }).nullable(),
  });
}

/**
 * One screen a participant reads. A Step with no Choices is an Ending and
 * carries the id of an Outcome. `position` is reserved for the canvas.
 */
export const stepSchema = stepSchemaWith(contentSchema);

/** The only thing the key/id check needs to know about what it is checking. */
type Addressed = { id: string };

/**
 * The key is the address; a Step or Outcome filed under a different id than
 * its own is a structural error, not a publish-time problem.
 */
function checkKeysMatchIds(
  document: {
    steps: Record<string, Addressed>;
    outcomes: Record<string, Addressed>;
  },
  ctx: z.RefinementCtx,
): void {
  for (const [key, step] of Object.entries(document.steps)) {
    if (step.id !== key) {
      ctx.addIssue({
        code: "custom",
        path: ["steps", key, "id"],
        message: `Step is filed under "${key}" but calls itself "${step.id}"`,
      });
    }
  }
  for (const [key, outcome] of Object.entries(document.outcomes)) {
    if (outcome.id !== key) {
      ctx.addIssue({
        code: "custom",
        path: ["outcomes", key, "id"],
        message: `Outcome is filed under "${key}" but calls itself "${outcome.id}"`,
      });
    }
  }
}

/**
 * The envelope around whichever Step schema is in play, so the strict shape
 * and the write path's loose shape agree on everything but rich text.
 */
function graphDocumentSchemaWith<S extends z.ZodType<Addressed>>(step: S) {
  return z
    .object({
      schemaVersion: z.literal(1),
      startStepId: idSchema,
      allowBack: z.boolean().default(true),
      steps: z.record(idSchema, step),
      outcomes: z.record(idSchema, outcomeSchema),
    })
    .superRefine(checkKeysMatchIds);
}

/**
 * `startStepId` is a single pointer, so "more than one Start" cannot be
 * written down at all; the publish rule "exactly one Start" reduces to "the
 * pointer names a Step that exists". `allowBack` is reserved: nothing reads
 * it yet.
 */
export const graphDocumentSchema = graphDocumentSchemaWith(stepSchema);

/**
 * The same envelope with every Step's rich text left unread, so raw editor
 * output can be checked structurally before it is sanitized. Private: only
 * `prepareDocumentForWrite` may hand out a document parsed this loosely.
 */
const looseGraphDocumentSchema = graphDocumentSchemaWith(
  stepSchemaWith(z.unknown()),
);

export type Choice = z.infer<typeof choiceSchema>;
export type Prompt = z.infer<typeof promptSchema>;
export type Outcome = z.infer<typeof outcomeSchema>;
export type Step = z.infer<typeof stepSchema>;
export type GraphDocument = z.infer<typeof graphDocumentSchema>;

/** An Ending is a Step a participant cannot walk on from. */
export function isEnding(step: Step): boolean {
  return step.choices.length === 0;
}

export type ParseGraphDocumentResult =
  { ok: true; document: GraphDocument } | { ok: false; error: string };

/**
 * The first problem with the path it was found at, because a caller showing
 * an Author one message is better served by a precise one.
 */
function firstIssueMessage(error: {
  issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>;
}): string {
  const [issue] = error.issues;
  const path = issue.path.join(".");
  return path.length > 0 ? `${path}: ${issue.message}` : issue.message;
}

/**
 * Structural validation for callers that would rather branch than catch.
 * This reads content strictly, so it is for documents already known to be in
 * stored shape; anything arriving from an editor goes through
 * `prepareDocumentForWrite` instead.
 */
export function parseGraphDocument(input: unknown): ParseGraphDocumentResult {
  const parsed = graphDocumentSchema.safeParse(input);
  return parsed.success
    ? { ok: true, document: parsed.data }
    : { ok: false, error: firstIssueMessage(parsed.error) };
}

export type PrepareDocumentResult =
  | { ok: true; document: GraphDocument }
  | { ok: false; error: string; stepId?: string };

/**
 * The only entry point a write path may use. Raw editor output is not in
 * stored shape yet — the editor's Link extension adds a `nofollow` rel and a
 * target, and pasted text arrives with elements the contract does not keep —
 * so reading it strictly would reject writes the sanitizer exists to clean.
 *
 * Loose parse, then sanitize every Step's rich text, then strict parse: what
 * comes back is always the sanitized stored shape. `stepId` is set only when
 * a particular Step's content was refused, so the Author can be sent to it.
 */
export function prepareDocumentForWrite(input: unknown): PrepareDocumentResult {
  const loose = looseGraphDocumentSchema.safeParse(input);
  if (!loose.success) {
    return { ok: false, error: firstIssueMessage(loose.error) };
  }

  const steps: Record<string, unknown> = {};
  for (const [stepId, step] of Object.entries(loose.data.steps)) {
    const sanitized = sanitizeContent(step.content);
    if (!sanitized.ok) {
      return { ok: false, error: sanitized.error, stepId };
    }
    steps[stepId] = { ...step, content: sanitized.content };
  }

  const stored = graphDocumentSchema.safeParse({ ...loose.data, steps });
  // The sanitizer promises content that satisfies the strict shape, so this
  // failing means the sanitizer is wrong. Say so rather than throwing: the
  // Author gets a message instead of the caller getting an exception.
  return stored.success
    ? { ok: true, document: stored.data }
    : { ok: false, error: firstIssueMessage(stored.error) };
}

/**
 * A brand-new Draft: one Step, which is the Start, holding the empty
 * paragraph the editor emits for empty rich text. Every field is written
 * out, so what is built here is exactly what is stored and read back.
 */
export function createDraftDocument(): GraphDocument {
  const startStepId = crypto.randomUUID();

  return {
    schemaVersion: 1,
    startStepId,
    allowBack: true,
    steps: {
      [startStepId]: {
        id: startStepId,
        title: "Start",
        content: { type: "doc", content: [{ type: "paragraph" }] },
        choices: [],
        prompt: null,
        outcomeId: null,
        position: null,
      },
    },
    outcomes: {},
  };
}
