import { SiteHeader } from '@/components/site/site-header'
import { SiteLocaleProvider } from '@/components/site/site-locale-provider'
import { SitePricing } from '@/components/site/site-pricing'

export const metadata = {
  title: 'Тарифы Banana Zero',
  description: 'Тарифы и стоимость цифровых услуг Banana Zero: Beginner, Creator, Professional и разовые пакеты Tokens.',
}

export default function PricingPage() {
  return (
    <SiteLocaleProvider>
      <div className="min-h-screen bg-[#F8FAFF] text-[#171A22]">
        <SiteHeader />
        <main className="pt-6">
          <SitePricing />
        </main>
      </div>
    </SiteLocaleProvider>
  )
}
