"use client";

import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useId, useState } from "react";

import { APPEARANCES, isAppearance } from "@/components/appearance-control";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavbarPortalContainer } from "@/components/navbar/navbar-header";
import {
  SEGMENT_CHECKED_CLASS,
  SEGMENT_GROUP_CLASS,
} from "@/components/ui/segmented-control";
import { authClient } from "@/lib/auth-client";
import { initials } from "@/lib/navbar";
import { cn } from "@/lib/utils";

/**
 * The navbar's account menu: the Author's avatar (their initials when the
 * provider gave no image) opens their name and email, a link to their
 * Settings (display name, picture, and Author page, ticket 52), the Theme
 * as one row with the three choices drawn as a segmented pill (ticket 51:
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
  const container = useNavbarPortalContainer();

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
      <DropdownMenuContent container={container} align="end" className="w-64">
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
 * "Theme" on the left and the three choices on the right, drawn as one
 * segmented pill (ticket 51's look) but built from menu roles (ticket 90): a
 * group named "Theme" of three menu item radios, each an icon named Light,
 * Dark, or System, the chosen one `aria-checked` and painted in the primary
 * pair. A radio group of its own inside the menu is not allowed there (axe
 * `aria-required-children`). As menu items they are walked with Up and Down
 * like the rest of the menu, and Enter, Space, or a click chooses one; the
 * menu stays open (`closeOnClick={false}`), so the change is seen at once.
 * On a phone the items grow to the menu's larger tap target.
 *
 * Rendered only once the menu opens, so `useTheme` is read on the client
 * after hydration — during server rendering next-themes has no answer yet,
 * and a radio checked on one side and not the other would mismatch.
 */
function ThemeRow() {
  const { theme, setTheme } = useTheme();
  const labelId = useId();

  return (
    <div className="flex items-center justify-between gap-3 px-1.5 py-1 text-sm max-sm:py-1.5 max-sm:text-base">
      <span id={labelId}>Theme</span>
      <DropdownMenuRadioGroup
        aria-labelledby={labelId}
        value={isAppearance(theme) ? theme : "system"}
        onValueChange={(value: string) => {
          if (isAppearance(value)) setTheme(value);
        }}
        className={SEGMENT_GROUP_CLASS}
      >
        {APPEARANCES.map((option) => (
          <MenuPrimitive.RadioItem
            key={option.value}
            value={option.value}
            closeOnClick={false}
            aria-label={option.label}
            className={cn(
              buttonVariants({ variant: "secondary", size: "icon-sm" }),
              SEGMENT_CHECKED_CLASS,
              "max-sm:size-11",
            )}
          >
            <span aria-hidden className="contents">
              {option.icon}
            </span>
          </MenuPrimitive.RadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </div>
  );
}
