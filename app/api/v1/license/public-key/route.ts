import { NextResponse } from 'next/server';
import { ensureKeypair } from '@/lib/crypto';

export async function GET() {
  const { publicKey } = ensureKeypair();
  return NextResponse.json({
    success: true,
    algorithm: 'Ed25519',
    publicKey,
  });
}
