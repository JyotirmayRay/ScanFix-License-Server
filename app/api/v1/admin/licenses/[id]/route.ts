import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { isAuthenticatedAdmin } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const updateSchema = z.object({
  status: z.enum(['active', 'suspended', 'revoked', 'expired']).optional(),
  maxDomains: z.number().int().min(1).optional(),
  allowedDomains: z.array(z.string()).optional(),
  durationDaysToAdd: z.number().int().optional(),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isAuthenticatedAdmin(req)) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const { id } = await context.params;
  const license = await db.getLicenseById(id);
  if (!license) return NextResponse.json({ success: false, error: 'License not found' }, { status: 404 });
  return NextResponse.json({ success: true, license });
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isAuthenticatedAdmin(req)) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await context.params;
    const body = await req.json();
    const data = updateSchema.parse(body);

    const existing = await db.getLicenseById(id);
    if (!existing) return NextResponse.json({ success: false, error: 'License not found' }, { status: 404 });

    const updates: any = {};
    if (data.status) {
      updates.status = data.status;
      await db.addLog({ licenseKey: existing.key, action: data.status === 'revoked' ? 'revoke' : 'create', status: 'success', reason: `Admin updated status to: ${data.status}` });
    }
    if (data.maxDomains) updates.maxDomains = data.maxDomains;
    if (data.allowedDomains) updates.allowedDomains = data.allowedDomains;
    if (data.notes !== undefined) updates.notes = data.notes;

    if (data.durationDaysToAdd && data.durationDaysToAdd > 0) {
      const currentExpiry = existing.expiresAt ? new Date(existing.expiresAt) : new Date();
      currentExpiry.setDate(currentExpiry.getDate() + data.durationDaysToAdd);
      updates.expiresAt = currentExpiry.toISOString();
      if (existing.status === 'expired') updates.status = 'active';
    }

    const updated = await db.updateLicense(id, updates);
    return NextResponse.json({ success: true, license: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isAuthenticatedAdmin(req)) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const { id } = await context.params;
  const success = await db.deleteLicense(id);
  if (!success) return NextResponse.json({ success: false, error: 'License not found' }, { status: 404 });
  return NextResponse.json({ success: true, message: 'License deleted' });
}
