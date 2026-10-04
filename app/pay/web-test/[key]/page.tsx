import Image from 'next/image'
import { notFound } from 'next/navigation'
import { hasDatabase, supabaseFetch } from '@/lib/server/supabase'
import { WebTestPaymentForm } from './web-test-payment-form'

export const dynamic = 'force-dynamic'

export default async function WebTestPayPage({
  params,
}: {
  params: Promise<{ key: string }>
}) {
  if (!hasDatabase()) notFound()

  const { key } = await params
  const response = await supabaseFetch(
    'app_settings?select=value&key=eq.web_test_checkout&limit=1',
  )
  const rows = response.ok ? await response.json() : []
  const config = rows?.[0]?.value || {}

  if (
    config?.enabled !== true ||
    !config?.access_key ||
    String(config.access_key) !== String(key)
  ) {
    notFound()
  }

  const amountRub = Number(config?.amount_rub || 100)
  const tokenAmount = Number(config?.token_amount || 100)

  return (
    <main className="min-h-dvh px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-xl">
        <header className="flex items-center gap-3">
          <Image src="/banana-zero-cake.jpg" alt="Banana Zero" width={44} height={44} className="rounded-2xl" />
          <div>
            <h1 className="text-xl font-bold">Banana Zero</h1>
            <p className="text-sm text-muted-foreground">Закрытый тест оплаты на сайте</p>
          </div>
        </header>

        <section className="glass mt-6 rounded-4xl p-5 sm:p-7">
          <WebTestPaymentForm
            accessKey={key}
            amountRub={amountRub}
            tokenAmount={tokenAmount}
          />
        </section>
      </div>
    </main>
  )
}
