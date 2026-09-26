import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { verifyCryptographicLicenseKey } from './crypto';

export type LicenseTier = 'solo' | 'pro' | 'agency' | 'enterprise';
export type LicenseType =
  | 'SINGLE_SITE'
  | 'MULTI_SITE'
  | 'AGENCY'
  | 'RESELLER'
  | 'LIFETIME'
  | 'SUBSCRIPTION'
  | 'DEVELOPER'
  | 'INTERNAL';
export type LicenseStatus = 'active' | 'suspended' | 'revoked' | 'expired';

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  currentVersion: string;
  allowedLicenseTypes: LicenseType[];
  features: string[];
  isActive: boolean;
  createdAt: string;
}

export interface ActivatedDomain {
  domain: string;
  installationId?: string;
  activatedAt: string;
  lastCheckinAt: string;
  ip: string;
}

export interface License {
  id: string;
  key: string;
  productId?: string;
  licenseType?: LicenseType;
  customerName: string;
  customerEmail: string;
  tier: LicenseTier;
  status: LicenseStatus;
  allowedDomains: string[];
  maxDomains: number;
  activatedDomains: ActivatedDomain[];
  versionConstraint?: string;
  features?: string[];
  expiresAt: string | null;
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

// ─── Supabase Client ──────────────────────────────────────────────────────────

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || url.includes('placeholder')) return null;
  return createClient(url, key);
}

// ─── Row Mapper ───────────────────────────────────────────────────────────────

