import { PaymentSuccess } from './payment-success'

export default async function PaySuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; channel?: string; status?: string }>
}) {
  const params = await searchParams
  return (
    <PaymentSuccess
      orderId={String(params?.order || '')}
      webMode={params?.channel === 'web'}
      failedRedirect={params?.status === 'failed'}
    />
  )
}
