"use client";

import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";
import { initials } from "@/lib/navbar";

/** The three answers next-themes accepts, "system" following the OS. */
const THEMES = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
] as const;

/**
 * The navbar's account menu: the Author's avatar (their initials when the
 * provider gave no image) opens their name and email, the three Theme
 * choices as plain rows (a fly-out submenu is a desktop idiom that cramps a
 * phone), and Sign out. The name also sits beside the avatar from tablet
 * width up and hides at phone width, where the avatar alone is the trigger
 * and the menu opens as a bottom sheet (see `DropdownMenuContent`).
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
        <DropdownMenuGroup>
          <DropdownMenuLabel>Theme</DropdownMenuLabel>
          <ThemeChoices />
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={signingOut} onClick={signOut}>
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Rendered only once the menu opens, so `useTheme` is read on the client
 * after hydration — during server rendering next-themes has no answer yet,
 * and a radio checked on one side and not the other would mismatch.
 */
function ThemeChoices() {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenuRadioGroup
      aria-label="Theme"
      value={theme ?? "system"}
      onValueChange={(value) => {
        if (typeof value === "string") setTheme(value);
      }}
    >
      {THEMES.map(({ value, label }) => (
        // closeOnClick: a radio item keeps the menu open by default, but a
        // theme is chosen once, like every other entry here.
        <DropdownMenuRadioItem key={value} value={value} closeOnClick>
          {label}
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  );
}
