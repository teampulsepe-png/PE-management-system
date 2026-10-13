import { useState, useEffect, useCallback } from 'react'
import {
  CheckCircle2, Clock, AlertTriangle,
  ChevronDown, ChevronUp, RefreshCw, ArrowRight,
  Infinity, CheckSquare, GaugeCircle, LayoutGrid,
} from 'lucide-react'
import { api } from '../api/teamPulseApi'
import { useAppContext } from '../context/AppContext'
import type { MyWorkItem, MyWorkResponse, MyWorkSource } from '../types'

// ── helpers ───────────────────────────────────────────────────────────────────

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

// ── source config ─────────────────────────────────────────────────────────────

const SOURCE_CONFIG: Record<MyWorkSource, {
  label: string
  accent: string
  badge: string
  icon: React.ElementType
}> = {
  liveops: {
    label: 'LiveOps',
    accent: 'bg-primary',
    badge: 'bg-primary/10 text-primary border-primary/20',
    icon: Infinity,
  },
  task: {
    label: 'Task',
    accent: 'bg-emerald-500',
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    icon: CheckSquare,
  },
  supervisor: {
    label: 'Supervisor',
    accent: 'bg-amber-500',
    badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    icon: GaugeCircle,
  },
  tracker: {
    label: 'Tracker',
    accent: 'bg-violet-500',
    badge: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    icon: LayoutGrid,
  },
}

const URGENCY_DOT: Record<string, string> = {
  high: 'bg-red-400',
  medium: 'bg-amber-400',
  low: 'bg-emerald-400',
}

// ── SLA countdown ─────────────────────────────────────────────────────────────

function SlaCountdown({ slaDeadline }: { slaDeadline: string }) {
  const [, setTick] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  const dl = new Date(slaDeadline)
  const diff = dl.getTime() - Date.now()

  if (diff <= 0) {
    return (
      <span className="text-[10px] font-semibold text-red-400 flex items-center gap-1">
        <AlertTriangle size={9} />
        SLA breached
      </span>
    )
  }

  const hours = Math.floor(diff / 3600000)
  const mins = Math.floor((diff % 3600000) / 60000)
  const isUrgent = hours < 2

  return (
    <span className={`text-[10px] font-semibold flex items-center gap-1 ${isUrgent ? 'text-red-400' : 'text-ink-subtle'}`}>
      <Clock size={9} />
      {hours > 0 ? `${hours}h ${mins}m` : `${mins}m`} left
    </span>
  )
}

// ── work item card ────────────────────────────────────────────────────────────

interface CardProps {
  item: MyWorkItem
  index: number
  onAction: (item: MyWorkItem, action: string) => Promise<void>
  actioning: string | null
}

function WorkItemCard({ item, index, onAction, actioning }: CardProps) {
  const cfg = SOURCE_CONFIG[item.source]
  const Icon = cfg.icon
  const isActioning = actioning === item.id

  const primaryAction = getPrimaryAction(item)

  return (
    <div
      className="group relative flex gap-3 bg-surface-1 border border-hairline rounded-xl px-4 py-3.5 hover:border-hairline-strong hover:bg-surface-2 transition-all duration-150"
      style={{ animationDelay: `${index * 40}ms`, animation: 'fadeSlideIn 0.25s ease both' }}
    >
      {/* left accent bar */}
      <div className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full ${cfg.accent}`} />

      <div className="flex-1 min-w-0 pl-1">
        {/* top row: source badge + urgency dot */}
        <div className="flex items-center gap-2 mb-1.5">
          <span className={`inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${cfg.badge}`}>
            <Icon size={8} />
            {cfg.label}
          </span>
          {item.urgency && (
            <span className={`w-1.5 h-1.5 rounded-full ${URGENCY_DOT[item.urgency] ?? 'bg-hairline-strong'}`} title={item.urgency} />
          )}
          {item.isOverdue && (
            <span className="text-[9px] font-semibold text-red-400 flex items-center gap-0.5">
              <AlertTriangle size={8} />
              overdue
            </span>
          )}
        </div>

        {/* title */}
        <p className="text-sm font-medium text-ink leading-snug truncate">{item.title}</p>

        {/* subtitle + sla countdown */}
        <div className="flex items-center gap-2 mt-1">
          {item.subtitle && (
            <span className="text-[11px] text-ink-subtle truncate">{item.subtitle}</span>
          )}
          {item.slaDeadline && <SlaCountdown slaDeadline={item.slaDeadline} />}
        </div>
      </div>

      {/* right: status + action */}
      <div className="flex flex-col items-end justify-between gap-2 shrink-0">
        <StatusBadge status={item.status} source={item.source} />
        {primaryAction && (
          <button
            onClick={() => onAction(item, primaryAction.key)}
            disabled={isActioning}
            className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-surface-3 hover:bg-primary hover:text-white text-ink-muted border border-hairline hover:border-primary transition-all duration-150 flex items-center gap-1 disabled:opacity-50"
          >
            {isActioning ? (
              <RefreshCw size={9} className="animate-spin" />
            ) : (
              <primaryAction.Icon size={9} />
            )}
            {primaryAction.label}
          </button>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status, source }: { status: string; source: MyWorkSource }) {
  const map: Record<string, string> = {
    pending:     'bg-surface-3 text-ink-subtle border-hairline',
    active:      'bg-blue-500/10 text-blue-400 border-blue-500/20',
    in_progress: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    done:        'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    extended:    'bg-amber-500/10 text-amber-400 border-amber-500/20',
  }
  const labels: Record<string, string> = {
    pending: 'Pending', active: 'Active', in_progress: 'In Progress',
    done: 'Done', extended: 'Extended',
  }
  // override display for liveops
  const display = source === 'liveops' && status === 'pending' ? 'Assigned' : (labels[status] ?? status)
  return (
    <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full border ${map[status] ?? 'bg-surface-3 text-ink-subtle border-hairline'}`}>
      {display}
    </span>
  )
}

