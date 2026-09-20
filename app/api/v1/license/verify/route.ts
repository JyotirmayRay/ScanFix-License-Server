import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { signLicensePayload } from '@/lib/crypto';

const verifySchema = z.object({
  licenseKey: z.string().min(5),
  domain: z.string().min(1),
});

function normalizeDomain(input: string): string {
  try {
    let clean = input.trim().toLowerCase();
    if (clean.startsWith('http://') || clean.startsWith('https://')) {
      clean = new URL(clean).hostname;
    }
    clean = clean.split(':')[0];
    return clean;
  } catch {
    return input.trim().toLowerCase();
  }
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || '127.0.0.1';

  try {
    const body = await req.json();
    const { licenseKey, domain } = verifySchema.parse(body);
    const cleanDomain = normalizeDomain(domain);

    const license = db.getLicenseByKey(licenseKey);

    if (!license) {
      return NextResponse.json(
        { success: false, valid: false, reason: 'License key not found' },
        { status: 404 }
      );
    }

    // Remote Kill Switch: check if revoked or suspended
    if (license.status === 'revoked') {
      db.addLog({
        licenseKey,
        action: 'verify',
        domain: cleanDomain,
        ip,
        status: 'denied',
        reason: 'License was revoked remotely',
      });
      return NextResponse.json(
        { success: false, valid: false, reason: 'License has been revoked by the administrator.' },
        { status: 403 }
      );
    }

    if (license.status === 'suspended') {
      return NextResponse.json(
        { success: false, valid: false, reason: 'License is temporarily suspended.' },
        { status: 403 }
      );
    }

    if (license.expiresAt && new Date(license.expiresAt).getTime() < Date.now()) {
      db.updateLicense(license.id, { status: 'expired' });
      return NextResponse.json(
        { success: false, valid: false, reason: 'License has expired.' },
        { status: 403 }
      );
    }

    // Verify this domain was activated
    const activation = license.activatedDomains.find((d) => d.domain === cleanDomain);
    const now = new Date().toISOString();

    if (!activation && !license.allowedDomains.includes('*') && cleanDomain !== 'localhost') {
      return NextResponse.json(
        { success: false, valid: false, reason: `Domain '${cleanDomain}' is not activated for this license.` },
        { status: 403 }
      );
    }

    // Update heartbeat timestamp
    if (activation) {
      activation.lastCheckinAt = now;
      activation.ip = ip;
      db.updateLicense(license.id, { activatedDomains: license.activatedDomains });
    }

    const payload = {
      licenseKey: license.key,
      customerEmail: license.customerEmail,
      customerName: license.customerName,
      tier: license.tier,
      domain: cleanDomain,
      expiresAt: license.expiresAt,
      issuedAt: now,
      activatedDomainsCount: license.activatedDomains.length,
      maxDomains: license.maxDomains,
    };

    const token = signLicensePayload(payload);

    return NextResponse.json({
      success: true,
      valid: true,
      token,
      payload,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
