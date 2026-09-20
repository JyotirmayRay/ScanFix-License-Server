import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';

const createResellerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  quotaLimit: z.number().int().min(1).default(10),
});

export async function GET() {
  const resellers = db.getResellers();
  return NextResponse.json({ success: true, count: resellers.length, resellers });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, quotaLimit } = createResellerSchema.parse(body);

    const reseller = db.createReseller(name, email, quotaLimit);
    return NextResponse.json({ success: true, reseller }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
