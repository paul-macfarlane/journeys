import type { ReactNode } from "react";

import { RichText } from "@/components/runner/rich-text";
import { buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  isEnding,
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
 * "Continue where you left off" — match the Choices they sit beside.
 */
export const choiceLinkClassName = cn(
  buttonVariants({ variant: "outline" }),
  "h-auto min-h-11 w-full justify-start py-3 text-left whitespace-normal",
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

/** The notice named in the address, when it is one of the Prompt's. */
export function ResponseNotice({
  notice,
}: {
  notice: string | string[] | undefined;
}) {
  const known =
    typeof notice === "string" && Object.hasOwn(RESPONSE_NOTICES, notice)
      ? RESPONSE_NOTICES[notice]
      : null;
  if (known === null) return null;

  return (
    <p
      role="status"
      className={cn(
        "text-sm",
        known.refusal ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {known.text}
    </p>
  );
}

/**
 * The Prompt's textbox: the question as its label, "(optional)" when it is,
 * the browser's own `required` check when it is not, and the same cap the
 * server enforces. A native label, like everything else in the runner: the
 * page ships no client bundle.
 */
function ResponseField({
  step,
  prompt,
  response,
}: {
  step: Step;
  prompt: Prompt;
  response: string | null | undefined;
}) {
  const id = `response-${step.id}`;

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
        required={prompt.required}
        maxLength={MAX_RESPONSE_LENGTH}
        defaultValue={response ?? ""}
        autoComplete="off"
      />
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
  // `Object.hasOwn`, not `in` or bare indexing: the maps are plain objects
  // parsed from JSON, so an id like "toString" would otherwise find a
  // prototype method and read as a real Outcome.
  const outcome =
    step.outcomeId !== null && Object.hasOwn(document.outcomes, step.outcomeId)
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
        <form action={choices.action} className="flex flex-col gap-3">
          <ResponseField
            step={step}
            prompt={step.prompt}
            response={choices.response}
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
        // Own property only — see the Outcome lookup above.
        const targetExists = Object.hasOwn(document.steps, choice.targetStepId);
        return (
          <li key={choice.id}>
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

  return (
    <form action={choices.action} className="flex flex-col gap-6">
      {step.prompt !== null ? (
        <ResponseField
          step={step}
          prompt={step.prompt}
          response={choices.response}
        />
      ) : null}
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
      <h1 className="text-2xl font-semibold tracking-tight">{step.title}</h1>
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
