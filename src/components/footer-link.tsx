"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * A footer link that knows whether it points at the page it is rendered
 * on (ticket 93): `aria-current="page"` plus a visible foreground colour,
 * rather than only an underline on hover. `SiteFooter` and `LegalLinks`
 * stay plain anchors everywhere else — the runner's navigations are
 * whole-document by design — this is the one small client island that
 * reads `usePathname()`, which also renders on the server, so the
 * attribute is in the HTML on first paint. In the runner (`/j/...`) no
 * footer `href` ever matches the path, so nothing here is ever current.
 */
export function FooterLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  const current = pathname === href;

  return (
    <a
      href={href}
      aria-current={current ? "page" : undefined}
      className={cn(
        "underline-offset-4 hover:underline",
        current ? "text-foreground font-medium" : "hover:text-foreground",
        className,
      )}
    >
      {children}
    </a>
  );
}
