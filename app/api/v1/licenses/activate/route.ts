import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { signLicensePayload } from '@/lib/crypto';

const activateSchema = z.object({
  licenseKey: z.string().min(5),
  domain: z.string().min(1),
  installationId: z.string().optional(),
  productId: z.string().optional(),
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

function isDomainAllowed(domain: string, allowedDomains: string[]): boolean {
  if (allowedDomains.includes('*')) return true;
  if (domain === 'localhost' || domain === '127.0.0.1') return true;
  for (const allowed of allowedDomains) {
    const cleanAllowed = normalizeDomain(allowed);
    if (cleanAllowed === domain) return true;
    if (cleanAllowed.startsWith('*.') && domain.endsWith(cleanAllowed.slice(2))) return true;
  }
  return false;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || '127.0.0.1';

  try {
    const body = await req.json();
    const { licenseKey, domain, installationId, productId } = activateSchema.parse(body);
    const cleanDomain = normalizeDomain(domain);

    const license = await db.getLicenseByKey(licenseKey);

    if (!license) {
      await db.addLog({ licenseKey, action: 'activate', domain: cleanDomain, ip, status: 'denied', reason: 'License key not found' });
      return NextResponse.json({ success: false, error: 'Invalid license key.' }, { status: 404 });
    }

    if (license.status === 'revoked') {
      await db.addLog({ licenseKey, action: 'activate', domain: cleanDomain, ip, status: 'denied', reason: 'License revoked' });
      return NextResponse.json({ success: false, error: 'This license has been revoked.' }, { status: 403 });
    }

    if (license.status === 'suspended') {
      await db.addLog({ licenseKey, action: 'activate', domain: cleanDomain, ip, status: 'denied', reason: 'License suspended' });
      return NextResponse.json({ success: false, error: 'This license is temporarily suspended.' }, { status: 403 });
    }

    if (license.expiresAt && new Date(license.expiresAt).getTime() < Date.now()) {
      await db.updateLicense(license.id, { status: 'expired' });
      await db.addLog({ licenseKey, action: 'activate', domain: cleanDomain, ip, status: 'denied', reason: 'License expired' });
      return NextResponse.json({ success: false, error: 'This license has expired.' }, { status: 403 });
    }

    if (productId && license.productId && license.productId !== productId) {
      return NextResponse.json({
        success: false,
        error: `License belongs to product '${license.productId}', not '${productId}'.`,
      }, { status: 403 });
    }

    if (!isDomainAllowed(cleanDomain, license.allowedDomains)) {
      await db.addLog({ licenseKey, action: 'activate', domain: cleanDomain, ip, status: 'denied', reason: `Domain ${cleanDomain} not allowed` });
      return NextResponse.json({
        success: false,
        error: `Domain '${cleanDomain}' is not registered under this license.`,
      }, { status: 400 });
    }

    const existingIndex = license.activatedDomains.findIndex((d) => d.domain === cleanDomain);
    const now = new Date().toISOString();

    if (existingIndex >= 0) {
      license.activatedDomains[existingIndex].lastCheckinAt = now;
      license.activatedDomains[existingIndex].ip = ip;
      if (installationId) license.activatedDomains[existingIndex].installationId = installationId;
    } else {
      if (license.activatedDomains.length >= license.maxDomains) {
        await db.addLog({ licenseKey, action: 'activate', domain: cleanDomain, ip, status: 'denied', reason: `Limit reached (${license.maxDomains})` });
        return NextResponse.json({
          success: false,
          error: `Maximum domain activations reached (${license.maxDomains}). Please deactivate an existing domain first.`,
        }, { status: 400 });
      }
      license.activatedDomains.push({
        domain: cleanDomain,
        installationId,
        activatedAt: now,
        lastCheckinAt: now,
        ip,
      });
    }

    await db.updateLicense(license.id, { activatedDomains: license.activatedDomains });

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

    const signature = signLicensePayload(payload);

    await db.addLog({ licenseKey, action: 'activate', domain: cleanDomain, ip, status: 'success', reason: `Activated on ${cleanDomain}` });

    return NextResponse.json({
      success: true,
      message: 'License activated successfully.',
      token: signature,
      payload,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
