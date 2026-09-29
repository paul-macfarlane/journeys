import type { ReactNode } from "react";

import { RichText } from "@/components/runner/rich-text";
import { buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  hasOutcome,
  hasStep,
  isEnding,
  stepName,
  type GraphDocument,
  type Prompt,
  type Step,
} from "@/lib/graph/document";
import { MAX_RESPONSE_LENGTH } from "@/lib/graph/prompt";
import { cn } from "@/lib/utils";

/**
 * One Step, rendered for whoever is walking the graph — Preview (ticket 05)
 * and the participant runner at `/j/{journey-id}` (ticket 06). This component
 * knows nothing about Preview, Runs, or Responses: the caller supplies every
 * URL and the whole "Start over" control, so the same component serves both.
 *
 * Every navigation here is a plain `<a>`, never `next/link`. A prefetched
 * Choice would reach the runner's step page and append a Step the Participant
 * never chose, and the browser's own back button has to reach the server for
 * the backtrack to be recorded at all. Preview inherits full-page navigation,
 * which changes nothing it proves.
 *
 * The one exception is the Start Step of a live Journey, whose Choices are
 * submit buttons in a form (ticket 27): taking one is what creates the Run,
 * and a write belongs to a POST an action owns, not to a link somebody can
 * prefetch. The caller says which it wants through `choices`.
 *
 * A Step with a Prompt (ticket 12) is the other: the answer travels with the
 * Choice, so its Choices are that same form's buttons with the textbox above
 * them, and an Ending with a Prompt — nothing to choose — offers the textbox
 * with a button of its own. The Prompt is offered only when `choices` is a
 * form: with links there is nothing to post the answer to, and the caller is
 * saying no answer can be recorded here.
 */

/**
 * A Choice: full width, wrapping, and tall enough to be a comfortable tap
 * target on a phone. Exported so the runner's own controls — "Start over",
 * "Continue where you left off" — match the Choices they sit beside. The
 * hover border takes the Theme's primary (ticket 11), which is where a
 * Project's accent shows on the one thing a Participant touches; the focus
 * border already takes the ring, which an accent replaces too.
 *
 * Keyboard focus (ticket 63) is a solid 2px outline in the ring colour at
 * full opacity, offset 2px so it sits on the page around the Choice rather
 * than over its border. The shared button's own focus treatment — a 3px
 * ring at half opacity over a pale border — is what the outline is drawn
 * over, and it was invisible on a themed card in the dark scheme. Every
 * preset's `--ring` clears 3:1 against its background and card in both
 * schemes (WCAG 1.4.11 non-text contrast, 2.4.13 focus appearance). An
 * accent replaces the ring: by night `globals.css` lifts its lightness
 * first, but by day it is the Author's colour as picked, and a pale accent
 * on pale paper is theirs to avoid — the hover border has always had the
 * same latitude. `outline-solid` is explicit because the button's
 * `outline-none` sets Tailwind's outline-style variable to `none`, which a
 * bare `outline-2` would inherit.
 */
export const choiceLinkClassName = cn(
  buttonVariants({ variant: "outline" }),
  "h-auto min-h-11 w-full justify-start py-3 text-left whitespace-normal hover:border-primary dark:hover:border-primary",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:outline-solid",
);

/**
 * How a Step's Choices are offered: as links to the Step each leads to, or
 * as the buttons of one form whose action receives the chosen Step's id in
 * its `to` field and, when the Step has a Prompt, the answer in `response`.
 * `response` is what this Run already answered here, shown back in the
 * textbox when a Participant returns to the Step.
 */
export type ChoiceControls =
  | { kind: "links"; href: (stepId: string) => string }
  | {
      kind: "form";
      action: (formData: FormData) => Promise<void>;
      response?: string | null;
      refusal?: string | null;
    };

/**
 * The one-line notices the runner's pages carry in `?notice=` and show above
 * the Step; the address is read on the server and stripped by `RunHistory`.
 * Two are refusals, the rest confirmations; anything else is not a notice.
 */
const RESPONSE_NOTICES: Record<string, { text: string; refusal: boolean }> = {
  "response-required": {
    text: "This step needs a response before you go on.",
    refusal: true,
  },
  "response-too-long": {
    text: `Keep your response under ${MAX_RESPONSE_LENGTH} characters.`,
    refusal: true,
  },
  "response-saved": { text: "Your response was saved.", refusal: false },
  "response-cleared": { text: "Your response was removed.", refusal: false },
  "response-preview": {
    text: "Nothing was recorded. In the live journey, this response would be saved.",
    refusal: false,
  },
};

/**
 * The refusal text for a notice, when the notice is one of the two the
 * server sends a blank or over-long Prompt back with — null for every other
 * notice, known or not. `ResponseField` is the refusal's one place; a
 * refusal never renders above the Step as well.
 */
export function responseRefusal(
  notice: string | string[] | undefined,
): string | null {
  const known = knownNotice(notice);
  return known !== null && known.refusal ? known.text : null;
}

/** The notice the address names, when it is one of the Prompt's at all. */
function knownNotice(notice: string | string[] | undefined) {
  return typeof notice === "string" && Object.hasOwn(RESPONSE_NOTICES, notice)
    ? RESPONSE_NOTICES[notice]
    : null;
}

