import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Allow Next.js internals, static assets, and favicon
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // 2. Allow public client licensing endpoints (called by buyers' SaaS instances)
  if (
    pathname.startsWith('/api/v1/license/') ||
    pathname === '/api/v1/admin/login' ||
    pathname === '/api/v1/admin/logout'
  ) {
    return NextResponse.next();
  }

  // 3. Check for login page
  const token = req.cookies.get('sf_admin_token')?.value;

  if (pathname === '/login') {
    // If already logged in, redirect to dashboard
    if (token) {
      return NextResponse.redirect(new URL('/', req.url));
    }
    return NextResponse.next();
  }

  // 4. Protect all other pages (including root dashboard `/` and `/admin/*`)
  if (!token) {
    const loginUrl = new URL('/login', req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
