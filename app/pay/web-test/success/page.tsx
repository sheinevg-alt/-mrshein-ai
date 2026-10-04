import { WebTestPaymentSuccess } from './web-test-payment-success'

export default async function WebTestPaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; status?: string }>
}) {
  const params = await searchParams
  return (
    <WebTestPaymentSuccess
      orderId={String(params?.order || '')}
      failedRedirect={params?.status === 'failed'}
    />
  )
}
