import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AdminSessionExpiry } from '@/components/AdminSessionExpiry'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminSessionExpiry />
      {children}
    </div>
  )
}
