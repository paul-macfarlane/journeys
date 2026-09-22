"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import {
  editProjectDescriptionAction,
  renameProjectAction,
} from "@/app/projects/actions";
import { useBlurSavedForm } from "@/components/blur-saved-form";
import { RichTextEditor } from "@/components/journeys/rich-text-editor";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Content } from "@/lib/graph/content";
import {
  renameProjectSchema,
  type RenameProjectInput,
} from "@/lib/validation/project";

/**
 * A Project's title and description, edited in place on the Settings tab
 * and saved when a field is left. The title is a blur-saved form field (see
 * `useBlurSavedForm`); the description is rich text (ticket 07), written in
 * the same editor a Step's content is and saved by the same rule — on blur,
 * when what it holds differs from what was last stored. The Project is
 * addressed by its id, so a rename never moves the page.
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
  const { form, save, handleEnterKeyDown } = useBlurSavedForm({
    schema: renameProjectSchema,
    values,
    submit: (next) => renameProjectAction(projectId, next),
    // The header above the tabs and the Delete confirmation read the title
    // off the page's own props.
    onSaved: () => router.refresh(),
  });
  const { errors } = form.formState;

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="project-title">Title</Label>
        <Input
          id="project-title"
          aria-invalid={errors.title ? true : undefined}
          autoComplete="off"
          {...form.register("title", { onBlur: () => void save("title") })}
          onKeyDown={handleEnterKeyDown}
        />
        {errors.title ? (
          <p role="alert" className="text-sm text-destructive">
            {errors.title.message}
          </p>
        ) : null}
      </div>

      <ProjectDescriptionField
        projectId={projectId}
        description={description}
      />

      <p className="text-muted-foreground text-xs">
        Changes save when you leave a field. Every member sees them; the
        project&apos;s address stays the same.
      </p>
    </div>
  );
}

/** Two documents are the same when they would be stored the same. */
function sameContent(a: Content, b: Content): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * The description editor and its save. What the editor holds and what the
 * server last accepted are refs, not state: neither is rendered, and a save
 * compares the two the moment the editor is left. The editor is never reset
 * from a refresh — `resetKey` is the Project's id, which does not change —
 * so another Member's edit arriving mid-typing is overwritten by this
 * Author's next blur, as last write wins on the title too.
 */
function ProjectDescriptionField({
  projectId,
  description,
}: {
  projectId: string;
  description: Content;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const current = useRef(description);
  const stored = useRef(description);

  async function saveDescription() {
    const next = current.current;
    if (sameContent(next, stored.current)) return;

    const result = await editProjectDescriptionAction(projectId, next).catch(
      () => ({ ok: false as const, error: "the server could not be reached" }),
    );
    if (!result.ok) {
      setError(`Couldn't save: ${result.error}`);
      return;
    }

    stored.current = next;
    setError(null);
    // The header above the tabs shows the description's opening line.
    router.refresh();
  }

  return (
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
        onChange={(content) => {
          current.current = content;
        }}
        onRefused={(message) => setError(`Couldn't save: ${message}`)}
        onBlur={() => void saveDescription()}
      />
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
