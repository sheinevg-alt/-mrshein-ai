'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

type InputKind = 'photo' | 'video' | 'audio' | 'text'
type InputSpec = {
  id: string
  kind: InputKind
  label: { en: string; ru?: string }
  hint?: { en: string; ru?: string }
  required: boolean
  tag?: string
  default_asset_url?: string
  default_asset_name?: string
  replaceable?: boolean
  removable?: boolean
}

type TrendRow = {
  id: string
  title_en: string
  title_ru?: string | null
  category: 'video' | 'image' | 'audio' | 'text'
  image_url: string
  preview_video_url?: string | null
  aspect_ratio?: string | null
  uses_count?: string
  token_cost: number
  input_schema?: InputSpec[]
  provider?: string | null
  model?: string | null
  hidden_prompt?: string | null
  published: boolean
  sort_order?: number
}

type KnowledgeRow = {
  id: string
  slug: string
  category: 'getting-started' | 'generation' | 'tokens' | 'account'
  title_en: string
  title_ru?: string | null
  body_en: string
  body_ru?: string | null
  published: boolean
  sort_order: number
}

type TicketRow = {
  id: string
  telegram_id: number
  first_name?: string | null
  last_name?: string | null
  username?: string | null
  language_code?: string | null
  topic: string
  message: string
  status: 'open' | 'answered' | 'closed'
  admin_reply?: string | null
  created_at: string
  updated_at: string
}

type AdminTab = 'trends' | 'knowledge' | 'support'

const blankTrend = (): TrendRow => ({
  id: '', title_en: '', title_ru: '', category: 'video', image_url: '', preview_video_url: '', aspect_ratio: '9:16', uses_count: 'New', token_cost: 20,
  input_schema: [], provider: 'mock', model: 'mock-success', hidden_prompt: '', published: true, sort_order: 100,
})

const blankKnowledge = (): Omit<KnowledgeRow, 'id' | 'slug'> => ({
  category: 'getting-started', title_en: '', title_ru: '', body_en: '', body_ru: '', published: true, sort_order: 100,
})

