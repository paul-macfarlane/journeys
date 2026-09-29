import { choiceLabel } from "@/components/journeys/editor-shared";
import { RichText } from "@/components/runner/rich-text";
import { Badge } from "@/components/ui/badge";
import {
  isEnding,
  stepName,
  type GraphDocument,
  type Step,
} from "@/lib/graph/document";

/**
 * One Step of a Published Version, read-only, beside the version's map on
 * its own view (ticket 94): its title, its content as a participant reads
 * it, its Prompt, and where each of its Choices leads — or, for an Ending,
 * its Outcome. Nothing here is an input: a Published Version is immutable,
 * and the way to change it is to restore it into the Draft.
 *
 * A server component, like the runner's `RichText` it renders with; the
 * view renders one per Step and shows the selected one.
 */
export function VersionStepPanel({
  document,
  step,
}: {
  document: GraphDocument;
  step: Step;
}) {
  const ending = isEnding(step);
  const outcome =
    step.outcomeId !== null ? document.outcomes[step.outcomeId] : undefined;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold break-words">{stepName(step)}</h2>
        {step.id === document.startStepId || ending ? (
          <div className="flex flex-wrap items-center gap-1">
            {step.id === document.startStepId ? <Badge>Start</Badge> : null}
            {ending ? <Badge>Ending</Badge> : null}
          </div>
        ) : null}
      </div>

      <RichText content={step.content} />

      {step.prompt !== null ? (
        <div className="flex flex-col gap-1 text-sm">
          <p className="font-medium">
            Prompt{" "}
            <span className="text-muted-foreground font-normal">
              ({step.prompt.required ? "required" : "optional"})
            </span>
          </p>
          <p className="break-words">{step.prompt.label}</p>
        </div>
      ) : null}

      {ending ? (
        <p className="text-sm">
          <span className="font-medium">Outcome:</span>{" "}
          {outcome !== undefined ? outcome.label : "No outcome"}
        </p>
      ) : (
        <div className="flex flex-col gap-1 text-sm">
          <p className="font-medium" id={`choices-${step.id}`}>
            Choices
          </p>
          {/* role="list" is explicit: the flex layout strips the marker,
              and some browsers drop the implicit role with it. */}
          <ul
            role="list"
            aria-labelledby={`choices-${step.id}`}
            className="flex flex-col gap-1"
          >
            {step.choices.map((choice) => {
              const target = document.steps[choice.targetStepId];
              return (
                <li key={choice.id} className="break-words">
                  {choiceLabel(choice.label)} →{" "}
                  {target !== undefined ? stepName(target) : "Missing step"}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
