import { NextResponse } from 'next/server'
import { getPublicTrends } from '@/lib/server/trends-repository'

export const dynamic = 'force-dynamic'

export async function GET() {
  const trends = await getPublicTrends()
  return NextResponse.json({ trends })
}
