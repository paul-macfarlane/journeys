import { NextResponse, type NextRequest } from "next/server";

// UX convenience only, never the security boundary: requireSession() inside
// each Author page stays authoritative. Cookie PRESENCE is checked, not
// validity — a stale cookie just means the in-page check does the real work.
const SESSION_COOKIES = [
  "better-auth.session_token",
  // Secure-context prefix (production HTTPS).
  "__Secure-better-auth.session_token",
];

function hasSessionCookie(request: NextRequest): boolean {
  return SESSION_COOKIES.some((name) => request.cookies.has(name));
}

export function proxy(request: NextRequest) {
  if (!hasSessionCookie(request)) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/projects/:path*"],
};
