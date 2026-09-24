import type { ReactNode } from "react";

import { ProsePage } from "@/components/prose-page";
import { LEGAL_UPDATED } from "@/lib/brand";

/**
 * The two legal pages: the shared prose shell with the date the text was
 * last changed under the title.
 */
export function LegalPage({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <ProsePage title={title} subtitle={`Last updated ${LEGAL_UPDATED}`}>
      {children}
    </ProsePage>
  );
}
