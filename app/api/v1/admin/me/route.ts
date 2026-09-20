import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticatedAdmin, verifyAdminSessionToken } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const isAuthed = isAuthenticatedAdmin(req);
  if (!isAuthed) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const cookie = req.cookies.get('sf_admin_token')?.value;
  const decoded = cookie ? verifyAdminSessionToken(cookie) : null;

  return NextResponse.json({
    authenticated: true,
    email: decoded?.email || 'admin@scanfix.dev',
    role: 'super_admin',
  });
}
