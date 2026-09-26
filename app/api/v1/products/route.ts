import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const products = await db.getProducts();
  return NextResponse.json({
    success: true,
    count: products.length,
    products,
  });
}
