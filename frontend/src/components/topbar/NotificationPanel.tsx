import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Bell } from 'lucide-react'
import { useAppContext } from '../../context/AppContext'
import type { AppNotification } from '../../types'

interface Props {
  onClose: () => void
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return days === 1 ? 'yesterday' : `${days}d ago`
}

function NotificationItem({ n, onClick }: { n: AppNotification; onClick: () => void }) {
  return (
    <li
      onClick={onClick}
      className={`px-4 py-3 cursor-pointer transition-colors hover:bg-surface-2 ${
        !n.isRead ? 'bg-primary/5' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        {!n.isRead && (
          <span className="mt-1.5 w-1.5 h-1.5 bg-primary rounded-full flex-shrink-0" />
        )}
        <div className={!n.isRead ? '' : 'ml-4'}>
          <p className="text-xs text-ink-muted leading-snug">{n.message}</p>
          <p className="text-[11px] text-ink-tertiary mt-1">{formatRelativeTime(n.createdAt)}</p>
        </div>
      </div>
    </li>
  )
}

export default function NotificationPanel({ onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { notifications, markAllRead } = useAppContext()

  useEffect(() => {
    if (notifications.some(n => !n.isRead)) {
      markAllRead()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  function handleClick(n: AppNotification) {
    onClose()
    if (n.taskId && n.taskRecurrence) {
      navigate(`/tasks?recurrence=${n.taskRecurrence}&taskId=${n.taskId}`)
    }
  }

  return (
    <div
      ref={ref}
      className="absolute right-4 top-full mt-2 w-80 bg-surface-1 border border-hairline-strong rounded-xl shadow-2xl z-50 overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-hairline">
        <span className="font-semibold text-ink text-sm" style={{ letterSpacing: '-0.2px' }}>Notifications</span>
        <button onClick={onClose} className="text-ink-tertiary hover:text-ink-subtle transition-colors p-0.5 rounded">
          <X size={15} />
        </button>
      </div>

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-ink-tertiary gap-2">
          <Bell size={22} className="text-hairline-strong" />
          <p className="text-xs">No notifications yet</p>
        </div>
      ) : (
        <ul className="divide-y divide-hairline max-h-80 overflow-y-auto">
          {notifications.map(n => (
            <NotificationItem key={n.id} n={n} onClick={() => handleClick(n)} />
          ))}
        </ul>
      )}
    </div>
  )
}
