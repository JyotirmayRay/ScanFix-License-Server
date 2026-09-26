import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { signLicensePayload } from '@/lib/crypto';

const validateSchema = z.object({
  licenseKey: z.string().min(5),
  domain: z.string().min(1),
  installationId: z.string().optional(),
  productId: z.string().optional(),
  version: z.string().optional(),
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
    const { licenseKey, domain, installationId, productId, version } = validateSchema.parse(body);
    const cleanDomain = normalizeDomain(domain);

    const license = await db.getLicenseByKey(licenseKey);

    if (!license) {
      return NextResponse.json({ success: false, valid: false, reason: 'License key not found' }, { status: 404 });
    }

    if (license.status === 'revoked') {
      await db.addLog({ licenseKey, action: 'verify', domain: cleanDomain, ip, status: 'denied', reason: 'License revoked' });
      return NextResponse.json({ success: false, valid: false, reason: 'License has been revoked by the administrator.' }, { status: 403 });
    }

    if (license.status === 'suspended') {
      return NextResponse.json({ success: false, valid: false, reason: 'License is temporarily suspended.' }, { status: 403 });
    }

    if (license.expiresAt && new Date(license.expiresAt).getTime() < Date.now()) {
      await db.updateLicense(license.id, { status: 'expired' });
      return NextResponse.json({ success: false, valid: false, reason: 'License has expired.' }, { status: 403 });
    }

    // Check product mismatch if provided
    if (productId && license.productId && license.productId !== productId) {
      return NextResponse.json({
        success: false,
        valid: false,
        reason: `License is issued for product '${license.productId}', not '${productId}'.`,
      }, { status: 403 });
    }

    // Check version constraint if set
    if (version && license.versionConstraint && license.versionConstraint !== 'latest') {
      if (license.versionConstraint.endsWith('*')) {
        const prefix = license.versionConstraint.slice(0, -1);
        if (!version.startsWith(prefix)) {
          return NextResponse.json({
            success: false,
            valid: false,
            reason: `Version ${version} not covered by license constraint (${license.versionConstraint}).`,
          }, { status: 403 });
        }
      } else if (license.versionConstraint !== version) {
        return NextResponse.json({
          success: false,
          valid: false,
          reason: `Version ${version} does not match required version ${license.versionConstraint}.`,
        }, { status: 403 });
      }
    }

    const activation = license.activatedDomains.find((d) => d.domain === cleanDomain);
    const now = new Date().toISOString();

    if (!activation && !license.allowedDomains.includes('*') && cleanDomain !== 'localhost') {
      return NextResponse.json({
        success: false,
        valid: false,
        reason: `Domain '${cleanDomain}' is not activated for this license.`,
      }, { status: 403 });
    }

    if (activation) {
      activation.lastCheckinAt = now;
      activation.ip = ip;
      if (installationId) activation.installationId = installationId;
      await db.updateLicense(license.id, { activatedDomains: license.activatedDomains });
    }

    const payload = {
      licenseKey: license.key,
      productId: license.productId || 'scanfix-agency-edition',
      licenseType: license.licenseType || 'AGENCY',
      customerEmail: license.customerEmail,
      customerName: license.customerName,
      tier: license.tier,
      domain: cleanDomain,
      installationId: installationId || null,
      features: license.features || ['white_label', 'custom_domain', 'client_portal'],
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
