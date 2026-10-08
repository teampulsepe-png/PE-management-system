import { useEffect, useRef } from 'react'
import { LogOut, User } from 'lucide-react'
import type { CurrentUser } from '../../types'

interface Props {
  user: CurrentUser
  onClose: () => void
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  head:  'Head',
  lead:  'Lead',
  user:  'Member',
}

export default function UserMenu({ user, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  function handleSignOut() {
    localStorage.clear()
    sessionStorage.clear()
    window.location.href = '/_logout'
  }

  const displayName = user.name ?? user.email.split('@')[0]
  const roleLabel = user.role ? (ROLE_LABEL[user.role] ?? user.role) : null

  return (
    <div
      ref={ref}
      className="absolute right-4 top-full mt-2 w-64 bg-surface-1 border border-hairline-strong rounded-xl shadow-2xl z-50 overflow-hidden"
    >
      {/* User info */}
      <div className="px-4 py-3.5 border-b border-hairline">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-primary flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
            {displayName.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink truncate" style={{ letterSpacing: '-0.2px' }}>{displayName}</p>
            <p className="text-[11px] text-ink-tertiary truncate">{user.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
          {user.teamId && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-primary/10 text-primary-hover border border-primary/20">
              {user.teamId.toUpperCase()} Team
            </span>
          )}
          {roleLabel && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-surface-3 text-ink-subtle border border-hairline">
              {roleLabel}
            </span>
          )}
          {user.hasAdminAccess && user.role !== 'admin' && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-red-900/20 text-red-400 border border-red-900/40">
              +admin access
            </span>
          )}
        </div>
      </div>

      {/* Profile row */}
      <div className="px-2 py-1.5">
        <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-ink-tertiary text-xs">
          <User size={13} />
          <span>Managed by Databricks</span>
        </div>
      </div>

      <div className="mx-3 border-t border-hairline" />

      {/* Sign out */}
      <div className="px-2 py-1.5">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium text-red-400 hover:bg-red-900/20 transition-colors text-left"
        >
          <LogOut size={13} />
          Sign out
        </button>
      </div>
    </div>
  )
}
