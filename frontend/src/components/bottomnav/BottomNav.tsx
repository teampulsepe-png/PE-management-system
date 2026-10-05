import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, CheckSquare, Ticket, Scale,
  LayoutGrid, LineSquiggle, Astroid, Cog,
} from 'lucide-react'

const LEFT_TABS = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/',      end: true },
  { label: 'Tasks',     icon: CheckSquare,     path: '/tasks', end: false },
]
const RIGHT_TABS = [
  { label: 'Tickets', icon: Ticket, path: '/tickets', end: false },
  { label: 'KPI',     icon: Scale,  path: '/kpi',     end: false },
]

const DIAL = [
  { label: 'Pipelines', icon: LineSquiggle, path: '/pipelines',         x: -76, y: 78 },
  { label: 'AI Subs',   icon: Astroid,      path: '/ai-subs',           x:   0, y: 104 },
  { label: 'Projects',  icon: Cog,          path: '/project-lifecycle', x:  76, y: 78 },
]

const DIAL_PATHS = DIAL.map(d => d.path)
const FAB_OVERFLOW = 12

export default function BottomNav() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const moreActive = DIAL_PATHS.includes(pathname)

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 md:hidden bg-canvas/60"
          onClick={() => setOpen(false)}
        />
      )}

      <nav
        className="fixed inset-x-0 bottom-0 z-40 md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="absolute bottom-full inset-x-0 pointer-events-none" style={{ height: 0 }}>
          {DIAL.map((item, i) => {
            const isActive = pathname === item.path
            const closedTransform = `translateX(calc(-50% - ${item.x}px)) scale(0.3)`
            const openTransform   = `translateX(-50%) scale(1)`

            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setOpen(false)}
                className="absolute flex flex-col items-center gap-1.5 pointer-events-auto"
                style={{
                  bottom: open ? `${item.y}px` : `${FAB_OVERFLOW}px`,
                  left: `calc(50% + ${item.x}px)`,
                  transform: open ? openTransform : closedTransform,
                  opacity: open ? 1 : 0,
                  transition: 'transform 300ms cubic-bezier(0.34,1.56,0.64,1), opacity 220ms ease, bottom 300ms cubic-bezier(0.34,1.56,0.64,1)',
                  transitionDelay: open
                    ? `${i * 55}ms`
                    : `${(DIAL.length - 1 - i) * 35}ms`,
                  pointerEvents: open ? 'auto' : 'none',
                }}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-xl border transition-colors ${
                  isActive
                    ? 'bg-primary text-white border-primary'
                    : 'bg-surface-2 text-ink-subtle border-hairline-strong'
                }`}>
                  <item.icon size={20} />
                </div>
                <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full shadow-sm whitespace-nowrap ${
                  isActive ? 'bg-primary text-white' : 'bg-surface-2 text-ink-subtle'
                }`}>
                  {item.label}
                </span>
              </NavLink>
            )
          })}
        </div>

        {/* Tab bar */}
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

          {/* Centre FAB slot */}
          <div className="flex-1 relative flex items-center justify-center">
            <button
              onClick={() => setOpen(v => !v)}
              aria-label="More navigation"
              className={`absolute left-1/2 -translate-x-1/2 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 ${
                open || moreActive ? 'bg-primary' : 'bg-surface-3'
              }`}
              style={{ bottom: `calc(50% - 28px + ${FAB_OVERFLOW}px)` }}
            >
              <LayoutGrid
                size={22}
                className={`text-ink transition-transform duration-300 ${open ? 'rotate-90 scale-110' : ''}`}
              />
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
