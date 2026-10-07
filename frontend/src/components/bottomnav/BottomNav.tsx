import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, CheckSquare, Ticket, Settings,
  LayoutGrid, LineSquiggle, Astroid, Cog, GaugeCircle,
  LayoutList, DollarSign, Infinity, BotMessageSquare, X,
} from 'lucide-react'

const LEFT_TABS = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/',      end: true  },
  { label: 'Tasks',     icon: CheckSquare,     path: '/tasks', end: false },
]
const RIGHT_TABS = [
  { label: 'Tickets',  icon: Ticket,   path: '/tickets',  end: false },
  { label: 'Settings', icon: Settings, path: '/settings', end: false },
]

// Three rows — each becomes a visually separated row in the floating card
const SHEET_ROWS = [
  [
    { label: 'Workload',  icon: GaugeCircle,      path: '/workload'          },
    { label: 'Pipelines', icon: LineSquiggle,     path: '/pipelines'         },
    { label: 'Tracker',   icon: LayoutList,       path: '/tracker'           },
  ],
  [
    { label: 'AI Subs',   icon: Astroid,          path: '/ai-subs'           },
    { label: 'Lifecycle', icon: Cog,              path: '/project-lifecycle' },
    { label: 'Cost',      icon: DollarSign,       path: '/cost'              },
  ],
  [
    { label: 'LiveOps',   icon: Infinity,         path: '/liveops'           },
    { label: 'DevOps',    icon: Ticket,           path: '/devops'            },
    { label: 'Agent',     icon: BotMessageSquare, path: '/agent'             },
  ],
]

const SHEET_PATHS = SHEET_ROWS.flat().map(i => i.path)

export default function BottomNav() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const moreActive = SHEET_PATHS.includes(pathname)

  return (
    <>
      {/* backdrop — subtle, only visible when open */}
      <div
        className="fixed inset-0 z-30 md:hidden transition-opacity duration-200"
        style={{
          background: 'rgba(0,0,0,0.45)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          backdropFilter: open ? 'blur(2px)' : 'none',
        }}
        onClick={() => setOpen(false)}
      />

      {/* floating compact card */}
      <div
        className="fixed z-40 md:hidden rounded-2xl border border-hairline shadow-2xl overflow-hidden"
        style={{
          left: 16,
          right: 16,
          bottom: `calc(4.5rem + env(safe-area-inset-bottom))`,
          background: 'color-mix(in srgb, var(--color-surface-1) 94%, transparent)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          transform: open ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.95)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'transform 220ms cubic-bezier(0.34,1.3,0.64,1), opacity 180ms ease',
          transformOrigin: 'bottom center',
        }}
      >
        {SHEET_ROWS.map((row, ri) => (
          <div key={ri}>
            {ri > 0 && <div className="border-t border-hairline mx-3" />}
            <div className="grid grid-cols-3">
              {row.map(item => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setOpen(false)}
                  className="flex flex-col items-center gap-2 py-4 px-2 active:opacity-70 transition-opacity"
                >
                  {({ isActive }) => (
                    <>
                      <div
                        className="w-11 h-11 rounded-2xl flex items-center justify-center transition-colors"
                        style={{
                          background: isActive
                            ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)'
                            : 'var(--color-surface-2)',
                        }}
                      >
                        <item.icon
                          size={19}
                          strokeWidth={isActive ? 2.2 : 1.6}
                          className={isActive ? 'text-primary-hover' : 'text-ink-subtle'}
                        />
                      </div>
                      <span
                        className="text-[10px] font-medium leading-none"
                        style={{ color: isActive ? 'var(--color-primary-hover)' : 'var(--color-ink-tertiary)' }}
                      >
                        {item.label}
                      </span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
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
                  <item.icon size={21} strokeWidth={isActive ? 2.2 : 1.6} />
                  <span className="text-[10px] font-medium">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}

          {/* centre FAB */}
          <div className="flex-1 relative flex items-center justify-center">
            <button
              onClick={() => setOpen(v => !v)}
              aria-label={open ? 'Close' : 'More'}
              className={`absolute left-1/2 -translate-x-1/2 w-13 h-13 rounded-full shadow-xl flex items-center justify-center transition-all duration-250 ${
                open || moreActive ? 'bg-primary scale-110' : 'bg-surface-3 scale-100'
              }`}
              style={{ bottom: 'calc(50% - 26px + 12px)', width: 52, height: 52 }}
            >
              <div
                className="transition-all duration-200"
                style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
              >
                {open
                  ? <X size={20} className="text-white" />
                  : <LayoutGrid size={20} className={moreActive ? 'text-white' : 'text-ink'} />
                }
              </div>
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
                  <item.icon size={21} strokeWidth={isActive ? 2.2 : 1.6} />
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
