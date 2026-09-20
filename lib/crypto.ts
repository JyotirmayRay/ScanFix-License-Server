import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const KEYS_DIR = path.join(process.cwd(), 'data', 'keys');
const PRIVATE_KEY_PATH = path.join(KEYS_DIR, 'private.pem');
const PUBLIC_KEY_PATH = path.join(KEYS_DIR, 'public.pem');

/**
 * Initializes or loads the server's Ed25519 asymmetric cryptographic keypair.
 * The private key signs license tokens, and the public key verifies them.
 */
export function ensureKeypair(): { publicKey: string; privateKey: string } {
  // Check environment variables first (for cloud hosting like Vercel)
  if (process.env.LICENSE_SERVER_PRIVATE_KEY && process.env.LICENSE_SERVER_PUBLIC_KEY) {
    return {
      privateKey: process.env.LICENSE_SERVER_PRIVATE_KEY.replace(/\\n/g, '\n'),
      publicKey: process.env.LICENSE_SERVER_PUBLIC_KEY.replace(/\\n/g, '\n'),
    };
  }

  // Otherwise use local file storage in data/keys
  if (fs.existsSync(PRIVATE_KEY_PATH) && fs.existsSync(PUBLIC_KEY_PATH)) {
    return {
      privateKey: fs.readFileSync(PRIVATE_KEY_PATH, 'utf8'),
      publicKey: fs.readFileSync(PUBLIC_KEY_PATH, 'utf8'),
    };
  }

  // Generate fresh Ed25519 keypair
  if (!fs.existsSync(KEYS_DIR)) {
    fs.mkdirSync(KEYS_DIR, { recursive: true });
  }

  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  fs.writeFileSync(PRIVATE_KEY_PATH, privateKey, 'utf8');
  fs.writeFileSync(PUBLIC_KEY_PATH, publicKey, 'utf8');

  return { publicKey, privateKey };
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
