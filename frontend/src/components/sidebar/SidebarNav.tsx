import { LayoutDashboard, DollarSign, CheckSquare, Ticket, Scale, LineSquiggle, Astroid, Cog, Infinity, BotMessageSquare, LayoutList, GaugeCircle, Settings } from 'lucide-react'
import SidebarNavItem from './SidebarNavItem'
import { useAppContext } from '../../context/AppContext'

const MAIN_NAV = [
  { label: 'Dashboard',  icon: LayoutDashboard, path: '/',         featureKey: null },
  { label: 'Tasks',      icon: CheckSquare,     path: '/tasks',    featureKey: 'tasks' },
  { label: 'Workload',   icon: GaugeCircle,     path: '/workload', featureKey: 'workload' },
  { label: 'KPI',        icon: Scale,           path: '/kpi',      featureKey: 'kpi' },
  { label: 'Pipelines',  icon: LineSquiggle,    path: '/pipelines',featureKey: 'pipelines' },
]

const TOOLS_NAV = [
  { label: 'AI Subscriptions',  icon: Astroid,   path: '/ai-subs',           featureKey: 'aiSubscriptions' },
  { label: 'Project Lifecycle', icon: Cog,        path: '/project-lifecycle', featureKey: 'projectLifecycle' },
  { label: 'Tracker Board',     icon: LayoutList, path: '/tracker',           featureKey: 'tracker' },
  { label: 'Cost',              icon: DollarSign, path: '/cost',              featureKey: 'cost' },
]

const TICKET_NAV = [
  { label: 'Liveops', icon: Infinity, path: '/liveops', featureKey: 'liveops' },
  { label: 'Devops',  icon: Ticket,   path: '/devops',  featureKey: 'devops' },
]

const SELF_NAV = [
  { label: 'Agent', icon: BotMessageSquare, path: '/agent', featureKey: 'agent' },
]

const ACCOUNT_NAV = [
  { label: 'Settings', icon: Settings, path: '/settings', featureKey: null },
]

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="text-[9px] font-semibold text-ink-tertiary uppercase px-2 mb-1.5" style={{ letterSpacing: '0.4px' }}>
      {label}
    </p>
  )
}

function SectionDivider() {
  return <div className="border-t border-hairline mb-1.5" />
}

export default function SidebarNav() {
  const { sidebarOpen, currentUser, teamPermissions } = useAppContext()

  const role = currentUser?.role ?? 'user'
  const bypassPermissions = role === 'admin' || role === 'head' || currentUser?.hasAdminAccess

  function isVisible(featureKey: string | null): boolean {
    if (!featureKey) return true
    if (bypassPermissions) return true
    if (!teamPermissions) return true
    return (teamPermissions as unknown as Record<string, boolean>)[featureKey] !== false
  }

  const visibleMain   = MAIN_NAV.filter(i => isVisible(i.featureKey))
  const visibleTools  = TOOLS_NAV.filter(i => isVisible(i.featureKey))
  const visibleTicket = TICKET_NAV.filter(i => isVisible(i.featureKey))
  const visibleSelf   = SELF_NAV.filter(i => isVisible(i.featureKey))

  return (
    <nav className="flex-1 py-3 px-2 overflow-y-auto space-y-4">
      <div className="space-y-0.5">
        {visibleMain.map(item => (
          <SidebarNavItem key={item.path} label={item.label} icon={item.icon} path={item.path} />
        ))}
      </div>

      {visibleTools.length > 0 && (
        <div>
          {sidebarOpen ? <SectionLabel label="Tools" /> : <SectionDivider />}
          <div className="space-y-0.5">
            {visibleTools.map(item => (
              <SidebarNavItem key={item.path} label={item.label} icon={item.icon} path={item.path} />
            ))}
          </div>
        </div>
      )}

      {visibleTicket.length > 0 && (
        <div>
          {sidebarOpen ? <SectionLabel label="Tickets" /> : <SectionDivider />}
          <div className="space-y-0.5">
            {visibleTicket.map(item => (
              <SidebarNavItem key={item.path} label={item.label} icon={item.icon} path={item.path} />
            ))}
          </div>
        </div>
      )}

      {visibleSelf.length > 0 && (
        <div>
          {sidebarOpen ? <SectionLabel label="Self Serving" /> : <SectionDivider />}
          <div className="space-y-0.5">
            {visibleSelf.map(item => (
              <SidebarNavItem key={item.path} label={item.label} icon={item.icon} path={item.path} />
            ))}
          </div>
        </div>
      )}

      <div>
        {sidebarOpen ? <SectionLabel label="Account" /> : <SectionDivider />}
        <div className="space-y-0.5">
          {ACCOUNT_NAV.map(item => (
            <SidebarNavItem key={item.path} label={item.label} icon={item.icon} path={item.path} />
          ))}
        </div>
      </div>
    </nav>
  )
}