export default function AdminPage() {
  const [secret, setSecret] = useState('')
  const [authorized, setAuthorized] = useState(false)
  const [tab, setTab] = useState<AdminTab>('trends')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  const [trends, setTrends] = useState<TrendRow[]>([])
  const [trendForm, setTrendForm] = useState<TrendRow>(blankTrend())
  const [editingTrendId, setEditingTrendId] = useState<string | null>(null)
  const [notifyUsers, setNotifyUsers] = useState(true)

  const [articles, setArticles] = useState<KnowledgeRow[]>([])
  const [articleForm, setArticleForm] = useState(blankKnowledge())
  const [editingArticleId, setEditingArticleId] = useState<string | null>(null)

  const [tickets, setTickets] = useState<TicketRow[]>([])
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({})

  useEffect(() => {
    const saved = window.sessionStorage.getItem('mrshein.admin.secret')
    if (saved) setSecret(saved)
  }, [])

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${secret}` }), [secret])

  async function loadDashboard() {
    setBusy(true)
    setStatus('Загрузка…')
    try {
      const [trendsResponse, knowledgeResponse, supportResponse] = await Promise.all([
        fetch('/api/admin/trends', { headers: authHeaders, cache: 'no-store' }),
        fetch('/api/admin/knowledge', { headers: authHeaders, cache: 'no-store' }),
        fetch('/api/admin/support', { headers: authHeaders, cache: 'no-store' }),
      ])
      const [trendsData, knowledgeData, supportData] = await Promise.all([
        trendsResponse.json(), knowledgeResponse.json(), supportResponse.json(),
      ])
      if (!trendsResponse.ok) throw new Error(trendsData?.error || 'Ошибка авторизации')
      if (!knowledgeResponse.ok) throw new Error(knowledgeData?.error || 'Не загрузилась база знаний')
      if (!supportResponse.ok) throw new Error(supportData?.error || 'Не загрузились обращения')

      window.sessionStorage.setItem('mrshein.admin.secret', secret)
      setAuthorized(true)
      setTrends(trendsData.trends || [])
      setArticles(knowledgeData.articles || [])
      setTickets(supportData.tickets || [])
      setStatus('Готово')
    } catch (error) {
      setAuthorized(false)
      setStatus(error instanceof Error ? error.message : 'Ошибка')
    } finally {
      setBusy(false)
    }
  }

  async function setupWebhook() {
    setBusy(true)
    setStatus('Подключаю Telegram webhook…')
    try {
      const response = await fetch('/api/admin/telegram/setup', { method: 'POST', headers: authHeaders })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'Не удалось подключить webhook')
      setStatus('Telegram webhook подключён. /start и уведомления готовы.')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Ошибка')
    } finally { setBusy(false) }
  }

  async function uploadPreview(file: File, target: 'cover' | 'video' = 'cover') {
    setBusy(true)
    setStatus(target === 'video' ? 'Загружаю preview-видео…' : 'Загружаю обложку…')
    try {
      const body = new FormData(); body.append('file', file)
      const response = await fetch('/api/admin/upload', { method: 'POST', headers: authHeaders, body })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'Не удалось загрузить обложку')
      setTrendForm((current) => target === 'video' ? ({ ...current, preview_video_url: data.url }) : ({ ...current, image_url: data.url }))
      setStatus(target === 'video' ? 'Preview-видео загружено' : 'Обложка загружена')
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Ошибка загрузки') }
    finally { setBusy(false) }
  }


  async function uploadInputAsset(file: File, index: number) {
    setBusy(true)
    setStatus(`Загружаю референс ${index + 1}…`)
    try {
      const body = new FormData(); body.append('file', file)
      const response = await fetch('/api/admin/upload', { method: 'POST', headers: authHeaders, body })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'Не удалось загрузить референс')
      updateInput(index, { default_asset_url: data.url, default_asset_name: file.name, replaceable: true })
      setStatus(`Референс ${index + 1} загружен`)
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Ошибка загрузки') }
    finally { setBusy(false) }
  }
  function addInput() {
    const n = (trendForm.input_schema?.length || 0) + 1
    setTrendForm((current) => ({
      ...current,
      input_schema: [...(current.input_schema || []), { id: `input${n}`, kind: 'photo', label: { en: `Photo ${n}`, ru: `Фото ${n}` }, required: true }],
    }))
  }

  function updateInput(index: number, patch: Partial<InputSpec>) {
    setTrendForm((current) => ({ ...current, input_schema: (current.input_schema || []).map((item, i) => i === index ? { ...item, ...patch } : item) }))
  }

  function removeInput(index: number) {
    setTrendForm((current) => ({ ...current, input_schema: (current.input_schema || []).filter((_, i) => i !== index) }))
  }

  function editTrend(trend: TrendRow) {
    setEditingTrendId(trend.id)
    setTrendForm({ ...trend, input_schema: Array.isArray(trend.input_schema) ? trend.input_schema : [] })
    setNotifyUsers(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function resetTrend() { setEditingTrendId(null); setTrendForm(blankTrend()); setNotifyUsers(true) }

  async function saveTrend() {
    setBusy(true); setStatus(editingTrendId ? 'Сохраняю…' : 'Публикую…')
    try {
      const url = editingTrendId ? `/api/admin/trends/${encodeURIComponent(editingTrendId)}` : '/api/admin/trends'
      const payload: any = { ...trendForm, notify_users: notifyUsers }
      if (!editingTrendId) delete payload.id
      const response = await fetch(url, {
        method: editingTrendId ? 'PATCH' : 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'Не удалось сохранить тренд')
      const delivered = data?.notification?.delivered
      setStatus(typeof delivered === 'number' ? `Сохранено. Уведомлений отправлено: ${delivered}` : 'Тренд сохранён')
      resetTrend(); await loadDashboard()
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Ошибка') }
    finally { setBusy(false) }
  }

  async function deleteTrend(id: string) {
    if (!window.confirm('Удалить этот тренд?')) return
    const response = await fetch(`/api/admin/trends/${encodeURIComponent(id)}`, { method: 'DELETE', headers: authHeaders })
    if (response.ok) { setStatus('Тренд удалён'); await loadDashboard() }
  }

  function editArticle(article: KnowledgeRow) {
    setEditingArticleId(article.id)
    setArticleForm({
      category: article.category, title_en: article.title_en, title_ru: article.title_ru || '', body_en: article.body_en,
      body_ru: article.body_ru || '', published: article.published, sort_order: article.sort_order,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function resetArticle() { setEditingArticleId(null); setArticleForm(blankKnowledge()) }

  async function saveArticle() {
    setBusy(true); setStatus('Сохраняю статью…')
    try {
      const url = editingArticleId ? `/api/admin/knowledge/${encodeURIComponent(editingArticleId)}` : '/api/admin/knowledge'
      const response = await fetch(url, {
        method: editingArticleId ? 'PATCH' : 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify(articleForm),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'Не удалось сохранить статью')
      setStatus('Статья сохранена'); resetArticle(); await loadDashboard()
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Ошибка') }
    finally { setBusy(false) }
  }

  async function deleteArticle(id: string) {
    if (!window.confirm('Удалить статью?')) return
    const response = await fetch(`/api/admin/knowledge/${encodeURIComponent(id)}`, { method: 'DELETE', headers: authHeaders })
    if (response.ok) { setStatus('Статья удалена'); await loadDashboard() }
  }

  async function answerTicket(ticket: TicketRow, nextStatus: TicketRow['status'] = 'answered') {
    const reply = (replyDrafts[ticket.id] ?? ticket.admin_reply ?? '').trim()
    setBusy(true); setStatus('Отправляю ответ…')
    try {
      const response = await fetch(`/api/admin/support/${encodeURIComponent(ticket.id)}`, {
        method: 'PATCH', headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_reply: reply, status: nextStatus, send_telegram: Boolean(reply) }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'Не удалось обновить обращение')
      setStatus(reply ? 'Ответ сохранён и отправлен пользователю в Telegram' : 'Статус обновлён')
      await loadDashboard()
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Ошибка') }
    finally { setBusy(false) }
  }

  if (!authorized) {
    return (
      <main className="mx-auto min-h-dvh max-w-xl px-5 py-12">
        <h1 className="text-2xl font-semibold">Shein AI Admin</h1>
        <p className="mt-2 text-sm text-muted-foreground">Тренды, база знаний, Служба заботы и Telegram.</p>
        <label className="mt-8 block text-sm font-medium">Admin Secret</label>
        <input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} className="mt-2 h-12 w-full rounded-2xl border bg-card px-4" placeholder="Введите секрет из Vercel" />
        <button type="button" disabled={!secret || busy} onClick={() => void loadDashboard()} className="brand-gradient mt-4 h-12 w-full rounded-full font-semibold text-white disabled:opacity-50">Открыть админку</button>
        {status && <p className="mt-3 text-sm text-muted-foreground">{status}</p>}
      </main>
    )
  }

  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-4 py-8">
      <div className="flex items-start justify-between gap-4">
        <div><h1 className="text-2xl font-semibold">Shein AI Admin</h1><p className="text-sm text-muted-foreground">Одна панель для Telegram Mini App и будущего сайта.</p></div>
        <div className="flex gap-2">
          <Link href="/admin/referrals" className="rounded-full border px-4 py-2 text-xs font-medium">Рефералы</Link>
          <button type="button" disabled={busy} onClick={() => void setupWebhook()} className="rounded-full border px-4 py-2 text-xs font-medium">Подключить bot</button>
        </div>
      </div>

      {status && <div className="mt-4 rounded-2xl bg-brand-tint px-4 py-3 text-sm text-brand">{status}</div>}

      <nav className="mt-5 grid grid-cols-3 rounded-2xl border p-1">
        {([['trends','Тренды'],['knowledge','База знаний'],['support','Служба заботы']] as [AdminTab,string][]).map(([id,label]) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={`rounded-xl px-2 py-2.5 text-xs font-medium ${tab === id ? 'brand-gradient text-white' : ''}`}>{label}{id === 'support' && tickets.filter((t) => t.status === 'open').length > 0 ? ` · ${tickets.filter((t) => t.status === 'open').length}` : ''}</button>
        ))}
      </nav>

      {tab === 'trends' && (
        <>
          <section className="glass mt-6 rounded-3xl p-5">
            <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{editingTrendId ? 'Редактировать тренд' : 'Новый тренд'}</h2>{editingTrendId && <button type="button" onClick={resetTrend} className="text-xs text-muted-foreground">Отмена</button>}</div>
            <p className="mt-1 text-xs text-muted-foreground">Пока реальные API не подключены, ставь Provider = mock и Model = mock-success. Для проверки возврата токенов можно поставить mock-error.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Название EN"><input value={trendForm.title_en} onChange={(e) => setTrendForm({ ...trendForm, title_en: e.target.value })} /></Field>
              <Field label="Название RU"><input value={trendForm.title_ru || ''} onChange={(e) => setTrendForm({ ...trendForm, title_ru: e.target.value })} /></Field>
              <Field label="Категория"><select value={trendForm.category} onChange={(e) => setTrendForm({ ...trendForm, category: e.target.value as TrendRow['category'] })}><option value="video">Video</option><option value="image">Image</option><option value="audio">Audio</option><option value="text">Text</option></select></Field>
              <Field label="Формат"><select value={trendForm.aspect_ratio || '9:16'} onChange={(e) => setTrendForm({ ...trendForm, aspect_ratio: e.target.value })}><option value="9:16">9:16 — вертикальный</option><option value="16:9">16:9 — горизонтальный</option><option value="1:1">1:1 — квадрат</option></select></Field>
              <Field label="Стоимость в токенах"><input type="number" min="0" value={trendForm.token_cost} onChange={(e) => setTrendForm({ ...trendForm, token_cost: Number(e.target.value) })} /></Field>
              <Field label="Uses"><input value={trendForm.uses_count || ''} onChange={(e) => setTrendForm({ ...trendForm, uses_count: e.target.value })} placeholder="New" /></Field>
              <Field label="Порядок"><input type="number" value={trendForm.sort_order || 100} onChange={(e) => setTrendForm({ ...trendForm, sort_order: Number(e.target.value) })} /></Field>
            </div>
            <Field label="Обложка / preview" className="mt-4"><div className="flex gap-2"><input value={trendForm.image_url} onChange={(e) => setTrendForm({ ...trendForm, image_url: e.target.value })} placeholder="URL или загрузите файл" /><label className="flex shrink-0 cursor-pointer items-center rounded-xl border px-3 text-xs font-medium">Загрузить<input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && void uploadPreview(e.target.files[0])} /></label></div></Field>
            {trendForm.image_url && <img src={trendForm.image_url} alt="Preview" className="mt-3 max-h-96 w-full rounded-2xl bg-black object-contain" style={{ aspectRatio: (trendForm.aspect_ratio || '9:16').replace(':', ' / ') }} />}
            <Field label="Preview-видео тренда" className="mt-4"><div className="flex gap-2"><input value={trendForm.preview_video_url || ''} onChange={(e) => setTrendForm({ ...trendForm, preview_video_url: e.target.value })} placeholder="URL или загрузите MP4" /><label className="flex shrink-0 cursor-pointer items-center rounded-xl border px-3 text-xs font-medium">Загрузить<input type="file" accept="video/*" className="sr-only" onChange={(e) => e.target.files?.[0] && void uploadPreview(e.target.files[0], 'video')} /></label></div></Field>
            {trendForm.preview_video_url && <video src={trendForm.preview_video_url} controls muted playsInline className="mt-3 max-h-96 w-full rounded-2xl bg-black object-contain" style={{ aspectRatio: (trendForm.aspect_ratio || '9:16').replace(':', ' / ') }} />}

            <div className="mt-6 flex items-center justify-between"><div><h3 className="text-sm font-semibold">Входные данные</h3><p className="text-xs text-muted-foreground">0, 1 или несколько фото/видео/аудио/текстов.</p></div><button type="button" onClick={addInput} className="rounded-full border px-3 py-2 text-xs font-medium">+ Добавить</button></div>
            <div className="mt-3 space-y-3">
              {(trendForm.input_schema || []).map((input, index) => (
                <div key={`${input.id}-${index}`} className="rounded-2xl border p-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="ID"><input value={input.id} onChange={(e) => updateInput(index, { id: e.target.value })} /></Field>
                    <Field label="Тип"><select value={input.kind} onChange={(e) => updateInput(index, { kind: e.target.value as InputKind })}><option value="photo">Photo</option><option value="video">Video</option><option value="audio">Audio</option><option value="text">Text</option></select></Field>
                    <label className="flex items-end gap-2 pb-3 text-sm"><input type="checkbox" checked={input.required} onChange={(e) => updateInput(index, { required: e.target.checked })} className="size-4" />Обязательно</label>
                  </div>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    <Field label="Label EN"><input value={input.label.en} onChange={(e) => updateInput(index, { label: { ...input.label, en: e.target.value } })} /></Field>
                    <Field label="Label RU"><input value={input.label.ru || ''} onChange={(e) => updateInput(index, { label: { ...input.label, ru: e.target.value } })} /></Field>
                    <Field label="Hint EN"><input value={input.hint?.en || ''} onChange={(e) => updateInput(index, { hint: { ...(input.hint || { en: '' }), en: e.target.value } })} /></Field>
                    <Field label="Hint RU"><input value={input.hint?.ru || ''} onChange={(e) => updateInput(index, { hint: { ...(input.hint || { en: '' }), ru: e.target.value } })} /></Field>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Field label="Тег референса"><input value={input.tag || ''} onChange={(e) => updateInput(index, { tag: e.target.value })} placeholder="@image1" /></Field>
                    {input.kind !== 'text' && <Field label="Референс по умолчанию"><div className="flex gap-2"><input value={input.default_asset_url || ''} onChange={(e) => updateInput(index, { default_asset_url: e.target.value })} placeholder="URL или загрузите файл" /><label className="flex shrink-0 cursor-pointer items-center rounded-xl border px-3 text-xs font-medium">Загрузить<input type="file" accept={input.kind === 'photo' ? 'image/*' : input.kind === 'video' ? 'video/*' : 'audio/*'} className="sr-only" onChange={(e) => e.target.files?.[0] && void uploadInputAsset(e.target.files[0], index)} /></label></div></Field>}
                  </div>
                  {input.default_asset_url && input.kind === 'photo' && <img src={input.default_asset_url} alt="Default reference" className="mt-3 size-24 rounded-xl border object-cover" />}
                  {input.default_asset_url && input.kind === 'video' && <video src={input.default_asset_url} muted controls playsInline className="mt-3 h-32 rounded-xl border bg-black" />}
                  <div className="mt-3 flex flex-wrap gap-4 text-xs">
                    <label className="flex items-center gap-2"><input type="checkbox" checked={input.replaceable !== false} onChange={(e) => updateInput(index, { replaceable: e.target.checked })} />Можно заменить</label>
                    <label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(input.removable)} onChange={(e) => updateInput(index, { removable: e.target.checked })} />Можно удалить</label>
                  </div>
                  <button type="button" onClick={() => removeInput(index)} className="mt-3 text-xs text-red-600">Удалить input</button>
                </div>
              ))}
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field label="Provider — скрыто"><input value={trendForm.provider || ''} onChange={(e) => setTrendForm({ ...trendForm, provider: e.target.value })} /></Field>
              <Field label="Model — скрыто"><input value={trendForm.model || ''} onChange={(e) => setTrendForm({ ...trendForm, model: e.target.value })} /></Field>
            </div>
            <Field label="Скрытый промпт" className="mt-4"><textarea rows={9} value={trendForm.hidden_prompt || ''} onChange={(e) => setTrendForm({ ...trendForm, hidden_prompt: e.target.value })} placeholder="Пользователь этот промпт не увидит" /></Field>
            <div className="mt-5 flex flex-wrap gap-5"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={trendForm.published} onChange={(e) => setTrendForm({ ...trendForm, published: e.target.checked })} />Опубликовать</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={notifyUsers} onChange={(e) => setNotifyUsers(e.target.checked)} />Уведомить пользователей</label></div>
            <button type="button" disabled={busy || !trendForm.title_en || !trendForm.image_url} onClick={() => void saveTrend()} className="brand-gradient mt-5 h-12 w-full rounded-full font-semibold text-white disabled:opacity-50">{editingTrendId ? 'Сохранить изменения' : 'Publish'}</button>
          </section>

          <section className="mt-8"><h2 className="text-lg font-semibold">Опубликованные и черновики</h2><div className="mt-3 space-y-3">{trends.map((trend) => <article key={trend.id} className="glass flex gap-3 rounded-2xl p-3"><img src={trend.image_url} alt="" className="size-20 rounded-xl object-cover" /><div className="min-w-0 flex-1"><p className="truncate font-medium">{trend.title_en}</p><p className="text-xs text-muted-foreground">{trend.category} · {trend.token_cost} tokens · {trend.published ? 'Published' : 'Draft'} · {trend.provider || 'mock'}</p><div className="mt-3 flex gap-2"><button type="button" onClick={() => editTrend(trend)} className="rounded-full border px-3 py-1.5 text-xs">Edit</button><button type="button" onClick={() => void deleteTrend(trend.id)} className="rounded-full border px-3 py-1.5 text-xs text-red-600">Delete</button></div></div></article>)}{trends.length === 0 && <p className="text-sm text-muted-foreground">Трендов в базе пока нет.</p>}</div></section>
        </>
      )}

      {tab === 'knowledge' && (
        <>
          <section className="glass mt-6 rounded-3xl p-5">
            <div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold">{editingArticleId ? 'Редактировать статью' : 'Новая статья'}</h2><p className="text-xs text-muted-foreground">Свой текст для Службы заботы. Не копируем чужую базу дословно.</p></div>{editingArticleId && <button type="button" onClick={resetArticle} className="text-xs text-muted-foreground">Отмена</button>}</div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Раздел"><select value={articleForm.category} onChange={(e) => setArticleForm({ ...articleForm, category: e.target.value as KnowledgeRow['category'] })}><option value="getting-started">Начало работы</option><option value="generation">Генерация</option><option value="tokens">Токены</option><option value="account">Аккаунт</option></select></Field>
              <Field label="Порядок"><input type="number" value={articleForm.sort_order} onChange={(e) => setArticleForm({ ...articleForm, sort_order: Number(e.target.value) })} /></Field>
              <Field label="Заголовок EN"><input value={articleForm.title_en} onChange={(e) => setArticleForm({ ...articleForm, title_en: e.target.value })} /></Field>
              <Field label="Заголовок RU"><input value={articleForm.title_ru || ''} onChange={(e) => setArticleForm({ ...articleForm, title_ru: e.target.value })} /></Field>
            </div>
            <Field label="Текст EN" className="mt-4"><textarea rows={5} value={articleForm.body_en} onChange={(e) => setArticleForm({ ...articleForm, body_en: e.target.value })} /></Field>
            <Field label="Текст RU" className="mt-4"><textarea rows={5} value={articleForm.body_ru || ''} onChange={(e) => setArticleForm({ ...articleForm, body_ru: e.target.value })} /></Field>
            <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={articleForm.published} onChange={(e) => setArticleForm({ ...articleForm, published: e.target.checked })} />Опубликовать</label>
            <button type="button" disabled={busy || !articleForm.title_en || !articleForm.body_en} onClick={() => void saveArticle()} className="brand-gradient mt-5 h-12 w-full rounded-full font-semibold text-white disabled:opacity-50">Сохранить статью</button>
          </section>
          <section className="mt-8"><h2 className="text-lg font-semibold">Статьи</h2><div className="mt-3 space-y-3">{articles.map((article) => <article key={article.id} className="glass rounded-2xl p-4"><p className="font-medium">{article.title_ru || article.title_en}</p><p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{article.body_ru || article.body_en}</p><p className="mt-2 text-[11px] text-muted-foreground">{article.category} · {article.published ? 'Published' : 'Draft'}</p><div className="mt-3 flex gap-2"><button type="button" onClick={() => editArticle(article)} className="rounded-full border px-3 py-1.5 text-xs">Edit</button><button type="button" onClick={() => void deleteArticle(article.id)} className="rounded-full border px-3 py-1.5 text-xs text-red-600">Delete</button></div></article>)}{articles.length === 0 && <p className="text-sm text-muted-foreground">Статей пока нет.</p>}</div></section>
        </>
      )}

      {tab === 'support' && (
        <section className="mt-6">
          <div className="mb-4"><h2 className="text-lg font-semibold">Служба заботы</h2><p className="text-xs text-muted-foreground">Пользователь сначала видит базу знаний. Если она не помогла — обращение появляется здесь.</p></div>
          <div className="space-y-3">
            {tickets.map((ticket) => {
              const name = [ticket.first_name, ticket.last_name].filter(Boolean).join(' ') || ticket.username || String(ticket.telegram_id)
              return <article key={ticket.id} className="glass rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold">{name}</p><p className="text-[11px] text-muted-foreground">{ticket.topic} · {new Date(ticket.created_at).toLocaleString('ru-RU')}</p></div><span className="rounded-full bg-muted px-2 py-1 text-[10px]">{ticket.status}</span></div>
                <p className="mt-3 text-sm leading-relaxed">{ticket.message}</p>
                {ticket.admin_reply && <div className="mt-3 rounded-xl bg-brand-tint/60 p-3"><p className="text-[10px] font-semibold text-brand">Последний ответ</p><p className="mt-1 text-xs">{ticket.admin_reply}</p></div>}
                <textarea rows={3} value={replyDrafts[ticket.id] ?? ticket.admin_reply ?? ''} onChange={(e) => setReplyDrafts((current) => ({ ...current, [ticket.id]: e.target.value }))} placeholder="Ответ от Службы заботы" className="mt-3 w-full resize-none rounded-2xl border bg-card p-3 text-sm" />
                <div className="mt-2 flex gap-2"><button type="button" disabled={busy} onClick={() => void answerTicket(ticket, 'answered')} className="brand-gradient flex-1 rounded-full px-3 py-2 text-xs font-semibold text-white">Ответить в Telegram</button><button type="button" disabled={busy} onClick={() => void answerTicket(ticket, 'closed')} className="rounded-full border px-3 py-2 text-xs">Закрыть</button></div>
              </article>
            })}
            {tickets.length === 0 && <p className="rounded-2xl border p-5 text-center text-sm text-muted-foreground">Новых обращений пока нет.</p>}
          </div>
        </section>
      )}
    </main>
  )
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={`block text-xs font-medium text-muted-foreground ${className}`}>{label}<div className="admin-field mt-1.5">{children}</div></label>
}
