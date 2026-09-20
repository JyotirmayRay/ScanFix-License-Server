import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Production default master Ed25519 keypair for zero-config serverless deployments.
// Can be overridden at runtime via LICENSE_SERVER_PRIVATE_KEY and LICENSE_SERVER_PUBLIC_KEY env vars.
const DEFAULT_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEANqpjJVJ/Fxvc+D0RyUis8QOJ7vtugereWvqSwKWi//k=
-----END PUBLIC KEY-----`;

const DEFAULT_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIGKpqS7YJN7OTwiswWU8eb+OzgnzAAd1QY5D9LAuJbPB
-----END PRIVATE KEY-----`;

const isVercel = !!process.env.VERCEL;
const KEYS_DIR = isVercel
  ? path.join(os.tmpdir(), 'scanfix-license-server', 'keys')
  : path.join(process.cwd(), 'data', 'keys');
const PRIVATE_KEY_PATH = path.join(KEYS_DIR, 'private.pem');
const PUBLIC_KEY_PATH = path.join(KEYS_DIR, 'public.pem');

// In-memory cache across serverless warm requests
const globalForKeys = globalThis as unknown as {
  __ED25519_KEYPAIR__?: { publicKey: string; privateKey: string };
};

/**
 * Initializes or loads the server's Ed25519 asymmetric cryptographic keypair.
 * The private key signs license tokens, and the public key verifies them.
 */
export function ensureKeypair(): { publicKey: string; privateKey: string } {
  // 1. Check in-memory cache
  if (globalForKeys.__ED25519_KEYPAIR__) {
    return globalForKeys.__ED25519_KEYPAIR__;
  }

  // 2. Check environment variables (recommended for custom deployment secrets)
  if (process.env.LICENSE_SERVER_PRIVATE_KEY && process.env.LICENSE_SERVER_PUBLIC_KEY) {
    const pair = {
      privateKey: process.env.LICENSE_SERVER_PRIVATE_KEY.replace(/\\n/g, '\n'),
      publicKey: process.env.LICENSE_SERVER_PUBLIC_KEY.replace(/\\n/g, '\n'),
    };
    globalForKeys.__ED25519_KEYPAIR__ = pair;
    return pair;
  }

  // 3. Check local file storage if available
  try {
    if (fs.existsSync(PRIVATE_KEY_PATH) && fs.existsSync(PUBLIC_KEY_PATH)) {
      const pair = {
        privateKey: fs.readFileSync(PRIVATE_KEY_PATH, 'utf8'),
        publicKey: fs.readFileSync(PUBLIC_KEY_PATH, 'utf8'),
      };
      globalForKeys.__ED25519_KEYPAIR__ = pair;
      return pair;
    }
  } catch (err) {
    // Ignore read errors
  }

  // 4. Try to write default keys to disk for persistence if filesystem allows
  try {
    if (!fs.existsSync(KEYS_DIR)) {
      fs.mkdirSync(KEYS_DIR, { recursive: true });
    }
    fs.writeFileSync(PRIVATE_KEY_PATH, DEFAULT_PRIVATE_KEY, 'utf8');
    fs.writeFileSync(PUBLIC_KEY_PATH, DEFAULT_PUBLIC_KEY, 'utf8');
  } catch (err) {
    // Read-only filesystem (e.g. Vercel) - safely ignore and use memory
  }

  const pair = { publicKey: DEFAULT_PUBLIC_KEY, privateKey: DEFAULT_PRIVATE_KEY };
  globalForKeys.__ED25519_KEYPAIR__ = pair;
  return pair;
}

/**
 * Generates a formatted license key.
 * Format: SF-XXXX-XXXX-XXXX-XXXX
 */
export function generateLicenseKey(prefix: string = 'SF'): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Base32 unambiguous
  const segment = () => {
    let s = '';
    const bytes = crypto.randomBytes(4);
    for (let i = 0; i < 4; i++) {
      s += chars[bytes[i] % chars.length];
    }
    return s;
  };
  return `${prefix}-${segment()}-${segment()}-${segment()}-${segment()}`;
}

/**
 * Cryptographically signs a license payload.
 * Returns a secure Base64 digital signature.
 */
export function signLicensePayload(payload: Record<string, any>): string {
  const { privateKey } = ensureKeypair();
  const serialized = JSON.stringify(payload);
  const signature = crypto.sign(null, Buffer.from(serialized), privateKey);
  return signature.toString('base64');
}

/**
 * Verifies a license payload against a signature using the public key.
 */
export function verifyLicenseSignature(payload: Record<string, any>, signatureBase64: string, publicKeyPem?: string): boolean {
  try {
    const pubKey = publicKeyPem || ensureKeypair().publicKey;
    const serialized = JSON.stringify(payload);
    return crypto.verify(null, Buffer.from(serialized), pubKey, Buffer.from(signatureBase64, 'base64'));
  } catch {
    return false;
  }
}
