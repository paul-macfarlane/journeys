"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useState } from "react";

import { APPEARANCES, isAppearance } from "@/components/appearance-control";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { authClient } from "@/lib/auth-client";
import { initials } from "@/lib/navbar";

/**
 * The navbar's account menu: the Author's avatar (their initials when the
 * provider gave no image) opens their name and email, a link to their
 * Settings (display name, picture, and Author page, ticket 52), the Theme
 * as one row with a segmented control of the three choices (ticket 51:
 * neither three rows of the menu nor a fly-out submenu, a desktop idiom
 * that cramps a phone), and Sign out. The name also sits beside the avatar from tablet
 * width up and hides at phone width, where the avatar alone is the trigger
 * and the menu opens as a popover under it, as at every width (Base UI's
 * positioner flips and clamps it into the viewport).
 *
 * Sign out is the sign-out button `/projects` used to carry: end the
 * session, then push *and* refresh, because the server components above
 * read the session and the cookie has just changed underneath them. It
 * lands on `/sign-in`, the one place an Author picks a provider again.
 */
export function UserMenu({
  user,
}: {
  user: { name: string; email: string; image: string | null };
}) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    try {
      await authClient.signOut();
      router.push("/sign-in");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Account: ${user.name}`}
        render={
          <Button
            variant="ghost"
            className="h-9 min-w-0 shrink-0 rounded-full pr-1 pl-1 sm:pr-2.5"
          />
        }
      >
        <Avatar aria-hidden>
          {user.image ? <AvatarImage src={user.image} alt="" /> : null}
          <AvatarFallback>{initials(user.name)}</AvatarFallback>
        </Avatar>
        <span className="hidden max-w-40 truncate sm:inline">{user.name}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="flex flex-col px-1.5 py-1">
          <span className="truncate text-sm font-medium">{user.name}</span>
          <span className="truncate text-xs text-muted-foreground">
            {user.email}
          </span>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/projects/settings" />}>
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <ThemeRow />
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={signingOut} onClick={signOut}>
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * "Theme" on the left and the three segments on the right, each an icon
 * button named Light, Dark, or System. The segments are not menu items, so
 * choosing one leaves the menu open and the change is seen at once; the menu
 * still walks its items with Up and Down, and the segments take Left and
 * Right. On a phone the segments grow to the menu's larger tap target.
 *
 * Rendered only once the menu opens, so `useTheme` is read on the client
 * after hydration — during server rendering next-themes has no answer yet,
 * and a radio checked on one side and not the other would mismatch.
 */
function ThemeRow() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center justify-between gap-3 px-1.5 py-1 text-sm max-sm:py-1.5 max-sm:text-base">
      <span>Theme</span>
      <SegmentedControl
        label="Theme"
        value={isAppearance(theme) ? theme : "system"}
        onValueChange={setTheme}
        options={APPEARANCES}
        size="icon-sm"
        segmentClassName="max-sm:size-11"
      />
    </div>
  );
}
