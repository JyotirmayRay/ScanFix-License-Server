import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { isAuthenticatedAdmin } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const updateBrandingSchema = z.object({
  companyName: z.string().min(1).optional(),
  serverName: z.string().min(1).optional(),
  logoUrl: z.string().optional(),
  brandColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color (e.g. #10b981)').optional(),
  keyPrefix: z.string().min(2).max(8).regex(/^[A-Z0-9]+$/, 'Must be uppercase alphanumeric').optional(),
  supportEmail: z.string().email().optional(),
  supportUrl: z.string().optional(),
  footerText: z.string().optional(),
  hideScanFixBranding: z.boolean().optional(),
});

export async function GET() {
  const branding = db.getBranding();
  return NextResponse.json({ success: true, branding });
}

export async function PATCH(req: NextRequest) {
  if (!isAuthenticatedAdmin(req)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: Admin authentication required.' },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const updates = updateBrandingSchema.parse(body);

    const updated = db.updateBranding(updates);
    return NextResponse.json({
      success: true,
      message: 'Branding settings updated successfully.',
      branding: updated,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Invalid branding data' }, { status: 400 });
  }
}
