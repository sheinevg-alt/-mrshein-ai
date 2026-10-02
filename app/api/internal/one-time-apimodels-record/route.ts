import { NextResponse } from 'next/server'
import { getApiModelsRecord } from '@/lib/server/apimodels-account'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const url = new URL(request.url)
  if (url.searchParams.get('key') !== 'bz_record_20261002_mT8kQ4pR2vN6xC9s') {
    return NextResponse.json({ ok: false }, { status: 404 })
  }
  const taskId = url.searchParams.get('task') || ''
  if (!taskId) return NextResponse.json({ ok: false }, { status: 400 })
  try {
    const record = await getApiModelsRecord(taskId)
    return NextResponse.json({ ok: true, record })
  } catch {
    return NextResponse.json({ ok: false }, { status: 502 })
  }
}
