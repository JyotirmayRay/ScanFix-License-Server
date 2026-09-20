import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { isAuthenticatedAdmin } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createResellerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  quotaLimit: z.number().int().min(1).default(10),
});

export async function GET(req: NextRequest) {
  if (!isAuthenticatedAdmin(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized: Admin authentication required.' }, { status: 401 });
  }

  const resellers = await db.getResellers();
  return NextResponse.json({ success: true, count: resellers.length, resellers });
}

export async function POST(req: NextRequest) {
  if (!isAuthenticatedAdmin(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized: Admin authentication required.' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { name, email, quotaLimit } = createResellerSchema.parse(body);

    const reseller = await db.createReseller(name, email, quotaLimit);
    return NextResponse.json({ success: true, reseller }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
