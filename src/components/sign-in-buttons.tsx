"use client";

import { useState } from "react";

import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

type Provider = "google" | "discord";

const PROVIDERS: { id: Provider; label: string }[] = [
  { id: "google", label: "Sign in with Google" },
  { id: "discord", label: "Sign in with Discord" },
];

// Authors sign in with Google or Discord; Participants never sign in at all.
// Both providers land on /projects, which is the Author's home.
export function SignInButtons() {
  const [pending, setPending] = useState<Provider | null>(null);

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      {PROVIDERS.map(({ id, label }) => (
        <Button
          key={id}
          size="lg"
          variant={id === "google" ? "default" : "outline"}
          disabled={pending !== null}
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
          {label}
        </Button>
      ))}
    </div>
  );
}
