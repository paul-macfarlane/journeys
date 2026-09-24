import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AuthorSettings } from "@/components/author-settings";
import { getAuthorSettings } from "@/db/users";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Settings",
};

/**
 * The signed-in Author's own Settings (ticket 52), reached from the
 * "Settings" row in the user menu: their display name, and their Author
 * page — the public switch, the bio, and the links. Inside the `(list)`
 * route group so its layout supplies the navbar; the static `settings`
 * segment is matched before `[projectId]`.
 */
export default async function SettingsPage() {
  const session = await requireSession();
  const settings = await getAuthorSettings(session.user.id);
  if (!settings) notFound();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <div>
          <Link
            href="/projects"
            className="text-muted-foreground text-sm hover:text-foreground"
          >
            ← Your projects
          </Link>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      </header>

      <AuthorSettings settings={settings} />
    </main>
  );
}
