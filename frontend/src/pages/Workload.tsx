import { useState, useRef, useEffect } from 'react'
import {
  Plus, AlertTriangle, ChevronDown, Trash2, X, ChevronLeft,
  Users, Calendar, CheckCircle2, Clock, Ticket, Briefcase,
  Pencil, Check, StickyNote,
} from 'lucide-react'
import { api } from '../api/teamPulseApi'
import { useAppContext } from '../context/AppContext'
import type { SupervisorTask, TeamMember, OpsTicket } from '../types'

// ── Feature types ──────────────────────────────────────────────────────────────

type AvailabilityStatus = 'available' | 'busy' | 'wfh' | 'on_leave' | 'in_meeting'
type SortMode = 'load_desc' | 'name' | 'overdue_first'
type TaskFilter = 'all' | 'active' | 'overdue' | 'completed'

// ── Mock ops data ──────────────────────────────────────────────────────────────

const MOCK_OPS: Record<string, OpsTicket[]> = {
  'Nimesh Rajapakse': [
    { id: 'o1', title: 'P2 – API gateway latency spike on prod', type: 'liveops', priority: 'high', status: 'in_progress' },
    { id: 'o2', title: 'CI/CD pipeline blocked on lint check', type: 'devops', priority: 'medium', status: 'open' },
  ],
  'Bob Smith': [
    { id: 'o3', title: 'P1 – DB connection pool exhausted in prod', type: 'liveops', priority: 'critical', status: 'in_progress' },
    { id: 'o4', title: 'RBAC rollback needed after hotfix merge', type: 'devops', priority: 'high', status: 'open' },
    { id: 'o5', title: 'Monitoring alert false positive cleanup', type: 'devops', priority: 'low', status: 'open' },
  ],
  'Carol White': [
    { id: 'o6', title: 'P3 – Report export timeout on large datasets', type: 'liveops', priority: 'medium', status: 'open' },
  ],
  'Chamila': [],
  'David Brown': [
    { id: 'o7', title: 'K8s node memory pressure alert on cluster-2', type: 'liveops', priority: 'high', status: 'open' },
    { id: 'o8', title: 'SSL certificate renewal for dev.internal', type: 'devops', priority: 'medium', status: 'in_progress' },
  ],
  'Emma Davis': [],
  'Frank Wilson': [
    { id: 'o9', title: 'P2 – Auth service intermittent 503s', type: 'liveops', priority: 'critical', status: 'in_progress' },
  ],
}

// ── Constants ──────────────────────────────────────────────────────────────────

const PRIORITY_WEIGHT: Record<string, number> = { critical: 40, high: 25, medium: 15, low: 10 }
const SIZE_WEIGHT: Record<string, number> = { S: 25, M: 50, L: 100 }

const AVAILABILITY: Record<AvailabilityStatus, { label: string; dot: string; pill: string; stroke: string }> = {
  available:  { label: 'Available',   dot: 'bg-emerald-500', pill: 'bg-emerald-900/30 text-emerald-400 border-emerald-800/50', stroke: '#10b981' },
  busy:       { label: 'Busy',        dot: 'bg-red-500',     pill: 'bg-red-900/30 text-red-400 border-red-800/50',             stroke: '#ef4444' },
  wfh:        { label: 'WFH',         dot: 'bg-sky-500',     pill: 'bg-sky-900/30 text-sky-400 border-sky-800/50',             stroke: '#0ea5e9' },
  on_leave:   { label: 'On Leave',    dot: 'bg-amber-500',   pill: 'bg-amber-900/30 text-amber-400 border-amber-800/50',       stroke: '#f59e0b' },
  in_meeting: { label: 'In Meeting',  dot: 'bg-purple-500',  pill: 'bg-purple-900/30 text-purple-400 border-purple-800/50',    stroke: '#a855f7' },
}

const SORT_LABELS: Record<SortMode, string> = {
  load_desc:     'Most Loaded',
  name:          'Name (A–Z)',
  overdue_first: 'Overdue First',
}

