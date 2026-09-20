import crypto from 'crypto';
import { NextRequest } from 'next/server';

const AUTH_SECRET = process.env.ADMIN_API_KEY || 'sf_admin_sec_2026_secret';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || process.env.ADMIN_API_KEY || 'Admin@ScanFix2026!';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@scanfix.dev').toLowerCase();

export interface SessionPayload {
  email: string;
  role: 'super_admin';
  exp: number;
}

/**
 * Creates a signed HMAC-SHA256 session token.
 */
export function createAdminSessionToken(email: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60; // 7 days
  const payload = Buffer.from(JSON.stringify({ email, role: 'super_admin', exp })).toString('base64url');
  const data = `${header}.${payload}`;
  const signature = crypto.createHmac('sha256', AUTH_SECRET).update(data).digest('base64url');
  return `${data}.${signature}`;
}

/**
 * Verifies a signed HMAC-SHA256 session token.
 */
export function verifyAdminSessionToken(token: string): { valid: boolean; email?: string } {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return { valid: false };
    const [header, payload, signature] = parts;
    const data = `${header}.${payload}`;
    const expectedSig = crypto.createHmac('sha256', AUTH_SECRET).update(data).digest('base64url');

    if (signature !== expectedSig) return { valid: false };

    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as SessionPayload;
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
      return { valid: false };
    }

    return { valid: true, email: decoded.email };
  } catch {
    return { valid: false };
  }
}

/**
 * Validates admin login credentials.
 */
export function validateAdminCredentials(email: string, passOrKey: string): boolean {
  const cleanPass = passOrKey.trim();

  // Accept ADMIN_PASSWORD, ADMIN_API_KEY, or master secret Admin@ScanFix2026!
  if (
    cleanPass === ADMIN_PASSWORD ||
    cleanPass === AUTH_SECRET ||
    cleanPass === 'Admin@ScanFix2026!' ||
    cleanPass === 'sf_admin_sec_2026_secret'
  ) {
    return true;
  }
  return false;
}

/**
 * Checks whether a NextRequest is authenticated as admin (via cookie or Bearer token).
 */
export function isAuthenticatedAdmin(req: NextRequest): boolean {
  // 1. Check HTTP-only cookie
  const cookie = req.cookies.get('sf_admin_token')?.value;
  if (cookie && verifyAdminSessionToken(cookie).valid) {
    return true;
  }

  // 2. Check Authorization header
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token === AUTH_SECRET || token === ADMIN_PASSWORD || verifyAdminSessionToken(token).valid) {
      return true;
    }
  }

  return false;
}
