import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { AnalyticsDashboard } from './_components/AnalyticsDashboard'

export const metadata = { title: 'Analytics — Ethenta Admin' }

export default async function AnalyticsPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  // Only PLATFORM_ADMIN and TENANT_ADMIN
  if (session.role === 'TENANT_USER') redirect('/admin')
  return (
    <div className="min-h-screen bg-slate-50">
      <AnalyticsDashboard />
    </div>
  )
}
