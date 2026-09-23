import { counted } from "@/components/journeys/editor-shared";
import type { StepResponses } from "@/lib/response-list";

/**
 * The Journey page's Responses tab: what Participants wrote, one plain list
 * per Step that asks a Prompt. Every Step with a Prompt is here whether or
 * not anything has been written yet, so an Author sees at once which
 * questions have answers, and a Step that no longer asks (or no longer
 * exists) keeps the answers it was given. No dates, no Run, no Participant:
 * the list is the answers and nothing that could put a person behind one.
 * Member-only by way of the page that renders it.
 */
export function ResponseList({ groups }: { groups: StepResponses[] }) {
  if (groups.length === 0) {
    return (
      <section aria-label="Responses" className="flex flex-col gap-2">
        <p className="text-muted-foreground">
          No step asks a prompt yet. Add one to a step from the editor, and
          participants&apos; responses appear here.
        </p>
      </section>
    );
  }

  return (
    <section aria-label="Responses" className="flex flex-col gap-6">
      <p className="text-muted-foreground text-sm">
        Responses are anonymous: nothing here says which participant wrote what,
        or when.
      </p>

      {groups.map((group) => (
        <section
          key={group.stepId}
          aria-label={group.title}
          className="flex flex-col gap-3 rounded-xl px-4 py-4 ring-1 ring-foreground/10"
        >
          <div className="flex flex-col gap-1">
            <h3 className="font-medium">{group.title}</h3>
            <p className="text-muted-foreground text-sm">
              {group.promptLabel ?? "This step no longer asks a prompt."}
            </p>
          </div>

          {group.responses.length === 0 ? (
            <p className="text-muted-foreground text-sm">No responses yet.</p>
          ) : (
            <ul
              role="list"
              aria-label={`Responses to ${group.title}`}
              className="flex flex-col gap-2"
            >
              {group.responses.map((response, index) => (
                // Index keys: a Response has no id a Member may see, and the
                // list is never reordered in place.
                <li
                  key={index}
                  className="rounded-lg bg-muted px-3 py-2 text-sm whitespace-pre-wrap"
                >
                  {response.text}
                </li>
              ))}
            </ul>
          )}

          <p className="text-muted-foreground text-xs">
            {counted(group.responses.length, "response")}
          </p>
        </section>
      ))}
    </section>
  );
}
