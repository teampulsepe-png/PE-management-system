import { useState, useEffect, useRef } from 'react'
import { ChevronDown, Check, Plus, Pencil, Trash2, AlertTriangle, Clock, CheckCircle, Infinity, FlaskConical } from 'lucide-react'
import { api } from '../api/teamPulseApi'
import type { TrackerArea, TrackerTask, TrackerSubtask } from '../types'

// ── Mock / preview data ────────────────────────────────────────────────────────

const MOCK_DATA: TrackerArea[] = [
  {
    id: 'm-a1', name: 'Governance & Compliance', sortOrder: 0,
    groups: [
      {
        id: 'm-g1', areaId: 'm-a1', name: 'ISO Programme', sortOrder: 0,
        tasks: [
          {
            id: 'm-t1', groupId: 'm-g1', title: 'ISO 27001 Recertification',
            owner: 'Chamila Perera', plannedEndDate: '2026-12-31', sortOrder: 0,
            subtasks: [
              { id: 'm-s1',  taskId: 'm-t1', title: 'Gap analysis & scoping',        date: '2026-08-15', remarks: 'Completed by internal team', isDone: true,  sortOrder: 0 },
              { id: 'm-s2',  taskId: 'm-t1', title: 'Internal audit preparation',     date: '2026-10-30', remarks: null,                        isDone: false, sortOrder: 1 },
              { id: 'm-s3',  taskId: 'm-t1', title: 'Corrective action plan',         date: '2026-11-15', remarks: null,                        isDone: false, sortOrder: 2 },
              { id: 'm-s4',  taskId: 'm-t1', title: 'Certification audit',            date: '2026-12-20', remarks: null,                        isDone: false, sortOrder: 3 },
            ],
          },
          {
            id: 'm-t2', groupId: 'm-g1', title: 'External Compliance Review',
            owner: 'Nimal Fernando', plannedEndDate: '2026-10-15', sortOrder: 1,
            subtasks: [
              { id: 'm-s5',  taskId: 'm-t2', title: 'Vendor questionnaire dispatch',  date: '2026-09-30', remarks: 'Pending legal sign-off', isDone: false, sortOrder: 0 },
              { id: 'm-s6',  taskId: 'm-t2', title: 'Document submission to auditor', date: '2026-10-05', remarks: null,                    isDone: false, sortOrder: 1 },
              { id: 'm-s7',  taskId: 'm-t2', title: 'Review sign-off',                date: '2026-10-15', remarks: null,                    isDone: false, sortOrder: 2 },
            ],
          },
        ],
      },
      {
        id: 'm-g2', areaId: 'm-a1', name: 'Risk Management', sortOrder: 1,
        tasks: [
          {
            id: 'm-t3', groupId: 'm-g2', title: 'Annual Risk Register Update',
            owner: 'Ruwan Silva', plannedEndDate: null, sortOrder: 0,
            subtasks: [
              { id: 'm-s8',  taskId: 'm-t3', title: 'IT risk assessment',        date: null, remarks: 'Done — no new critical risks', isDone: true,  sortOrder: 0 },
              { id: 'm-s9',  taskId: 'm-t3', title: 'Operational risk review',   date: null, remarks: null,                          isDone: false, sortOrder: 1 },
              { id: 'm-s10', taskId: 'm-t3', title: 'Board presentation',        date: null, remarks: null,                          isDone: false, sortOrder: 2 },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'm-a2', name: 'Digital Transformation', sortOrder: 1,
    groups: [
      {
        id: 'm-g3', areaId: 'm-a2', name: 'Cloud Migration', sortOrder: 0,
        tasks: [
          {
            id: 'm-t4', groupId: 'm-g3', title: 'Phase 1 — Core Infrastructure',
            owner: 'Kasun Jayawardena', plannedEndDate: '2027-03-31', sortOrder: 0,
            subtasks: [
              { id: 'm-s11', taskId: 'm-t4', title: 'Architecture design',          date: null, remarks: 'Approved by CTO',    isDone: true,  sortOrder: 0 },
              { id: 'm-s12', taskId: 'm-t4', title: 'Dev environment setup',         date: null, remarks: null,                isDone: true,  sortOrder: 1 },
              { id: 'm-s13', taskId: 'm-t4', title: 'Staging environment setup',     date: null, remarks: null,                isDone: true,  sortOrder: 2 },
              { id: 'm-s14', taskId: 'm-t4', title: 'Data migration (non-prod)',     date: null, remarks: null,                isDone: false, sortOrder: 3 },
              { id: 'm-s15', taskId: 'm-t4', title: 'Production deployment',         date: null, remarks: null,                isDone: false, sortOrder: 4 },
              { id: 'm-s16', taskId: 'm-t4', title: 'UAT & sign-off',               date: null, remarks: null,                isDone: false, sortOrder: 5 },
            ],
          },
          {
            id: 'm-t5', groupId: 'm-g3', title: 'Legacy System Decommission',
            owner: 'Priya Mendis', plannedEndDate: '2026-08-31', sortOrder: 1,
            subtasks: [
              { id: 'm-s17', taskId: 'm-t5', title: 'Identify dependent services',   date: null, remarks: null,                              isDone: true,  sortOrder: 0 },
              { id: 'm-s18', taskId: 'm-t5', title: 'Migrate all data',             date: null, remarks: 'Blocked — DB schema conflict',     isDone: false, sortOrder: 1 },
              { id: 'm-s19', taskId: 'm-t5', title: 'Decommission approval',         date: null, remarks: null,                              isDone: false, sortOrder: 2 },
              { id: 'm-s20', taskId: 'm-t5', title: 'System shutdown',              date: null, remarks: null,                              isDone: false, sortOrder: 3 },
            ],
          },
        ],
      },
      {
        id: 'm-g4', areaId: 'm-a2', name: 'Automation', sortOrder: 1,
        tasks: [
          {
            id: 'm-t6', groupId: 'm-g4', title: 'Incident Response Automation',
            owner: 'Dilshan Ratnayake', plannedEndDate: '2026-10-05', sortOrder: 0,
            subtasks: [
              { id: 'm-s21', taskId: 'm-t6', title: 'Playbook design',              date: null, remarks: 'Reviewed and signed off', isDone: true,  sortOrder: 0 },
              { id: 'm-s22', taskId: 'm-t6', title: 'Tool integration (PagerDuty)', date: null, remarks: null,                     isDone: false, sortOrder: 1 },
              { id: 'm-s23', taskId: 'm-t6', title: 'Test scenarios',               date: null, remarks: null,                     isDone: false, sortOrder: 2 },
              { id: 'm-s24', taskId: 'm-t6', title: 'Pilot run',                   date: null, remarks: null,                     isDone: false, sortOrder: 3 },
              { id: 'm-s25', taskId: 'm-t6', title: 'Full rollout',                date: null, remarks: null,                     isDone: false, sortOrder: 4 },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'm-a3', name: 'Capability Development', sortOrder: 2,
    groups: [
      {
        id: 'm-g5', areaId: 'm-a3', name: 'Team Training', sortOrder: 0,
        tasks: [
          {
            id: 'm-t7', groupId: 'm-g5', title: 'Security Awareness Programme',
            owner: 'Nilufar Srinivasan', plannedEndDate: null, sortOrder: 0,
            subtasks: [
              { id: 'm-s26', taskId: 'm-t7', title: 'Q1 training sessions (Mar)',   date: null, remarks: '62 staff completed', isDone: true,  sortOrder: 0 },
              { id: 'm-s27', taskId: 'm-t7', title: 'Q2 training sessions (Jun)',   date: null, remarks: '58 staff completed', isDone: true,  sortOrder: 1 },
              { id: 'm-s28', taskId: 'm-t7', title: 'Q3 training sessions (Sep)',   date: null, remarks: 'In progress',        isDone: true,  sortOrder: 2 },
              { id: 'm-s29', taskId: 'm-t7', title: 'Q4 training sessions (Dec)',   date: null, remarks: null,                 isDone: false, sortOrder: 3 },
            ],
          },
          {
            id: 'm-t8', groupId: 'm-g5', title: 'Agile Transformation Rollout',
            owner: 'Marcus Lee', plannedEndDate: '2026-11-30', sortOrder: 1,
            subtasks: [
              { id: 'm-s30', taskId: 'm-t8', title: 'Scrum master training',        date: null, remarks: 'All leads certified',   isDone: true, sortOrder: 0 },
              { id: 'm-s31', taskId: 'm-t8', title: 'Team coaching sessions',       date: null, remarks: '8 sprints completed',   isDone: true, sortOrder: 1 },
              { id: 'm-s32', taskId: 'm-t8', title: 'Process documentation',        date: null, remarks: null,                    isDone: true, sortOrder: 2 },
              { id: 'm-s33', taskId: 'm-t8', title: 'Retrospective framework',      date: null, remarks: null,                    isDone: true, sortOrder: 3 },
            ],
          },
        ],
      },
    ],
  },
]

// ── Status system ──────────────────────────────────────────────────────────────

type Status = 'complete' | 'on_track' | 'at_risk' | 'overdue' | 'ongoing'

const STATUS_CFG = {
  complete: {
    label: 'Complete',   icon: CheckCircle,
    border: '#10b981',   bar: '#10b981',   barBg: '#d1fae5',  faint: '#f0fdf4',
    pill:   'bg-success/10 text-success ring-1 ring-success/30',
    dot:    'bg-success',  text: 'text-success',
  },
  on_track: {
    label: 'On Track',   icon: Clock,
    border: '#5e6ad2',   bar: '#5e6ad2',   barBg: '#23252a',  faint: '#0f1011',
    pill:   'bg-primary/10 text-primary-hover ring-1 ring-primary/30',
    dot:    'bg-primary',     text: 'text-primary-hover',
  },
  at_risk: {
    label: 'At Risk',    icon: AlertTriangle,
    border: '#f59e0b',   bar: '#f59e0b',   barBg: '#23252a',  faint: '#0f1011',
    pill:   'bg-amber-900/20 text-amber-400 ring-1 ring-amber-500/30',
    dot:    'bg-amber-500',    text: 'text-amber-400',
  },
  overdue: {
    label: 'Overdue',    icon: AlertTriangle,
    border: '#ef4444',   bar: '#ef4444',   barBg: '#23252a',  faint: '#0f1011',
    pill:   'bg-red-900/20 text-red-400 ring-1 ring-red-900/40',
    dot:    'bg-red-500',      text: 'text-red-400',
  },
  ongoing: {
    label: 'Ongoing',    icon: Infinity,
    border: '#8b5cf6',   bar: '#8b5cf6',   barBg: '#23252a',  faint: '#0f1011',
    pill:   'bg-violet-900/20 text-violet-400 ring-1 ring-violet-900/40',
    dot:    'bg-violet-500',   text: 'text-violet-400',
  },
} as const

function getStatus(task: TrackerTask): Status {
  const done  = task.subtasks.filter(s => s.isDone).length
  const total = task.subtasks.length
  if (total > 0 && done === total) return 'complete'
  if (!task.plannedEndDate) return 'ongoing'
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const due   = new Date(task.plannedEndDate + 'T00:00:00')
  const days  = Math.ceil((due.getTime() - today.getTime()) / 86_400_000)
  const pct   = total === 0 ? 0 : done / total
  if (days < 0) return 'overdue'
  if (days <= 30 && pct < 0.3) return 'at_risk'
  if (days <= 14 && pct < 0.7) return 'at_risk'
  return 'on_track'
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return ''
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function daysLeft(iso: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.ceil((new Date(iso + 'T00:00:00').getTime() - today.getTime()) / 86_400_000)
}

// ── SubtaskRow ─────────────────────────────────────────────────────────────────

function SubtaskRow({ subtask, accentColor, onUpdate, isMock }: {
  subtask: TrackerSubtask; accentColor: string
  onUpdate: (a: TrackerArea[]) => void; isMock: boolean
}) {
  const [editingNote, setEditingNote] = useState(false)
  const [note, setNote]               = useState(subtask.remarks ?? '')
  const noteRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setNote(subtask.remarks ?? '') }, [subtask.remarks])
  useEffect(() => { if (editingNote) noteRef.current?.focus() }, [editingNote])

  async function toggle() {
    if (isMock) return
    onUpdate(await api.updateTrackerSubtask(subtask.id, { is_done: !subtask.isDone }))
  }
  async function saveNote() {
    if (isMock) { setEditingNote(false); return }
    const val = note.trim() || null
    if (val === (subtask.remarks ?? null)) { setEditingNote(false); return }
    onUpdate(await api.updateTrackerSubtask(subtask.id, { remarks: val }))
    setEditingNote(false)
  }
  async function del() {
    if (isMock) return
    await api.deleteTrackerSubtask(subtask.id)
    onUpdate(await api.getTrackerAreas())
  }

  return (
    <div className="flex items-center gap-3 px-5 py-2.5 group/sub hover:bg-black/[0.02] transition-colors">
      <button
        onClick={toggle}
        className="flex-shrink-0 w-[18px] h-[18px] rounded-full border-[1.5px] flex items-center justify-center
                   transition-all duration-200 hover:scale-110"
        style={{ backgroundColor: subtask.isDone ? accentColor : 'transparent', borderColor: subtask.isDone ? accentColor : '#cbd5e1' }}
      >
        {subtask.isDone && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
      </button>

      <span className={`flex-1 text-sm transition-all duration-150 ${subtask.isDone ? 'line-through text-ink-subtle' : 'text-ink'}`}>
        {subtask.title}
      </span>

      <span className="flex-shrink-0 text-[11px] text-ink-subtle tabular-nums w-28 text-right">
        {subtask.date ? fmtDate(subtask.date) : '—'}
      </span>

      <div className="flex-shrink-0 w-52">
        {editingNote ? (
          <input
            ref={noteRef} value={note} onChange={e => setNote(e.target.value)}
            onBlur={saveNote}
            onKeyDown={e => { if (e.key === 'Enter') saveNote(); if (e.key === 'Escape') { setNote(subtask.remarks ?? ''); setEditingNote(false) } }}
            placeholder="Add remark…"
            className="w-full text-xs px-2.5 py-1 rounded-lg border border-hairline focus:outline-none focus:border-primary bg-surface-2 text-ink"
          />
        ) : (
          <button onClick={() => setEditingNote(true)} className="w-full text-left">
            {subtask.remarks
              ? <span className="text-xs text-ink-muted italic truncate block">{subtask.remarks}</span>
              : <span className="flex items-center gap-1 text-xs text-ink-subtle opacity-0 group-hover/sub:opacity-100 transition-opacity">
                  <Pencil className="w-2.5 h-2.5" /> Add remark
                </span>
            }
          </button>
        )}
      </div>

      <button
        onClick={del}
        className="flex-shrink-0 opacity-0 group-hover/sub:opacity-100 transition-opacity
                   p-1.5 rounded-lg text-ink-subtle hover:text-red-400 hover:bg-red-900/20 transition-colors"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  )
}

// ── AddSubtaskRow ──────────────────────────────────────────────────────────────

function AddSubtaskRow({ taskId, accentColor, onUpdate, onDone }: {
  taskId: string; accentColor: string
  onUpdate: (a: TrackerArea[]) => void; onDone: () => void
}) {
  const [title, setTitle] = useState('')
  const [date,  setDate]  = useState('')
  const [busy,  setBusy]  = useState(false)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { ref.current?.focus() }, [])

  async function submit() {
    if (!title.trim() || busy) return
    setBusy(true)
    onUpdate(await api.createTrackerSubtask(taskId, { title: title.trim(), date: date || null }))
    setTitle(''); setDate('')
    setBusy(false); onDone()
  }

  return (
    <div className="flex items-center gap-3 px-5 py-2.5 bg-surface-2">
      <div className="flex-shrink-0 w-[18px] h-[18px] rounded-full border-[1.5px] border-dashed" style={{ borderColor: accentColor + '60' }} />
      <input
        ref={ref} value={title} onChange={e => setTitle(e.target.value)} disabled={busy}
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onDone() }}
        placeholder="Subtask title…"
        className="flex-1 text-sm bg-transparent focus:outline-none placeholder-subtle text-ink"
      />
      <input type="date" value={date} onChange={e => setDate(e.target.value)} disabled={busy}
        className="text-xs bg-transparent focus:outline-none text-ink-subtle cursor-pointer w-28"
      />
      <div className="w-52 flex items-center gap-2">
        <button onClick={submit} disabled={!title.trim() || busy}
          className="text-xs font-semibold text-ink hover:text-ink disabled:opacity-30 transition-colors">Add</button>
        <span className="text-ink-subtle">·</span>
        <button onClick={onDone} className="text-xs text-ink-subtle hover:text-ink-muted transition-colors">Cancel</button>
      </div>
      <span className="w-7" />
    </div>
  )
}

// ── TaskCard ───────────────────────────────────────────────────────────────────

function TaskCard({ task, onUpdate, isMock }: {
  task: TrackerTask; onUpdate: (a: TrackerArea[]) => void; isMock: boolean
}) {
  const [expanded,  setExpanded]  = useState(false)
  const [addingSub, setAddingSub] = useState(false)
  const [editing,   setEditing]   = useState(false)
  const [eTitle,    setETitle]    = useState(task.title)
  const [eOwner,    setEOwner]    = useState(task.owner ?? '')
  const [eDate,     setEDate]     = useState(task.plannedEndDate ?? '')
  const eTitleRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editing) eTitleRef.current?.focus() }, [editing])

  const status = getStatus(task)
  const cfg    = STATUS_CFG[status]
  const Icon   = cfg.icon
  const done   = task.subtasks.filter(s => s.isDone).length
  const total  = task.subtasks.length
  const pct    = total === 0 ? 0 : Math.round((done / total) * 100)
  const days   = task.plannedEndDate ? daysLeft(task.plannedEndDate) : null

  async function del(e: React.MouseEvent) {
    e.stopPropagation()
    if (isMock) return
    await api.deleteTrackerTask(task.id)
    onUpdate(await api.getTrackerAreas())
  }
  async function saveEdit() {
    if (!eTitle.trim() || isMock) return
    onUpdate(await api.updateTrackerTask(task.id, { title: eTitle.trim(), owner: eOwner.trim() || null, planned_end_date: eDate || null }))
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="bg-surface-1 rounded-2xl border-2 border-hairline p-5 mb-3 shadow-sm">
        <div className="space-y-3">
          <input ref={eTitleRef} value={eTitle} onChange={e => setETitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(false) }}
            placeholder="Task name…"
            className="w-full text-sm font-semibold bg-surface-2 px-3 py-2 rounded-lg border border-hairline focus:outline-none focus:border-primary text-ink"
          />
          <div className="flex gap-2">
            <input value={eOwner} onChange={e => setEOwner(e.target.value)} placeholder="Owner (optional)"
              className="flex-1 text-xs px-3 py-2 bg-surface-2 border border-hairline rounded-lg focus:outline-none focus:border-primary placeholder-subtle text-ink-muted"
            />
            <input type="date" value={eDate} onChange={e => setEDate(e.target.value)}
              className="flex-1 text-xs px-3 py-2 bg-surface-2 border border-hairline rounded-lg focus:outline-none focus:border-primary text-ink-muted cursor-pointer"
            />
          </div>
          <p className="text-[10px] text-ink-subtle">Leave date empty for ongoing tasks</p>
          <div className="flex items-center gap-2">
            <button onClick={saveEdit} disabled={!eTitle.trim()}
              className="px-4 py-1.5 text-xs font-semibold bg-ink text-surface-1 rounded-lg disabled:opacity-40 hover:bg-ink/80 transition-colors">Save</button>
            <button onClick={() => setEditing(false)} className="text-xs text-ink-subtle hover:text-ink-muted px-2 py-1.5 transition-colors">Cancel</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="bg-surface-1 rounded-2xl border border-hairline mb-3 overflow-hidden
                 shadow-[0_1px_4px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.09)]
                 transition-all duration-200 group/card"
      style={{ borderLeft: `4px solid ${cfg.border}` }}
    >
      {/* Header */}
      <div className="px-5 pt-4 pb-4 cursor-pointer select-none" onClick={() => setExpanded(v => !v)}>

        {/* Top row: badge + urgency + actions */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full ${cfg.pill}`}>
              <Icon className="w-3 h-3" />
              {cfg.label}
            </span>
            {days !== null && status !== 'complete' && (
              <span className={`text-xs font-semibold tabular-nums ${
                days < 0 ? 'text-red-500' : days <= 14 ? 'text-amber-500' : 'text-ink-subtle'
              }`}>
                {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Due today' : `${days}d left`}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <div className="hidden group-hover/card:flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => { setETitle(task.title); setEOwner(task.owner ?? ''); setEDate(task.plannedEndDate ?? ''); setEditing(true) }}
                className="p-1.5 rounded-lg text-ink-subtle hover:text-ink-muted hover:bg-surface-2 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button onClick={del} className="p-1.5 rounded-lg text-ink-subtle hover:text-red-400 hover:bg-red-900/20 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <ChevronDown
              className="w-4 h-4 text-ink-subtle ml-0.5 transition-transform duration-200 flex-shrink-0"
              style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0)' }}
            />
          </div>
        </div>

        {/* Task name */}
        <p className="text-[15px] font-semibold text-ink leading-snug mb-2.5">{task.title}</p>

        {/* Meta */}
        <div className="flex items-center gap-2 mb-3.5 flex-wrap">
          {task.owner && (
            <span className="inline-flex items-center text-xs font-medium text-ink-muted bg-surface-3 px-2.5 py-1 rounded-full">
              {task.owner}
            </span>
          )}
          {task.plannedEndDate
            ? <span className="text-xs text-ink-subtle tabular-nums">{fmtDate(task.plannedEndDate)}</span>
            : <span className="text-xs font-medium" style={{ color: STATUS_CFG.ongoing.border }}>No deadline</span>
          }
        </div>

        {/* Progress */}
        {total > 0 ? (
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: cfg.barBg }}>
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${pct}%`, backgroundColor: cfg.bar }}
                />
              </div>
              <p className="text-[11px] text-ink-subtle mt-1.5">{done} of {total} subtasks complete</p>
            </div>
            <div className="flex-shrink-0 text-right">
              <span className="text-2xl font-black tabular-nums leading-none" style={{ color: cfg.bar }}>{pct}</span>
              <span className="text-sm font-bold" style={{ color: cfg.bar }}>%</span>
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-ink-subtle">No subtasks added</p>
        )}
      </div>

      {/* Subtask drawer */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${cfg.border}22`, backgroundColor: cfg.faint }}>
          {/* Column header */}
          <div className="flex items-center gap-3 px-5 py-2 border-b border-black/[0.04]">
            <span className="w-[18px] flex-shrink-0" />
            <span className="flex-1 text-[10px] font-semibold uppercase tracking-widest text-ink-subtle">Subtask</span>
            <span className="w-28 text-right text-[10px] font-semibold uppercase tracking-widest text-ink-subtle">Due</span>
            <span className="w-52 text-[10px] font-semibold uppercase tracking-widest text-ink-subtle">Remarks</span>
            <span className="w-7" />
          </div>
          <div className="divide-y divide-black/[0.03]">
            {task.subtasks.length === 0 && !addingSub && (
              <p className="px-5 py-3 text-xs text-ink-subtle italic">No subtasks yet</p>
            )}
            {task.subtasks.map(st => (
              <SubtaskRow key={st.id} subtask={st} accentColor={cfg.bar} onUpdate={onUpdate} isMock={isMock} />
            ))}
            {addingSub
              ? <AddSubtaskRow taskId={task.id} accentColor={cfg.bar} onUpdate={onUpdate} onDone={() => setAddingSub(false)} />
              : (
                <div className="px-5 py-2.5">
                  <button
                    onClick={e => { e.stopPropagation(); setAddingSub(true) }}
                    className="flex items-center gap-1.5 text-xs font-medium transition-colors"
                    style={{ color: cfg.bar }}
                  >
                    <Plus className="w-3 h-3" /> Add subtask
                  </button>
                </div>
              )
            }
          </div>
        </div>
      )}
    </div>
  )
}

// ── AddTaskForm ────────────────────────────────────────────────────────────────

function AddTaskForm({ groupId, onUpdate, onDone }: {
  groupId: string; onUpdate: (a: TrackerArea[]) => void; onDone: () => void
}) {
  const [title, setTitle] = useState('')
  const [owner, setOwner] = useState('')
  const [date,  setDate]  = useState('')
  const [busy,  setBusy]  = useState(false)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { ref.current?.focus() }, [])

  async function submit() {
    if (!title.trim() || busy) return
    setBusy(true)
    onUpdate(await api.createTrackerTask(groupId, { title: title.trim(), owner: owner.trim() || null, planned_end_date: date || null }))
    setBusy(false); onDone()
  }

  return (
    <div className="bg-surface-1 rounded-2xl border-2 border-dashed border-hairline p-4 mb-3">
      <div className="space-y-2.5">
        <input ref={ref} value={title} onChange={e => setTitle(e.target.value)} disabled={busy}
          onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onDone() }}
          placeholder="Task name…"
          className="w-full text-sm font-medium bg-surface-2 px-3 py-2 rounded-lg border border-hairline focus:outline-none focus:border-primary placeholder-subtle text-ink"
        />
        <div className="flex gap-2">
          <input value={owner} onChange={e => setOwner(e.target.value)} placeholder="Owner (optional)" disabled={busy}
            className="flex-1 text-xs px-3 py-2 bg-surface-2 border border-hairline rounded-lg focus:outline-none focus:border-primary placeholder-subtle text-ink-muted"
          />
          <input type="date" value={date} onChange={e => setDate(e.target.value)} disabled={busy}
            className="flex-1 text-xs px-3 py-2 bg-surface-2 border border-hairline rounded-lg focus:outline-none focus:border-primary text-ink-muted cursor-pointer"
          />
        </div>
        <p className="text-[10px] text-ink-subtle">Leave date empty for ongoing tasks (no deadline)</p>
        <div className="flex items-center gap-2">
          <button onClick={submit} disabled={!title.trim() || busy}
            className="px-4 py-1.5 text-xs font-semibold bg-ink text-surface-1 rounded-lg disabled:opacity-40 hover:bg-ink/80 transition-colors">
            Add Task
          </button>
          <button onClick={onDone} className="text-xs text-ink-subtle hover:text-ink-muted px-2 py-1.5 transition-colors">Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ── GroupSection ───────────────────────────────────────────────────────────────

function GroupSection({ group, onUpdate, isMock }: {
  group: { id: string; name: string; tasks: TrackerTask[] }
  onUpdate: (a: TrackerArea[]) => void; isMock: boolean
}) {
  const [addingTask, setAddingTask] = useState(false)
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2.5 mb-3">
        <span className="w-1.5 h-1.5 rounded-full bg-ink-subtle flex-shrink-0" />
        <span className="text-[11px] font-semibold uppercase tracking-widest text-ink-subtle">{group.name}</span>
        <div className="flex-1 h-px bg-hairline" />
      </div>
      {group.tasks.length === 0 && !addingTask && (
        <p className="text-xs text-ink-subtle italic mb-3 pl-4">No tasks yet</p>
      )}
      {group.tasks.map(task => <TaskCard key={task.id} task={task} onUpdate={onUpdate} isMock={isMock} />)}
      {!isMock && (
        addingTask
          ? <AddTaskForm groupId={group.id} onUpdate={onUpdate} onDone={() => setAddingTask(false)} />
          : <button onClick={() => setAddingTask(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-ink-subtle hover:text-ink-muted transition-colors py-1 pl-1">
              <Plus className="w-3.5 h-3.5" /> Add task
            </button>
      )}
    </div>
  )
}

// ── AreaSection ────────────────────────────────────────────────────────────────

function AreaSection({ area, ordinal, onUpdate, isMock }: {
  area: TrackerArea; ordinal: number; onUpdate: (a: TrackerArea[]) => void; isMock: boolean
}) {
  const [collapsed, setCollapsed] = useState(false)

  const tasks    = area.groups.flatMap(g => g.tasks)
  const subtasks = tasks.flatMap(t => t.subtasks)
  const doneSubs = subtasks.filter(s => s.isDone).length

  const counts = tasks.reduce(
    (acc, t) => { acc[getStatus(t)]++; return acc },
    { complete: 0, on_track: 0, at_risk: 0, overdue: 0, ongoing: 0 } as Record<Status, number>
  )
  const statusOrder: Status[] = ['overdue', 'at_risk', 'on_track', 'ongoing', 'complete']

  return (
    <div className="mb-12">
      <button onClick={() => setCollapsed(v => !v)} className="w-full flex items-center gap-4 mb-5 group/area text-left">
        <span className="text-sm font-black tabular-nums text-ink-subtle flex-shrink-0 w-7 text-right
                         group-hover/area:text-ink-muted transition-colors select-none">
          {String(ordinal).padStart(2, '0')}
        </span>
        <h2 className="text-xl font-bold tracking-tight text-ink">{area.name}</h2>
        <div className="flex items-center gap-1.5 ml-1">
          {statusOrder.map(s => counts[s] > 0 ? (
            <span key={s} className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_CFG[s].pill}`}>
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_CFG[s].dot}`} />
              {counts[s]} {STATUS_CFG[s].label}
            </span>
          ) : null)}
        </div>
        <div className="flex-1 h-px bg-hairline" />
        <div className="flex-shrink-0 flex items-center gap-3 text-xs text-ink-subtle">
          <span className="tabular-nums">{tasks.length} task{tasks.length !== 1 ? 's' : ''}</span>
          {subtasks.length > 0 && (
            <span className="tabular-nums font-semibold text-ink-muted">{doneSubs}/{subtasks.length} done</span>
          )}
          <ChevronDown className="w-4 h-4 text-ink-subtle transition-transform duration-200"
            style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0)' }}
          />
        </div>
      </button>
      {!collapsed && (
        <div className="pl-11">
          {area.groups.length === 0
            ? <p className="text-sm text-ink-subtle italic py-4">No groups configured</p>
            : area.groups.map(g => <GroupSection key={g.id} group={g} onUpdate={onUpdate} isMock={isMock} />)
          }
        </div>
      )}
    </div>
  )
}

// ── Summary bar ────────────────────────────────────────────────────────────────

function SummaryBar({ areas }: { areas: TrackerArea[] }) {
  const tasks  = areas.flatMap(a => a.groups.flatMap(g => g.tasks))
  const counts = tasks.reduce(
    (acc, t) => { acc[getStatus(t)]++; return acc },
    { complete: 0, on_track: 0, at_risk: 0, overdue: 0, ongoing: 0 } as Record<Status, number>
  )
  const order: Status[] = ['complete', 'on_track', 'at_risk', 'overdue', 'ongoing']
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {order.map(s => {
        const n = counts[s]; if (!n) return null
        const cfg = STATUS_CFG[s]
        const Icon = cfg.icon
        return (
          <span key={s} className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${cfg.pill}`}>
            <Icon className="w-3.5 h-3.5" />
            <span className="font-black tabular-nums">{n}</span>
            {cfg.label}
          </span>
        )
      })}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function Tracker() {
  const [areas,   setAreas]   = useState<TrackerArea[]>([])
  const [loading, setLoading] = useState(true)
  const [isMock,  setIsMock]  = useState(false)

  useEffect(() => {
    api.getTrackerAreas()
      .then(d => {
        if (d.length === 0) { setAreas(MOCK_DATA); setIsMock(true) }
        else                { setAreas(d);         setIsMock(false) }
        setLoading(false)
      })
      .catch(() => { setAreas(MOCK_DATA); setIsMock(true); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-sm text-ink-subtle">Loading board…</span>
      </div>
    )
  }

  return (
    <div className="max-w-4xl">

      {/* Preview banner */}
      {isMock && (
        <div className="flex items-center gap-2.5 mb-6 px-4 py-3 bg-violet-900/20 border border-violet-900/40 rounded-xl text-sm text-violet-400">
          <FlaskConical className="w-4 h-4 flex-shrink-0" />
          <span>
            Showing <strong>sample data</strong> — no areas found in the database.
            Seed your areas &amp; groups to see live data here.
          </span>
        </div>
      )}

      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Tracker Board</h1>
        <p className="text-sm text-ink-subtle mt-0.5 mb-5">Strategic initiative tracking · Leadership review</p>
        <SummaryBar areas={areas} />
      </div>

      <div className="border-t border-hairline mb-8" />

      {areas.map((area, idx) => (
        <AreaSection key={area.id} area={area} ordinal={idx + 1} onUpdate={setAreas} isMock={isMock} />
      ))}
    </div>
  )
}