const STATUS_OPTS = [
  { value: 'pending',     label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed',   label: 'Completed' },
  { value: 'extended',    label: 'Extended' },
]

const STATUS_STYLES: Record<string, string> = {
  pending:     'bg-surface-3 text-ink-subtle',
  in_progress: 'bg-blue-900/40 text-blue-400',
  completed:   'bg-emerald-900/40 text-emerald-400',
  extended:    'bg-amber-900/40 text-amber-400',
}

const SIZE_STYLES: Record<string, string> = {
  S: 'bg-surface-3 text-ink-muted',
  M: 'bg-blue-900/50 text-blue-300',
  L: 'bg-purple-900/50 text-purple-300',
}

const PRIORITY_DOT: Record<string, string> = {
  critical: 'bg-red-500', high: 'bg-orange-500', medium: 'bg-amber-500', low: 'bg-ink-subtle',
}

const PRIORITY_TEXT: Record<string, string> = {
  critical: 'text-red-400', high: 'text-orange-400', medium: 'text-amber-400', low: 'text-ink-subtle',
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getOpsLoad(tickets: OpsTicket[]) {
  return tickets.reduce((s, t) => s + (PRIORITY_WEIGHT[t.priority] ?? 0), 0)
}

function getProjectLoad(tasks: SupervisorTask[]) {
  return tasks.filter(t => t.status !== 'completed').reduce((s, t) => s + (SIZE_WEIGHT[t.size] ?? 0), 0)
}

function combinedLoad(member: TeamMember, tasks: SupervisorTask[]) {
  const tickets = MOCK_OPS[member.name] ?? []
  const mTasks = tasks.filter(t => t.assignees.some(a => a.memberId === member.id))
  return Math.min(Math.round((Math.min(getOpsLoad(tickets), 100) + Math.min(getProjectLoad(mTasks), 100)) / 2), 100)
}

function loadColor(pct: number) {
  if (pct >= 100) return '#ef4444'
  if (pct >= 75)  return '#f59e0b'
  return '#10b981'
}

function loadBarCls(pct: number) {
  if (pct >= 100) return 'bg-red-500'
  if (pct >= 75)  return 'bg-amber-500'
  return 'bg-emerald-500'
}

function loadTextCls(pct: number) {
  if (pct >= 100) return 'text-red-400'
  if (pct >= 75)  return 'text-amber-400'
  return 'text-ink-subtle'
}

function capacityBadge(ops: number, proj: number, overdue: boolean) {
  const max = Math.max(ops, proj)
  if (max >= 100 || overdue) return { label: 'Overloaded', cls: 'bg-red-900/40 text-red-400 border border-red-800/60' }
  if (max >= 75)             return { label: 'At Risk',    cls: 'bg-amber-900/40 text-amber-400 border border-amber-800/60' }
  return                            { label: 'OK',         cls: 'bg-emerald-900/40 text-emerald-400 border border-emerald-800/60' }
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

// ── localStorage hooks ─────────────────────────────────────────────────────────

function useAvailability() {
  const [map, setMap] = useState<Record<string, AvailabilityStatus>>(() => {
    try { return JSON.parse(localStorage.getItem('tp_avail') ?? '{}') } catch { return {} }
  })
  function set(id: string, s: AvailabilityStatus) {
    setMap(prev => { const n = { ...prev, [id]: s }; localStorage.setItem('tp_avail', JSON.stringify(n)); return n })
  }
  function get(id: string): AvailabilityStatus { return map[id] ?? 'available' }
  return { get, set }
}

function useNotes() {
  const [map, setMap] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('tp_notes') ?? '{}') } catch { return {} }
  })
  function set(id: string, note: string) {
    setMap(prev => { const n = { ...prev, [id]: note }; localStorage.setItem('tp_notes', JSON.stringify(n)); return n })
  }
  function get(id: string): string { return map[id] ?? '' }
  return { get, set }
}

// ── StatusDropdown ─────────────────────────────────────────────────────────────

