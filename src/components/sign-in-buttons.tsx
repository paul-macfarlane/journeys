"use client";

import { useState } from "react";

import { DiscordLogo, GoogleLogo } from "@/components/icons/provider-logos";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

type Provider = "google" | "discord";

// Each button follows its provider's branding guidelines rather than the
// app's own button styles: Google's light/dark "Sign in with Google" spec
// (white or near-black surface, neutral border, 20px logo) and Discord's
// blurple with the white Clyde mark.
const PROVIDERS: {
  id: Provider;
  label: string;
  className: string;
  Logo: typeof GoogleLogo;
}[] = [
  {
    id: "google",
    label: "Sign in with Google",
    className:
      "border border-[#747775] bg-white text-[#1F1F1F] hover:bg-[#F2F2F2] dark:border-[#8E918F] dark:bg-[#131314] dark:text-[#E3E3E3] dark:hover:bg-[#1E1F20]",
    Logo: GoogleLogo,
  },
  {
    id: "discord",
    label: "Sign in with Discord",
    className: "bg-[#5865F2] text-white hover:bg-[#4752C4]",
    Logo: DiscordLogo,
  },
];

// Authors sign in with Google or Discord; Participants never sign in at all.
// Both providers land on /projects, which is the Author's home.
export function SignInButtons() {
  const [pending, setPending] = useState<Provider | null>(null);

  return (
    <div className="flex flex-col gap-3">
      {PROVIDERS.map(({ id, label, className, Logo }) => (
        <button
          key={id}
          type="button"
          disabled={pending !== null}
          className={cn(
            "inline-flex h-10 w-full items-center justify-center gap-3 rounded-md px-3 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-60",
            className,
          )}
          onClick={async () => {
            setPending(id);
            try {
              await authClient.signIn.social({
                provider: id,
                callbackURL: "/projects",
              });
            } finally {
              // Reached only if the redirect never happens (e.g. the
              // provider call failed) — otherwise the page is gone.
              setPending(null);
            }
          }}
        >
          <Logo className="size-5 shrink-0" />
          {label}
        </button>
      ))}
    </div>
  );
}
