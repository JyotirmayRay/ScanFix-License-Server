import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { signLicensePayload } from '@/lib/crypto';

const activateSchema = z.object({
  licenseKey: z.string().min(5),
  domain: z.string().min(1),
});

function normalizeDomain(input: string): string {
  try {
    let clean = input.trim().toLowerCase();
    if (clean.startsWith('http://') || clean.startsWith('https://')) {
      clean = new URL(clean).hostname;
    }
    // Remove port if present
    clean = clean.split(':')[0];
    return clean;
  } catch {
    return input.trim().toLowerCase();
  }
}

function isDomainAllowed(domain: string, allowedDomains: string[]): boolean {
  if (allowedDomains.includes('*')) return true;
  if (domain === 'localhost' || domain === '127.0.0.1') return true; // Always allow local dev

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
    const { licenseKey, domain } = activateSchema.parse(body);
    const cleanDomain = normalizeDomain(domain);

    const license = db.getLicenseByKey(licenseKey);

    if (!license) {
      db.addLog({
        licenseKey,
        action: 'activate',
        domain: cleanDomain,
        ip,
        status: 'denied',
        reason: 'License key not found',
      });
      return NextResponse.json({ success: false, error: 'Invalid license key.' }, { status: 404 });
    }

    if (license.status === 'revoked') {
      db.addLog({
        licenseKey,
        action: 'activate',
        domain: cleanDomain,
        ip,
        status: 'denied',
        reason: 'License has been revoked by administrator',
      });
      return NextResponse.json(
        { success: false, error: 'This license has been revoked. Contact support or your reseller.' },
        { status: 403 }
      );
    }

    if (license.status === 'suspended') {
      db.addLog({
        licenseKey,
        action: 'activate',
        domain: cleanDomain,
        ip,
        status: 'denied',
        reason: 'License is temporarily suspended',
      });
      return NextResponse.json(
        { success: false, error: 'This license is suspended due to billing or policy review.' },
        { status: 403 }
      );
    }

    if (license.expiresAt && new Date(license.expiresAt).getTime() < Date.now()) {
      db.updateLicense(license.id, { status: 'expired' });
      db.addLog({
        licenseKey,
        action: 'activate',
        domain: cleanDomain,
        ip,
        status: 'denied',
        reason: 'License expired',
      });
      return NextResponse.json(
        { success: false, error: 'This license has expired. Please renew your plan.' },
        { status: 403 }
      );
    }

    // Check domain restriction rules
    if (!isDomainAllowed(cleanDomain, license.allowedDomains)) {
      db.addLog({
        licenseKey,
        action: 'activate',
        domain: cleanDomain,
        ip,
        status: 'denied',
        reason: `Domain ${cleanDomain} is not permitted for this license`,
      });
      return NextResponse.json(
        {
          success: false,
          error: `Domain '${cleanDomain}' is not registered under this license. Allowed: ${license.allowedDomains.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Check activation slot limit
    const existingIndex = license.activatedDomains.findIndex((d) => d.domain === cleanDomain);
    const now = new Date().toISOString();

    if (existingIndex >= 0) {
      // Already activated on this domain — refresh checkin
      license.activatedDomains[existingIndex].lastCheckinAt = now;
      license.activatedDomains[existingIndex].ip = ip;
    } else {
      if (license.activatedDomains.length >= license.maxDomains) {
        db.addLog({
          licenseKey,
          action: 'activate',
          domain: cleanDomain,
          ip,
          status: 'denied',
          reason: `Maximum domain activations reached (${license.maxDomains})`,
        });
        return NextResponse.json(
          {
            success: false,
            error: `Maximum domain limit reached (${license.maxDomains} domain${license.maxDomains > 1 ? 's' : ''}). Please deactivate an existing domain first.`,
          },
          { status: 400 }
        );
      }
      license.activatedDomains.push({
        domain: cleanDomain,
        activatedAt: now,
        lastCheckinAt: now,
        ip,
      });
    }

    db.updateLicense(license.id, { activatedDomains: license.activatedDomains });

    // Build cryptographically signed license token
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

    const signature = signLicensePayload(payload);

    db.addLog({
      licenseKey,
      action: 'activate',
      domain: cleanDomain,
      ip,
      status: 'success',
      reason: `Successfully activated on ${cleanDomain}`,
    });

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