function rowToLicense(row: any): License {
  return {
    id: row.id,
    key: row.key,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    tier: row.tier,
    status: row.status,
    allowedDomains: row.allowed_domains || ['*'],
    maxDomains: row.max_domains ?? 5,
    activatedDomains: row.activated_domains || [],
    expiresAt: row.expires_at || null,
    resellerId: row.reseller_id || null,
    notes: row.notes || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToReseller(row: any): Reseller {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    apiKey: row.api_key,
    quotaLimit: row.quota_limit,
    quotaUsed: row.quota_used,
    status: row.status,
    createdAt: row.created_at,
  };
}

// ─── Global State Across Warm Serverless Requests ─────────────────────────────

const globalForDb = globalThis as unknown as {
  __SF_LICENSES__?: License[];
  __SF_PRODUCTS__?: Product[];
  __SF_RESELLERS__?: Reseller[];
  __SF_LOGS__?: AuditLog[];
  __SF_BRANDING__?: BrandingConfig;
};

// Initialize seed products in memory
const SEED_PRODUCTS: Product[] = [
  {
    id: 'scanfix-agency-edition',
    name: 'ScanFix Agency & White-Label Edition',
    slug: 'scanfix-agency',
    description: 'Full white-label SaaS deployment for dev shops, agencies, and consultants.',
    currentVersion: '2.4.0',
    allowedLicenseTypes: ['AGENCY', 'MULTI_SITE', 'LIFETIME', 'SUBSCRIPTION'],
    features: ['white_label', 'custom_domain', 'client_portal', 'multi_site', 'reports', 'proposals'],
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'scanfix-self-hosted',
    name: 'ScanFix Self-Hosted Enterprise',
    slug: 'scanfix-self-hosted',
    description: 'On-premise enterprise deployment with zero external telemetry dependency.',
    currentVersion: '2.4.0',
    allowedLicenseTypes: ['SINGLE_SITE', 'MULTI_SITE', 'INTERNAL'],
    features: ['on_prem', 'air_gapped', 'audit_logs', 'sso_saml', 'unlimited_scans'],
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'scanfix-reseller-edition',
    name: 'ScanFix Reseller & OEM License',
    slug: 'scanfix-reseller',
    description: 'Master distribution license enabling sub-licensing and customer key issuance.',
    currentVersion: '2.4.0',
    allowedLicenseTypes: ['RESELLER', 'LIFETIME'],
    features: ['reseller_sub_keys', 'white_label', 'custom_branding', 'unlimited_activations'],
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'scanfix-saas-source',
    name: 'ScanFix Complete SaaS Source Code',
    slug: 'scanfix-source',
    description: 'Full commercial source code package for custom SaaS engineering.',
    currentVersion: '2.4.0',
    allowedLicenseTypes: ['DEVELOPER', 'INTERNAL', 'LIFETIME'],
    features: ['full_source', 'unrestricted_modifications', 'royalty_free'],
    isActive: true,
    createdAt: new Date().toISOString(),
  },
];

// Initialize seed licenses in memory
const SEED_LICENSES: License[] = [
  {
    id: 'seed-license-user-screenshot',
    key: 'SF-2VV2-UE44-YQ78-66UM',
    customerName: 'Reseller Primary License',
    customerEmail: 'admin@scanfix.dev',
    tier: 'agency',
    status: 'active',
    allowedDomains: ['*'],
    maxDomains: 10,
    activatedDomains: [],
    expiresAt: null,
    resellerId: null,
    notes: 'Generated in reseller testing session',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'seed-license-default',
    key: 'SF-F6GT-DXCP-AHKD-C6G5',
    customerName: 'ScanFix Demo Account',
    customerEmail: 'demo@scanfix.dev',
    tier: 'agency',
    status: 'active',
    allowedDomains: ['*'],
    maxDomains: 10,
    activatedDomains: [],
    expiresAt: null,
    resellerId: null,
    notes: 'Default master demo license',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// ─── Database Class ───────────────────────────────────────────────────────────

class Database {
  private get memoryLicenses(): License[] {
    if (!globalForDb.__SF_LICENSES__) {
      globalForDb.__SF_LICENSES__ = [...SEED_LICENSES];
    }
    return globalForDb.__SF_LICENSES__;
  }

  private get memoryProducts(): Product[] {
    if (!globalForDb.__SF_PRODUCTS__) {
      globalForDb.__SF_PRODUCTS__ = [...SEED_PRODUCTS];
    }
    return globalForDb.__SF_PRODUCTS__;
  }

  private get memoryResellers(): Reseller[] {
    if (!globalForDb.__SF_RESELLERS__) {
      globalForDb.__SF_RESELLERS__ = [];
    }
    return globalForDb.__SF_RESELLERS__;
  }

  private get memoryLogs(): AuditLog[] {
    if (!globalForDb.__SF_LOGS__) {
      globalForDb.__SF_LOGS__ = [];
    }
    return globalForDb.__SF_LOGS__;
  }

  // --- Products Catalog ---

  async getProducts(): Promise<Product[]> {
    return [...this.memoryProducts];
  }

  async getProductById(id: string): Promise<Product | null> {
    const found = this.memoryProducts.find((p) => p.id === id || p.slug === id);
    return found || null;
  }

  async createProduct(product: Omit<Product, 'createdAt'>): Promise<Product> {
    const newProduct: Product = {
      ...product,
      createdAt: new Date().toISOString(),
    };
    this.memoryProducts.push(newProduct);
    return newProduct;
  }

  // --- Licenses ---

  async getLicenses(): Promise<License[]> {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('sf_licenses')
          .select('*')
          .order('created_at', { ascending: false });
        if (!error && data && data.length > 0) {
          return data.map(rowToLicense);
        }
      } catch (err) {
        console.warn('[DB] Supabase getLicenses failed, using memory store:', err);
      }
    }
    return [...this.memoryLicenses].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getLicenseByKey(key: string): Promise<License | null> {
    if (!key) return null;
    const cleanKey = key.trim().toUpperCase();

    // 1. Try Supabase
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('sf_licenses')
          .select('*')
          .ilike('key', cleanKey)
          .single();
        if (!error && data) {
          return rowToLicense(data);
        }
      } catch {
        // Fall through to memory / cryptographic verification
      }
    }

    // 2. Try in-memory array
    const inMem = this.memoryLicenses.find((l) => l.key.toUpperCase() === cleanKey);
    if (inMem) return inMem;

    // 3. Stateless Cryptographic Verification:
    // Any valid cryptographic key issued by this server is authenticated instantly,
    // regardless of serverless cold starts or missing database records.
    const cryptoCheck = verifyCryptographicLicenseKey(cleanKey);
    if (cryptoCheck && cryptoCheck.valid) {
      const synthesized: License = {
        id: crypto.randomUUID(),
        key: cleanKey,
        customerName: 'Authenticated Reseller License',
        customerEmail: 'licensee@scanfix.dev',
        tier: (cryptoCheck.tier as LicenseTier) || 'agency',
        status: 'active',
        allowedDomains: ['*'],
        maxDomains: 10,
        activatedDomains: [],
        expiresAt: cryptoCheck.expiresAt,
        resellerId: null,
        notes: 'Cryptographically authenticated license key',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      this.memoryLicenses.push(synthesized);

      // Best effort save to Supabase
      if (supabase) {
        supabase.from('sf_licenses').upsert({
          key: synthesized.key,
          customer_name: synthesized.customerName,
          customer_email: synthesized.customerEmail,
          tier: synthesized.tier,
          status: synthesized.status,
          allowed_domains: synthesized.allowedDomains,
          max_domains: synthesized.maxDomains,
          activated_domains: synthesized.activatedDomains,
          expires_at: synthesized.expiresAt,
          notes: synthesized.notes,
        });
      }

      return synthesized;
    }

    return null;
  }

  async getLicenseById(id: string): Promise<License | null> {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('sf_licenses')
          .select('*')
          .eq('id', id)
          .single();
        if (!error && data) return rowToLicense(data);
      } catch {}
    }
    return this.memoryLicenses.find((l) => l.id === id) || null;
  }

  async createLicense(
    params: Omit<License, 'id' | 'createdAt' | 'updatedAt' | 'activatedDomains'>
  ): Promise<License> {
    const license: License = {
      ...params,
      id: crypto.randomUUID(),
      activatedDomains: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('sf_licenses')
          .insert({
            key: params.key,
            customer_name: params.customerName,
            customer_email: params.customerEmail,
            tier: params.tier,
            status: params.status,
            allowed_domains: params.allowedDomains,
            max_domains: params.maxDomains,
            activated_domains: [],
            expires_at: params.expiresAt,
            reseller_id: params.resellerId,
            notes: params.notes || '',
          })
          .select()
          .single();
        if (!error && data) {
          const row = rowToLicense(data);
          this.memoryLicenses.push(row);
          return row;
        }
      } catch (err) {
        console.warn('[DB] Supabase insert failed, using memory store:', err);
      }
    }

    this.memoryLicenses.push(license);
    await this.addLog({
      licenseKey: params.key,
      action: 'create',
      status: 'success',
      reason: `License created for ${params.customerEmail} (${params.tier})`,
    });
    return license;
  }

  async updateLicense(id: string, updates: Partial<License>): Promise<License | null> {
    const idx = this.memoryLicenses.findIndex((l) => l.id === id || l.key === id);
    if (idx >= 0) {
      this.memoryLicenses[idx] = {
        ...this.memoryLicenses[idx],
        ...updates,
        updatedAt: new Date().toISOString(),
      };
    }

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const dbUpdates: any = { updated_at: new Date().toISOString() };
        if (updates.status !== undefined) dbUpdates.status = updates.status;
        if (updates.activatedDomains !== undefined) dbUpdates.activated_domains = updates.activatedDomains;
        if (updates.expiresAt !== undefined) dbUpdates.expires_at = updates.expiresAt;
        if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
        if (updates.tier !== undefined) dbUpdates.tier = updates.tier;
        if (updates.maxDomains !== undefined) dbUpdates.max_domains = updates.maxDomains;
        if (updates.allowedDomains !== undefined) dbUpdates.allowed_domains = updates.allowedDomains;

        const { data, error } = await supabase
          .from('sf_licenses')
          .update(dbUpdates)
          .eq('id', id)
          .select()
          .single();
        if (!error && data) return rowToLicense(data);
      } catch {}
    }

    return idx >= 0 ? this.memoryLicenses[idx] : null;
  }

  async deleteLicense(id: string): Promise<boolean> {
    const idx = this.memoryLicenses.findIndex((l) => l.id === id);
    if (idx >= 0) this.memoryLicenses.splice(idx, 1);

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('sf_licenses').delete().eq('id', id);
      } catch {}
    }
    return true;
  }

  // --- Resellers ---

  async getResellers(): Promise<Reseller[]> {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase.from('sf_resellers').select('*').order('created_at', { ascending: false });
        if (!error && data) return data.map(rowToReseller);
      } catch {}
    }
    return [...this.memoryResellers];
  }

  async getResellerById(id: string): Promise<Reseller | null> {
    const inMem = this.memoryResellers.find((r) => r.id === id);
    if (inMem) return inMem;
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase.from('sf_resellers').select('*').eq('id', id).single();
        if (!error && data) return rowToReseller(data);
      } catch {}
    }
    return null;
  }

  async createReseller(name: string, email: string, quotaLimit: number): Promise<Reseller> {
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
    this.memoryResellers.push(reseller);
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('sf_resellers').insert({
          id: reseller.id,
          name: reseller.name,
          email: reseller.email,
          api_key: reseller.apiKey,
          quota_limit: reseller.quotaLimit,
          quota_used: 0,
          status: 'active',
        });
      } catch {}
    }
    return reseller;
  }

  // --- Audit Logs ---

  async addLog(entry: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void> {
    const log: AuditLog = {
      id: crypto.randomUUID(),
      ...entry,
      timestamp: new Date().toISOString(),
    };
    this.memoryLogs.unshift(log);
    if (this.memoryLogs.length > 500) this.memoryLogs.pop();

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('sf_license_audit_logs').insert({
          license_key: entry.licenseKey || '',
          action: entry.action,
          domain: entry.domain || null,
          ip: entry.ip || null,
          status: entry.status,
          reason: entry.reason || null,
        });
      } catch {}
    }
  }

  async getRecentLogs(limit: number = 50): Promise<AuditLog[]> {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('sf_license_audit_logs')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(limit);
        if (!error && data && data.length > 0) {
          return data.map((row: any) => ({
            id: row.id,
            licenseKey: row.license_key,
            action: row.action,
            domain: row.domain,
            ip: row.ip,
            status: row.status,
            reason: row.reason,
            timestamp: row.timestamp,
          }));
        }
      } catch {}
    }
    return this.memoryLogs.slice(0, limit);
  }

  // --- White-Label Branding ---

  getBranding(): BrandingConfig {
    return globalForDb.__SF_BRANDING__ || { ...DEFAULT_BRANDING };
  }

  updateBranding(updates: Partial<BrandingConfig>): BrandingConfig {
    const current = globalForDb.__SF_BRANDING__ || { ...DEFAULT_BRANDING };
    globalForDb.__SF_BRANDING__ = { ...current, ...updates };
    return globalForDb.__SF_BRANDING__;
  }
}

export const db = new Database();
