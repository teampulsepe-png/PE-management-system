import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import type { CurrentUser, AppNotification, TeamPermissions } from '../types'
import { api } from '../api/teamPulseApi'

export type Theme = 'light' | 'dark' | 'system'

interface AppContextType {
  sidebarOpen: boolean
  toggleSidebar: () => void
  currentUser: CurrentUser | null
  teamPermissions: TeamPermissions | null
  refreshTeamPermissions: () => void
  notifications: AppNotification[]
  unreadCount: number
  markAllRead: () => Promise<void>
  refreshNotifications: () => void
  theme: Theme
  setTheme: (t: Theme) => void
}

const AppContext = createContext<AppContextType | null>(null)

function applyTheme(t: Theme) {
  const root = document.documentElement
  const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches
  const isLight = t === 'light' || (t === 'system' && prefersLight)
  if (isLight) root.setAttribute('data-theme', 'light')
  else root.removeAttribute('data-theme')
}

function parseSSENotification(raw: string): AppNotification | null {
  try {
    const n = JSON.parse(raw)
    return {
      id: n.id,
      type: n.type,
      taskId: n.task_id,
      taskRecurrence: n.task_recurrence,
      occurrenceId: n.occurrence_id,
      triggeredByName: n.triggered_by_name,
      message: n.message,
      isRead: n.is_read,
      createdAt: n.created_at,
    }
  } catch {
    return null
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [teamPermissions, setTeamPermissions] = useState<TeamPermissions | null>(null)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [theme, setThemeState] = useState<Theme>(() => {
    return (localStorage.getItem('theme') as Theme) ?? 'system'
  })

  const unreadCount = notifications.filter(n => !n.isRead).length

  const setTheme = (t: Theme) => {
    setThemeState(t)
    localStorage.setItem('theme', t)
  }

  // Apply theme class to <html> and listen for system changes
  useEffect(() => {
    applyTheme(theme)

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = () => applyTheme('system')
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
  }, [theme])

  const fetchNotifications = useCallback(() => {
    api.getNotifications().then(setNotifications).catch(console.error)
  }, [])

  const fetchTeamPermissions = useCallback((teamId: string) => {
    api.settings.getTeamPermissions(teamId).then(setTeamPermissions).catch(console.error)
  }, [])

  const refreshTeamPermissions = useCallback(() => {
    if (currentUser?.teamId) fetchTeamPermissions(currentUser.teamId)
  }, [currentUser?.teamId, fetchTeamPermissions])

  useEffect(() => {
    api.getUser().then(user => {
      setCurrentUser(user)
      if (user.teamId) fetchTeamPermissions(user.teamId)
    }).catch(console.error)
  }, [fetchTeamPermissions])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  useEffect(() => {
    const es = new EventSource('/api/v1/notifications/stream')

    es.onmessage = (event) => {
      const notification = parseSSENotification(event.data)
      if (notification) {
        setNotifications(prev => [notification, ...prev])
      }
    }

    es.onerror = () => {}
    return () => es.close()
  }, [])

  async function markAllRead() {
    await api.markNotificationsRead()
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
  }

  const toggleSidebar = () => setSidebarOpen(prev => !prev)

  return (
    <AppContext.Provider value={{
      sidebarOpen, toggleSidebar,
      currentUser,
      teamPermissions, refreshTeamPermissions,
      notifications, unreadCount, markAllRead,
      refreshNotifications: fetchNotifications,
      theme, setTheme,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useAppContext() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppContext must be used within AppProvider')
  return ctx
}
