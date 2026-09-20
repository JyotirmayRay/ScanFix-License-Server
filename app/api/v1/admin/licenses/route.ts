import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db, LicenseTier } from '@/lib/db';
import { generateLicenseKey } from '@/lib/crypto';

const createLicenseSchema = z.object({
  customerName: z.string().min(1),
  customerEmail: z.string().email(),
  tier: z.enum(['solo', 'pro', 'agency', 'enterprise']),
  allowedDomains: z.array(z.string()).default(['*']),
  maxDomains: z.number().int().min(1).default(1),
  durationDays: z.number().int().nullable().optional(), // null = Lifetime
  resellerId: z.string().nullable().optional(),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const licenses = db.getLicenses();
  return NextResponse.json({ success: true, count: licenses.length, licenses });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = createLicenseSchema.parse(body);

    // If reseller is issuing, check quota
    if (data.resellerId) {
      const reseller = db.getResellerById(data.resellerId);
      if (!reseller) {
        return NextResponse.json({ success: false, error: 'Reseller not found' }, { status: 404 });
      }
      if (reseller.quotaUsed >= reseller.quotaLimit) {
        return NextResponse.json(
          {
            success: false,
            error: `Reseller quota exceeded (${reseller.quotaUsed}/${reseller.quotaLimit}). Please purchase more license credits.`,
          },
          { status: 403 }
        );
      }
    }

    let expiresAt: string | null = null;
    if (data.durationDays && data.durationDays > 0) {
      const expDate = new Date();
      expDate.setDate(expDate.getDate() + data.durationDays);
      expiresAt = expDate.toISOString();
    }

    const key = generateLicenseKey();
    const license = db.createLicense({
      key,
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      tier: data.tier as LicenseTier,
      status: 'active',
      allowedDomains: data.allowedDomains.length > 0 ? data.allowedDomains : ['*'],
      maxDomains: data.maxDomains,
      expiresAt,
      resellerId: data.resellerId || null,
      notes: data.notes || '',
    });

    return NextResponse.json({
      success: true,
      message: 'License generated successfully',
      license,
    }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