interface ActionDef { key: string; label: string; Icon: React.ElementType }

function getPrimaryAction(item: MyWorkItem): ActionDef | null {
  if (item.source === 'liveops') {
    if (item.status === 'pending') return { key: 'liveops_pickup', label: 'Pick Up', Icon: ArrowRight }
    if (item.status === 'active')  return { key: 'liveops_complete', label: 'Complete', Icon: CheckCircle2 }
  }
  if (item.source === 'task') {
    return { key: 'task_done', label: 'Mark Done', Icon: CheckCircle2 }
  }
  if (item.source === 'supervisor') {
    return { key: 'supervisor_done', label: 'Mark Done', Icon: CheckCircle2 }
  }
  if (item.source === 'tracker') {
    return { key: 'tracker_done', label: 'Done', Icon: CheckCircle2 }
  }
  return null
}

// ── group section ─────────────────────────────────────────────────────────────

interface GroupProps {
  label: string
  count: number
  accentClass: string
  dotClass: string
  items: MyWorkItem[]
  defaultOpen?: boolean
  indexOffset?: number
  onAction: (item: MyWorkItem, action: string) => Promise<void>
  actioning: string | null
}

function WorkGroup({ label, count, accentClass, dotClass, items, defaultOpen = true, indexOffset = 0, onAction, actioning }: GroupProps) {
  const [open, setOpen] = useState(defaultOpen)

  if (items.length === 0) return null

  return (
    <div className="space-y-2">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 group/hdr"
      >
        <span className={`w-2 h-2 rounded-full shrink-0 ${dotClass}`} />
        <span className={`text-xs font-semibold uppercase tracking-wide ${accentClass}`} style={{ letterSpacing: '0.5px' }}>
          {label}
        </span>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${accentClass} bg-current/10`}>
          {count}
        </span>
        <div className="flex-1 h-px bg-hairline" />
        {open
          ? <ChevronUp size={12} className="text-ink-tertiary group-hover/hdr:text-ink-subtle transition-colors" />
          : <ChevronDown size={12} className="text-ink-tertiary group-hover/hdr:text-ink-subtle transition-colors" />
        }
      </button>
      {open && (
        <div className="space-y-2 pl-4">
          {items.map((item, i) => (
            <WorkItemCard key={item.id} item={item} index={indexOffset + i} onAction={onAction} actioning={actioning} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── skeleton ──────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-3">
        <div className="h-3 w-32 bg-surface-3 rounded-full" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-16 bg-surface-2 rounded-xl border border-hairline" />
        ))}
      </div>
      <div className="space-y-3">
        <div className="h-3 w-24 bg-surface-3 rounded-full" />
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-16 bg-surface-2 rounded-xl border border-hairline" />
        ))}
      </div>
    </div>
  )
}

// ── empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
        <CheckCircle2 size={24} className="text-emerald-400" />
      </div>
      <p className="text-sm font-semibold text-ink">You're all caught up</p>
      <p className="text-xs text-ink-subtle mt-1">No open work items assigned to you right now.</p>
    </div>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function MyWork() {
  const { currentUser } = useAppContext()
  const [data, setData] = useState<MyWorkResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [actioning, setActioning] = useState<string | null>(null)

  const displayName = currentUser?.name
    ?? currentUser?.email?.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    ?? 'there'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.getMyWork()
      setData(res)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleAction = useCallback(async (item: MyWorkItem, action: string) => {
    if (!currentUser?.email) return
    setActioning(item.id)
    try {
      if (action === 'liveops_pickup' && item.ticketId) {
        await api.liveops.pickup(item.ticketId, currentUser.email)
      } else if (action === 'liveops_complete' && item.ticketId) {
        await api.liveops.complete(item.ticketId, null, currentUser.email)
      } else if (action === 'task_done' && item.occurrenceId) {
        await api.updateOccurrence(item.occurrenceId, {
          status: 'done',
          completed_by: currentUser.name ?? currentUser.email,
          completed_at: new Date().toISOString(),
        })
      } else if (action === 'supervisor_done' && item.supervisorTaskId) {
        await api.updateWorkloadTaskStatus(item.supervisorTaskId, 'completed')
      } else if (action === 'tracker_done') {
        await api.updateTrackerSubtask(item.id, { is_done: true })
      }
      // optimistic remove
      if (data) {
        setData(prev => {
          if (!prev) return prev
          const filter = (arr: MyWorkItem[]) => arr.filter(i => i.id !== item.id)
          const newData = {
            ...prev,
            overdue: filter(prev.overdue),
            dueToday: filter(prev.dueToday),
            thisWeek: filter(prev.thisWeek),
            later: filter(prev.later),
            summary: {
              ...prev.summary,
              total: Math.max(0, prev.summary.total - 1),
              overdue: Math.max(0, prev.summary.overdue - (prev.overdue.some(i => i.id === item.id) ? 1 : 0)),
              dueToday: Math.max(0, prev.summary.dueToday - (prev.dueToday.some(i => i.id === item.id) ? 1 : 0)),
            },
          }
          return newData
        })
      }
    } catch (err) {
      console.error(err)
    } finally {
      setActioning(null)
    }
  }, [currentUser, data])

  const total = data?.summary.total ?? 0
  const overdue = data?.summary.overdue ?? 0
  const dueToday = data?.summary.dueToday ?? 0
  const inProgress = data?.summary.inProgress ?? 0
  const isEmpty = total === 0

  let itemOffset = 0

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto w-full px-6 py-8 space-y-8">

        {/* ── header ──────────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold text-ink">{greeting()}, {displayName}</h1>
              <p className="text-xs text-ink-subtle mt-0.5">{formatDate()}</p>
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="p-2 rounded-lg border border-hairline bg-surface-1 hover:bg-surface-2 text-ink-subtle hover:text-ink transition-all"
              title="Refresh"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* stat strip */}
          <div className="grid grid-cols-4 gap-2 mt-4">
            <StatChip label="Open" value={total} color="text-ink" />
            <StatChip label="Overdue" value={overdue} color={overdue > 0 ? 'text-red-400' : 'text-ink-subtle'} />
            <StatChip label="Due Today" value={dueToday} color={dueToday > 0 ? 'text-amber-400' : 'text-ink-subtle'} />
            <StatChip label="In Progress" value={inProgress} color="text-primary" />
          </div>
        </div>

        {/* ── feed ────────────────────────────────────────────────────────── */}
        {loading ? (
          <Skeleton />
        ) : isEmpty ? (
          <EmptyState />
        ) : (
          <div className="space-y-6">
            {data && data.overdue.length > 0 && (() => {
              const offset = itemOffset
              itemOffset += data.overdue.length
              return (
                <WorkGroup
                  key="overdue"
                  label="Overdue"
                  count={data.overdue.length}
                  accentClass="text-red-400"
                  dotClass="bg-red-400"
                  items={data.overdue}
                  defaultOpen={true}
                  indexOffset={offset}
                  onAction={handleAction}
                  actioning={actioning}
                />
              )
            })()}

            {data && data.dueToday.length > 0 && (() => {
              const offset = itemOffset
              itemOffset += data.dueToday.length
              return (
                <WorkGroup
                  key="today"
                  label="Due Today"
                  count={data.dueToday.length}
                  accentClass="text-amber-400"
                  dotClass="bg-amber-400"
                  items={data.dueToday}
                  defaultOpen={true}
                  indexOffset={offset}
                  onAction={handleAction}
                  actioning={actioning}
                />
              )
            })()}

            {data && data.thisWeek.length > 0 && (() => {
              const offset = itemOffset
              itemOffset += data.thisWeek.length
              return (
                <WorkGroup
                  key="week"
                  label="This Week"
                  count={data.thisWeek.length}
                  accentClass="text-primary"
                  dotClass="bg-primary"
                  items={data.thisWeek}
                  defaultOpen={true}
                  indexOffset={offset}
                  onAction={handleAction}
                  actioning={actioning}
                />
              )
            })()}

            {data && data.later.length > 0 && (() => {
              const offset = itemOffset
              itemOffset += data.later.length
              return (
                <WorkGroup
                  key="later"
                  label="Later"
                  count={data.later.length}
                  accentClass="text-ink-subtle"
                  dotClass="bg-hairline-strong"
                  items={data.later}
                  defaultOpen={false}
                  indexOffset={offset}
                  onAction={handleAction}
                  actioning={actioning}
                />
              )
            })()}
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

// ── stat chip ─────────────────────────────────────────────────────────────────

function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-surface-1 border border-hairline rounded-xl px-3 py-2.5 flex flex-col gap-0.5">
      <span className="text-[9px] font-semibold text-ink-tertiary uppercase" style={{ letterSpacing: '0.4px' }}>{label}</span>
      <span className={`text-lg font-bold leading-none ${color}`}>{value}</span>
    </div>
  )
}
