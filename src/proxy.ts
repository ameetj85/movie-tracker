import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, sessionCookieOptions, validateSessionToken } from "@/lib/session";

/**
 * Every page, API route, poster and Server Action requires a signed-in user,
 * except the auth pages below. Proxy runs on the Node.js runtime in Next 16, so
 * the session is checked against the database here, not just for cookie presence.
 */
const AUTH_PAGES = ["/login", "/signup", "/forgot-password", "/reset-password"];

const isAuthPage = (pathname: string) => AUTH_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? validateSessionToken(token) : null;

  if (isAuthPage(pathname)) {
    // Already signed in: the sign-in and sign-up pages have nothing to offer.
    // (A reset link still works while signed in, e.g. opened on the same browser.)
    if (session && (pathname === "/login" || pathname === "/signup")) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (!session) {
    const response = pathname.startsWith("/api/")
      ? NextResponse.json({ error: "Sign in required." }, { status: 401 })
      : NextResponse.redirect(loginUrl(request, pathname + search));
    if (token) response.cookies.delete(SESSION_COOKIE);
    return response;
  }

  const response = NextResponse.next();
  if (session.refreshed) response.cookies.set(SESSION_COOKIE, token!, sessionCookieOptions(session.expiresAt));
  return response;
}

function loginUrl(request: NextRequest, next: string) {
  const url = new URL("/login", request.url);
  if (next !== "/") url.searchParams.set("next", next);
  return url;
}

export const config = {
  // Everything except Next's own static assets and the favicon.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
