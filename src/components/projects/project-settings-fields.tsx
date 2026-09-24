"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  editProjectDescriptionAction,
  renameProjectAction,
} from "@/app/projects/actions";
import { useAutosave } from "@/components/autosave";
import { useAutosavedForm } from "@/components/autosaved-form";
import { RichTextEditor } from "@/components/journeys/rich-text-editor";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { STATUS_TEXT, type SaveStatus } from "@/lib/autosave";
import type { Content } from "@/lib/graph/content";
import {
  renameProjectSchema,
  type RenameProjectInput,
} from "@/lib/validation/project";

/**
 * A Project's title and description, edited in place on the Settings tab
 * and saved as they are typed into (ticket 46). The title is an autosaved
 * form field (see `useAutosavedForm`); the description is rich text (ticket
 * 07), written in the same editor a Step's content is and saved by the same
 * loop (`useAutosave`), when what it holds differs from what was last
 * stored. One status line under the two says where the pair stands. The
 * Project is addressed by its id, so a rename never moves the page.
 */
export function ProjectSettingsFields({
  projectId,
  title,
  description,
}: {
  projectId: string;
  title: string;
  description: Content;
}) {
  const router = useRouter();
  const values = useMemo<RenameProjectInput>(() => ({ title }), [title]);
  const { form, status, change, flush, handleEnterKeyDown } = useAutosavedForm({
    schema: renameProjectSchema,
    values,
    submit: (next) => renameProjectAction(projectId, next),
    // The header above the tabs and the Delete confirmation read the title
    // off the page's own props.
    onSaved: () => router.refresh(),
  });
  const { errors } = form.formState;

  // The description's own loop. What the editor holds and what the server
  // last accepted live in the loop, not in state: neither is rendered, and
  // the loop compares the two whenever it is asked to write. The editor is
  // never reset from a refresh — its `resetKey` is the Project's id, which
  // does not change — so another Member's edit arriving mid-typing is
  // overwritten by this Author's next save, as last write wins on the
  // title too.
  const [descriptionError, setDescriptionError] = useState<string | null>(null);
  const { status: descriptionStatus, autosave: descriptionAutosave } =
    useAutosave<Content>({
      initial: description,
      equals: sameContent,
      write: async (next) => {
        const result = await editProjectDescriptionAction(
          projectId,
          next,
        ).catch(() => ({
          ok: false as const,
          error: "the server could not be reached",
        }));
        if (!result.ok) {
          setDescriptionError(`Couldn't save: ${result.error}`);
          return false;
        }
        setDescriptionError(null);
        return true;
      },
      // The header above the tabs shows the description's opening line.
      onSaved: () => router.refresh(),
    });

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="project-title">Title</Label>
        <Input
          id="project-title"
          aria-invalid={errors.title ? true : undefined}
          autoComplete="off"
          {...form.register("title", {
            onChange: () => change("title"),
            onBlur: () => void flush("title"),
          })}
          onKeyDown={handleEnterKeyDown}
        />
        {errors.title ? (
          <p role="alert" className="text-sm text-destructive">
            {errors.title.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        {/* The editor names itself ("Description") through `label`, so the
            visible caption above it is for sighted Authors only: a <label>
            would have nothing to be `for`, since the surface is a
            contenteditable rather than a form field. */}
        <p aria-hidden className="text-sm leading-none font-medium select-none">
          Description
        </p>
        <RichTextEditor
          resetKey={projectId}
          label="Description"
          content={description}
          onChange={(content) => descriptionAutosave.change(content)}
          onRefused={(message) =>
            setDescriptionError(`Couldn't save: ${message}`)
          }
          onBlur={() => void descriptionAutosave.flush()}
        />
        {descriptionError ? (
          <p role="alert" className="text-sm text-destructive">
            {descriptionError}
          </p>
        ) : null}
      </div>

      <p className="text-muted-foreground flex flex-wrap gap-x-3 text-xs">
        <span role="status">
          {STATUS_TEXT[combinedStatus(status, descriptionStatus)]}
        </span>
        <span>
          Every member sees your changes; the project&apos;s address stays the
          same.
        </span>
      </p>
    </div>
  );
}

/**
 * Two surfaces, one line: anything still unsaved is what the Author needs
 * to know about, then anything still being written, and "Saved" only when
 * both have landed.
 */
function combinedStatus(a: SaveStatus, b: SaveStatus): SaveStatus {
  if (a === "unsaved" || b === "unsaved") return "unsaved";
  if (a === "saving" || b === "saving") return "saving";
  return "saved";
}

/**
 * Two documents are the same when they would be stored the same. A string
 * comparison is enough because both sides came out of `sanitizeContent`,
 * which builds every object in one fixed key order.
 */
function sameContent(a: Content, b: Content): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
