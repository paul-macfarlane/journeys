"use client";

import { CheckIcon, ChevronDownIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SwitcherProject } from "@/lib/navbar";

/**
 * The navbar's way between Projects: a menu of the Author's most recent
 * ones — the page's own marked — and "All projects" for the rest. The
 * trigger reads the current Project's title on Project and Journey pages
 * and "Projects" anywhere else, truncated rather than wrapped so the bar
 * stays one row at phone width.
 *
 * Every entry is a real link, so choosing one is an ordinary navigation
 * and a middle-click opens it in a new tab.
 */
export function ProjectSwitcher({
  projects,
  currentId,
  label,
}: {
  projects: readonly SwitcherProject[];
  currentId: string | null;
  label: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="min-w-0 max-w-[45vw] text-muted-foreground sm:max-w-xs"
          />
        }
      >
        <span className="truncate">{label}</span>
        <ChevronDownIcon aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64">
        {projects.map((project) => {
          const isCurrent = project.id === currentId;
          return (
            <DropdownMenuItem
              key={project.id}
              render={<Link href={`/projects/${project.id}`} />}
              aria-current={isCurrent ? "page" : undefined}
            >
              <span className="truncate">{project.title}</span>
              {isCurrent ? <CheckIcon aria-hidden className="ml-auto" /> : null}
            </DropdownMenuItem>
          );
        })}
        {projects.length > 0 ? <DropdownMenuSeparator /> : null}
        <DropdownMenuItem render={<Link href="/projects" />}>
          All projects
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
