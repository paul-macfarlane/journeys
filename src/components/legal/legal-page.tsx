import type { ReactNode } from "react";

import { ProsePage } from "@/components/prose-page";
import { LEGAL_UPDATED } from "@/lib/brand";

/**
 * The two legal pages: the shared prose shell with the date under the
 * title, so a reader knows which version of the policy they are reading.
 */
export function LegalPage({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <ProsePage
      title={title}
      subtitle={
        <p className="text-muted-foreground text-sm">
          Last updated {LEGAL_UPDATED}
        </p>
      }
    >
      {children}
    </ProsePage>
  );
}
