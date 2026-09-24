"use client";

import { useRouter } from "next/navigation";
import { useMemo, useOptimistic, useState, useTransition } from "react";
import { z } from "zod";

import {
  editAuthorPageAction,
  renameAuthorAction,
  setAuthorPageVisibilityAction,
} from "@/app/projects/(list)/settings/actions";
import { useAutosavedForm } from "@/components/autosaved-form";
import { CopyLinkButton } from "@/components/journeys/copy-link-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AuthorSettings as AuthorSettingsValues } from "@/db/users";
import {
  AUTHOR_LINK_KINDS,
  authorBioSchema,
  authorLinkLabel,
  authorLinkUrlSchema,
  type AuthorLinkKind,
} from "@/lib/author";
import { STATUS_TEXT } from "@/lib/autosave";
import { initials } from "@/lib/navbar";
import {
  renameAuthorSchema,
  type RenameAuthorInput,
} from "@/lib/validation/author";

/**
 * The "Author page" form's own shape: one string field per link kind, empty
 * for none, because a form field always holds a string. The links the
 * action receives are made from it in `submit` below, one entry per field
 * that holds a url, in `AUTHOR_LINK_KINDS` order.
 */
const authorPageFormSchema = z.object({
  bio: authorBioSchema,
  ...(Object.fromEntries(
    AUTHOR_LINK_KINDS.map(({ kind }) => [
      kind,
      z.union([z.literal(""), authorLinkUrlSchema(kind)]),
    ]),
  ) as unknown as Record<AuthorLinkKind, z.ZodType<string, string>>),
});

type AuthorPageFormInput = { bio: string } & Record<AuthorLinkKind, string>;

/** What a platform field suggests; a website can be anywhere. */
const LINK_PLACEHOLDERS: Record<AuthorLinkKind, string> = {
  linkedin: "https://www.linkedin.com/in/…",
  github: "https://github.com/…",
  instagram: "https://www.instagram.com/…",
  facebook: "https://www.facebook.com/…",
  website: "https://…",
};

/**
 * The Settings page's two sections (ticket 52). "Display name" edits the
 * name the navbar, the Projects list, and the Members tab show, saved as
 * it is typed into like every other in-place field (`useAutosavedForm`).
 * "Author page" holds the switch that makes `/authors/<id>` public —
 * applied the moment it is flipped, like a Journey's Theme override — and
 * the bio and links that page shows, saved together as one record. The
 * profile picture is the provider's and is only shown here.
 */
export function AuthorSettings({
  settings,
}: {
  settings: AuthorSettingsValues;
}) {
  return (
    <div className="flex max-w-xl flex-col gap-8">
      <DisplayNameSection settings={settings} />
      <AuthorPageSection settings={settings} />
    </div>
  );
}

function DisplayNameSection({ settings }: { settings: AuthorSettingsValues }) {
  const router = useRouter();
  const values = useMemo<RenameAuthorInput>(
    () => ({ name: settings.name }),
    [settings.name],
  );
  const { form, status, change, flush, handleEnterKeyDown } = useAutosavedForm({
    schema: renameAuthorSchema,
    values,
    submit: renameAuthorAction,
    // The navbar above reads the name off the session's own row.
    onSaved: () => router.refresh(),
  });
  const { errors } = form.formState;

  return (
    <section aria-labelledby="display-name" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="display-name" className="font-medium">
          Display name
        </h2>
        <p className="text-muted-foreground text-sm">
          How you appear to the other members of your projects.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Avatar size="lg" aria-hidden>
          {settings.image ? <AvatarImage src={settings.image} alt="" /> : null}
          <AvatarFallback>{initials(settings.name)}</AvatarFallback>
        </Avatar>
        <p className="text-muted-foreground text-sm">
          Your profile picture comes from Google or Discord.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="display-name-field">Display name</Label>
        <Input
          id="display-name-field"
          aria-invalid={errors.name ? true : undefined}
          autoComplete="off"
          {...form.register("name", {
            onChange: () => change("name"),
            onBlur: () => void flush("name"),
          })}
          onKeyDown={handleEnterKeyDown}
        />
        {errors.name ? (
          <p role="alert" className="text-sm text-destructive">
            {errors.name.message}
          </p>
        ) : null}
      </div>

      <p className="text-muted-foreground flex flex-wrap gap-x-3 text-xs">
        <span role="status">{STATUS_TEXT[status]}</span>
        <span>
          Shown in the navbar, on your projects, and to the other members of a
          project.
        </span>
      </p>
    </section>
  );
}

