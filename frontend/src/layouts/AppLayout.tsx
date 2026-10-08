import { Outlet } from 'react-router-dom'
import Sidebar from '../components/sidebar/Sidebar'
import TopBar from '../components/topbar/TopBar'
import BottomNav from '../components/bottomnav/BottomNav'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { useAppContext } from '../context/AppContext'
import Onboarding from '../pages/Onboarding'

export default function AppLayout() {
  const { showBanner, requestAndSubscribe, dismiss } = usePushNotifications()
  const { currentUser, userLoading } = useAppContext()

  if (userLoading) return null

  if (currentUser?.memberId === null) {
    return <Onboarding email={currentUser.email} />
  }

  return (
    <div className="flex h-screen bg-canvas overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <TopBar />
        {showBanner && (
          <div className="flex items-center justify-between gap-3 border-b border-hairline bg-surface-1 px-4 py-2">
            <p className="text-xs text-ink-subtle">
              Enable notifications to get alerts when tasks are completed or you're mentioned.
            </p>
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={requestAndSubscribe}
                className="text-xs font-semibold text-primary hover:text-primary-hover transition-colors"
              >
                Enable
              </button>
              <button
                onClick={dismiss}
                className="text-xs text-ink-tertiary hover:text-ink-subtle transition-colors"
              >
                ✕
              </button>
            </div>
          </div>
        )}
        <main className="flex-1 overflow-y-auto px-4 py-4 pb-24 sm:px-5 sm:py-5 md:px-6 md:py-6 md:pb-6 bg-canvas">
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
