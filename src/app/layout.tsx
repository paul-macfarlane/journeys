import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// Fail fast on invalid configuration (validated once, server-only).
import { env } from "@/lib/env";

import { ThemeProvider } from "@/components/theme-provider";

// Loads the font files; globals.css references the resulting family names
// literally in @theme inline (which can't resolve runtime CSS variables).
// Swapping fonts means updating globals.css too.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // BETTER_AUTH_URL is the app's own origin, so it doubles as the canonical
  // base for absolute social URLs.
  metadataBase: new URL(env.BETTER_AUTH_URL),
  title: {
    default: "Journeys",
    template: "%s · Journeys",
  },
  description:
    "Author branching, text-based journeys and let participants walk them: read a step, make a choice, live with the consequence.",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
