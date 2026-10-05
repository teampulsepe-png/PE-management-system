import { NavLink } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { useAppContext } from '../../context/AppContext'

interface Props {
  label: string
  icon: LucideIcon
  path: string
}

export default function SidebarNavItem({ label, icon: Icon, path }: Props) {
  const { sidebarOpen } = useAppContext()

  return (
    <NavLink
      to={path}
      end={path === '/'}
      title={!sidebarOpen ? label : undefined}
      className={({ isActive }) =>
        `flex items-center gap-2.5 px-2 py-[7px] rounded-md text-xs font-medium transition-all duration-150 ${
          isActive
            ? 'bg-primary/10 text-primary-hover'
            : 'text-ink-subtle hover:bg-surface-2 hover:text-ink'
        } ${!sidebarOpen ? 'justify-center' : ''}`
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            size={15}
            strokeWidth={isActive ? 2.25 : 1.75}
            className={`flex-shrink-0 ${isActive ? 'text-primary-hover' : ''}`}
          />
          {sidebarOpen && <span className="truncate">{label}</span>}
        </>
      )}
    </NavLink>
  )
}
