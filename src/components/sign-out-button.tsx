"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          await authClient.signOut();
          // refresh() as well as push(): the server components above read
          // the session, and the cookie has just changed underneath them.
          router.push("/");
          router.refresh();
        } finally {
          setPending(false);
        }
      }}
    >
      Sign out
    </Button>
  );
}
