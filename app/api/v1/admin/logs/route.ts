import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const logs = db.getRecentLogs(100);
  return NextResponse.json({ success: true, count: logs.length, logs });
}
