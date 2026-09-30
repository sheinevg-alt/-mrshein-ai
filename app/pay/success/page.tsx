import Link from 'next/link'

export default function PaySuccessPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="glass w-full max-w-lg rounded-4xl p-7 text-center">
        <h1 className="text-3xl font-bold">Оплата обрабатывается</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">После подтверждения платежа банк отправит уведомление серверу, и токены будут зачислены автоматически. До подключения боевого webhook эта страница используется только как техническая заготовка.</p>
        <Link href="/" className="brand-gradient mt-6 inline-flex h-11 items-center rounded-full px-5 font-semibold text-white">Вернуться в Shein AI</Link>
      </div>
    </main>
  )
}
