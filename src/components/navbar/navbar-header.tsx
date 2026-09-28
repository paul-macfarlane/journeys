"use client";

import {
  createContext,
  use,
  useRef,
  type ComponentProps,
  type RefObject,
} from "react";

const NavbarPortalContext = createContext<RefObject<HTMLElement | null> | null>(
  null,
);

/**
 * The navbar's `<header>` — the page's banner — and the place its menus
 * portal their popups (ticket 90). A portaled popup at the end of `<body>`
 * sits outside every landmark (axe `region`); rendered inside the banner it
 * belongs to the bar that opened it. The header is `sticky`, so it is the
 * popups' containing block, and nothing on it clips (no `overflow`); its
 * `z-40` keeps an open menu above the page beneath it.
 */
export function NavbarHeader({ children, ...props }: ComponentProps<"header">) {
  const ref = useRef<HTMLElement>(null);
  return (
    <NavbarPortalContext value={ref}>
      <header ref={ref} {...props}>
        {children}
      </header>
    </NavbarPortalContext>
  );
}

/**
 * Where a navbar menu portals its popup: the navbar's header, or the
 * default (`<body>`) when rendered outside one.
 */
export function useNavbarPortalContainer():
  RefObject<HTMLElement | null> | undefined {
  return use(NavbarPortalContext) ?? undefined;
}
