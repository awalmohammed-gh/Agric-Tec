import { NextResponse, type NextRequest } from 'next/server';

// ⚠️ DEMO ONLY — NOT REAL SECURITY.
// The `agrictec_session` cookie is just a "logged-in" flag set by the browser (services/auth.service.ts)
// so that we can redirect before a page renders. Anyone can set it by hand, and the data itself
// lives in localStorage. A real backend must issue a signed, httpOnly session cookie and verify
// it on the server for every request.

const SESSION_COOKIE = 'agrictec_session';
const AUTH_PAGES = ['/login', '/signup'];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);
  const isAuthPage = AUTH_PAGES.some((p) => pathname.startsWith(p));

  if (!hasSession && !isAuthPage) {
    const url = new URL('/login', request.url);
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
  if (hasSession && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Skip all Next.js internals (static files, images, dev/HMR endpoints) and public assets.
  matcher: [
    '/((?!_next/|favicon.ico|icons/|images/|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt|xml)$).*)',
  ],
};
