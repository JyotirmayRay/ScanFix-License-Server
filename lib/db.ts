import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export type LicenseTier = 'solo' | 'pro' | 'agency' | 'enterprise';
export type LicenseStatus = 'active' | 'suspended' | 'revoked' | 'expired';

export interface ActivatedDomain {
  domain: string;
  activatedAt: string;
  lastCheckinAt: string;
  ip: string;
}

export interface License {
  id: string;
  key: string;
  customerName: string;
  customerEmail: string;
  tier: LicenseTier;
  status: LicenseStatus;
  allowedDomains: string[]; // ['*'] for any, or specific domains ['client.com', 'localhost']
  maxDomains: number;
  activatedDomains: ActivatedDomain[];
  expiresAt: string | null; // ISO string, null = Lifetime
  resellerId: string | null;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Reseller {
  id: string;
  name: string;
  email: string;
  apiKey: string;
  quotaLimit: number;
  quotaUsed: number;
  status: 'active' | 'suspended';
  createdAt: string;
}

export interface AuditLog {
  id: string;
  licenseKey?: string;
  action: 'activate' | 'verify' | 'deactivate' | 'revoke' | 'create' | 'reseller_create';
  domain?: string;
  ip?: string;
  status: 'success' | 'denied';
  reason?: string;
  timestamp: string;
}

export interface BrandingConfig {
  companyName: string;
  serverName: string;
  logoUrl?: string;
  brandColor: string;
  keyPrefix: string;
  supportEmail: string;
  supportUrl?: string;
  footerText?: string;
  hideScanFixBranding: boolean;
}

export const DEFAULT_BRANDING: BrandingConfig = {
  companyName: process.env.BRAND_COMPANY_NAME || 'ScanFix',
  serverName: process.env.BRAND_SERVER_NAME || 'License Authority',
  logoUrl: process.env.BRAND_LOGO_URL || '',
  brandColor: process.env.BRAND_COLOR || '#10b981',
  keyPrefix: process.env.LICENSE_KEY_PREFIX || 'SF',
  supportEmail: process.env.BRAND_SUPPORT_EMAIL || 'support@scanfix.dev',
  supportUrl: process.env.BRAND_SUPPORT_URL || '',
  footerText: process.env.BRAND_FOOTER_TEXT || 'Protected by Cryptographic Token Authority',
  hideScanFixBranding: process.env.HIDE_SCANFIX_BRANDING === 'true',
};

interface DatabaseSchema {
  licenses: License[];
  resellers: Reseller[];
  auditLogs: AuditLog[];
  branding: BrandingConfig;
}

import os from 'os';

const isVercel = !!process.env.VERCEL;
const DATA_DIR = isVercel
  ? path.join(os.tmpdir(), 'scanfix-license-server', 'data')
  : path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');

const globalForDb = globalThis as unknown as {
  __LICENSE_DB_DATA__?: DatabaseSchema;
};

class Database {
  private data: DatabaseSchema = {
    licenses: [],
    resellers: [],
    auditLogs: [],
    branding: { ...DEFAULT_BRANDING },
  };

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (globalForDb.__LICENSE_DB_DATA__) {
        this.data = globalForDb.__LICENSE_DB_DATA__;
        return;
      }

      if (fs.existsSync(DB_PATH)) {
        const raw = fs.readFileSync(DB_PATH, 'utf8');
        this.data = JSON.parse(raw);
        if (!this.data.branding) {
          this.data.branding = { ...DEFAULT_BRANDING };
        }
        globalForDb.__LICENSE_DB_DATA__ = this.data;
        return;
      }
    } catch (err) {
      console.error('[DB] Load error, initializing empty:', err);
    }

    this.data = {
      licenses: [],
      resellers: [],
      auditLogs: [],
      branding: { ...DEFAULT_BRANDING },
    };
    globalForDb.__LICENSE_DB_DATA__ = this.data;
    this.save();
  }

  private save() {
    try {
      globalForDb.__LICENSE_DB_DATA__ = this.data;
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_PATH, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err) {
      console.warn('[DB] Could not write to disk, using in-memory store:', err);
    }
  }

  // --- Licenses ---
  getLicenses(): License[] {
    return [...this.data.licenses].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  getLicenseByKey(key: string): License | null {
    const cleanKey = key.trim().toUpperCase();
    return this.data.licenses.find((l) => l.key.toUpperCase() === cleanKey) || null;
  }

  getLicenseById(id: string): License | null {
    return this.data.licenses.find((l) => l.id === id) || null;
  }

  createLicense(params: Omit<License, 'id' | 'createdAt' | 'updatedAt' | 'activatedDomains'>): License {
    const license: License = {
      ...params,
      id: crypto.randomUUID(),
      activatedDomains: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.data.licenses.push(license);

    if (params.resellerId) {
      const reseller = this.data.resellers.find((r) => r.id === params.resellerId);
      if (reseller) {
        reseller.quotaUsed += 1;
      }
    }

    this.save();
    this.addLog({
      licenseKey: license.key,
      action: 'create',
      status: 'success',
      reason: `License created for ${license.customerEmail} (${license.tier})`,
    });
    return license;
  }

  updateLicense(id: string, updates: Partial<License>): License | null {
    const idx = this.data.licenses.findIndex((l) => l.id === id);
    if (idx === -1) return null;

    this.data.licenses[idx] = {
      ...this.data.licenses[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.save();
    return this.data.licenses[idx];
  }

  deleteLicense(id: string): boolean {
    const idx = this.data.licenses.findIndex((l) => l.id === id);
    if (idx === -1) return false;
    this.data.licenses.splice(idx, 1);
    this.save();
    return true;
  }

  // --- Resellers ---
  getResellers(): Reseller[] {
    return [...this.data.resellers];
  }

  getResellerById(id: string): Reseller | null {
    return this.data.resellers.find((r) => r.id === id) || null;
  }

  getResellerByApiKey(apiKey: string): Reseller | null {
    return this.data.resellers.find((r) => r.apiKey === apiKey) || null;
  }

  createReseller(name: string, email: string, quotaLimit: number): Reseller {
    const reseller: Reseller = {
      id: crypto.randomUUID(),
      name,
      email,
      apiKey: `SF_RS_${crypto.randomBytes(16).toString('hex')}`,
      quotaLimit,
      quotaUsed: 0,
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    this.data.resellers.push(reseller);
    this.save();
    this.addLog({
      action: 'reseller_create',
      status: 'success',
      reason: `Reseller ${name} created with quota ${quotaLimit}`,
    });
    return reseller;
  }

  // --- Audit Logs ---
  addLog(entry: Omit<AuditLog, 'id' | 'timestamp'>) {
    const log: AuditLog = {
      id: crypto.randomUUID(),
      ...entry,
      timestamp: new Date().toISOString(),
    };
    this.data.auditLogs.unshift(log);
    // Keep last 1000 logs
    if (this.data.auditLogs.length > 1000) {
      this.data.auditLogs.pop();
    }
    this.save();
  }

  getRecentLogs(limit: number = 50): AuditLog[] {
    return this.data.auditLogs.slice(0, limit);
  }

  // --- White-Label Branding ---
  getBranding(): BrandingConfig {
    return this.data.branding || { ...DEFAULT_BRANDING };
  }

  updateBranding(updates: Partial<BrandingConfig>): BrandingConfig {
    this.data.branding = {
      ...(this.data.branding || DEFAULT_BRANDING),
      ...updates,
    };
    this.save();
    return this.data.branding;
  }
}

export const db = new Database();
