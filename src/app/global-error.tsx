"use client";

import Link from "next/link";
import { useEffect } from "react";

import { APP_NAME, BRAND_COLORS } from "@/lib/brand";

/**
 * The last-resort error boundary: an error thrown by the root layout
 * itself, which `error.tsx` cannot catch since it renders inside that
 * layout. Next requires this file to render its own `<html>` and `<body>`
 * — the root layout is gone, and with it the fonts and `ThemeProvider` — so
 * this stays deliberately plain: system fonts, a handful of inline styles,
 * and the wordmark in text rather than `Wordmark`'s SVG mark, which assumes
 * the layout's font variables are on `<html>`.
 *
 * Same rule as `error.tsx`: never the error's own message or stack, "Try
 * again" (`reset`), and a way home. The digest is logged, never shown.
 */
export default function GlobalErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[error]", error.digest);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1.5rem",
          padding: "2rem",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          textAlign: "center",
          color: BRAND_COLORS.ink,
          background: BRAND_COLORS.chalk,
        }}
      >
        <span style={{ fontWeight: 600, fontSize: "1.125rem" }}>
          {APP_NAME}
        </span>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 500, margin: 0 }}>
          Something went wrong
        </h1>
        <p style={{ maxWidth: "32rem", color: BRAND_COLORS.moss }}>
          This wasn&apos;t anything you did. Trying again usually clears it; if
          it keeps happening, the front page still gets you where you&apos;re
          going.
        </p>
        <p style={{ display: "flex", gap: "1rem" }}>
          <button
            type="button"
            onClick={reset}
            style={{
              border: "none",
              borderRadius: "0.5rem",
              padding: "0.5rem 1rem",
              background: BRAND_COLORS.spruce,
              color: BRAND_COLORS.paper,
              font: "inherit",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          <Link
            href="/"
            style={{ color: BRAND_COLORS.spruce, alignSelf: "center" }}
          >
            Go home
          </Link>
        </p>
      </body>
    </html>
  );
}
