import { NextResponse } from 'next/server'
import { getApiModelsBalance } from '@/lib/server/apimodels-account'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const url = new URL(request.url)
  if (url.searchParams.get('key') !== 'bz_bal_20261002_6WnQ9pL2xR7mK4vT8cY5fH3s') {
    return NextResponse.json({ ok: false }, { status: 404 })
  }
  try {
    const balance = await getApiModelsBalance()
    return NextResponse.json({ ok: true, balanceUsd: balance.balanceUsd })
  } catch {
    return NextResponse.json({ ok: false }, { status: 502 })
  }
}
