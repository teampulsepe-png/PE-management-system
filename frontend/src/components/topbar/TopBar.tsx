import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import NotificationBell from './NotificationBell'
import NotificationPanel from './NotificationPanel'
import UserMenu from './UserMenu'
import { useAppContext } from '../../context/AppContext'

const PAGE_META: Record<string, { title: string; subtitle: string }> = {
  '/':                  { title: 'Dashboard',          subtitle: 'Overview & team performance' },
  '/tasks':             { title: 'Tasks',               subtitle: 'Track and manage team tasks' },
  '/tickets':           { title: 'Tickets',             subtitle: 'Issue & ticket management' },
  '/kpi':               { title: 'KPI Metrics',         subtitle: 'Key performance indicators' },
  '/pipelines':         { title: 'Pipelines',           subtitle: 'Deal pipeline management' },
  '/ai-subs':           { title: 'AI Subscriptions',    subtitle: 'AI tool subscriptions & costs' },
  '/project-lifecycle': { title: 'Project Lifecycle',   subtitle: 'Project tracking & phases' },
  '/agent':             { title: 'Operations Agent',    subtitle: 'Databricks self-service automation' },
  '/workload':          { title: 'Workload',            subtitle: 'Team capacity & utilisation' },
  '/tracker':           { title: 'Tracker Board',       subtitle: 'Project tracking & progress' },
  '/cost':              { title: 'Cost',                subtitle: 'Budget & spend tracking' },
  '/settings':          { title: 'Settings',            subtitle: 'Manage your workspace' },
  '/liveops':           { title: 'LiveOps',             subtitle: 'Live operations ticketing' },
}

function getInitials(user: { name: string | null; email: string }): string {
  if (user.name) {
    return user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  }
  return user.email[0].toUpperCase()
}

export default function TopBar() {
  const { pathname } = useLocation()
  const [panelOpen, setPanelOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const { currentUser } = useAppContext()

  const meta = PAGE_META[pathname] ?? { title: 'TeamPulse', subtitle: '' }

  function handleAvatarClick() {
    setPanelOpen(false)
    setMenuOpen(prev => !prev)
  }

  return (
    <header className="relative flex items-center justify-between px-4 sm:px-6 h-12 sm:h-14 bg-surface-1 border-b border-hairline z-10 flex-shrink-0">
      <div>
        <h1
          className="text-sm font-semibold text-ink leading-tight"
          style={{ letterSpacing: '-0.2px' }}
        >
          {meta.title}
        </h1>
        {meta.subtitle && (
          <p className="text-[11px] text-ink-tertiary leading-tight mt-0.5">{meta.subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <NotificationBell onClick={() => { setMenuOpen(false); setPanelOpen(prev => !prev) }} />

        {currentUser && (
          <button
            onClick={handleAvatarClick}
            className="flex items-center gap-2.5 pl-2.5 border-l border-hairline ml-0.5 rounded-md hover:bg-surface-2 pr-1.5 py-1 transition-colors"
            aria-label="Open user menu"
          >
            <div className="hidden sm:block text-right">
              <p className="text-xs font-medium text-ink-muted leading-tight">
                {currentUser.name ?? currentUser.email.split('@')[0]}
              </p>
              <p className="text-[10px] text-ink-tertiary leading-tight">
                {currentUser.teamId ? `${currentUser.teamId.toUpperCase()} Team` : 'Member'}
              </p>
            </div>
            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center text-white text-[11px] font-semibold flex-shrink-0">
              {getInitials(currentUser)}
            </div>
          </button>
        )}
      </div>

      {panelOpen && <NotificationPanel onClose={() => setPanelOpen(false)} />}
      {menuOpen && currentUser && (
        <UserMenu user={currentUser} onClose={() => setMenuOpen(false)} />
      )}
    </header>
  )
}
