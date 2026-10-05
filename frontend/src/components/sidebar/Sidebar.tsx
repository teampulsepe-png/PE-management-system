import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useAppContext } from '../../context/AppContext'
import SidebarNav from './SidebarNav'

function getInitials(user: { name: string | null; email: string }): string {
  if (user.name) {
    return user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  }
  return user.email[0].toUpperCase()
}

export default function Sidebar() {
  const { sidebarOpen, toggleSidebar, currentUser } = useAppContext()

  return (
    <aside
      className={`relative hidden md:flex flex-col bg-surface-1 border-r border-hairline text-ink transition-all duration-300 ease-in-out flex-shrink-0 ${
        sidebarOpen ? 'w-56' : 'w-14'
      }`}
    >
      {/* Logo */}
      <div className={`flex items-center gap-2.5 border-b border-hairline flex-shrink-0 ${
        sidebarOpen ? 'px-3.5 py-4' : 'px-3 py-4 justify-center'
      }`}>
        <img src="/teampulse-icon-dark.png" alt="TeamPulse" className="flex-shrink-0 w-7 h-7 rounded-md object-cover" />
        {sidebarOpen && (
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-ink tracking-tight leading-tight" style={{ letterSpacing: '-0.3px' }}>TeamPulse</p>
            <p className="text-[10px] text-ink-tertiary font-medium tracking-wider uppercase" style={{ letterSpacing: '0.4px' }}>PE Management</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <SidebarNav />

      {/* Bottom: user + collapse */}
      <div className="border-t border-hairline p-2 flex-shrink-0 space-y-0.5">
        {/* User profile */}
        {currentUser && (
          <div className={`flex items-center gap-2.5 px-2 py-2 rounded-md ${sidebarOpen ? '' : 'justify-center'}`}>
            <div className="flex-shrink-0 w-6 h-6 rounded-md bg-primary flex items-center justify-center text-white font-semibold text-[10px]">
              {getInitials(currentUser)}
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-ink-muted truncate leading-tight">
                  {currentUser.name ?? currentUser.email.split('@')[0]}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {currentUser.role && (
                    <span className={`text-[9px] font-semibold px-1.5 py-px rounded-full capitalize ${
                      currentUser.role === 'admin' ? 'bg-red-900/40 text-red-300' :
                      currentUser.role === 'head'  ? 'bg-purple-900/40 text-purple-300' :
                      currentUser.role === 'lead'  ? 'bg-primary/15 text-primary-hover' :
                      'bg-surface-3 text-ink-subtle'
                    }`}>
                      {currentUser.role}
                    </span>
                  )}
                  {currentUser.teamId && (
                    <p className="text-[10px] text-ink-tertiary truncate">
                      {currentUser.teamId.toUpperCase()} Team
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Collapse toggle */}
        <button
          onClick={toggleSidebar}
          title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-ink-tertiary hover:text-ink-subtle hover:bg-surface-2 transition-colors text-xs ${
            sidebarOpen ? '' : 'justify-center'
          }`}
        >
          {sidebarOpen ? (
            <>
              <ChevronLeft size={13} className="flex-shrink-0" />
              <span>Collapse</span>
            </>
          ) : (
            <ChevronRight size={13} />
          )}
        </button>
      </div>
    </aside>
  )
}
