import { NextResponse } from 'next/server'
import { deleteStorageObjects, hasDatabase, supabaseFetch } from '@/lib/server/supabase'
import { verifyTelegramInitData } from '@/lib/server/telegram-auth'

export const dynamic = 'force-dynamic'

function failureType(row: any): 'temporary' | 'input' | 'provider' {
  if (row?.result_metadata?.apimodels_retryable === true) return 'temporary'
  const text = [
    row?.error_code,
    row?.result_metadata?.apimodels_fail_code,
    row?.result_metadata?.apimodels_fail_message,
  ].filter(Boolean).join(' ').toLowerCase()

  if (/input|reference|file|format|duration|resolution|unsupported|invalid|image|video/.test(text)) return 'input'
  return 'provider'
}

function collectOwnedInputPaths(value: unknown, telegramId: number, out = new Set<string>()) {
  if (typeof value === 'string') {
    const path = value.replace(/^\/+/, '')
    if (path.startsWith(`${telegramId}/`)) out.add(path)
    return out
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => collectOwnedInputPaths(entry, telegramId, out))
    return out
  }
  if (value && typeof value === 'object') {
    Object.values(value as Record<string, unknown>).forEach((entry) => collectOwnedInputPaths(entry, telegramId, out))
  }
  return out
}

export async function GET(request: Request) {
  const user = verifyTelegramInitData(request.headers.get('x-telegram-init-data') || '')
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasDatabase()) {
    return NextResponse.json({
      history: [],
      pagination: { limit: 5, offset: 0, nextOffset: 0, hasMore: false },
    })
  }

  const url = new URL(request.url)
  const requestedLimit = Number(url.searchParams.get('limit') || '5')
  const requestedOffset = Number(url.searchParams.get('offset') || '0')
  const limit = Number.isFinite(requestedLimit) ? Math.min(5, Math.max(1, Math.floor(requestedLimit))) : 5
  const offset = Number.isFinite(requestedOffset) ? Math.max(0, Math.floor(requestedOffset)) : 0

  // Fetch at most five works. If a full page is returned, the client may request
  // the next page; an empty/partial page ends pagination. This remains reliable
  // even when the REST layer enforces its own maximum row count.
  const response = await supabaseFetch(
    `generation_history?select=id,type,title,status,created_at,failed_at,result_url,error_code,provider,model,source_id,result_metadata&telegram_id=eq.${user.id}&deleted_at=is.null&order=created_at.desc&limit=${limit}&offset=${offset}`,
  )
  if (!response.ok) {
    return NextResponse.json({
      history: [],
      pagination: { limit, offset, nextOffset: offset, hasMore: false },
    })
  }

  const rows = await response.json()
  const pageRows = Array.isArray(rows) ? rows.slice(0, limit) : []
  return NextResponse.json({
    history: pageRows.map((row: any) => ({
      id: String(row.id),
      type: row.type,
      title: row.title,
      status: row.status,
      createdAt: row.created_at,
      failedAt: row.failed_at || null,
      resultUrl: row.result_url || null,
      error: row.status === 'failed' ? 'GENERATION_FAILED' : null,
      failureType: row.status === 'failed' ? failureType(row) : null,
      retryable: row.status === 'failed' ? row?.result_metadata?.apimodels_retryable === true : false,
      provider: row.provider || null,
      model: row.model || null,
      sourceId: row.source_id || null,
    })),
    pagination: {
      limit,
      offset,
      nextOffset: offset + pageRows.length,
      hasMore: pageRows.length === limit,
    },
  })
}

export async function DELETE(request: Request) {
  const user = verifyTelegramInitData(request.headers.get('x-telegram-init-data') || '')
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasDatabase()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  const url = new URL(request.url)
  const deleteAll = url.searchParams.get('all') === '1'
  const jobId = String(url.searchParams.get('jobId') || '')

  if (!deleteAll && !/^[0-9a-f-]{36}$/i.test(jobId)) {
    return NextResponse.json({ error: 'INVALID_JOB_ID' }, { status: 400 })
  }

  const targetQuery = deleteAll
    ? `generation_history?select=id,status,input_payload&telegram_id=eq.${user.id}&deleted_at=is.null&status=in.(completed,failed)`
    : `generation_history?select=id,status,input_payload&telegram_id=eq.${user.id}&id=eq.${encodeURIComponent(jobId)}&deleted_at=is.null&limit=1`

  const targetResponse = await supabaseFetch(targetQuery)
  if (!targetResponse.ok) return NextResponse.json({ error: 'Could not load works' }, { status: 500 })
  const targets = await targetResponse.json()

  if (!Array.isArray(targets) || targets.length === 0) {
    return NextResponse.json({ ok: true, deleted: 0, mediaDeleted: 0 })
  }

  if (!deleteAll && !['completed', 'failed'].includes(String(targets[0]?.status || ''))) {
    return NextResponse.json({ error: 'ACTIVE_GENERATION_CANNOT_BE_DELETED' }, { status: 409 })
  }

  const targetIds = new Set(targets.map((row: any) => String(row.id)))
  const candidatePaths = new Set<string>()
  targets.forEach((row: any) => {
    collectOwnedInputPaths(row.input_payload, user.id).forEach((path) => candidatePaths.add(path))
  })

  // A repeated generation can reuse the same uploaded input. Keep any file that is still
  // referenced by another visible work belonging to the same user.
  const remainingResponse = await supabaseFetch(
    `generation_history?select=id,input_payload&telegram_id=eq.${user.id}&deleted_at=is.null`,
  )
  if (!remainingResponse.ok) return NextResponse.json({ error: 'Could not verify media references' }, { status: 500 })
  const remainingRows = await remainingResponse.json()
  const stillReferenced = new Set<string>()
  if (Array.isArray(remainingRows)) {
    remainingRows
      .filter((row: any) => !targetIds.has(String(row.id)))
      .forEach((row: any) => {
        collectOwnedInputPaths(row.input_payload, user.id).forEach((path) => stillReferenced.add(path))
      })
  }

  const pathsToDelete = [...candidatePaths].filter((path) => !stillReferenced.has(path))
  let mediaDeleted = 0
  if (pathsToDelete.length) {
    try {
      const deleted = await deleteStorageObjects('generation-inputs', pathsToDelete)
      mediaDeleted = deleted.deleted
    } catch {
      return NextResponse.json({ error: 'MEDIA_DELETE_FAILED' }, { status: 500 })
    }
  }

  const now = new Date().toISOString()
  const ids = [...targetIds]
  const patchResponse = await supabaseFetch(
    `generation_history?id=in.(${ids.map(encodeURIComponent).join(',')})&telegram_id=eq.${user.id}`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        deleted_at: now,
        media_deleted_at: now,
        result_url: null,
        input_payload: { deleted_by_user: true },
        result_metadata: { deleted_by_user: true },
        error_code: null,
      }),
    },
  )
  if (!patchResponse.ok) return NextResponse.json({ error: 'Could not delete works' }, { status: 500 })

  return NextResponse.json({
    ok: true,
    deleted: ids.length,
    mediaDeleted,
    activeKept: deleteAll && Array.isArray(remainingRows)
      ? remainingRows.filter((row: any) => ['queued', 'processing'].includes(String(row?.status || ''))).length
      : 0,
  })
}
