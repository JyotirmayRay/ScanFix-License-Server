import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';

const deactivateSchema = z.object({
  licenseKey: z.string().min(5),
  domain: z.string().min(1),
  installationId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { licenseKey, domain, installationId } = deactivateSchema.parse(body);
    const cleanDomain = domain.trim().toLowerCase().split(':')[0].replace(/^https?:\/\//, '');

    const license = await db.getLicenseByKey(licenseKey);
    if (!license) {
      return NextResponse.json({ success: false, error: 'License key not found' }, { status: 404 });
    }

    const initialCount = license.activatedDomains.length;
    license.activatedDomains = license.activatedDomains.filter((d) => {
      if (installationId && d.installationId) {
        return d.installationId !== installationId;
      }
      return d.domain !== cleanDomain;
    });

    await db.updateLicense(license.id, { activatedDomains: license.activatedDomains });

    await db.addLog({
      licenseKey,
      action: 'deactivate',
      domain: cleanDomain,
      status: 'success',
      reason: `Released ${cleanDomain} (${initialCount} -> ${license.activatedDomains.length})`,
    });

    return NextResponse.json({
      success: true,
      message: `Domain '${cleanDomain}' deactivated. Remaining active activations: ${license.activatedDomains.length}`,
      remainingActiveDomains: license.activatedDomains.length,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
