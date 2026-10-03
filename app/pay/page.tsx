import Link from 'next/link'
import Image from 'next/image'
import { normalizeTokenPurchaseAmount } from '@/lib/public-pricing'
import { PaymentForm } from './payment-form'
import { hasDatabase, supabaseFetch } from '@/lib/server/supabase'

export const dynamic = 'force-dynamic'

export default async function PayPage({ searchParams }: { searchParams: Promise<{ tokens?: string }> }) {
  let enabled = false
  if (hasDatabase() && process.env.TOCHKA_JWT) {
    const configResponse = await supabaseFetch(
      'app_settings?select=value&key=eq.tochka_acquiring_config&limit=1',
    )
    const configRows = configResponse.ok ? await configResponse.json() : []
    enabled = configRows?.[0]?.value?.setupComplete === true
  }

  const params = await searchParams
  const initialTokens = normalizeTokenPurchaseAmount(Number(params?.tokens || 500))

  return (
    <main className="min-h-dvh px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <header className="flex items-center gap-3">
          <Image src="/banana-zero-cake.jpg" alt="Banana Zero" width={44} height={44} className="rounded-2xl" />
          <div>
            <h1 className="text-xl font-bold">Banana Zero</h1>
            <p className="text-sm text-muted-foreground">Оплата Tokens</p>
          </div>
        </header>

        <section className="glass mt-6 rounded-4xl p-5 sm:p-7">
          <PaymentForm enabled={enabled} initialTokens={initialTokens} />
        </section>

        <footer className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
          <Link href="/pricing" className="underline underline-offset-4">Тарифы</Link>
          <Link href="/offer" className="underline underline-offset-4">Оферта</Link>
          <Link href="/privacy" className="underline underline-offset-4">Конфиденциальность</Link>
          <Link href="/refund" className="underline underline-offset-4">Возвраты</Link>
          <Link href="/contacts" className="underline underline-offset-4">Контакты</Link>
        </footer>
      </div>
    </main>
  )
}