/**
 * The notice named in the address, when it is one of the Prompt's — except a
 * refusal, which `responseRefusal` renders at the field instead, so it shows
 * in exactly one place.
 */
export function ResponseNotice({
  notice,
}: {
  notice: string | string[] | undefined;
}) {
  const known = knownNotice(notice);
  if (known === null || known.refusal) return null;

  return (
    <p role="status" className="text-muted-foreground text-sm">
      {known.text}
    </p>
  );
}

/**
 * The Prompt's textbox: the question as its label, "(optional)" when it is,
 * `aria-required` when it is not (native constraint validation is off across
 * the app, so nothing here relies on the browser's own `required` bubble),
 * and the same cap the server enforces. A refusal from the server renders
 * directly beneath the textbox, in the destructive colour, wired to it by
 * `aria-describedby` and `aria-invalid`; `autoFocus` is what keeps the field
 * in focus after the server's redirect, since the runner ships no JS of its
 * own to do it. A native label, like everything else in the runner: the page
 * ships no client bundle.
 */
function ResponseField({
  step,
  prompt,
  response,
  refusal,
}: {
  step: Step;
  prompt: Prompt;
  response: string | null | undefined;
  refusal: string | null;
}) {
  const id = `response-${step.id}`;
  const refusalId = `${id}-refusal`;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-base font-medium">
        {prompt.label}
        {prompt.required ? null : (
          <span className="text-muted-foreground font-normal"> (optional)</span>
        )}
      </label>
      <Textarea
        id={id}
        name="response"
        rows={4}
        aria-required={prompt.required}
        maxLength={MAX_RESPONSE_LENGTH}
        defaultValue={response ?? ""}
        autoComplete="off"
        aria-invalid={refusal !== null}
        aria-describedby={refusal !== null ? refusalId : undefined}
        autoFocus={refusal !== null}
      />
      {refusal !== null ? (
        <p id={refusalId} role="alert" className="text-destructive text-sm">
          {refusal}
        </p>
      ) : null}
    </div>
  );
}

function EndingView({
  step,
  document,
  choices,
  startOver,
}: {
  step: Step;
  document: GraphDocument;
  choices: ChoiceControls;
  startOver: ReactNode;
}) {
  const outcome =
    step.outcomeId !== null && hasOutcome(document, step.outcomeId)
      ? document.outcomes[step.outcomeId]
      : null;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold tracking-tight">The end</h2>
      {/*
       * An untagged Ending says nothing here: what an Author has or has not
       * grouped is authoring state, not a Participant's.
       */}
      {outcome === null ? null : <p>Outcome: {outcome.label}</p>}
      {/* Nothing to choose here, so the answer needs a button of its own.
          Its own form, too: "Start over" below is a form as well, and one
          form cannot hold another. */}
      {step.prompt !== null && choices.kind === "form" ? (
        <form
          action={choices.action}
          noValidate
          className="flex flex-col gap-3"
        >
          <ResponseField
            step={step}
            prompt={step.prompt}
            response={choices.response}
            refusal={choices.refusal ?? null}
          />
          <button type="submit" className={choiceLinkClassName}>
            Save response
          </button>
        </form>
      ) : null}
      {startOver}
    </div>
  );
}

function ChoiceList({
  step,
  document,
  choices,
}: {
  step: Step;
  document: GraphDocument;
  choices: ChoiceControls;
}) {
  // role="list" is explicit: the flex layout strips the list marker, and
  // some browsers drop the implicit role with it.
  const list = (
    <ul role="list" aria-label="Choices" className="flex flex-col gap-2">
      {step.choices.map((choice) => {
        const targetExists = hasStep(document, choice.targetStepId);
        return (
          <li key={choice.id} className="flex flex-col gap-1">
            {!targetExists ? (
              <span className="text-muted-foreground">
                {choice.label} (missing step)
              </span>
            ) : choices.kind === "links" ? (
              <a
                href={choices.href(choice.targetStepId)}
                className={choiceLinkClassName}
              >
                {choice.label}
              </a>
            ) : (
              <button
                type="submit"
                name="to"
                value={choice.targetStepId}
                className={choiceLinkClassName}
              >
                {choice.label}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );

  if (choices.kind !== "form") return list;

  const field =
    step.prompt !== null ? (
      <ResponseField
        step={step}
        prompt={step.prompt}
        response={choices.response}
        refusal={choices.refusal ?? null}
      />
    ) : null;

  return (
    <form action={choices.action} noValidate className="flex flex-col gap-6">
      {field}
      {list}
    </form>
  );
}

export function StepView({
  step,
  document,
  choices,
  startOver,
}: {
  step: Step;
  document: GraphDocument;
  choices: ChoiceControls;
  startOver: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      {/* The name an Author sees for it, so a Step left untitled (ticket 79
          item 1 stores its title empty) still heads the page with words
          rather than an empty `h1`. */}
      <h1 className="text-2xl font-semibold tracking-tight">
        {stepName(step)}
      </h1>
      <RichText content={step.content} />

      {isEnding(step) ? (
        <EndingView
          step={step}
          document={document}
          choices={choices}
          startOver={startOver}
        />
      ) : (
        <ChoiceList step={step} document={document} choices={choices} />
      )}
    </div>
  );
}
