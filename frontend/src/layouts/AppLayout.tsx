import { Outlet } from 'react-router-dom'
import Sidebar from '../components/sidebar/Sidebar'
import TopBar from '../components/topbar/TopBar'
import BottomNav from '../components/bottomnav/BottomNav'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { useAppContext } from '../context/AppContext'

export default function AppLayout() {
  const { showBanner, requestAndSubscribe, dismiss } = usePushNotifications()
  const { currentUser, userLoading } = useAppContext()

  if (userLoading) return null

  if (currentUser?.memberId === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas px-6">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-surface-2 border border-hairline flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-ink-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div>
            <h1 className="text-base font-semibold text-ink">Account not set up</h1>
            <p className="text-sm text-ink-subtle mt-1">
              <span className="font-medium text-ink">{currentUser.email}</span> is not added to the system.
              Contact your administrator to get access.
            </p>
          </div>
          <button
            onClick={() => { localStorage.clear(); sessionStorage.clear(); window.location.href = '/_logout' }}
            className="text-xs text-ink-tertiary hover:text-ink-subtle underline underline-offset-2 transition-colors"
          >
            Sign out and try a different account
          </button>
        </div>
      </div>
    )
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
