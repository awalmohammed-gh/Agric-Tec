import { NextResponse, type NextRequest } from 'next/server';

// ⚠️ DEMO ONLY — NOT REAL SECURITY.
// These cookies are just "signed-in" flags set by the browser (services/auth.service.ts and
// services/admin/admin-auth.service.ts) so we can redirect before a page renders. Anyone can set
// them by hand, and the data itself lives in localStorage. They are UX redirects only: a real
// backend must issue signed, httpOnly session cookies and enforce roles on EVERY request.

const SESSION_COOKIE = 'agrictec_session';
const ADMIN_COOKIE = 'agrictec_admin';
const AUTH_PAGES = ['/login', '/signup'];
const ADMIN_LOGIN = '/admin-login';

const isAdminPath = (pathname: string) => pathname === '/admin' || pathname.startsWith('/admin/');

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ---- Admin console: its own cookie. A farmer session never grants access. ----
  const hasAdmin = request.cookies.has(ADMIN_COOKIE);
  if (isAdminPath(pathname)) {
    if (!hasAdmin) {
      const url = new URL(ADMIN_LOGIN, request.url);
      url.searchParams.set('next', pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }
  if (pathname === ADMIN_LOGIN) {
    // Open without any farmer session; an admin who is already signed in goes to the console.
    return hasAdmin ? NextResponse.redirect(new URL('/admin', request.url)) : NextResponse.next();
  }

  // ---- Farmer app (unchanged) ----
  const hasSession = request.cookies.has(SESSION_COOKIE);
  const isAuthPage = AUTH_PAGES.some((p) => pathname.startsWith(p));

  if (!hasSession && !isAuthPage) {
    const url = new URL('/login', request.url);
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
  // Registration remains accessible so a guest can create a full account.
  if (hasSession && isAuthPage && !pathname.startsWith('/signup')) {
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
