// Himoyalangan sahifalar: kirmagan bo'lsa — kirish sahifasiga, roli mos kelmasa — o'z sahifasiga.
// role="admin" — panel: umumiy rahbariyat va filial direktori kiradi.
import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { api } from '../api'
import { getToken } from '../lib/auth'
import { isPanelRole, type Role } from '../types'

const loginPathFor = (role: Role) => (isPanelRole(role) ? '/admin/login' : '/login')
const allowed = (required: Role, actual: Role) => (required === 'admin' ? isPanelRole(actual) : actual === required)

export default function RequireAuth({ role, children }: { role: Role; children: ReactNode }) {
  const location = useLocation()
  const token = getToken()
  const me = useQuery({ queryKey: ['me'], queryFn: api.getMe, enabled: Boolean(token), retry: false })

  if (!token || me.isError) return <Navigate to={loginPathFor(role)} replace state={{ from: location.pathname }} />
  if (me.isPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-tg-secondary text-brand">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }
  if (!allowed(role, me.data.role)) return <Navigate to={isPanelRole(me.data.role) ? '/admin' : '/app'} replace />
  return <>{children}</>
}