function AuthorPageSection({ settings }: { settings: AuthorSettingsValues }) {
  const router = useRouter();
  const authorPath = `/authors/${settings.id}`;

  // The switch: flips the moment it is clicked and settles on what the
  // server holds once the refresh lands, as in `journey-theme-settings`.
  const [visibilityError, setVisibilityError] = useState<string | null>(null);
  const [checked, setChecked] = useOptimistic(settings.public);
  const [, startTransition] = useTransition();

  function toggle(on: boolean) {
    startTransition(async () => {
      setChecked(on);
      const result = await setAuthorPageVisibilityAction({ public: on }).catch(
        () => ({
          ok: false as const,
          error: "the server could not be reached",
        }),
      );
      if (!result.ok) {
        setVisibilityError(`Couldn't save: ${result.error}`);
        return;
      }
      setVisibilityError(null);
      router.refresh();
    });
  }

  const values = useMemo<AuthorPageFormInput>(() => {
    const urlByKind = new Map(
      settings.links.map((link) => [link.kind, link.url]),
    );
    return {
      bio: settings.bio,
      ...(Object.fromEntries(
        AUTHOR_LINK_KINDS.map(({ kind }) => [kind, urlByKind.get(kind) ?? ""]),
      ) as Record<AuthorLinkKind, string>),
    };
  }, [settings.bio, settings.links]);

  const { form, status, change, flush, handleEnterKeyDown } = useAutosavedForm({
    schema: authorPageFormSchema,
    values,
    submit: (next) =>
      editAuthorPageAction({
        bio: next.bio,
        links: AUTHOR_LINK_KINDS.filter(({ kind }) => next[kind] !== "").map(
          ({ kind }) => ({ kind, url: next[kind] }),
        ),
      }),
    onSaved: () => router.refresh(),
  });
  const { errors } = form.formState;

  return (
    <section aria-labelledby="author-page" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="author-page" className="font-medium">
          Author page
        </h2>
        <p className="text-muted-foreground text-sm">
          A public page with your name, profile picture, bio, and links, and the
          projects you belong to that have a published journey.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm leading-none font-medium">
        <input
          type="checkbox"
          className="accent-primary size-4"
          checked={checked}
          onChange={(event) => toggle(event.target.checked)}
        />
        Public Author page
      </label>
      {visibilityError ? (
        <p role="alert" className="text-sm text-destructive">
          {visibilityError}
        </p>
      ) : null}

      {settings.public ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <p>
            Your Author page is public at{" "}
            <a
              href={authorPath}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4"
            >
              {authorPath}
            </a>
          </p>
          <CopyLinkButton path={authorPath} />
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="author-bio">Bio</Label>
        <Textarea
          id="author-bio"
          rows={5}
          aria-invalid={errors.bio ? true : undefined}
          {...form.register("bio", {
            onChange: () => change("bio"),
            onBlur: () => void flush("bio"),
          })}
        />
        <p className="text-muted-foreground text-xs">
          Plain text, up to 1,000 characters. Line breaks are kept.
        </p>
        {errors.bio ? (
          <p role="alert" className="text-sm text-destructive">
            {errors.bio.message}
          </p>
        ) : null}
      </div>

      {AUTHOR_LINK_KINDS.map(({ kind }) => {
        const error = errors[kind];
        return (
          <div key={kind} className="flex flex-col gap-2">
            <Label htmlFor={`author-link-${kind}`}>
              {authorLinkLabel(kind)}
            </Label>
            <Input
              id={`author-link-${kind}`}
              type="text"
              inputMode="url"
              autoComplete="off"
              placeholder={LINK_PLACEHOLDERS[kind]}
              aria-invalid={error ? true : undefined}
              {...form.register(kind, {
                onChange: () => change(kind),
                onBlur: () => void flush(kind),
              })}
              onKeyDown={handleEnterKeyDown}
            />
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error.message}
              </p>
            ) : null}
          </div>
        );
      })}

      <p role="status" className="text-muted-foreground text-xs">
        {STATUS_TEXT[status]}
      </p>
    </section>
  );
}
