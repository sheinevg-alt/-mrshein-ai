import { PaymentSuccess } from './payment-success'

export default async function PaySuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>
}) {
  const params = await searchParams
  return <PaymentSuccess orderId={String(params?.order || '')} />
}
