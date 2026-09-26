import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next, Literata } from "next/font/google";
import "./globals.css";

// Fail fast on invalid configuration (validated once, server-only).
import { env } from "@/lib/env";

import { ChunkLoadRecovery } from "@/components/chunk-load-recovery";
import { ThemeProvider } from "@/components/theme-provider";
import { APP_NAME, APP_TAGLINE, BRAND_COLORS } from "@/lib/brand";

// The type pair from docs/branding.md: a reading serif for the name and
// headings, a legibility-first sans for everything else. globals.css names
// the resulting families literally in @theme inline (which can't resolve
// runtime CSS variables), so swapping a face means updating it there too.
// The variable names deliberately differ from Tailwind's --font-display and
// --font-sans so the two definitions never compete on <html>.
const displayFont = Literata({
  variable: "--font-display-face",
  subsets: ["latin"],
  axes: ["opsz"],
  display: "swap",
});

const textFont = Atkinson_Hyperlegible_Next({
  variable: "--font-text",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  // BETTER_AUTH_URL is the app's own origin, so it doubles as the canonical
  // base for absolute social URLs.
  metadataBase: new URL(env.BETTER_AUTH_URL),
  title: {
    default: APP_NAME,
    template: `%s · ${APP_NAME}`,
  },
  description: APP_TAGLINE,
  applicationName: APP_NAME,
};

// The browser chrome takes the page's own background in each scheme.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: BRAND_COLORS.chalk },
    { media: "(prefers-color-scheme: dark)", color: BRAND_COLORS.pineNight },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: next-themes stamps the theme class on <html>
    // before hydration.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${displayFont.variable} ${textFont.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ChunkLoadRecovery />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
