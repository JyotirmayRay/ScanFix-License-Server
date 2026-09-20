-- ==============================================================================
-- ScanFix License Server - Supabase PostgreSQL Schema
-- ==============================================================================

-- 1. Licenses Table
CREATE TABLE IF NOT EXISTS sf_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('agency', 'enterprise', 'custom')),
  status TEXT NOT NULL CHECK (status IN ('active', 'suspended', 'revoked', 'expired')),
  allowed_domains JSONB NOT NULL DEFAULT '["*"]'::jsonb,
  max_domains INT NOT NULL DEFAULT 5,
  activated_domains JSONB NOT NULL DEFAULT '[]'::jsonb,
  expires_at TIMESTAMPTZ,
  reseller_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for high-speed key verification
CREATE INDEX IF NOT EXISTS idx_sf_licenses_key ON sf_licenses(key);
CREATE INDEX IF NOT EXISTS idx_sf_licenses_status ON sf_licenses(status);

-- 2. Resellers Table
CREATE TABLE IF NOT EXISTS sf_resellers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  api_key TEXT UNIQUE NOT NULL,
  quota_limit INT NOT NULL DEFAULT 20,
  quota_used INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sf_resellers_api_key ON sf_resellers(api_key);

-- 3. Audit Logs Table
CREATE TABLE IF NOT EXISTS sf_license_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_key TEXT NOT NULL,
  action TEXT NOT NULL,
  domain TEXT,
  ip TEXT,
  status TEXT NOT NULL,
  reason TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sf_audit_license_key ON sf_license_audit_logs(license_key);
CREATE INDEX IF NOT EXISTS idx_sf_audit_timestamp ON sf_license_audit_logs(timestamp DESC);
