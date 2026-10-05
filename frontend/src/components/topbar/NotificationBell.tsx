import { Bell } from 'lucide-react'
import { useAppContext } from '../../context/AppContext'

interface Props {
  onClick: () => void
}

export default function NotificationBell({ onClick }: Props) {
  const { unreadCount: notificationCount } = useAppContext()

  return (
    <button
      onClick={onClick}
      className="relative p-1.5 text-ink-subtle hover:text-ink hover:bg-surface-2 rounded-md transition-colors"
    >
      <Bell size={16} strokeWidth={1.75} />
      {notificationCount > 0 && (
        <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center leading-none font-semibold">
          {notificationCount > 9 ? '9+' : notificationCount}
        </span>
      )}
    </button>
  )
}