function StatusDropdown({ taskId, current, onUpdate, canEdit }: {
  taskId: string; current: string; onUpdate: (id: string, s: string) => void; canEdit: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  if (!canEdit) return (
    <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${STATUS_STYLES[current] ?? STATUS_STYLES.pending}`}>
      {STATUS_OPTS.find(o => o.value === current)?.label ?? current}
    </span>
  )

  return (
    <div ref={ref} className="relative">
      <button
        onClick={e => { e.stopPropagation(); setOpen(v => !v) }}
        className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-medium ${STATUS_STYLES[current] ?? STATUS_STYLES.pending} hover:opacity-80 transition-opacity`}
      >
        {STATUS_OPTS.find(o => o.value === current)?.label ?? current}
        <ChevronDown size={9} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 bg-surface-2 border border-hairline rounded-xl shadow-2xl py-1.5 min-w-[130px]">
          {STATUS_OPTS.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onUpdate(taskId, opt.value); setOpen(false) }}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-surface-3 transition-colors ${opt.value === current ? 'text-ink font-semibold' : 'text-ink-subtle'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── AvailabilityPicker ─────────────────────────────────────────────────────────

function AvailabilityPicker({ memberId, current, canEdit, onChange }: {
  memberId: string; current: AvailabilityStatus; canEdit: boolean; onChange: (s: AvailabilityStatus) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const av = AVAILABILITY[current]

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [memberId])

  const pill = (
    <span className={`flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1 rounded-full border ${av.pill}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${av.dot}`} />
      {av.label}
    </span>
  )

  if (!canEdit) return pill

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1 rounded-full border transition-opacity hover:opacity-80 ${av.pill}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${av.dot}`} />
        {av.label}
        <ChevronDown size={9} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-30 bg-surface-2 border border-hairline rounded-xl shadow-2xl py-1.5 min-w-[148px]">
          {(Object.keys(AVAILABILITY) as AvailabilityStatus[]).map(s => {
            const a = AVAILABILITY[s]
            return (
              <button
                key={s}
                onClick={() => { onChange(s); setOpen(false) }}
                className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2.5 hover:bg-surface-3 transition-colors ${s === current ? 'text-ink font-semibold' : 'text-ink-subtle'}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${a.dot}`} />
                {a.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── SortDropdown ───────────────────────────────────────────────────────────────

function SortDropdown({ mode, onChange }: { mode: SortMode; onChange: (m: SortMode) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-2 hover:bg-surface-3 border border-hairline rounded-lg text-xs text-ink-muted transition-colors"
      >
        {SORT_LABELS[mode]}
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 bg-surface-2 border border-hairline rounded-xl shadow-2xl py-1.5 min-w-[148px]">
          {(Object.keys(SORT_LABELS) as SortMode[]).map(m => (
            <button
              key={m}
              onClick={() => { onChange(m); setOpen(false) }}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-surface-3 transition-colors ${m === mode ? 'text-ink font-semibold' : 'text-ink-subtle'}`}
            >
              {SORT_LABELS[m]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── SVG CircleGauge ────────────────────────────────────────────────────────────

function CircleGauge({ pct, label, sublabel }: { pct: number; label: string; sublabel: string }) {
  const clamped = Math.min(pct, 100)
  const r = 34
  const circ = 2 * Math.PI * r
  const dash = (clamped / 100) * circ
  const color = loadColor(pct)

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <svg width="88" height="88" className="-rotate-90" style={{ display: 'block' }}>
          <circle cx="44" cy="44" r={r} fill="none" stroke="#1f2937" strokeWidth="7" />
          <circle
            cx="44" cy="44" r={r} fill="none"
            stroke={color} strokeWidth="7"
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.5s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-sm font-bold ${loadTextCls(pct)}`}>{clamped}%</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-xs font-semibold text-ink-muted">{label}</p>
        <p className="text-[10px] text-ink-subtle mt-0.5">{sublabel}</p>
      </div>
    </div>
  )
}

// ── NoteEditor ─────────────────────────────────────────────────────────────────

function NoteEditor({ note, canEdit, onSave }: {
  note: string; canEdit: boolean; onSave: (n: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(note)

  useEffect(() => { setDraft(note) }, [note])

  if (!canEdit && !note) return null

  return (
    <div className="bg-surface-2 border border-hairline rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <StickyNote size={12} className="text-ink-subtle" />
          <span className="text-[10px] font-semibold text-ink-subtle uppercase tracking-widest">Lead Note</span>
        </div>
        {canEdit && !editing && (
          <button onClick={() => setEditing(true)} className="text-ink-subtle hover:text-ink-muted transition-colors">
            <Pencil size={12} />
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={2}
            placeholder="e.g. Covering for David this week · On rotation until Friday"
            autoFocus
            className="w-full bg-surface-2 border border-hairline rounded-lg px-3 py-2 text-xs text-ink placeholder-subtle focus:outline-none focus:border-primary resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={() => { onSave(draft); setEditing(false) }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-white text-xs font-medium rounded-lg transition-colors"
            >
              <Check size={11} /> Save
            </button>
            <button
              onClick={() => { setDraft(note); setEditing(false) }}
              className="px-3 py-1.5 bg-surface-3 hover:bg-surface-3 text-ink-muted text-xs rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : note ? (
        <p className="text-xs text-ink-muted leading-relaxed">{note}</p>
      ) : (
        <button onClick={() => setEditing(true)} className="text-xs text-ink-subtle hover:text-ink-muted transition-colors italic">
          Add a note about this member…
        </button>
      )}
    </div>
  )
}

// ── TaskDetailCard ─────────────────────────────────────────────────────────────

function TaskDetailCard({ task, memberId, canEdit, canManage, onStatusUpdate, onDeleteTask }: {
  task: SupervisorTask; memberId: string; canEdit: boolean; canManage: boolean
  onStatusUpdate: (id: string, s: string) => void; onDeleteTask: (id: string) => void
}) {
  const isOverdue = task.isOverdue && task.status !== 'completed'
  const isDone = task.status === 'completed'

  const startMs = new Date(task.startDate).getTime()
  const dueMs   = new Date(task.dueDate).getTime()
  const nowMs   = Date.now()
  const span    = dueMs - startMs
  const elapsed = Math.min(Math.max(((nowMs - startMs) / span) * 100, 0), 100)
  const daysLeft = Math.ceil((dueMs - nowMs) / 86_400_000)

  const coAssignees = task.assignees.filter(a => a.memberId !== memberId)

  return (
    <div className={`bg-surface-1 border rounded-xl p-4 space-y-3 transition-all ${
      isDone      ? 'border-hairline opacity-55' :
      isOverdue   ? 'border-red-900/50 bg-red-950/10' :
                    'border-hairline hover:border-hairline'
    }`}>
      {/* Top row */}
      <div className="flex items-start gap-3">
        <span className={`flex-shrink-0 text-[10px] px-2 py-1 rounded-md font-bold mt-0.5 ${SIZE_STYLES[task.size]}`}>
          {task.size}
        </span>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium leading-snug ${isDone ? 'line-through text-ink-subtle' : 'text-ink'}`}>
            {task.title}
          </p>
          {task.description && (
            <p className="text-xs text-ink-subtle mt-1.5 leading-relaxed">{task.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
          <StatusDropdown taskId={task.id} current={task.status} onUpdate={onStatusUpdate} canEdit={canEdit} />
          {canManage && (
            <button onClick={() => onDeleteTask(task.id)} className="text-ink-subtle hover:text-red-400 transition-colors p-0.5">
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Co-assignees */}
      {coAssignees.length > 0 && (
        <div className="flex items-center gap-1.5">
          <Users size={10} className="text-ink-subtle" />
          <span className="text-[10px] text-ink-subtle">Shared with {coAssignees.map(a => a.memberName).join(', ')}</span>
        </div>
      )}

      {/* Timeline */}
      {!isDone && (
        <div className="space-y-1.5 pt-0.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Calendar size={10} className="text-ink-subtle" />
              <span className="text-[10px] text-ink-subtle">{task.startDate} → {task.dueDate}</span>
            </div>
            <span className={`text-[10px] font-semibold ${
              isOverdue              ? 'text-red-400' :
              daysLeft <= 2          ? 'text-amber-400' :
                                       'text-ink-subtle'
            }`}>
              {isOverdue ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? 'Due today' : `${daysLeft}d left`}
            </span>
          </div>
          <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${isOverdue ? 'bg-red-500' : elapsed >= 80 ? 'bg-amber-500' : 'bg-primary'}`}
              style={{ width: `${elapsed}%` }}
            />
          </div>
        </div>
      )}

      {isDone && (
        <div className="flex items-center gap-1.5">
          <CheckCircle2 size={11} className="text-emerald-500" />
          <span className="text-[10px] text-emerald-600">Completed · was due {task.dueDate}</span>
        </div>
      )}

      {task.status === 'extended' && !isDone && (
        <div className="flex items-center gap-1.5">
          <AlertTriangle size={10} className="text-amber-500" />
          <span className="text-[10px] text-amber-500 font-medium">Due date has been extended</span>
        </div>
      )}
    </div>
  )
}

// ── MemberDetail ───────────────────────────────────────────────────────────────

interface MemberDetailProps {
  member: TeamMember
  tasks: SupervisorTask[]
  isCurrentUser: boolean
  canManage: boolean
  avStatus: AvailabilityStatus
  note: string
  onBack: () => void
  onStatusUpdate: (id: string, s: string) => void
  onDeleteTask: (id: string) => void
  onSetAvailability: (id: string, s: AvailabilityStatus) => void
  onSaveNote: (id: string, n: string) => void
  onAssign: () => void
}

function MemberDetail({
  member, tasks, isCurrentUser, canManage, avStatus, note,
  onBack, onStatusUpdate, onDeleteTask, onSetAvailability, onSaveNote, onAssign,
}: MemberDetailProps) {
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('all')

  const tickets    = MOCK_OPS[member.name] ?? []
  const memberTasks = tasks.filter(t => t.assignees.some(a => a.memberId === member.id))
  const activeTasks    = memberTasks.filter(t => t.status !== 'completed')
  const completedTasks = memberTasks.filter(t => t.status === 'completed')
  const overdueTasks   = memberTasks.filter(t => t.isOverdue && t.status !== 'completed')

  const opsPct  = Math.min(getOpsLoad(tickets), 120)
  const projPct = Math.min(getProjectLoad(memberTasks), 120)
  const badge   = capacityBadge(opsPct, projPct, overdueTasks.length > 0)
  const canEdit = canManage || isCurrentUser
  const combined = Math.min(Math.round((Math.min(opsPct, 100) + Math.min(projPct, 100)) / 2), 100)
  const av = AVAILABILITY[avStatus]

  const filteredTasks = memberTasks
    .filter(t => {
      if (taskFilter === 'active')    return t.status !== 'completed'
      if (taskFilter === 'overdue')   return t.isOverdue && t.status !== 'completed'
      if (taskFilter === 'completed') return t.status === 'completed'
      return true
    })
    .sort((a, b) => {
      if (a.status === 'completed' && b.status !== 'completed') return 1
      if (a.status !== 'completed' && b.status === 'completed') return -1
      if (a.isOverdue && !b.isOverdue) return -1
      if (!a.isOverdue && b.isOverdue)  return 1
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    })

  const FILTER_LABELS: Record<TaskFilter, string> = {
    all: 'All', active: 'Active', overdue: 'Overdue', completed: 'Completed',
  }

  return (
    <div className="flex flex-col h-full bg-surface-1 rounded-xl border border-hairline overflow-hidden">
      {/* ── Header ── */}
      <div className="flex-shrink-0 border-b border-hairline px-6 pt-5 pb-5 space-y-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[11px] text-ink-subtle hover:text-ink-muted transition-colors group w-fit"
        >
          <ChevronLeft size={13} className="group-hover:-translate-x-0.5 transition-transform" />
          Team Workload
        </button>

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Avatar with availability ring */}
            <div className="relative flex-shrink-0">
              <div
                className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-lg shadow-lg"
                style={{ boxShadow: `0 0 0 2px #111827, 0 0 0 4px ${av.stroke ?? '#10b981'}40` }}
              >
                {getInitials(member.name)}
              </div>
              <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-surface-1 ${av.dot}`} />
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-semibold text-ink">{member.name}</h2>
                {isCurrentUser && (
                  <span className="text-[9px] bg-blue-900/50 text-blue-400 border border-blue-800 px-1.5 py-0.5 rounded font-medium">you</span>
                )}
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>{badge.label}</span>
              </div>
              <p className="text-[11px] text-ink-subtle mt-0.5 uppercase tracking-widest">{member.teamId?.toUpperCase()} Team</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <AvailabilityPicker
              memberId={member.id}
              current={avStatus}
              canEdit={canManage || isCurrentUser}
              onChange={s => onSetAvailability(member.id, s)}
            />
            {canManage && (
              <button
                onClick={onAssign}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-white text-xs font-medium rounded-lg transition-colors"
              >
                <Plus size={12} />
                Assign Task
              </button>
            )}
          </div>
        </div>

        {/* Stat pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { label: 'Active',    value: activeTasks.length,    cls: 'text-ink' },
            { label: 'Completed', value: completedTasks.length,  cls: 'text-emerald-400' },
            { label: 'Overdue',   value: overdueTasks.length,    cls: overdueTasks.length > 0 ? 'text-red-400' : 'text-ink-subtle' },
            { label: 'Ops Open',  value: tickets.filter(t => t.status !== 'in_progress').length, cls: 'text-orange-400' },
            { label: 'Ops Live',  value: tickets.filter(t => t.status === 'in_progress').length, cls: 'text-red-400' },
          ].map(p => (
            <div key={p.label} className="flex items-center gap-2 bg-surface-2 border border-hairline rounded-lg px-3 py-1.5">
              <span className={`text-sm font-bold ${p.cls}`}>{p.value}</span>
              <span className="text-[10px] text-ink-subtle">{p.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

        {/* Capacity */}
        <section>
          <p className="text-[10px] font-semibold text-ink-subtle uppercase tracking-widest mb-3">Capacity</p>
          <div className="bg-surface-2 border border-hairline rounded-xl overflow-hidden">
            <div className="grid grid-cols-3 divide-x divide-hairline">
              <div className="flex flex-col items-center py-7 px-4">
                <CircleGauge
                  pct={Math.min(opsPct, 100)}
                  label="Ops Load"
                  sublabel={`${tickets.length} ticket${tickets.length !== 1 ? 's' : ''}`}
                />
              </div>
              <div className="flex flex-col items-center py-7 px-4">
                <CircleGauge
                  pct={Math.min(projPct, 100)}
                  label="Project Load"
                  sublabel={`${activeTasks.length} active`}
                />
              </div>
              <div className="flex flex-col items-center py-7 px-4">
                <CircleGauge
                  pct={combined}
                  label="Combined"
                  sublabel="overall capacity"
                />
              </div>
            </div>
            <div className="border-t border-hairline px-5 py-2.5 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-surface-3 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${loadBarCls(combined)}`} style={{ width: `${combined}%` }} />
              </div>
              <span className="text-[10px] text-ink-subtle flex-shrink-0">50% ops · 50% project</span>
            </div>
          </div>
        </section>

        {/* Lead Note */}
        <NoteEditor
          note={note}
          canEdit={canManage}
          onSave={n => onSaveNote(member.id, n)}
        />

        {/* Project Tasks */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-semibold text-ink-subtle uppercase tracking-widest">
              Project Tasks
              <span className="ml-2 normal-case font-normal text-ink-subtle">({memberTasks.length} total)</span>
            </p>
            {/* Filter tabs */}
            <div className="flex items-center bg-surface-2 border border-hairline rounded-lg p-0.5">
              {(Object.keys(FILTER_LABELS) as TaskFilter[]).map(f => (
                <button
                  key={f}
                  onClick={() => setTaskFilter(f)}
                  className={`relative px-3 py-1 rounded-md text-[10px] font-medium capitalize transition-all ${
                    taskFilter === f ? 'bg-surface-3 text-ink shadow-sm' : 'text-ink-subtle hover:text-ink-muted'
                  }`}
                >
                  {FILTER_LABELS[f]}
                  {f === 'overdue' && overdueTasks.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[7px] flex items-center justify-center font-bold">
                      {overdueTasks.length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {filteredTasks.length === 0 ? (
            <div className="bg-surface-1 border border-hairline rounded-xl flex items-center justify-center h-20">
              <p className="text-sm text-ink-subtle">No {taskFilter === 'all' ? '' : taskFilter + ' '}tasks</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredTasks.map(task => (
                <TaskDetailCard
                  key={task.id}
                  task={task}
                  memberId={member.id}
                  canEdit={canEdit}
                  canManage={canManage}
                  onStatusUpdate={onStatusUpdate}
                  onDeleteTask={onDeleteTask}
                />
              ))}
            </div>
          )}
        </section>

        {/* Ops Tickets */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-semibold text-ink-subtle uppercase tracking-widest">Ops Tickets</p>
            <span className="text-[9px] text-ink-subtle italic">sample data</span>
          </div>
          {tickets.length === 0 ? (
            <div className="bg-surface-1 border border-hairline rounded-xl flex items-center justify-center h-16">
              <p className="text-sm text-ink-subtle">No open tickets</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tickets.map(t => (
                <div key={t.id} className="bg-surface-1 border border-hairline rounded-xl px-4 py-3.5 flex items-start gap-3">
                  <span className={`flex-shrink-0 w-2 h-2 rounded-full mt-1.5 ${PRIORITY_DOT[t.priority]}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink-muted leading-snug">{t.title}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-[10px] text-ink-subtle uppercase tracking-wide">
                        {t.type === 'liveops' ? 'LiveOps' : 'DevOps'}
                      </span>
                      <span className={`text-[10px] font-bold uppercase ${PRIORITY_TEXT[t.priority]}`}>{t.priority}</span>
                    </div>
                  </div>
                  <span className={`flex-shrink-0 text-[10px] px-2.5 py-1 rounded-full font-medium ${
                    t.status === 'in_progress' ? 'bg-blue-900/40 text-blue-400' : 'bg-surface-3 text-ink-subtle'
                  }`}>
                    {t.status === 'in_progress' ? 'In Progress' : 'Open'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

// ── MemberCard (overview grid) ─────────────────────────────────────────────────

function MemberCard({ member, tasks, isCurrentUser, avStatus, note, onSelect }: {
  member: TeamMember; tasks: SupervisorTask[]; isCurrentUser: boolean
  avStatus: AvailabilityStatus; note: string; onSelect: () => void
}) {
  const tickets    = MOCK_OPS[member.name] ?? []
  const memberTasks = tasks.filter(t => t.assignees.some(a => a.memberId === member.id))
  const active     = memberTasks.filter(t => t.status !== 'completed')
  const overdue    = memberTasks.filter(t => t.isOverdue && t.status !== 'completed')
  const completed  = memberTasks.filter(t => t.status === 'completed')
  const opsPct     = Math.min(getOpsLoad(tickets), 120)
  const projPct    = Math.min(getProjectLoad(memberTasks), 120)
  const badge      = capacityBadge(opsPct, projPct, overdue.length > 0)
  const load       = combinedLoad(member, tasks)
  const av         = AVAILABILITY[avStatus]

  return (
    <button
      onClick={onSelect}
      className={`group text-left w-full bg-surface-1 border rounded-xl overflow-hidden transition-all duration-150 hover:shadow-xl ${
        isCurrentUser
          ? 'border-blue-700/50 shadow-blue-900/10 shadow-md hover:border-blue-600/70'
          : 'border-hairline hover:border-hairline'
      }`}
    >
      {/* Top accent bar */}
      <div
        className="h-0.5 w-full transition-all"
        style={{ background: overdue.length > 0 ? '#ef4444' : opsPct >= 75 || projPct >= 75 ? '#f59e0b' : '#10b981', opacity: 0.6 }}
      />

      <div className="p-4 space-y-3.5">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="relative flex-shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-semibold text-xs shadow-md">
              {getInitials(member.name)}
            </div>
            <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-surface-1 ${av.dot}`} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-sm font-semibold text-ink truncate">{member.name}</p>
              {isCurrentUser && (
                <span className="text-[8px] bg-blue-900/50 text-blue-400 border border-blue-800 px-1 py-0.5 rounded font-medium flex-shrink-0">you</span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] text-ink-subtle uppercase tracking-wide">{member.teamId?.toUpperCase()}</span>
              <span className="text-ink-subtle">·</span>
              <span className={`text-[10px] font-medium ${av.dot.replace('bg-', 'text-').replace('-500', '-400')}`}>{av.label}</span>
            </div>
          </div>

          <span className={`flex-shrink-0 text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${badge.cls}`}>{badge.label}</span>
        </div>

        {/* Note snippet */}
        {note && (
          <p className="text-[10px] text-ink-subtle italic leading-snug line-clamp-1 -mt-1 px-0.5">{note}</p>
        )}

        {/* Capacity bars */}
        <div className="space-y-2">
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <Ticket size={9} className="text-ink-subtle" />
                <span className="text-[10px] text-ink-subtle">Ops</span>
              </div>
              <span className={`text-[10px] font-semibold ${loadTextCls(opsPct)}`}>
                {Math.min(opsPct, 100)}% · {tickets.length}
              </span>
            </div>
            <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${loadBarCls(opsPct)}`} style={{ width: `${Math.min(opsPct, 100)}%` }} />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <Briefcase size={9} className="text-ink-subtle" />
                <span className="text-[10px] text-ink-subtle">Project</span>
              </div>
              <span className={`text-[10px] font-semibold ${loadTextCls(projPct)}`}>
                {Math.min(projPct, 100)}% · {active.length} active
              </span>
            </div>
            <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${loadBarCls(projPct)}`} style={{ width: `${Math.min(projPct, 100)}%` }} />
            </div>
          </div>
        </div>

        {/* Footer row */}
        <div className="flex items-center justify-between pt-0.5 border-t border-hairline">
          <div className="flex items-center gap-3">
            {overdue.length > 0 && (
              <div className="flex items-center gap-1">
                <AlertTriangle size={10} className="text-red-400" />
                <span className="text-[10px] text-red-400 font-medium">{overdue.length} overdue</span>
              </div>
            )}
            {completed.length > 0 && (
              <div className="flex items-center gap-1">
                <CheckCircle2 size={10} className="text-emerald-600" />
                <span className="text-[10px] text-ink-subtle">{completed.length} done</span>
              </div>
            )}
            {active.length === 0 && tickets.length === 0 && (
              <span className="text-[10px] text-ink-subtle">No active workload</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`text-xs font-bold ${loadTextCls(load)}`}>{load}%</span>
            <span className="text-[10px] text-ink-subtle group-hover:text-ink-muted transition-colors">View →</span>
          </div>
        </div>
      </div>
    </button>
  )
}

// ── AssignTaskModal ────────────────────────────────────────────────────────────

function AssignTaskModal({ members, createdBy, onClose, onCreated }: {
  members: TeamMember[]; createdBy: string
  onClose: () => void; onCreated: (t: SupervisorTask) => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [size, setSize] = useState<'S' | 'M' | 'L'>('M')
  const [startDate, setStartDate] = useState(today)
  const [dueDate, setDueDate] = useState('')
  const [assigneeIds, setAssigneeIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function toggleAssignee(id: string) {
    setAssigneeIds(p => p.includes(id) ? p.filter(x => x !== id) : p.length < 2 ? [...p, id] : p)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim())          return setError('Title is required')
    if (!dueDate)               return setError('Due date is required')
    if (!assigneeIds.length)    return setError('Assign at least one member')
    setError(''); setSaving(true)
    try {
      const task = await api.createWorkloadTask({
        title: title.trim(), description: description.trim() || null,
        size, start_date: startDate, due_date: dueDate,
        assignee_ids: assigneeIds, created_by: createdBy,
      })
      onCreated(task)
    } catch { setError('Failed to create task') } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-surface-1 border border-hairline rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-hairline">
          <h2 className="text-sm font-semibold text-ink">Assign Project Task</h2>
          <button onClick={onClose} className="text-ink-subtle hover:text-ink-muted transition-colors"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1.5">Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Power Platform POC integration"
              className="w-full bg-surface-2 border border-hairline rounded-lg px-3 py-2 text-sm text-ink placeholder-subtle focus:outline-none focus:border-primary" />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1.5">Description <span className="text-ink-subtle">(optional)</span></label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="What needs to be done..."
              className="w-full bg-surface-2 border border-hairline rounded-lg px-3 py-2 text-sm text-ink placeholder-subtle focus:outline-none focus:border-primary resize-none" />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1.5">Size</label>
            <div className="flex gap-2">
              {(['S', 'M', 'L'] as const).map(s => (
                <button key={s} type="button" onClick={() => setSize(s)}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-colors ${size === s ? 'bg-primary border-primary text-white' : 'bg-surface-2 border-hairline text-ink-subtle hover:border-hairline'}`}>
                  {s}
                  <span className="block text-[9px] font-normal mt-0.5 opacity-60">
                    {s === 'S' ? '~1 day' : s === 'M' ? '2–3 days' : '~1 week+'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1.5">Start</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full bg-surface-2 border border-hairline rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1.5">Due</label>
              <input type="date" value={dueDate} min={startDate} onChange={e => setDueDate(e.target.value)}
                className="w-full bg-surface-2 border border-hairline rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-primary" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-muted mb-1.5">Assign To <span className="text-ink-subtle">(max 2)</span></label>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {members.map(m => {
                const sel = assigneeIds.includes(m.id)
                const dis = !sel && assigneeIds.length >= 2
                return (
                  <label key={m.id} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                    sel ? 'bg-primary/20 border border-primary/50' : 'bg-surface-2 border border-transparent hover:border-hairline'
                  } ${dis ? 'opacity-40 cursor-not-allowed' : ''}`}>
                    <input type="checkbox" checked={sel} disabled={dis} onChange={() => toggleAssignee(m.id)} className="accent-primary" />
                    <div className="w-5 h-5 rounded bg-primary flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">
                      {getInitials(m.name)}
                    </div>
                    <span className="text-xs text-ink-muted">{m.name}</span>
                    <span className="text-[10px] text-ink-subtle ml-auto">{m.teamId?.toUpperCase()}</span>
                  </label>
                )
              })}
            </div>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg text-sm text-ink-muted bg-surface-2 hover:bg-surface-3 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-primary hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {saving ? 'Assigning…' : 'Assign Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Team Health Mini-viz ───────────────────────────────────────────────────────

function TeamHealthBar({ members, tasks, avGet }: {
  members: TeamMember[]; tasks: SupervisorTask[]; avGet: (id: string) => AvailabilityStatus
}) {
  if (members.length === 0) return null
  const loads = members.map(m => combinedLoad(m, tasks))
  const avg = Math.round(loads.reduce((a, b) => a + b, 0) / loads.length)
  const atRisk = loads.filter(l => l >= 75).length
  const onLeave = members.filter(m => avGet(m.id) === 'on_leave').length

  return (
    <div className="flex items-center gap-5 mt-4 flex-wrap">
      {/* Avg load badge */}
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: loadColor(avg) }} />
        <span className={`text-xs font-semibold ${loadTextCls(avg)}`}>{avg}% avg load</span>
      </div>
      <div className="flex items-center gap-2">
        <div className={`w-1.5 h-1.5 rounded-full ${atRisk > 0 ? 'bg-amber-500' : 'bg-surface-3'}`} />
        <span className={`text-xs ${atRisk > 0 ? 'text-amber-400' : 'text-ink-subtle'}`}>{atRisk} at risk</span>
      </div>
      {onLeave > 0 && (
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          <span className="text-xs text-amber-400">{onLeave} on leave</span>
        </div>
      )}
      {/* Mini load bars */}
      <div className="flex items-end gap-1.5 h-6 ml-2">
        {members.map((m, i) => {
          const l = loads[i]
          const av = avGet(m.id)
          return (
            <div key={m.id} className="flex flex-col items-center gap-0.5" title={`${m.name}: ${l}%`}>
              <div className="w-4 h-4 bg-surface-3 rounded-sm overflow-hidden flex flex-col justify-end">
                <div
                  className={`w-full rounded-sm transition-all ${av === 'on_leave' ? 'bg-amber-500' : loadBarCls(l)}`}
                  style={{ height: `${l}%` }}
                />
              </div>
              <span className="text-[7px] text-ink-subtle leading-none">{getInitials(m.name)}</span>
            </div>
          )
        })}
      </div>
      <div className="flex items-center gap-1.5 ml-auto">
        <Clock size={10} className="text-ink-subtle" />
        <span className="text-[10px] text-ink-subtle">Ops tickets: sample data</span>
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function Workload() {
  const { currentUser } = useAppContext()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [tasks, setTasks] = useState<SupervisorTask[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [sortMode, setSortMode] = useState<SortMode>('load_desc')

  const av    = useAvailability()
  const notes = useNotes()
  const canManage = currentUser?.role === 'lead' || currentUser?.role === 'head'

  useEffect(() => {
    setLoading(true)
    Promise.all([api.getAllMembers(), api.getWorkloadTasks()])
      .then(([m, t]) => { setMembers(m); setTasks(t) })
      .finally(() => setLoading(false))
  }, [])

  async function handleStatusUpdate(taskId: string, status: string) {
    try {
      const updated = await api.updateWorkloadTaskStatus(taskId, status)
      setTasks(prev => prev.map(t => t.id === taskId ? updated : t))
    } catch { /* silent */ }
  }

  async function handleDelete(taskId: string) {
    if (!confirm('Remove this task?')) return
    try {
      await api.deleteWorkloadTask(taskId)
      setTasks(prev => prev.filter(t => t.id !== taskId))
    } catch { /* silent */ }
  }

  const displayMembers = (currentUser?.teamId ? members.filter(m => m.teamId === currentUser.teamId) : members)
    .slice()
    .sort((a, b) => {
      if (sortMode === 'name')          return a.name.localeCompare(b.name)
      if (sortMode === 'overdue_first') {
        const ao = tasks.filter(t => t.isOverdue && t.status !== 'completed' && t.assignees.some(x => x.memberId === a.id)).length
        const bo = tasks.filter(t => t.isOverdue && t.status !== 'completed' && t.assignees.some(x => x.memberId === b.id)).length
        return bo - ao
      }
      return combinedLoad(b, tasks) - combinedLoad(a, tasks)
    })

  // Current-user always first
  const sorted = [
    ...displayMembers.filter(m => m.id === currentUser?.memberId),
    ...displayMembers.filter(m => m.id !== currentUser?.memberId),
  ]

  const selectedMember = selectedMemberId ? displayMembers.find(m => m.id === selectedMemberId) : null
  if (selectedMember) {
    return (
      <MemberDetail
        member={selectedMember}
        tasks={tasks}
        isCurrentUser={selectedMember.id === currentUser?.memberId}
        canManage={canManage}
        avStatus={av.get(selectedMember.id)}
        note={notes.get(selectedMember.id)}
        onBack={() => setSelectedMemberId(null)}
        onStatusUpdate={handleStatusUpdate}
        onDeleteTask={handleDelete}
        onSetAvailability={av.set}
        onSaveNote={notes.set}
        onAssign={() => setShowModal(true)}
      />
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-hairline px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-ink">Team Workload</h1>
            <p className="text-xs text-ink-subtle mt-0.5">Click a member card to see their full workload breakdown</p>
          </div>
          <div className="flex items-center gap-2">
            <SortDropdown mode={sortMode} onChange={setSortMode} />
            {canManage && (
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-white text-xs font-medium rounded-lg transition-colors"
              >
                <Plus size={13} />
                Assign Task
              </button>
            )}
          </div>
        </div>

        {!loading && (
          <TeamHealthBar members={displayMembers} tasks={tasks} avGet={av.get} />
        )}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <p className="text-sm text-ink-subtle">Loading workload…</p>
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex items-center justify-center h-40">
            <p className="text-sm text-ink-subtle">No team members found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {sorted.map(m => (
              <MemberCard
                key={m.id}
                member={m}
                tasks={tasks}
                isCurrentUser={m.id === currentUser?.memberId}
                avStatus={av.get(m.id)}
                note={notes.get(m.id)}
                onSelect={() => setSelectedMemberId(m.id)}
              />
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <AssignTaskModal
          members={displayMembers}
          createdBy={currentUser?.name ?? currentUser?.email ?? ''}
          onClose={() => setShowModal(false)}
          onCreated={task => { setTasks(prev => [task, ...prev]); setShowModal(false) }}
        />
      )}
    </div>
  )
}
