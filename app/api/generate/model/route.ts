import { NextResponse } from 'next/server'
import {
  createApiModelsAudioTask,
  createApiModelsChatCompletion,
  createApiModelsElevenTts,
  createApiModelsGeminiOmniFlashTask,
  createApiModelsImageTask,
  createApiModelsKlingTask,
} from '@/lib/server/apimodels'
import { quoteTokens } from '@/lib/server/model-pricing'
import { createStorageSignedDownloadUrl, hasDatabase, supabaseFetch } from '@/lib/server/supabase'
import { verifyTelegramInitData } from '@/lib/server/telegram-auth'
import { getModelDefinition } from '@/lib/model-catalog'

export const dynamic = 'force-dynamic'

const INPUT_BUCKET = 'generation-inputs'

async function rpc(name: string, payload: Record<string, unknown>) {
  return supabaseFetch(`rpc/${name}`, { method: 'POST', body: JSON.stringify(payload) })
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const parsed = Number(value)
  return Math.max(min, Math.min(max, Number.isFinite(parsed) ? parsed : fallback))
}

function isOwnedPath(path: string, userId: number, kind: 'images' | 'videos') {
  return path.startsWith(`${userId}/${kind}/`)
}

export async function POST(request: Request) {
  const user = verifyTelegramInitData(request.headers.get('x-telegram-init-data') || '')
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasDatabase()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'JSON_BODY_REQUIRED' }, { status: 415 })

  const payload = body as Record<string, any>
  const toolId = String(payload.toolId || '')
  const tool = getModelDefinition(toolId)
  if (!tool || tool.provider !== 'apimodels') return NextResponse.json({ error: 'MODEL_NOT_AVAILABLE' }, { status: 404 })
  if (toolId === 'seedance-2-5') return NextResponse.json({ error: 'USE_SEEDANCE_WORKSPACE' }, { status: 400 })

  const prompt = String(payload.prompt || '').trim()
  if (prompt.length < 2) return NextResponse.json({ error: 'PROMPT_REQUIRED' }, { status: 400 })
  if (prompt.length > 12_000) return NextResponse.json({ error: 'PROMPT_TOO_LONG' }, { status: 400 })

  const settings = payload.settings && typeof payload.settings === 'object' ? payload.settings : {}
  const rawReferencePaths = Array.isArray(payload.referencePaths) ? payload.referencePaths : []
  const referencePaths = rawReferencePaths.map((value: unknown) => String(value || '')).filter(Boolean).slice(0, 10)
  if (referencePaths.some((path: string) => !isOwnedPath(path, user.id, 'images'))) {
    return NextResponse.json({ error: 'INVALID_REFERENCE_PATH' }, { status: 400 })
  }
  const sourceVideoPath = String(payload.sourceVideoPath || '')
  if (sourceVideoPath && !isOwnedPath(sourceVideoPath, user.id, 'videos')) {
    return NextResponse.json({ error: 'INVALID_VIDEO_REFERENCE_PATH' }, { status: 400 })
  }

  const duration = Math.round(clampNumber(settings.duration, 3, 30, 5))
  const resolution = String(settings.resolution || (tool.category === 'video' ? '720p' : '2k')).toLowerCase()
  const quality = String(settings.quality || 'medium').toLowerCase()
  const mode = String(settings.mode || 'std').toLowerCase()
  const generateAudio = settings.generateAudio === true

  const quote = await quoteTokens({
    toolId,
    duration,
    resolution,
    quality,
    mode,
    generateAudio,
    promptLength: prompt.length,
  })

  const generationResponse = await rpc('create_generation', {
    p_telegram_id: user.id,
    p_type: 'tool',
    p_source_id: toolId,
    p_title: tool.displayName,
    p_token_cost: quote.tokenCost,
    p_provider: 'apimodels',
    p_model: tool.model,
    p_input_payload: {
      prompt,
      settings: { duration, resolution, quality, mode, generateAudio },
      reference_paths: referencePaths,
      source_video_path: sourceVideoPath || null,
      quoted_provider_usd: quote.providerUsd,
      quoted_usd_rub: quote.usdRub,
    },
  })

  if (!generationResponse.ok) {
    const details = await generationResponse.text()
    if (details.includes('INSUFFICIENT_TOKENS')) {
      return NextResponse.json({ error: 'INSUFFICIENT_TOKENS', requiredTokens: quote.tokenCost }, { status: 402 })
    }
    return NextResponse.json({ error: 'GENERATION_CREATE_FAILED' }, { status: 500 })
  }

  const jobId = String(await generationResponse.json()).replace(/^"|"$/g, '')
  const callbackUrl = `${new URL(request.url).origin}/api/generate/callback/apimodels?jobId=${encodeURIComponent(jobId)}`

  try {
    const references = await Promise.all(
      referencePaths.map((path: string) => createStorageSignedDownloadUrl(INPUT_BUCKET, path, 7200)),
    )
    const sourceVideoUrl = sourceVideoPath
      ? await createStorageSignedDownloadUrl(INPUT_BUCKET, sourceVideoPath, 7200)
      : ''

    if (tool.category === 'text') {
      const result = await createApiModelsChatCompletion({
        model: tool.model as 'gpt-6-sol' | 'gpt-6-luna' | 'claude-sonnet-5',
        promptText: prompt,
        reasoningEffort: ['none','low','medium','high'].includes(String(settings.reasoningEffort))
          ? settings.reasoningEffort
          : 'medium',
      })
      const metadata = {
        text: result.text,
        apimodels_kind: 'text',
        apimodels_request_id: result.requestId,
        apimodels_credits_usd: result.creditsUsd,
        apimodels_usage: result.usage,
      }
      await rpc('complete_generation', {
        p_generation_id: jobId,
        p_result_url: '',
        p_result_metadata: metadata,
      })
      return NextResponse.json({
        ok: true,
        status: 'completed',
        jobId,
        tokenCost: quote.tokenCost,
        text: result.text,
        providerCostUsd: result.creditsUsd,
      })
    }

    if (toolId === 'elevenlabs-tts') {
      const result = await createApiModelsElevenTts({
        text: prompt,
        voiceId: String(settings.voiceId || 'EXAVITQu4vr4xnSDxMaL'),
        model: 'eleven-tts-v3',
      })
      const audioBase64 = result.audio.toString('base64')
      await rpc('complete_generation', {
        p_generation_id: jobId,
        p_result_url: '',
        p_result_metadata: {
          apimodels_kind: 'tts',
          apimodels_request_id: result.requestId,
          apimodels_credits_usd: result.creditsUsd,
          mime_type: result.mimeType,
          ephemeral_result: true,
        },
      })
      return NextResponse.json({
        ok: true,
        status: 'completed',
        jobId,
        tokenCost: quote.tokenCost,
        audioDataUrl: `data:${result.mimeType};base64,${audioBase64}`,
        providerCostUsd: result.creditsUsd,
      })
    }

    let task: any
    let kind: 'video' | 'image' | 'audio' = 'video'

    if (toolId === 'omni-flash') {
      task = await createApiModelsGeminiOmniFlashTask({
        promptText: prompt,
        duration: ([4,6,8,10].includes(duration) ? duration : 4) as 4 | 6 | 8 | 10,
        ratio: String(settings.ratio || '9:16') === '16:9' ? '16:9' : '9:16',
        resolution: (['720p','1080p','4k'].includes(resolution) ? resolution : '720p') as '720p' | '1080p' | '4k',
        firstFrameUrl: references[0],
        callbackUrl,
      })
    } else if (toolId === 'kling-v3') {
      task = await createApiModelsKlingTask({
        model: 'kling-v3',
        promptText: prompt,
        duration: Math.max(3, Math.min(15, duration)),
        ratio: String(settings.ratio || '9:16'),
        imageUrl: references[0],
        mode: mode === 'pro' ? 'pro' : 'std',
        generateAudio,
        callbackUrl,
      })
    } else if (tool.category === 'image') {
      kind = 'image'
      task = await createApiModelsImageTask({
        model: tool.model as 'gemini-3.1-flash-image-preview' | 'gemini-3-pro-image' | 'gpt-image-2.5-flare' | 'gpt-image-2.5-sunburst',
        promptText: prompt,
        ratio: String(settings.ratio || '1:1'),
        resolution: (['1k','2k','4k'].includes(resolution) ? resolution : '2k') as '1k' | '2k' | '4k',
        references,
        callbackUrl,
      })
    } else if (toolId === 'suno-v5') {
      kind = 'audio'
      task = await createApiModelsAudioTask({
        model: 'suno-v5',
        promptText: prompt,
        callbackUrl,
      })
    } else if (toolId === 'kling-audio') {
      kind = 'audio'
      if (sourceVideoUrl) {
        task = await createApiModelsAudioTask({
          model: 'kling-video-to-audio',
          promptText: prompt,
          videoUrl: sourceVideoUrl,
          bgmPrompt: String(settings.bgmPrompt || ''),
          callbackUrl,
        })
      } else {
        task = await createApiModelsAudioTask({
          model: 'kling-sound-effects',
          promptText: prompt,
          duration: Math.max(3, Math.min(10, duration)),
          callbackUrl,
        })
      }
    } else {
      throw new Error('MODEL_EXECUTION_NOT_IMPLEMENTED')
    }

    const processing = await rpc('mark_generation_processing', { p_generation_id: jobId })
    if (!processing.ok) throw new Error('GENERATION_STATE_UPDATE_FAILED')

    await supabaseFetch(`generation_history?id=eq.${encodeURIComponent(jobId)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        result_metadata: {
          apimodels_task_id: task.id,
          apimodels_kind: kind,
          quoted_provider_usd: quote.providerUsd,
          quoted_usd_rub: quote.usdRub,
        },
        updated_at: new Date().toISOString(),
      }),
    })

    return NextResponse.json({
      ok: true,
      status: 'processing',
      jobId,
      providerTaskId: task.id,
      tokenCost: quote.tokenCost,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'MODEL_EXECUTION_FAILED'
    await rpc('fail_generation', {
      p_generation_id: jobId,
      p_error_code: message.slice(0, 240),
      p_refund: true,
    })
    return NextResponse.json({ error: 'MODEL_EXECUTION_FAILED', details: message }, { status: 502 })
  }
}
