import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';

const deactivateSchema = z.object({
  licenseKey: z.string().min(5),
  domain: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { licenseKey, domain } = deactivateSchema.parse(body);
    const cleanDomain = domain.trim().toLowerCase().split(':')[0].replace(/^https?:\/\//, '');

    const license = await db.getLicenseByKey(licenseKey);
    if (!license) {
      return NextResponse.json({ success: false, error: 'License key not found' }, { status: 404 });
    }

    const initialCount = license.activatedDomains.length;
    license.activatedDomains = license.activatedDomains.filter((d) => d.domain !== cleanDomain);

    await db.updateLicense(license.id, { activatedDomains: license.activatedDomains });

    await db.addLog({
      licenseKey,
      action: 'deactivate',
      domain: cleanDomain,
      status: 'success',
      reason: `Domain ${cleanDomain} released successfully (${initialCount} -> ${license.activatedDomains.length})`,
    });

    return NextResponse.json({
      success: true,
      message: `Domain '${cleanDomain}' deactivated. You may now activate this license on a new server.`,
      remainingActiveDomains: license.activatedDomains.length,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
