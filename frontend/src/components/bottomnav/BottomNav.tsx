import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, CheckSquare, Ticket, Settings,
  LayoutGrid, LineSquiggle, Astroid, Cog, GaugeCircle,
  LayoutList, DollarSign, Infinity, BotMessageSquare, X,
} from 'lucide-react'

// ── permanent bottom bar tabs ─────────────────────────────────────────────────
const LEFT_TABS = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/',      end: true  },
  { label: 'Tasks',     icon: CheckSquare,     path: '/tasks', end: false },
]
const RIGHT_TABS = [
  { label: 'Tickets',  icon: Ticket,   path: '/tickets',  end: false },
  { label: 'Settings', icon: Settings, path: '/settings', end: false },
]

// ── overflow sheet — all remaining tabs ───────────────────────────────────────
const SHEET_GROUPS = [
  {
    label: 'Work',
    items: [
      { label: 'Workload',  icon: GaugeCircle,  path: '/workload'  },
      { label: 'Pipelines', icon: LineSquiggle, path: '/pipelines' },
      { label: 'Tracker',   icon: LayoutList,   path: '/tracker'   },
    ],
  },
  {
    label: 'Platform',
    items: [
      { label: 'AI Subs',   icon: Astroid,          path: '/ai-subs'           },
      { label: 'Lifecycle', icon: Cog,              path: '/project-lifecycle' },
      { label: 'Cost',      icon: DollarSign,       path: '/cost'              },
    ],
  },
  {
    label: 'Ops',
    items: [
      { label: 'LiveOps', icon: Infinity,        path: '/liveops' },
      { label: 'DevOps',  icon: Ticket,          path: '/devops'  },
      { label: 'Agent',   icon: BotMessageSquare, path: '/agent'  },
    ],
  },
]

const SHEET_PATHS = SHEET_GROUPS.flatMap(g => g.items.map(i => i.path))

export default function BottomNav() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const moreActive = SHEET_PATHS.includes(pathname)

  return (
    <>
      {/* backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 md:hidden bg-canvas/70 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* bottom sheet */}
      <div
        className="fixed inset-x-0 z-40 md:hidden rounded-t-2xl bg-surface-1 border-t border-hairline shadow-2xl transition-transform duration-300 ease-out"
        style={{
          bottom: 'calc(4rem + env(safe-area-inset-bottom))',
          transform: open ? 'translateY(0)' : 'translateY(110%)',
        }}
      >
        {/* drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 rounded-full bg-hairline-strong" />
        </div>

        <div className="px-4 pt-2 pb-5 flex flex-col gap-5">
          {SHEET_GROUPS.map(group => (
            <div key={group.label}>
              <p className="text-[9px] font-bold text-ink-tertiary uppercase tracking-widest mb-2 px-1">
                {group.label}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {group.items.map(item => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      `flex flex-col items-center gap-1.5 py-3 rounded-xl transition-colors ${
                        isActive
                          ? 'bg-primary/10 text-primary-hover'
                          : 'bg-surface-2 text-ink-subtle active:bg-surface-3'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon size={19} strokeWidth={isActive ? 2.2 : 1.6} />
                        <span className="text-[10px] font-medium">{item.label}</span>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* tab bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex bg-surface-1 border-t border-hairline h-16">

          {LEFT_TABS.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${
                  isActive ? 'text-primary-hover' : 'text-ink-tertiary'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon size={22} strokeWidth={isActive ? 2.2 : 1.6} />
                  <span className="text-[10px] font-medium">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}

          {/* centre FAB */}
          <div className="flex-1 relative flex items-center justify-center">
            <button
              onClick={() => setOpen(v => !v)}
              aria-label={open ? 'Close menu' : 'More navigation'}
              className={`absolute left-1/2 -translate-x-1/2 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 ${
                open || moreActive ? 'bg-primary' : 'bg-surface-3'
              }`}
              style={{ bottom: 'calc(50% - 28px + 12px)' }}
            >
              {open
                ? <X size={22} className="text-white" />
                : <LayoutGrid size={22} className={`transition-colors ${moreActive ? 'text-white' : 'text-ink'}`} />
              }
            </button>
          </div>

          {RIGHT_TABS.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={false}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${
                  isActive ? 'text-primary-hover' : 'text-ink-tertiary'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon size={22} strokeWidth={isActive ? 2.2 : 1.6} />
                  <span className="text-[10px] font-medium">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}

        </div>
      </nav>
    </>
  )
}
