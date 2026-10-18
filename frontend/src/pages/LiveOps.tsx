import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Plus, X, Check, XOctagon, AlertOctagon, ChevronRight,
  Search, RefreshCw, SlidersHorizontal, Activity,
  Hourglass, CheckCircle2, Wrench, UserPlus, BarChart2,
  Trash2, Layers, FileText, Download,
  TrendingUp, PauseCircle, PlayCircle,
  BadgeCheck, Flame, CornerDownLeft, LayoutList,
  CornerUpLeft, RefreshCcw, CheckCheck,
} from 'lucide-react'
import { api } from '../api/teamPulseApi'
import { useAppContext } from '../context/AppContext'
import type {
  LiveOpsTicketListItem, LiveOpsTicketDetail, LiveOpsBusinessUnit,
  LiveOpsTicketType, LiveOpsUseCase, LiveOpsMemberRoleRecord,
  LiveOpsAssignableMember, LiveOpsAnalyticsSummary, LiveOpsUrgency,
  LiveOpsComment, LiveOpsSlaConfig, LiveOpsApproverConfig,
  LiveOpsMemberRoleType,
} from '../types'

// ── constants ─────────────────────────────────────────────────────────────────

const URGENCY_COLOR: Record<LiveOpsUrgency, string> = {
  high:   'bg-red-500/10 text-red-400 border-red-500/20',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  low:    'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
}

const URGENCY_DOT: Record<LiveOpsUrgency, string> = {
  high:   'bg-red-400',
  medium: 'bg-amber-400',
  low:    'bg-emerald-400',
}

const STATUS_COLOR: Record<string, string> = {
  draft:          'bg-zinc-800/60 text-zinc-400',
  pending_wl:     'bg-amber-500/10 text-amber-400',
  pending_tl:     'bg-orange-500/10 text-orange-400',
  pending_lo:     'bg-fuchsia-500/10 text-fuchsia-400',
  open:           'bg-sky-500/10 text-sky-400',
  in_progress:    'bg-primary/10 text-primary',
  pending_review: 'bg-violet-500/10 text-violet-400',
  completed:      'bg-emerald-500/10 text-emerald-400',
  rejected:       'bg-red-500/10 text-red-400',
  cancelled:      'bg-zinc-800/60 text-zinc-500',
  on_hold:        'bg-yellow-500/10 text-yellow-400',
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', pending_wl: 'Pending WL', pending_tl: 'Pending TL',
  pending_lo: 'Pending LO', open: 'Open', in_progress: 'In Progress',
  pending_review: 'Pending Review',
  completed: 'Completed', rejected: 'Rejected', cancelled: 'Cancelled', on_hold: 'On Hold',
}

const ROLE_LABEL: Record<LiveOpsMemberRoleType, string> = {
  workstream_lead: 'Workstream Lead', team_lead: 'Practice Lead',
}

// ── utilities ─────────────────────────────────────────────────────────────────

function initials(name: string | null) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

function timeAgo(iso: string | null) {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function slaStatus(deadline: string | null, status: string): 'breached' | 'warning' | 'ok' | 'none' {
  if (!deadline || ['completed', 'rejected', 'cancelled', 'pending_review'].includes(status)) return 'none'
  const remaining = new Date(deadline).getTime() - Date.now()
  if (remaining < 0) return 'breached'
  if (remaining < 2 * 3600 * 1000) return 'warning'
  return 'ok'
}

function slaLabel(deadline: string | null) {
  if (!deadline) return null
  const remaining = new Date(deadline).getTime() - Date.now()
  if (remaining < 0) {
    const over = Math.abs(remaining)
    const h = Math.floor(over / 3600000)
    if (h < 24) return `${h}h overdue`
    return `${Math.floor(h / 24)}d overdue`
  }
  const h = Math.floor(remaining / 3600000)
  if (h < 1) return `<1h left`
  if (h < 24) return `${h}h left`
  return `${Math.floor(h / 24)}d left`
}

// ── small components ──────────────────────────────────────────────────────────

function UrgencyBadge({ urgency }: { urgency: LiveOpsUrgency }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${URGENCY_COLOR[urgency]}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${URGENCY_DOT[urgency]}`} />
      {urgency.charAt(0).toUpperCase() + urgency.slice(1)}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[status] ?? 'bg-surface-3 text-ink-subtle'}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

function Avatar({ name, size = 'sm' }: { name: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const s = size === 'lg' ? 'w-10 h-10 text-[12px]' : size === 'md' ? 'w-8 h-8 text-[11px]' : 'w-6 h-6 text-[10px]'
  return (
    <div className={`${s} rounded-full bg-primary flex items-center justify-center text-white font-semibold flex-shrink-0`}>
      {initials(name)}
    </div>
  )
}

function TicketNumberBadge({ n }: { n: number }) {
  return (
    <span className="text-[10px] font-mono font-semibold text-ink-subtle bg-surface-3 px-1.5 py-0.5 rounded">
      LO-{String(n).padStart(4, '0')}
    </span>
  )
}

// ── stat card ─────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color, accentLine }: {
  icon: React.ElementType; label: string; value: number | string; color: string; accentLine?: string
}) {
  return (
    <div className="relative bg-surface-1 rounded-xl overflow-hidden px-4 pt-3.5 pb-4">
      <div className="flex items-start justify-between mb-2">
        <p className="text-3xl font-bold text-ink leading-none tabular-nums">{value}</p>
        <div className="w-8 h-8 rounded-lg bg-surface-3 flex items-center justify-center flex-shrink-0">
          <Icon size={16} className={color} />
        </div>
      </div>
      <p className="text-[11px] font-medium text-ink-muted leading-none">{label}</p>
      {accentLine && <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${accentLine}`} />}
    </div>
  )
}

// ── ticket row (compact list) ─────────────────────────────────────────────────

const URGENCY_STRIP: Record<LiveOpsUrgency, string> = {
  high:   'border-l-red-500',
  medium: 'border-l-amber-500',
  low:    'border-l-emerald-500',
}

function TicketRow({ ticket, onClick, isLoading }: { ticket: LiveOpsTicketListItem; onClick: () => void; isLoading?: boolean }) {
  const sla = slaStatus(ticket.slaDeadline, ticket.status)
  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className={`w-full text-left bg-surface-1 rounded-xl border border-hairline border-l-2 ${URGENCY_STRIP[ticket.urgency]} px-4 py-3 hover:bg-surface-2 hover:border-primary/30 transition-all group disabled:opacity-60`}
    >
      <div className="flex items-center gap-3">
        {/* Left zone */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <TicketNumberBadge n={ticket.ticketNumber} />
            <p className="text-sm font-semibold text-ink truncate">{ticket.ticketTypeName}</p>
          </div>
          <p className="text-[11px] text-ink-subtle truncate">
            {ticket.businessUnitName} · {ticket.useCaseName}
            {ticket.currentlyWithName && <> · <span className="text-ink-muted">{ticket.currentlyWithName}</span></>}
          </p>
        </div>
        {/* Right zone */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <StatusBadge status={ticket.status} />
            {sla === 'breached' && (
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" title={slaLabel(ticket.slaDeadline) ?? ''} />
            )}
            {sla === 'warning' && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" title={slaLabel(ticket.slaDeadline) ?? ''} />
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-ink-subtle">{timeAgo(ticket.submittedAt ?? ticket.createdAt)}</span>
            {isLoading
              ? <RefreshCw size={12} className="text-primary animate-spin" />
              : <ChevronRight size={12} className="text-ink-subtle group-hover:text-ink-muted transition-colors" />
            }
          </div>
        </div>
      </div>
    </button>
  )
}

// ── approval chain ────────────────────────────────────────────────────────────

function ApprovalChain({ ticket }: { ticket: LiveOpsTicketDetail }) {
  type StageStatus = 'done' | 'rejected' | 'active' | 'na' | 'waiting'

  const stages: Array<{ label: string; actor: string | null; date: string | null; status: StageStatus; reason?: string | null }> = [
    {
      label: 'Submitted',
      actor: ticket.submittedByName,
      date: ticket.submittedAt,
      status: 'done',
    },
    {
      label: 'Workstream Lead',
      actor: ticket.workstreamLeadName,
      date: ticket.wlActedAt,
      reason: ticket.wlReason,
      status:
        ticket.wlStatus === 'approved' ? 'done' :
        ticket.wlStatus === 'rejected' ? 'rejected' :
        ticket.status === 'pending_wl' ? 'active' : 'waiting',
    },
    ...(ticket.tlStatus !== 'na' ? [{
      label: 'Practice Lead',
      actor: ticket.teamLeadName,
      date: ticket.tlActedAt,
      reason: ticket.tlReason,
      status: (
        ticket.tlStatus === 'approved' ? 'done' :
        ticket.tlStatus === 'rejected' ? 'rejected' :
        ticket.status === 'pending_tl' ? 'active' : 'waiting'
      ) as StageStatus,
    }] : []),
    {
      label: 'LO Manager',
      actor: ticket.loActorName,
      date: ticket.loActedAt,
      reason: ticket.loReason,
      status:
        ticket.loStatus === 'approved' ? 'done' :
        ticket.loStatus === 'rejected' ? 'rejected' :
        ticket.status === 'pending_lo' ? 'active' : 'waiting',
    },
    {
      label: ticket.status === 'completed' ? 'Completed' :
             ticket.status === 'pending_review' ? 'Pending Review' :
             ticket.status === 'in_progress' ? 'In Progress' : 'Resolution',
      actor: ticket.status === 'completed' ? ticket.completedAt ? timeAgo(ticket.completedAt) : null : null,
      date: ticket.completedAt,
      status:
        ticket.status === 'completed' ? 'done' :
        ['open', 'in_progress', 'on_hold', 'pending_review'].includes(ticket.status) ? 'active' : 'waiting',
    },
  ]

  const rejectionIdx = stages.findIndex(s => s.status === 'rejected')

  return (
    <div className="flex items-start overflow-x-auto gap-0 pb-1">
      {stages.map((stage, i) => {
        const isAfterRejection = rejectionIdx >= 0 && i > rejectionIdx
        return (
          <div key={stage.label} className={`flex items-start transition-opacity ${isAfterRejection ? 'opacity-30' : ''}`}>
            <div className="flex flex-col items-center" style={{ minWidth: 84 }}>
              <div className={`relative w-8 h-8 rounded-full border-2 flex items-center justify-center ${
                stage.status === 'done'     ? 'border-emerald-500 bg-emerald-500' :
                stage.status === 'rejected' ? 'border-red-400 bg-red-400' :
                stage.status === 'active'   ? 'border-primary bg-primary/10' :
                'border-hairline bg-surface-2'
              }`}>
                {stage.status === 'active' && (
                  <div className="absolute inset-0 rounded-full ring-4 ring-primary/25 animate-pulse" />
                )}
                {stage.status === 'done'     ? <Check size={12} className="text-white" /> :
                 stage.status === 'rejected' ? <X size={12} className="text-white" /> :
                 stage.status === 'active'   ? <div className="w-2 h-2 rounded-full bg-primary" /> :
                 <div className="w-2 h-2 rounded-full bg-surface-4" />}
              </div>
              <p className="text-[10px] font-medium text-ink-muted mt-1.5 text-center leading-tight px-1">{stage.label}</p>
              {stage.actor && <p className="text-[10px] text-ink-subtle text-center max-w-[80px] truncate">{stage.actor}</p>}
            </div>
            {i < stages.length - 1 && (
              <div className="flex items-center mt-4" style={{ minWidth: 16 }}>
                <div className={`h-px w-full ${stage.status === 'done' ? 'bg-emerald-400/60' : 'bg-hairline'}`} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── submit panel ──────────────────────────────────────────────────────────────

// ── report card ───────────────────────────────────────────────────────────────

function ReportCard() {
  const today = new Date().toISOString().slice(0, 10)
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)

  const [fromDate, setFromDate] = useState(firstOfMonth)
  const [toDate, setToDate]     = useState(today)
  const [format, setFormat]     = useState<'excel' | 'pdf'>('excel')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  async function generate() {
    setLoading(true); setError(null)
    try {
      const params = new URLSearchParams({ from_date: fromDate, to_date: toDate, format })
      const res = await fetch(`/api/v1/liveops/reports/export?${params.toString()}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.detail ?? `Server error ${res.status}`)
      }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      const ext  = format === 'excel' ? 'xlsx' : 'pdf'
      a.download = `liveops_report_${fromDate}_to_${toDate}.${ext}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate report')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-surface-1 rounded-xl border border-hairline px-5 py-5">
      <p className="text-xs font-semibold text-ink mb-1 flex items-center gap-2">
        <FileText size={14} className="text-primary" /> PMO Report Export
      </p>
      <p className="text-[11px] text-ink-subtle mb-4">
        Generate a summary report of all tickets for a date range — for PMO calls and governance reviews.
      </p>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-[10px] font-semibold text-ink-subtle uppercase tracking-widest mb-1">From</label>
          <input type="date" value={fromDate} max={toDate}
            onChange={e => setFromDate(e.target.value)}
            className="w-full text-xs border border-hairline rounded-lg px-3 py-2 bg-surface-2 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-ink" />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-ink-subtle uppercase tracking-widest mb-1">To</label>
          <input type="date" value={toDate} min={fromDate}
            onChange={e => setToDate(e.target.value)}
            className="w-full text-xs border border-hairline rounded-lg px-3 py-2 bg-surface-2 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-ink" />
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-[10px] font-semibold text-ink-subtle uppercase tracking-widest mb-1.5">Format</label>
        <div className="flex gap-2">
          {([['excel', 'Excel (.xlsx)'], ['pdf', 'PDF (.pdf']] as const).map(([val, label]) => (
            <button key={val} onClick={() => setFormat(val as 'excel' | 'pdf')}
              className={`flex-1 py-2 px-3 rounded-lg border text-xs font-medium transition-all ${
                format === val
                  ? 'bg-primary/10 border-primary/40 text-primary'
                  : 'bg-surface-1 border-hairline text-ink-subtle hover:border-primary/30 hover:text-ink-muted'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="text-[11px] text-red-400 bg-red-900/20 rounded-lg px-3 py-2 mb-3">{error}</p>
      )}

      <button onClick={generate} disabled={loading || !fromDate || !toDate}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors">
        {loading
          ? <><RefreshCw size={14} className="animate-spin" /> Generating…</>
          : <><Download size={14} /> Generate Report</>}
      </button>
    </div>
  )
}

interface SubmitPanelProps {
  onClose: () => void
  onSubmitted: () => void
  businessUnits: LiveOpsBusinessUnit[]
  ticketTypes: LiveOpsTicketType[]
  useCases: LiveOpsUseCase[]
  approverConfigs: LiveOpsApproverConfig[]
  memberEmail: string
}

function SubmitPanel({ onClose, onSubmitted, businessUnits, ticketTypes, useCases, approverConfigs, memberEmail }: SubmitPanelProps) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    ticketTypeId: '', businessUnitId: '', useCaseId: '',
    urgency: 'medium' as LiveOpsUrgency, description: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filteredUseCases = useCases.filter(u => !form.businessUnitId || u.businessUnitId === form.businessUnitId)
  const selectedType = ticketTypes.find(t => t.id === form.ticketTypeId)
  const selectedBU = businessUnits.find(b => b.id === form.businessUnitId)
  const selectedUC = filteredUseCases.find(u => u.id === form.useCaseId)
  const approverConfig = (form.ticketTypeId && form.businessUnitId)
    ? approverConfigs.find(c => c.ticketTypeId === form.ticketTypeId && c.businessUnitId === form.businessUnitId)
    : null

  const step1Valid = !!form.ticketTypeId && !!form.businessUnitId && !!form.useCaseId
  const step2Valid = form.description.trim().length >= 10

  async function handleSubmit() {
    setLoading(true); setError(null)
    try {
      await api.liveops.createTicket({
        ticket_type_id: form.ticketTypeId, use_case_id: form.useCaseId,
        business_unit_id: form.businessUnitId, urgency: form.urgency,
        description: form.description, submit: true,
      }, memberEmail)
      onSubmitted()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit ticket')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full sm:w-[500px] bg-surface-1 h-full flex flex-col shadow-2xl border-l border-hairline">
        {/* Header */}
        <div className="px-6 py-4 border-b border-hairline flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-ink">New LiveOps Ticket</h2>
            <p className="text-[11px] text-ink-subtle mt-0.5">Step {step} of 3</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-2 text-ink-subtle">
            <X size={15} />
          </button>
        </div>

        {/* Step progress */}
        <div className="px-6 py-3 flex gap-1.5">
          {[1, 2, 3].map(s => (
            <div key={s} className={`flex-1 h-1 rounded-full transition-colors duration-300 ${s <= step ? 'bg-primary' : 'bg-surface-3'}`} />
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {step === 1 && (
            <>
              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1.5">Ticket Type</label>
                <select value={form.ticketTypeId}
                  onChange={e => setForm(f => ({ ...f, ticketTypeId: e.target.value }))}
                  className="w-full text-sm border border-hairline rounded-lg px-3 py-2 bg-surface-2 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-ink">
                  <option value="">Select ticket type…</option>
                  {ticketTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                {selectedType?.guideText && (
                  <div className="mt-2.5 px-3 py-2.5 bg-primary/8 border border-primary/20 rounded-xl text-[11px] text-primary leading-relaxed">
                    {selectedType.guideText}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1.5">Business Unit</label>
                <select value={form.businessUnitId}
                  onChange={e => setForm(f => ({ ...f, businessUnitId: e.target.value, useCaseId: '' }))}
                  className="w-full text-sm border border-hairline rounded-lg px-3 py-2 bg-surface-2 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-ink">
                  <option value="">Select business unit…</option>
                  {businessUnits.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1.5">Use Case</label>
                <select value={form.useCaseId} disabled={!form.businessUnitId}
                  onChange={e => setForm(f => ({ ...f, useCaseId: e.target.value }))}
                  className="w-full text-sm border border-hairline rounded-lg px-3 py-2 bg-surface-2 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-ink disabled:bg-surface-3 disabled:text-ink-subtle">
                  <option value="">Select use case…</option>
                  {filteredUseCases.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1.5">Urgency</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['high', 'medium', 'low'] as const).map(u => (
                    <button key={u} onClick={() => setForm(f => ({ ...f, urgency: u }))}
                      className={`py-2 rounded-lg border text-xs font-medium transition-all ${
                        form.urgency === u
                          ? u === 'high' ? 'bg-red-900/20 border-red-900/40 text-red-400' :
                            u === 'medium' ? 'bg-amber-900/20 border-amber-500/40 text-amber-400' :
                            'bg-success/10 border-success/30 text-success'
                          : 'bg-surface-1 border-hairline text-ink-subtle hover:border-primary/30 hover:text-ink-muted'
                      }`}>
                      {u.charAt(0).toUpperCase() + u.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Approval routing preview — shown once type + BU are both selected */}
              {form.ticketTypeId && form.businessUnitId && (
                <div className={`rounded-xl border px-4 py-3.5 ${approverConfig ? 'bg-primary/5 border-primary/20' : 'bg-amber-900/20 border-amber-500/20'}`}>
                  <p className="text-[10px] font-semibold uppercase tracking-widest mb-2.5 flex items-center gap-1.5 text-ink-subtle">
                    <ChevronRight size={10} /> Approval Routing
                  </p>
                  {approverConfig ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold text-ink-subtle w-28 flex-shrink-0">Workstream Lead</span>
                        {approverConfig.workstreamLeadName ? (
                          <div className="flex items-center gap-1.5">
                            <Avatar name={approverConfig.workstreamLeadName} size="sm" />
                            <span className="text-xs font-medium text-ink">{approverConfig.workstreamLeadName}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-ink-subtle italic">Not assigned</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold text-ink-subtle w-28 flex-shrink-0">Practice Lead</span>
                        {approverConfig.teamLeadName ? (
                          <div className="flex items-center gap-1.5">
                            <Avatar name={approverConfig.teamLeadName} size="sm" />
                            <span className="text-xs font-medium text-ink">{approverConfig.teamLeadName}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-ink-subtle italic">Not required</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-amber-400">
                      No approval routing configured for this combination. Your ticket will go directly to the LO Manager.
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {step === 2 && (
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1">Description</label>
              <p className="text-[11px] text-ink-subtle mb-2">Be specific — include what you need, timelines, and any relevant context.</p>
              <textarea value={form.description} rows={12} placeholder="Describe the task or issue in detail…"
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full text-sm border border-hairline rounded-lg px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-ink bg-surface-2 placeholder:text-ink-subtle" />
              <p className="text-[10px] text-ink-subtle mt-1 text-right">{form.description.length} chars {form.description.trim().length < 10 && '· min 10 required'}</p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="bg-surface-2 rounded-xl border border-hairline divide-y divide-hairline">
                {[
                  ['Ticket Type', selectedType?.name],
                  ['Business Unit', selectedBU?.name],
                  ['Use Case', selectedUC?.name],
                  ['Urgency', form.urgency.charAt(0).toUpperCase() + form.urgency.slice(1)],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between px-4 py-2.5">
                    <span className="text-xs text-ink-muted">{label}</span>
                    <span className="text-xs font-medium text-ink">{value ?? '—'}</span>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-[10px] font-semibold text-ink-subtle uppercase tracking-widest mb-2">Description</p>
                <p className="text-xs text-ink-muted bg-surface-2 border border-hairline rounded-xl px-4 py-3 whitespace-pre-wrap leading-relaxed">
                  {form.description}
                </p>
              </div>
              <p className="text-[11px] text-ink-subtle flex items-center gap-1.5">
                <ChevronRight size={11} />
                On submit, this ticket will be routed to your Workstream Lead for approval.
              </p>
              {error && <p className="text-xs text-red-400 bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-hairline flex items-center justify-between gap-3">
          {step > 1
            ? <button onClick={() => setStep(s => s - 1)} className="px-4 py-2 text-sm text-ink-muted bg-surface-1 border border-hairline rounded-lg hover:bg-surface-2">Back</button>
            : <div />}
          {step < 3
            ? <button onClick={() => setStep(s => s + 1)}
                disabled={(step === 1 && !step1Valid) || (step === 2 && !step2Valid)}
                className="px-5 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed">
                Continue
              </button>
            : <button onClick={handleSubmit} disabled={loading}
                className="px-5 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2">
                {loading && <RefreshCw size={13} className="animate-spin" />}
                {loading ? 'Submitting…' : 'Submit Ticket'}
              </button>}
        </div>
      </div>
    </div>
  )
}

// ── mention utilities ─────────────────────────────────────────────────────────

const MENTION_RE = /@\[([^\]]+)\]\(([^)]+)\)/g

function renderMentions(text: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  let last = 0
  let match: RegExpExecArray | null
  MENTION_RE.lastIndex = 0
  while ((match = MENTION_RE.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    parts.push(
      <span key={match.index} className="text-primary font-medium">@{match[1]}</span>
    )
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts.length ? parts : text
}

interface MentionInputProps {
  value: string
  /** Called with (displayText, resolvedText). displayText is plain text; resolvedText has @[Name](id) tokens. */
  onChange: (display: string, resolved: string) => void
  members: LiveOpsAssignableMember[]
  placeholder?: string
  rows?: number
}

function MentionInput({ value, onChange, members, placeholder, rows = 2 }: MentionInputProps) {
  const divRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [triggerInfo, setTriggerInfo] = useState<{ node: Text; atOffset: number } | null>(null)
  const [activeIdx, setActiveIdx] = useState(0)

  // Clear the div when parent resets value to ''
  useEffect(() => {
    if (value === '' && divRef.current && divRef.current.innerHTML !== '') {
      divRef.current.innerHTML = ''
      setQuery('')
      setTriggerInfo(null)
    }
  }, [value])

  const filtered = useMemo(() => {
    if (!triggerInfo) return []
    const q = query.toLowerCase()
    return members.filter(m => m.name.toLowerCase().includes(q)).slice(0, 6)
  }, [query, triggerInfo, members])

  function getResolvedBody(): string {
    const div = divRef.current
    if (!div) return ''
    let out = ''
    function walk(node: Node) {
      if (node.nodeType === Node.TEXT_NODE) {
        out += node.textContent ?? ''
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement
        if (el.dataset.memberId) {
          out += `@[${el.dataset.memberName}](${el.dataset.memberId})`
        } else if (el.tagName === 'BR') {
          out += '\n'
        } else if (el.tagName === 'DIV' || el.tagName === 'P') {
          if (out.length > 0) out += '\n'
          el.childNodes.forEach(walk)
        } else {
          el.childNodes.forEach(walk)
        }
      }
    }
    div.childNodes.forEach(walk)
    return out
  }

  function fireChange() {
    const display = (divRef.current?.innerText ?? '').replace(/\n$/, '')
    onChange(display, getResolvedBody())
  }

  function handleInput() {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) { fireChange(); return }
    const range = sel.getRangeAt(0)
    const node = range.startContainer
    if (node.nodeType === Node.TEXT_NODE) {
      const textBefore = (node.textContent ?? '').slice(0, range.startOffset)
      const atIdx = textBefore.lastIndexOf('@')
      if (atIdx !== -1) {
        const q = textBefore.slice(atIdx + 1)
        if (!q.includes(' ') && !q.includes('\n')) {
          setTriggerInfo({ node: node as Text, atOffset: atIdx })
          setQuery(q)
          setActiveIdx(0)
          fireChange()
          return
        }
      }
    }
    setTriggerInfo(null)
    setQuery('')
    fireChange()
  }

  function selectMember(m: LiveOpsAssignableMember) {
    if (!triggerInfo) return
    const { node, atOffset } = triggerInfo

    const chip = document.createElement('span')
    chip.contentEditable = 'false'
    chip.dataset.memberId = m.id
    chip.dataset.memberName = m.name
    chip.className = 'inline-flex items-center bg-primary/15 text-primary text-[11px] font-medium rounded px-1.5 mx-0.5 select-none'
    chip.textContent = `@${m.name}`

    const range = document.createRange()
    range.setStart(node, atOffset)
    range.setEnd(node, atOffset + 1 + query.length)
    range.deleteContents()
    range.insertNode(chip)

    const space = document.createTextNode(' ')
    chip.after(space)

    const sel = window.getSelection()
    if (sel) {
      const cur = document.createRange()
      cur.setStartAfter(space)
      cur.collapse(true)
      sel.removeAllRanges()
      sel.addRange(cur)
    }

    setTriggerInfo(null)
    setQuery('')
    const display = (divRef.current?.innerText ?? '').replace(/\n$/, '')
    onChange(display, getResolvedBody())
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!triggerInfo || filtered.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, filtered.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); selectMember(filtered[activeIdx]) }
    else if (e.key === 'Escape') { setTriggerInfo(null); setQuery('') }
  }

  return (
    <div className="relative flex-1">
      <div
        ref={divRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        style={{ minHeight: `${rows * 1.5}rem` }}
        className="w-full text-xs border border-hairline rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-surface-2 text-ink leading-relaxed break-words"
      />
      {value === '' && (
        <span className="absolute top-2 left-3 text-xs text-ink-subtle pointer-events-none select-none">
          {placeholder}
        </span>
      )}
      {triggerInfo && filtered.length > 0 && (
        <ul className="absolute bottom-full mb-1 left-0 w-56 bg-surface-1 border border-hairline rounded-xl shadow-xl overflow-hidden z-50">
          {filtered.map((m, i) => (
            <li key={m.id}
              onMouseDown={e => { e.preventDefault(); selectMember(m) }}
              className={`px-3 py-2 text-xs cursor-pointer flex items-center gap-2 ${i === activeIdx ? 'bg-primary/10 text-primary' : 'text-ink hover:bg-surface-2'}`}
            >
              <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[9px] font-bold flex-shrink-0">
                {m.name.charAt(0).toUpperCase()}
              </span>
              {m.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── ticket detail panel ───────────────────────────────────────────────────────

interface DetailPanelProps {
  ticket: LiveOpsTicketDetail
  onClose: () => void
  onAction: (updated: LiveOpsTicketDetail) => void
  memberEmail: string
  memberId: string | null
  isLoManager: boolean
  isAdmin: boolean
  assignableMembers: LiveOpsAssignableMember[]
}

function DetailPanel({ ticket, onClose, onAction, memberEmail, memberId, isLoManager, isAdmin, assignableMembers }: DetailPanelProps) {
  const [comment, setComment] = useState('')
  const [commentResolved, setCommentResolved] = useState('')
  const [postingComment, setPostingComment] = useState(false)
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [rejectInput, setRejectInput] = useState('')
  const [showRejectBox, setShowRejectBox] = useState(false)
  const [pushBackInput, setPushBackInput] = useState('')
  const [showPushBackBox, setShowPushBackBox] = useState(false)
  const [cancelInput, setCancelInput] = useState('')
  const [showCancelBox, setShowCancelBox] = useState(false)
  const [holdInput, setHoldInput] = useState('')
  const [showHoldBox, setShowHoldBox] = useState(false)
  const [showAssignBox, setShowAssignBox] = useState(false)
  const [assigneeIds, setAssigneeIds] = useState<string[]>([])
  const [assignNote, setAssignNote] = useState('')
  // LO approve+assign modal
  const [showLoApproveBox, setShowLoApproveBox] = useState(false)
  const [loApproveAssigneeIds, setLoApproveAssigneeIds] = useState<string[]>([])
  const [loApproveNote, setLoApproveNote] = useState('')
  const [completeNote, setCompleteNote] = useState('')
  const [showCompleteBox, setShowCompleteBox] = useState(false)
  const [rejectAssignNote, setRejectAssignNote] = useState('')
  const [showRejectAssignBox, setShowRejectAssignBox] = useState(false)
  const [confirmNote, setConfirmNote] = useState('')
  const [showConfirmBox, setShowConfirmBox] = useState(false)
  // Draft edit & resubmit
  const [showEditDraft, setShowEditDraft] = useState(false)
  const [editDesc, setEditDesc] = useState(ticket.description)
  const [editUrgency, setEditUrgency] = useState<LiveOpsUrgency>(ticket.urgency)
  // Reassign
  const [showReassignBox, setShowReassignBox] = useState(false)
  const [reassigneeId, setReassigneeId] = useState('')
  const [reassignReason, setReassignReason] = useState('')
  const [reassignNote, setReassignNote] = useState('')
  // Urgency override
  const [showUrgencyBox, setShowUrgencyBox] = useState(false)
  const [overrideUrgency, setOverrideUrgency] = useState<LiveOpsUrgency>(ticket.urgency)
  const [urgencyReason, setUrgencyReason] = useState('')
  const [localTicket, setLocalTicket] = useState(ticket)

  useEffect(() => {
    setLocalTicket(ticket)
    setEditDesc(ticket.description)
    setEditUrgency(ticket.urgency)
    setOverrideUrgency(ticket.urgency)
  }, [ticket])

  const isSubmitter = localTicket.submittedById === memberId

  const myActiveAssignment = localTicket.assignments.find(
    a => a.assigneeId === memberId && (a.status === 'pending' || a.status === 'active')
  )

  const spin = <RefreshCw size={13} className="animate-spin" />

  async function runAction(fn: () => Promise<LiveOpsTicketDetail>, key: string) {
    setLoadingAction(key)
    try {
      const updated = await fn()
      setLocalTicket(updated)
      onAction(updated)
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingAction(null)
    }
  }

  async function postComment() {
    if (!comment.trim()) return
    setPostingComment(true)
    try {
      const body = commentResolved.trim() || comment.trim()
      const c: LiveOpsComment = await api.liveops.addComment(localTicket.id, body, memberEmail)
      setLocalTicket(t => ({ ...t, comments: [...t.comments, c] }))
      setComment('')
      setCommentResolved('')
    } catch (e) { console.error(e) }
    finally { setPostingComment(false) }
  }

  // ── determine which actions to show
  const canApprove = (
    (localTicket.status === 'pending_wl' && (localTicket.workstreamLeadId === memberId || isAdmin)) ||
    (localTicket.status === 'pending_tl' && (localTicket.teamLeadId === memberId || isAdmin)) ||
    (localTicket.status === 'pending_lo' && isLoManager)
  )
  const canPushBack = (
    (localTicket.status === 'pending_wl' && (localTicket.workstreamLeadId === memberId || isAdmin)) ||
    (localTicket.status === 'pending_tl' && (localTicket.teamLeadId === memberId || isAdmin))
  )
  const hasActiveAssignment = localTicket.assignments.some(a => a.status === 'pending' || a.status === 'active')
  const canAssign = isLoManager && ['open', 'in_progress'].includes(localTicket.status)
  const canReassign = isLoManager && localTicket.status === 'in_progress' && hasActiveAssignment
  const canHold = isLoManager && ['open', 'in_progress', 'pending_lo', 'pending_review'].includes(localTicket.status)
  const canResume = isLoManager && localTicket.status === 'on_hold'
  const canCancel = (isSubmitter || isLoManager) && !['completed', 'rejected', 'cancelled'].includes(localTicket.status)
  const canPickup = !!myActiveAssignment && myActiveAssignment.status === 'pending'
  const canComplete = !!myActiveAssignment && myActiveAssignment.status === 'active'
  const canRejectAssignment = !!myActiveAssignment
  const isLoApproveStage = localTicket.status === 'pending_lo' && isLoManager
  const canEditDraft = localTicket.status === 'draft' && isSubmitter
  const canConfirmComplete = isLoManager && localTicket.status === 'pending_review'
  const canOverrideUrgency = isLoManager && !['completed', 'rejected', 'cancelled'].includes(localTicket.status)
  const sla = slaStatus(localTicket.slaDeadline, localTicket.status)
  const nonSystemComments = localTicket.comments.filter(c => !c.isSystem)

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full sm:w-[580px] bg-surface-1 h-full flex flex-col shadow-2xl border-l border-hairline overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-hairline flex items-start justify-between gap-3 bg-surface-1">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <TicketNumberBadge n={localTicket.ticketNumber} />
              <UrgencyBadge urgency={localTicket.urgency} />
              <StatusBadge status={localTicket.status} />
              {sla === 'breached' && (
                <span className="text-[10px] font-semibold text-red-400 bg-red-900/20 px-1.5 py-0.5 rounded flex items-center gap-1">
                  <AlertOctagon size={9} /> {slaLabel(localTicket.slaDeadline)}
                </span>
              )}
              {sla === 'warning' && (
                <span className="text-[10px] font-semibold text-amber-400 bg-amber-900/20 px-1.5 py-0.5 rounded flex items-center gap-1">
                  <Hourglass size={9} /> {slaLabel(localTicket.slaDeadline)}
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-ink mt-1.5">{localTicket.ticketTypeName}</p>
            <p className="text-[11px] text-ink-subtle mt-0.5">{localTicket.businessUnitName} · {localTicket.useCaseName}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-2 text-ink-subtle flex-shrink-0">
            <X size={15} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {/* Approval chain */}
          <div className="px-6 pt-5 pb-4 border-b border-hairline">
            <p className="text-[10px] font-semibold text-ink-subtle uppercase tracking-widest mb-3">Approval Chain</p>
            <ApprovalChain ticket={localTicket} />
          </div>

          {/* Submitter / meta */}
          <div className="px-6 py-4 border-b border-hairline flex items-center gap-4">
            <div className="flex items-center gap-2 flex-1">
              <Avatar name={localTicket.submittedByName} />
              <div>
                <p className="text-xs font-medium text-ink">{localTicket.submittedByName}</p>
                <p className="text-[10px] text-ink-subtle">Submitted {timeAgo(localTicket.submittedAt)}</p>
              </div>
            </div>
            {localTicket.currentlyWithName && (
              <div className="text-right">
                <p className="text-[10px] text-ink-subtle">Currently with</p>
                <p className="text-xs font-medium text-ink">{localTicket.currentlyWithName}</p>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="px-6 py-4 border-b border-hairline">
            <p className="text-[10px] font-semibold text-ink-subtle uppercase tracking-widest mb-2">Description</p>
            <p className="text-xs text-ink-muted leading-relaxed whitespace-pre-wrap">{localTicket.description}</p>
          </div>

          {/* Rejection / cancellation reason */}
          {localTicket.status === 'rejected' && (localTicket.wlReason || localTicket.tlReason || localTicket.loReason) && (
            <div className="px-6 py-4 border-b border-hairline bg-red-900/20">
              <p className="text-[10px] font-semibold text-red-500 uppercase tracking-widest mb-1">Rejection Reason</p>
              <p className="text-xs text-red-400">{localTicket.wlReason ?? localTicket.tlReason ?? localTicket.loReason}</p>
            </div>
          )}
          {localTicket.status === 'cancelled' && localTicket.cancelReason && (
            <div className="px-6 py-4 border-b border-hairline bg-surface-2">
              <p className="text-[10px] font-semibold text-ink-subtle uppercase tracking-widest mb-1">Cancel Reason</p>
              <p className="text-xs text-ink-muted">{localTicket.cancelReason}</p>
            </div>
          )}
          {localTicket.status === 'on_hold' && localTicket.onHoldReason && (
            <div className="px-6 py-4 border-b border-hairline bg-amber-900/20">
              <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-widest mb-1">On Hold</p>
              <p className="text-xs text-amber-300">{localTicket.onHoldReason}</p>
            </div>
          )}

          {/* Assignments */}
          {localTicket.assignments.length > 0 && (
            <div className="px-6 py-4 border-b border-hairline">
              <p className="text-[10px] font-semibold text-ink-subtle uppercase tracking-widest mb-3">Assignments</p>
              {localTicket.assignments.length <= 3 ? (
                <div className="flex items-start gap-5">
                  {localTicket.assignments.map(a => {
                    const ringColor =
                      a.status === 'active'    ? 'ring-primary' :
                      a.status === 'completed' ? 'ring-emerald-400' :
                      a.status === 'rejected'  ? 'ring-red-500' :
                                                  'ring-amber-400'
                    const badgeColor =
                      a.status === 'active'    ? 'bg-primary/10 text-primary' :
                      a.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' :
                      a.status === 'rejected'  ? 'bg-red-500/10 text-red-400' :
                                                  'bg-amber-500/10 text-amber-400'
                    return (
                      <div key={a.id} className="flex flex-col items-center gap-1.5 min-w-0">
                        <div className={`rounded-full ring-2 p-0.5 ${ringColor}`}>
                          <Avatar name={a.assigneeName} size="lg" />
                        </div>
                        <p className="text-[10px] font-medium text-ink text-center max-w-[64px] truncate leading-tight">
                          {a.assigneeName?.split(' ')[0]}
                        </p>
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${badgeColor}`}>
                          {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                        </span>
                        {a.rejectionReason && (
                          <p className="text-[9px] text-red-500 text-center max-w-[64px] truncate">{a.rejectionReason}</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="space-y-2">
                  {localTicket.assignments.map(a => {
                    const ringColor =
                      a.status === 'active'    ? 'ring-primary' :
                      a.status === 'completed' ? 'ring-emerald-400' :
                      a.status === 'rejected'  ? 'ring-red-500' :
                                                  'ring-amber-400'
                    const rowBg =
                      a.status === 'active'    ? 'bg-primary/5 border-primary/15' :
                      a.status === 'completed' ? 'bg-emerald-500/5 border-emerald-500/15' :
                      a.status === 'rejected'  ? 'bg-red-900/10 border-red-900/20' :
                                                  'bg-surface-2 border-hairline'
                    const badgeColor =
                      a.status === 'active'    ? 'bg-primary/10 text-primary' :
                      a.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' :
                      a.status === 'rejected'  ? 'bg-red-500/10 text-red-400' :
                                                  'bg-amber-500/10 text-amber-400'
                    return (
                      <div key={a.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${rowBg}`}>
                        <div className={`rounded-full ring-2 p-0.5 ${ringColor}`}>
                          <Avatar name={a.assigneeName} size="sm" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-ink">{a.assigneeName}</p>
                          {a.loMessage && <p className="text-[10px] text-ink-muted truncate">{a.loMessage}</p>}
                          {a.rejectionReason && <p className="text-[10px] text-red-500 truncate">Declined: {a.rejectionReason}</p>}
                        </div>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${badgeColor}`}>
                          {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          {(canApprove || canPushBack || canAssign || canReassign || canPickup || canComplete || canConfirmComplete || canHold || canResume || canCancel || canRejectAssignment || canEditDraft || canOverrideUrgency) && (
            <div className="px-6 py-4 border-b border-hairline">
              <p className="text-[10px] font-semibold text-ink-subtle uppercase tracking-widest mb-3">Actions</p>
              <div className="space-y-2">

                {/* ── TIER 1: Primary actions ── */}

                {canEditDraft && (
                  showEditDraft ? (
                    <div className="space-y-2 bg-surface-2 rounded-xl p-3 border border-hairline">
                      <p className="text-[10px] font-semibold text-ink-subtle uppercase tracking-widest">Edit &amp; Resubmit</p>
                      <div className="flex gap-2 mb-1">
                        {(['high', 'medium', 'low'] as const).map(u => (
                          <button key={u} onClick={() => setEditUrgency(u)}
                            className={`flex-1 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                              editUrgency === u
                                ? u === 'high' ? 'bg-red-900/20 border-red-900/40 text-red-400' : u === 'medium' ? 'bg-amber-900/20 border-amber-500/40 text-amber-400' : 'bg-success/10 border-success/30 text-success'
                                : 'bg-surface-1 border-hairline text-ink-subtle hover:border-primary/30'
                            }`}>{u.charAt(0).toUpperCase() + u.slice(1)}</button>
                        ))}
                      </div>
                      <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={5}
                        placeholder="Update description…"
                        className="w-full text-xs border border-hairline rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-surface-1 text-ink" />
                      <div className="flex gap-2">
                        <button onClick={() => setShowEditDraft(false)}
                          className="flex-1 py-2 text-xs text-ink-muted bg-surface-1 border border-hairline rounded-lg hover:bg-surface-2">Cancel</button>
                        <button
                          onClick={() => runAction(async () => {
                            setShowEditDraft(false)
                            await api.liveops.updateDraftTicket(localTicket.id, { description: editDesc, urgency: editUrgency }, memberEmail)
                            return api.liveops.submitTicket(localTicket.id, memberEmail)
                          }, 'submit-draft')}
                          disabled={editDesc.trim().length < 10 || !!loadingAction}
                          className="flex-1 py-2 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1.5">
                          {loadingAction === 'submit-draft' ? <>{spin} Submitting…</> : 'Save & Submit'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setShowEditDraft(true)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90">
                      <FileText size={14} /> Edit &amp; Resubmit
                    </button>
                  )
                )}

                {canApprove && !isLoApproveStage && (
                  <button onClick={() => runAction(() => api.liveops.approve(localTicket.id, null, memberEmail), 'approve')}
                    disabled={!!loadingAction}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                    {loadingAction === 'approve' ? <>{spin} Approving…</> : <><Check size={14} /> Approve</>}
                  </button>
                )}

                {isLoApproveStage && (
                  showLoApproveBox ? (
                    <div className="space-y-2">
                      <p className="text-[10px] font-semibold text-ink-subtle uppercase tracking-widest">Approve &amp; Assign Engineers</p>
                      <div className="border border-hairline rounded-lg bg-surface-2 divide-y divide-hairline max-h-44 overflow-y-auto">
                        {assignableMembers.map(m => {
                          const checked = loApproveAssigneeIds.includes(m.id)
                          return (
                            <label key={m.id} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-surface-3 select-none">
                              <input type="checkbox" checked={checked}
                                onChange={() => setLoApproveAssigneeIds(prev => checked ? prev.filter(id => id !== m.id) : [...prev, m.id])}
                                className="accent-emerald-500" />
                              <span className="text-xs text-ink flex-1">{m.name}</span>
                              <span className="text-[10px] text-ink-subtle">{m.activeAssignmentCount} active</span>
                            </label>
                          )
                        })}
                      </div>
                      <input value={loApproveNote} onChange={e => setLoApproveNote(e.target.value)}
                        placeholder="Optional message for engineers…"
                        className="w-full text-xs border border-hairline rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 bg-surface-2 text-ink" />
                      <div className="flex gap-2">
                        <button onClick={() => { setShowLoApproveBox(false); setLoApproveAssigneeIds([]); setLoApproveNote('') }}
                          className="flex-1 py-2 text-xs text-ink-muted bg-surface-1 border border-hairline rounded-lg hover:bg-surface-2">Cancel</button>
                        <button onClick={() => runAction(() => {
                          setShowLoApproveBox(false)
                          return api.liveops.approve(localTicket.id, null, memberEmail, loApproveAssigneeIds, loApproveNote || null)
                        }, 'approve-lo')}
                          disabled={loApproveAssigneeIds.length === 0 || !!loadingAction}
                          className="flex-1 py-2 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-1.5">
                          {loadingAction === 'approve-lo' ? <>{spin} Approving…</> : `Approve & Assign${loApproveAssigneeIds.length > 1 ? ` (${loApproveAssigneeIds.length})` : ''}`}</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setShowLoApproveBox(true)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700">
                      <Check size={14} /> Approve &amp; Assign
                    </button>
                  )
                )}

                {canPickup && (
                  <button onClick={() => runAction(() => api.liveops.pickup(localTicket.id, memberEmail), 'pickup')}
                    disabled={!!loadingAction}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50">
                    {loadingAction === 'pickup' ? <>{spin} Picking up…</> : <><PlayCircle size={14} /> Pick Up</>}
                  </button>
                )}

                {canComplete && (
                  showCompleteBox ? (
                    <div className="space-y-2">
                      <textarea value={completeNote} onChange={e => setCompleteNote(e.target.value)} rows={2}
                        placeholder="Optional completion note…"
                        className="w-full text-xs border border-hairline rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-surface-2 text-ink" />
                      <div className="flex gap-2">
                        <button onClick={() => setShowCompleteBox(false)} className="flex-1 py-2 text-xs text-ink-muted bg-surface-1 border border-hairline rounded-lg hover:bg-surface-2">Cancel</button>
                        <button onClick={() => runAction(() => { setShowCompleteBox(false); return api.liveops.complete(localTicket.id, completeNote || null, memberEmail) }, 'complete')}
                          disabled={!!loadingAction}
                          className="flex-1 py-2 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1.5">
                          {loadingAction === 'complete' ? <>{spin} Saving…</> : 'Mark Complete'}</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setShowCompleteBox(true)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90">
                      <CheckCheck size={14} /> Mark Complete
                    </button>
                  )
                )}

                {canConfirmComplete && (
                  showConfirmBox ? (
                    <div className="space-y-2 bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">
                      <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-widest">Confirm Completion</p>
                      <textarea value={confirmNote} onChange={e => setConfirmNote(e.target.value)} rows={2}
                        placeholder="Optional note for the submitter…"
                        className="w-full text-xs border border-hairline rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 bg-surface-2 text-ink" />
                      <div className="flex gap-2">
                        <button onClick={() => { setShowConfirmBox(false); setConfirmNote('') }}
                          className="flex-1 py-2 text-xs text-ink-muted bg-surface-1 border border-hairline rounded-lg hover:bg-surface-2">Cancel</button>
                        <button onClick={() => runAction(() => {
                          setShowConfirmBox(false)
                          return api.liveops.confirmComplete(localTicket.id, confirmNote || null, memberEmail)
                        }, 'confirm-complete')}
                          disabled={!!loadingAction}
                          className="flex-1 py-2 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-1.5">
                          {loadingAction === 'confirm-complete' ? <>{spin} Confirming…</> : 'Confirm Complete'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setShowConfirmBox(true)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700">
                      <BadgeCheck size={14} /> Confirm Completion
                    </button>
                  )
                )}

                {canResume && (
                  <button onClick={() => runAction(() => api.liveops.resume(localTicket.id, memberEmail), 'resume')}
                    disabled={!!loadingAction}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50">
                    {loadingAction === 'resume' ? <>{spin} Resuming…</> : <><PlayCircle size={14} /> Resume</>}
                  </button>
                )}

                {/* ── TIER 2: Secondary (side by side) ── */}

                {!showPushBackBox && !showRejectBox && (canPushBack || canApprove) && (
                  <div className="flex gap-2">
                    {canPushBack && (
                      <button onClick={() => setShowPushBackBox(true)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium border border-amber-500/30 text-amber-400 rounded-lg hover:bg-amber-900/20 bg-surface-1">
                        <CornerUpLeft size={13} /> Push Back
                      </button>
                    )}
                    {canApprove && (
                      <button onClick={() => setShowRejectBox(true)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium border border-red-900/40 text-red-400 rounded-lg hover:bg-red-900/20 bg-surface-1">
                        <XOctagon size={13} /> Reject
                      </button>
                    )}
                  </div>
                )}
                {showPushBackBox && (
                  <div className="space-y-2">
                    <textarea value={pushBackInput} onChange={e => setPushBackInput(e.target.value)} rows={2}
                      placeholder="Reason for push back (required)…"
                      className="w-full text-xs border border-hairline rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 resize-none bg-surface-2 text-ink" />
                    <div className="flex gap-2">
                      <button onClick={() => { setShowPushBackBox(false); setPushBackInput('') }}
                        className="flex-1 py-2 text-xs text-ink-muted bg-surface-1 border border-hairline rounded-lg hover:bg-surface-2">Cancel</button>
                      <button onClick={() => runAction(() => { setShowPushBackBox(false); return api.liveops.pushBack(localTicket.id, pushBackInput, memberEmail) }, 'push-back')}
                        disabled={!pushBackInput.trim() || !!loadingAction}
                        className="flex-1 py-2 text-xs font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center gap-1.5">
                        {loadingAction === 'push-back' ? <>{spin} Processing…</> : 'Push Back'}
                      </button>
                    </div>
                  </div>
                )}
                {showRejectBox && (
                  <div className="space-y-2">
                    <textarea value={rejectInput} onChange={e => setRejectInput(e.target.value)} rows={2}
                      placeholder="Reason for rejection (required)…"
                      className="w-full text-xs border border-hairline rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 resize-none bg-surface-2 text-ink" />
                    <div className="flex gap-2">
                      <button onClick={() => { setShowRejectBox(false); setRejectInput('') }}
                        className="flex-1 py-2 text-xs text-ink-muted bg-surface-1 border border-hairline rounded-lg hover:bg-surface-2">Cancel</button>
                      <button onClick={() => runAction(() => { setShowRejectBox(false); return api.liveops.reject(localTicket.id, rejectInput, memberEmail) }, 'reject')}
                        disabled={!rejectInput.trim() || !!loadingAction}
                        className="flex-1 py-2 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-1.5">
                        {loadingAction === 'reject' ? <>{spin} Rejecting…</> : 'Reject'}
                      </button>
                    </div>
                  </div>
                )}

                {!showAssignBox && !showReassignBox && (canAssign || canReassign) && (
                  <div className="flex gap-2">
                    {canAssign && (
                      <button onClick={() => setShowAssignBox(true)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium border border-primary/30 text-primary rounded-lg hover:bg-primary/10 bg-surface-1">
                        <UserPlus size={13} /> {hasActiveAssignment ? 'Add Assignee' : 'Assign'}
                      </button>
                    )}
                    {canReassign && (
                      <button onClick={() => setShowReassignBox(true)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium border border-hairline text-ink-muted rounded-lg hover:bg-surface-2 bg-surface-1">
                        <RefreshCcw size={13} /> Reassign
                      </button>
                    )}
                  </div>
                )}
                {showAssignBox && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold text-ink-subtle uppercase tracking-widest">
                      {hasActiveAssignment ? 'Add Engineers' : 'Assign Engineers'}
                    </p>
                    <div className="border border-hairline rounded-lg bg-surface-2 divide-y divide-hairline max-h-44 overflow-y-auto">
                      {assignableMembers.map(m => {
                        const alreadyActive = localTicket.assignments.some(a => a.assigneeId === m.id && (a.status === 'pending' || a.status === 'active'))
                        const checked = assigneeIds.includes(m.id)
                        return (
                          <label key={m.id} className={`flex items-center gap-2.5 px-3 py-2 select-none ${alreadyActive ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-surface-3'}`}>
                            <input type="checkbox" checked={checked} disabled={alreadyActive}
                              onChange={() => !alreadyActive && setAssigneeIds(prev => checked ? prev.filter(id => id !== m.id) : [...prev, m.id])}
                              className="accent-primary" />
                            <span className="text-xs text-ink flex-1">{m.name}</span>
                            <span className="text-[10px] text-ink-subtle">
                              {alreadyActive ? 'assigned' : `${m.activeAssignmentCount} active`}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                    <input value={assignNote} onChange={e => setAssignNote(e.target.value)} placeholder="Optional note for assignees…"
                      className="w-full text-xs border border-hairline rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-surface-2 text-ink" />
                    <div className="flex gap-2">
                      <button onClick={() => { setShowAssignBox(false); setAssigneeIds([]); setAssignNote('') }}
                        className="flex-1 py-2 text-xs text-ink-muted bg-surface-1 border border-hairline rounded-lg hover:bg-surface-2">Cancel</button>
                      <button onClick={() => runAction(() => { setShowAssignBox(false); return api.liveops.assign(localTicket.id, assigneeIds, assignNote || null, memberEmail) }, 'assign')}
                        disabled={assigneeIds.length === 0 || !!loadingAction}
                        className="flex-1 py-2 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1.5">
                        {loadingAction === 'assign' ? <>{spin} Assigning…</> : `Assign${assigneeIds.length > 1 ? ` (${assigneeIds.length})` : ''}`}
                      </button>
                    </div>
                  </div>
                )}
                {showReassignBox && (
                  <div className="space-y-2 bg-surface-2 rounded-xl p-3 border border-hairline">
                    <p className="text-[10px] font-semibold text-ink-subtle uppercase tracking-widest">Reassign Engineer</p>
                    <select value={reassigneeId} onChange={e => setReassigneeId(e.target.value)}
                      className="w-full text-xs border border-hairline rounded-lg px-3 py-2 bg-surface-1 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-ink">
                      <option value="">Select Engineer…</option>
                      {assignableMembers.map(m => (
                        <option key={m.id} value={m.id}>{m.name} ({m.activeAssignmentCount} active)</option>
                      ))}
                    </select>
                    <input value={reassignReason} onChange={e => setReassignReason(e.target.value)}
                      placeholder="Reason for reassignment (optional)…"
                      className="w-full text-xs border border-hairline rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-surface-1 text-ink" />
                    <input value={reassignNote} onChange={e => setReassignNote(e.target.value)}
                      placeholder="Note for new assignee (optional)…"
                      className="w-full text-xs border border-hairline rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-surface-1 text-ink" />
                    <div className="flex gap-2">
                      <button onClick={() => { setShowReassignBox(false); setReassigneeId(''); setReassignReason(''); setReassignNote('') }}
                        className="flex-1 py-2 text-xs text-ink-muted bg-surface-1 border border-hairline rounded-lg hover:bg-surface-2">Cancel</button>
                      <button onClick={() => runAction(() => {
                        setShowReassignBox(false)
                        return api.liveops.reassign(localTicket.id, reassigneeId, reassignReason || null, reassignNote || null, memberEmail)
                      }, 'reassign')}
                        disabled={!reassigneeId || !!loadingAction}
                        className="flex-1 py-2 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1.5">
                        {loadingAction === 'reassign' ? <>{spin} Reassigning…</> : 'Reassign'}
                      </button>
                    </div>
                  </div>
                )}

                {/* ── TIER 3: Management (side by side) ── */}

                {!showHoldBox && !showUrgencyBox && (canHold || canOverrideUrgency) && (
                  <div className="flex gap-2">
                    {canHold && (
                      <button onClick={() => setShowHoldBox(true)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium border border-amber-500/20 text-amber-400/80 rounded-lg hover:bg-amber-900/15 bg-surface-1">
                        <PauseCircle size={13} /> Put on Hold
                      </button>
                    )}
                    {canOverrideUrgency && (
                      <button onClick={() => setShowUrgencyBox(true)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium border border-hairline text-ink-subtle rounded-lg hover:bg-surface-2 bg-surface-1">
                        <Flame size={13} /> Override Urgency
                      </button>
                    )}
                  </div>
                )}
                {showHoldBox && (
                  <div className="space-y-2">
                    <textarea value={holdInput} onChange={e => setHoldInput(e.target.value)} rows={2}
                      placeholder="Reason for hold (required)…"
                      className="w-full text-xs border border-hairline rounded-lg px-3 py-2 resize-none focus:outline-none bg-surface-2 text-ink" />
                    <div className="flex gap-2">
                      <button onClick={() => setShowHoldBox(false)} className="flex-1 py-2 text-xs text-ink-muted bg-surface-1 border border-hairline rounded-lg">Cancel</button>
                      <button onClick={() => runAction(() => { setShowHoldBox(false); return api.liveops.hold(localTicket.id, holdInput, memberEmail) }, 'hold')}
                        disabled={!holdInput.trim() || !!loadingAction}
                        className="flex-1 py-2 text-xs font-medium bg-amber-600 text-white rounded-lg disabled:opacity-50 flex items-center justify-center gap-1.5">
                        {loadingAction === 'hold' ? <>{spin} Processing…</> : 'Put on Hold'}
                      </button>
                    </div>
                  </div>
                )}
                {showUrgencyBox && (
                  <div className="space-y-2 bg-surface-2 rounded-xl p-3 border border-hairline">
                    <p className="text-[10px] font-semibold text-ink-subtle uppercase tracking-widest">Override Urgency</p>
                    <div className="flex gap-2">
                      {(['high', 'medium', 'low'] as const).map(u => (
                        <button key={u} onClick={() => setOverrideUrgency(u)}
                          className={`flex-1 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                            overrideUrgency === u
                              ? u === 'high' ? 'bg-red-900/20 border-red-900/40 text-red-400' : u === 'medium' ? 'bg-amber-900/20 border-amber-500/40 text-amber-400' : 'bg-success/10 border-success/30 text-success'
                              : 'bg-surface-1 border-hairline text-ink-subtle hover:border-primary/30'
                          }`}>{u.charAt(0).toUpperCase() + u.slice(1)}</button>
                      ))}
                    </div>
                    <input value={urgencyReason} onChange={e => setUrgencyReason(e.target.value)}
                      placeholder="Reason (optional)…"
                      className="w-full text-xs border border-hairline rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-surface-1 text-ink" />
                    <div className="flex gap-2">
                      <button onClick={() => { setShowUrgencyBox(false); setUrgencyReason('') }}
                        className="flex-1 py-2 text-xs text-ink-muted bg-surface-1 border border-hairline rounded-lg hover:bg-surface-2">Cancel</button>
                      <button
                        onClick={() => runAction(() => {
                          setShowUrgencyBox(false)
                          return api.liveops.overrideUrgency(localTicket.id, overrideUrgency, urgencyReason || null, memberEmail)
                        }, 'urgency')}
                        disabled={overrideUrgency === localTicket.urgency || !!loadingAction}
                        className="flex-1 py-2 text-xs font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 flex items-center justify-center gap-1.5">
                        {loadingAction === 'urgency' ? <>{spin} Saving…</> : 'Update Urgency'}
                      </button>
                    </div>
                  </div>
                )}

                {/* ── TIER 4: Destructive ── */}
                {(canRejectAssignment || canCancel) && (
                  <div className="border-t border-hairline pt-2 mt-1 space-y-1">
                    {canRejectAssignment && (
                      showRejectAssignBox ? (
                        <div className="space-y-2">
                          <textarea value={rejectAssignNote} onChange={e => setRejectAssignNote(e.target.value)} rows={2}
                            placeholder="Reason for declining (required)…"
                            className="w-full text-xs border border-hairline rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 bg-surface-2 text-ink" />
                          <div className="flex gap-2">
                            <button onClick={() => { setShowRejectAssignBox(false); setRejectAssignNote('') }}
                              className="flex-1 py-2 text-xs text-ink-muted bg-surface-1 border border-hairline rounded-lg hover:bg-surface-2">Cancel</button>
                            <button onClick={() => runAction(() => { setShowRejectAssignBox(false); return api.liveops.rejectAssignment(localTicket.id, rejectAssignNote, memberEmail) }, 'reject-assign')}
                              disabled={!rejectAssignNote.trim() || !!loadingAction}
                              className="flex-1 py-2 text-xs font-medium bg-red-600 text-white rounded-lg disabled:opacity-50 flex items-center justify-center gap-1.5">
                              {loadingAction === 'reject-assign' ? <>{spin} Processing…</> : 'Decline'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => setShowRejectAssignBox(true)}
                          className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-ink-subtle border border-hairline rounded-lg hover:border-red-900/40 hover:text-red-400 bg-surface-1 transition-colors">
                          <XOctagon size={12} /> Decline Assignment
                        </button>
                      )
                    )}
                    {canCancel && (
                      showCancelBox ? (
                        <div className="space-y-2">
                          <textarea value={cancelInput} onChange={e => setCancelInput(e.target.value)} rows={2}
                            placeholder="Reason for cancellation (required)…"
                            className="w-full text-xs border border-hairline rounded-lg px-3 py-2 resize-none focus:outline-none bg-surface-2 text-ink" />
                          <div className="flex gap-2">
                            <button onClick={() => setShowCancelBox(false)} className="flex-1 py-2 text-xs text-ink-muted bg-surface-1 border border-hairline rounded-lg">Cancel</button>
                            <button onClick={() => runAction(() => { setShowCancelBox(false); return api.liveops.cancel(localTicket.id, cancelInput, memberEmail) }, 'cancel')}
                              disabled={!cancelInput.trim() || !!loadingAction}
                              className="flex-1 py-2 text-xs font-medium bg-surface-3 text-ink rounded-lg disabled:opacity-50 flex items-center justify-center gap-1.5">
                              {loadingAction === 'cancel' ? <>{spin} Cancelling…</> : 'Cancel Ticket'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => setShowCancelBox(true)}
                          className="w-full py-2 text-xs text-ink-subtle hover:text-red-500 transition-colors text-center">
                          Cancel this ticket
                        </button>
                      )
                    )}
                  </div>
                )}

              </div>
            </div>
          )}

          {/* Activity */}
          <div className="px-6 py-4">
            <p className="text-[10px] font-semibold text-ink-subtle uppercase tracking-widest mb-4">
              Activity {nonSystemComments.length > 0 && `· ${nonSystemComments.length} comment${nonSystemComments.length !== 1 ? 's' : ''}`}
            </p>

            {localTicket.comments.length > 0 ? (
              <div className="relative">
                <div className="absolute left-[11px] top-3 bottom-3 w-px bg-hairline" />
                <div className="space-y-3">
                  {[...localTicket.comments]
                    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                    .map(c => c.isSystem ? (
                      <div key={c.id} className="flex items-start gap-3 relative">
                        <div className="w-6 flex items-center justify-center flex-shrink-0 pt-0.5 z-10">
                          <div className="w-2.5 h-2.5 rounded-full bg-surface-3 border border-hairline" />
                        </div>
                        <p className="text-[11px] text-ink-subtle leading-snug flex-1 min-w-0 pb-0.5">
                          {renderMentions(c.body)}
                          <span className="text-ink-tertiary ml-1.5">· {timeAgo(c.createdAt)}</span>
                        </p>
                      </div>
                    ) : (
                      <div key={c.id} className="flex items-start gap-3 relative">
                        <div className="flex-shrink-0 z-10">
                          <Avatar name={c.authorName} size="sm" />
                        </div>
                        <div className="flex-1 min-w-0 bg-surface-2 rounded-xl px-3 py-2.5 border border-hairline">
                          <div className="flex items-baseline gap-1.5 mb-1">
                            <span className="text-xs font-medium text-ink">{c.authorName ?? 'Unknown'}</span>
                            <span className="text-[10px] text-ink-subtle">{timeAgo(c.createdAt)}</span>
                          </div>
                          <p className="text-xs text-ink-muted leading-relaxed">{renderMentions(c.body)}</p>
                        </div>
                      </div>
                    ))
                  }
                </div>
              </div>
            ) : (
              <p className="text-xs text-ink-subtle text-center py-4">No activity yet.</p>
            )}

            {/* Add comment */}
            {!['completed', 'rejected', 'cancelled'].includes(localTicket.status) && (
              <div className="flex gap-2 mt-4">
                <MentionInput
                  value={comment}
                  onChange={(display, resolved) => { setComment(display); setCommentResolved(resolved) }}
                  members={assignableMembers}
                  placeholder="Add a comment… use @ to mention"
                  rows={2}
                />
                <button onClick={postComment} disabled={!comment.trim() || postingComment}
                  className="px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-40 flex-shrink-0 self-end">
                  <CornerDownLeft size={13} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── tabs ──────────────────────────────────────────────────────────────────────

type TabId = 'my-tickets' | 'approvals' | 'my-work' | 'all-tickets' | 'admin'

// ── main component ────────────────────────────────────────────────────────────

export default function LiveOps() {
  const { currentUser } = useAppContext()
  const memberEmail = currentUser?.email ?? ''
  const memberId = currentUser?.memberId ?? null
  const [activeTab, setActiveTab] = useState<TabId>('my-tickets')
  const [analytics, setAnalytics] = useState<LiveOpsAnalyticsSummary | null>(null)

  // Lookup data
  const [businessUnits, setBusinessUnits] = useState<LiveOpsBusinessUnit[]>([])
  const [ticketTypes, setTicketTypes] = useState<LiveOpsTicketType[]>([])
  const [useCases, setUseCases] = useState<LiveOpsUseCase[]>([])
  const [memberRoles, setMemberRoles] = useState<LiveOpsMemberRoleRecord[]>([])
  const [slaConfigs, setSlaConfigs] = useState<LiveOpsSlaConfig[]>([])
  const [approverConfigs, setApproverConfigs] = useState<LiveOpsApproverConfig[]>([])
  const [assignableMembers, setAssignableMembers] = useState<LiveOpsAssignableMember[]>([])

  // Ticket lists per tab
  const [myTickets, setMyTickets] = useState<LiveOpsTicketListItem[]>([])
  const [approvalTickets, setApprovalTickets] = useState<LiveOpsTicketListItem[]>([])
  const [myWorkTickets, setMyWorkTickets] = useState<LiveOpsTicketListItem[]>([])
  const [allTickets, setAllTickets] = useState<LiveOpsTicketListItem[]>([])

  // UI state
  const [myTicketsView, setMyTicketsView] = useState<'active' | 'history'>('active')
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null)
  const [showSubmit, setShowSubmit] = useState(false)
  const [detailTicket, setDetailTicket] = useState<LiveOpsTicketDetail | null>(null)
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [allTicketsFilter, setAllTicketsFilter] = useState('')
  const [allTicketsStatus, setAllTicketsStatus] = useState('')

  // Admin UI state
  const [adminNewRole, setAdminNewRole] = useState({ memberId: '', role: '' })
  const [adminNewCfg, setAdminNewCfg] = useState({ ticketTypeId: '', businessUnitId: '', workstreamLeadId: '', teamLeadId: '' })
  const [adminSlaEdit, setAdminSlaEdit] = useState<Record<string, number>>({})
  const [adminSaving, setAdminSaving] = useState(false)
  const [teamMembers, setTeamMembers] = useState<Array<{ id: string; name: string }>>([])

  // Derived roles
  const myRoles = useMemo(() => {
    if (!memberId) return new Set<string>()
    return new Set(memberRoles.filter(r => r.memberId === memberId).map(r => r.role))
  }, [memberRoles, memberId])

  const isLoManager = currentUser?.teamId === 'liveops' && ['lead', 'head'].includes(currentUser?.role ?? '')
  const isAdmin = currentUser?.role === 'admin' || !!(currentUser?.hasAdminAccess)

  // Visible tabs
  const tabs = useMemo((): Array<{ id: TabId; label: string; count?: number }> => {
    const result: Array<{ id: TabId; label: string; count?: number }> = [
      { id: 'my-tickets', label: 'My Tickets', count: myTickets.filter(t => !['completed', 'cancelled', 'rejected'].includes(t.status)).length || undefined },
    ]
    if (myRoles.has('workstream_lead') || myRoles.has('team_lead') || isLoManager || isAdmin) {
      result.push({ id: 'approvals', label: 'Approvals', count: approvalTickets.length || undefined })
    }
    if (currentUser?.teamId === 'pe' || currentUser?.teamId === 'liveops' || isAdmin) {
      result.push({ id: 'my-work', label: 'My Work', count: myWorkTickets.length || undefined })
    }
    if (isAdmin || isLoManager) {
      result.push({ id: 'all-tickets', label: 'All Tickets' })
      result.push({ id: 'admin', label: 'Admin' })
    }
    return result
  }, [myRoles, myTickets, approvalTickets, myWorkTickets, isAdmin, isLoManager, currentUser])

  // Load lookup tables on mount — no auth required for any of these
  const loadInitial = useCallback(async () => {
    setLoadingInitial(true)
    try {
      const [bus, tts, ucs, roles, ana, approver] = await Promise.all([
        api.liveops.getBusinessUnits().catch(() => [] as LiveOpsBusinessUnit[]),
        api.liveops.getTicketTypes().catch(() => [] as LiveOpsTicketType[]),
        api.liveops.getUseCases().catch(() => [] as LiveOpsUseCase[]),
        api.liveops.getMemberRoles().catch(() => [] as LiveOpsMemberRoleRecord[]),
        api.liveops.getAnalyticsSummary().catch(() => null),
        api.liveops.getApproverConfig().catch(() => [] as LiveOpsApproverConfig[]),
      ])
      setBusinessUnits(bus); setTicketTypes(tts); setUseCases(ucs)
      setMemberRoles(roles); setAnalytics(ana); setApproverConfigs(approver)
    } finally {
      setLoadingInitial(false)
    }
  }, [])

  const loadTabData = useCallback(async (tab: TabId) => {
    if (!memberEmail || !memberId) return
    if (tab === 'my-tickets') {
      const d = await api.liveops.listTickets({ submittedById: memberId })
      setMyTickets(d)
    } else if (tab === 'approvals') {
      const pending = await api.liveops.listTickets()
      const mine = pending.filter(t =>
        (t.status === 'pending_wl' && (t.workstreamLeadId === memberId || isAdmin)) ||
        (t.status === 'pending_tl' && (t.teamLeadId === memberId || isAdmin)) ||
        (t.status === 'pending_lo' && (isLoManager || isAdmin))
      )
      setApprovalTickets(mine)
    } else if (tab === 'my-work') {
      const d = await api.liveops.listTickets({ assignedToId: memberId })
      setMyWorkTickets(d.filter(t => !['completed', 'cancelled', 'rejected'].includes(t.status)))
    } else if (tab === 'all-tickets') {
      const d = await api.liveops.listTickets()
      setAllTickets(d)
    } else if (tab === 'admin') {
      const [sla, approver, assignable] = await Promise.all([
        api.liveops.getSlaConfig(),
        api.liveops.getApproverConfig(),
        api.liveops.getAssignableMembers(),
      ])
      setSlaConfigs(sla)
      setApproverConfigs(approver)
      setAssignableMembers(assignable)
      // Also load team members for role assignment
      const members = await api.settings.getMembers().catch(() => [])
      setTeamMembers(members.map((m: { id: string; name: string }) => ({ id: m.id, name: m.name })))
    }
  }, [memberEmail, memberId, myRoles, isAdmin, isLoManager])

  useEffect(() => { loadInitial() }, [loadInitial])
  useEffect(() => {
    if (!loadingInitial) loadTabData(activeTab)
  }, [activeTab, loadingInitial, loadTabData])

  async function openDetail(id: string) {
    setLoadingDetailId(id)
    try {
      const d = await api.liveops.getTicket(id)
      setDetailTicket(d)
      if (isAdmin || isLoManager) {
        const members = await api.liveops.getAssignableMembers()
        setAssignableMembers(members)
      }
    } finally {
      setLoadingDetailId(null)
    }
  }

  function handleAction(updated: LiveOpsTicketDetail) {
    setDetailTicket(updated)
    // Refresh the active tab list
    loadTabData(activeTab)
    api.liveops.getAnalyticsSummary().then(setAnalytics).catch(() => {})
  }

  // ── filter for all tickets tab
  const filteredAllTickets = useMemo(() => {
    let list = allTickets
    if (allTicketsStatus) list = list.filter(t => t.status === allTicketsStatus)
    if (allTicketsFilter) {
      const q = allTicketsFilter.toLowerCase()
      list = list.filter(t =>
        t.ticketTypeName.toLowerCase().includes(q) ||
        t.businessUnitName.toLowerCase().includes(q) ||
        t.useCaseName.toLowerCase().includes(q) ||
        t.submittedByName.toLowerCase().includes(q) ||
        String(t.ticketNumber).includes(q)
      )
    }
    return list
  }, [allTickets, allTicketsFilter, allTicketsStatus])

  // ── render ────────────────────────────────────────────────────────────────

  if (loadingInitial) {
    return (
      <div className="flex-1 bg-surface-2 p-4 sm:p-6 space-y-4">
        <div className="skeleton h-8 w-64 rounded-lg" />
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
        </div>
        <div className="skeleton h-10 w-full rounded-xl" />
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 bg-surface-2 flex flex-col min-h-0">
      {/* Page header */}
      <div className="bg-gradient-to-r from-surface-1 to-canvas border-b border-hairline px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
            <LayoutList size={16} className="text-primary" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-semibold text-ink leading-tight">LiveOps Ticketing</h1>
            <p className="hidden sm:block text-[11px] text-ink-subtle">Operational request tracking and fulfillment</p>
          </div>
        </div>
        <button onClick={() => setShowSubmit(true)}
          className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors">
          <Plus size={14} /> <span className="hidden sm:inline">New Ticket</span><span className="sm:hidden">New</span>
        </button>
      </div>

      {/* Stat bar */}
      {analytics && (
        <div className="px-3 sm:px-6 py-3 sm:py-4 grid grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 border-b border-hairline bg-surface-1/40">
          <StatCard icon={Layers} label="Total Open" value={analytics.totalOpen} color="text-primary" accentLine="bg-primary/40" />
          <StatCard icon={Hourglass} label="Pending Approval" value={analytics.pendingApproval} color="text-amber-400" accentLine="bg-amber-400/40" />
          <StatCard icon={Activity} label="In Progress" value={analytics.inProgress} color="text-sky-400" accentLine="bg-sky-400/40" />
          <StatCard
            icon={AlertOctagon}
            label="SLA Breaching"
            value={analytics.slaBreaching}
            color={analytics.slaBreaching > 0 ? "text-red-400" : "text-ink-subtle"}
            accentLine={analytics.slaBreaching > 0 ? "bg-red-400/50" : "bg-surface-3"}
          />
          <StatCard icon={TrendingUp} label="Done This Month" value={analytics.completedThisMonth} color="text-emerald-400" accentLine="bg-emerald-400/40" />
          <StatCard
            icon={BarChart2}
            label="Avg Resolution"
            value={analytics.avgResolutionHours != null ? `${analytics.avgResolutionHours}h` : '—'}
            color="text-ink-muted"
            accentLine="bg-surface-3"
          />
        </div>
      )}

      {/* Tab bar */}
      <div className="bg-canvas border-b border-hairline px-2 sm:px-6 overflow-x-auto">
        <div className="flex gap-0 min-w-max sm:min-w-0">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-b-2 transition-all ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-ink-subtle hover:text-ink-muted'
              }`}>
              {activeTab === tab.id ? (
                <span className="flex items-center gap-1.5 bg-primary/10 px-2 py-0.5 rounded-md -mx-2">
                  {tab.label}
                  {tab.count != null && tab.count > 0 && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/20 text-primary">{tab.count}</span>
                  )}
                </span>
              ) : (
                <>
                  {tab.label}
                  {tab.count != null && tab.count > 0 && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-surface-3 text-ink-subtle">{tab.count}</span>
                  )}
                </>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 sm:py-5 space-y-3">

        {/* ── My Tickets ── */}
        {activeTab === 'my-tickets' && (() => {
          const activeMyTickets = myTickets.filter(t => !['completed', 'cancelled', 'rejected'].includes(t.status))
          const historyMyTickets = myTickets.filter(t => ['completed', 'cancelled', 'rejected'].includes(t.status))
          const shown = myTicketsView === 'active' ? activeMyTickets : historyMyTickets
          return (
            <>
              {/* Toggle */}
              <div className="flex items-center gap-1 bg-surface-3 rounded-lg p-1 w-fit mb-1">
                {(['active', 'history'] as const).map(v => (
                  <button key={v} onClick={() => setMyTicketsView(v)}
                    className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${myTicketsView === v ? 'bg-surface-1 text-ink shadow-sm' : 'text-ink-subtle hover:text-ink-muted'}`}>
                    {v === 'active' ? `Active${activeMyTickets.length > 0 ? ` (${activeMyTickets.length})` : ''}` : `History${historyMyTickets.length > 0 ? ` (${historyMyTickets.length})` : ''}`}
                  </button>
                ))}
              </div>

              {shown.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-surface-2 to-surface-3 ring-1 ring-hairline flex items-center justify-center mb-3">
                    <LayoutList size={22} className="text-ink-subtle" />
                  </div>
                  {myTicketsView === 'active' ? (
                    <>
                      <p className="text-sm font-medium text-ink-muted">No active tickets</p>
                      <p className="text-xs text-ink-subtle mt-1">Submit a new ticket to get started</p>
                      <button onClick={() => setShowSubmit(true)} className="mt-4 flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90">
                        <Plus size={14} /> New Ticket
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-ink-muted">No history yet</p>
                      <p className="text-xs text-ink-subtle mt-1">Completed, cancelled, and rejected tickets appear here</p>
                    </>
                  )}
                </div>
              ) : (
                shown.map(t => <TicketRow key={t.id} ticket={t} onClick={() => openDetail(t.id)} isLoading={loadingDetailId === t.id} />)
              )}
            </>
          )
        })()}

        {/* ── Approvals ── */}
        {activeTab === 'approvals' && (
          <>
            {approvalTickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/5 to-emerald-500/12 ring-1 ring-emerald-500/20 flex items-center justify-center mb-3">
                  <CheckCircle2 size={22} className="text-emerald-400" />
                </div>
                <p className="text-sm font-medium text-ink-muted">All clear</p>
                <p className="text-xs text-ink-subtle mt-1">No tickets waiting for your approval</p>
              </div>
            ) : (
              approvalTickets.map(t => (
                <div key={t.id} className="bg-surface-1 rounded-xl border border-amber-500/30 p-4 hover:border-amber-500/40 hover:shadow-sm transition-all">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <TicketNumberBadge n={t.ticketNumber} />
                        <UrgencyBadge urgency={t.urgency} />
                        <StatusBadge status={t.status} />
                      </div>
                      <p className="text-xs font-medium text-ink">{t.ticketTypeName}</p>
                      <p className="text-[10px] text-ink-subtle mt-0.5">{t.businessUnitName} · {t.useCaseName} · by {t.submittedByName} · {timeAgo(t.submittedAt)}</p>
                    </div>
                    <button
                      onClick={() => openDetail(t.id)}
                      disabled={!!loadingDetailId}
                      className="text-[11px] text-primary font-medium px-3 py-1.5 bg-primary/10 rounded-lg hover:bg-primary/20 flex-shrink-0 disabled:opacity-50 flex items-center gap-1">
                      {loadingDetailId === t.id ? <RefreshCw size={11} className="animate-spin" /> : null}
                      Review
                    </button>
                  </div>
                  {/* Quick approve — shown only to the actual approver for that stage */}
                  <div className="flex gap-2 mt-3 pt-3 border-t border-hairline">
                    {(() => {
                      const canQuickApprove =
                        (t.status === 'pending_wl' && (t.workstreamLeadId === memberId || isAdmin)) ||
                        (t.status === 'pending_tl' && (t.teamLeadId === memberId || isAdmin))
                      return canQuickApprove ? (
                        <button
                          disabled={!!approvingId || !!loadingDetailId}
                          onClick={async () => {
                            setApprovingId(t.id)
                            try {
                              await api.liveops.approve(t.id, null, memberEmail)
                              loadTabData('approvals')
                              api.liveops.getAnalyticsSummary().then(setAnalytics).catch(() => {})
                            } catch (e) { console.error(e) }
                            finally { setApprovingId(null) }
                          }}
                          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                          {approvingId === t.id
                            ? <><RefreshCw size={12} className="animate-spin" /> Approving…</>
                            : <><Check size={12} /> Approve</>
                          }
                        </button>
                      ) : (
                        <button
                          onClick={() => openDetail(t.id)}
                          disabled={!!loadingDetailId}
                          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                          {loadingDetailId === t.id
                            ? <><RefreshCw size={12} className="animate-spin" /> Loading…</>
                            : <><Check size={12} /> Approve &amp; Assign</>
                          }
                        </button>
                      )
                    })()}
                    <button onClick={() => openDetail(t.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium bg-surface-1 border border-red-900/40 text-red-400 rounded-lg hover:bg-red-900/20">
                      <XOctagon size={12} /> Reject (with reason)
                    </button>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {/* ── My Work ── */}
        {activeTab === 'my-work' && (
          <>
            {myWorkTickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/5 to-primary/12 ring-1 ring-primary/20 flex items-center justify-center mb-3">
                  <Wrench size={22} className="text-primary/60" />
                </div>
                <p className="text-sm font-medium text-ink-muted">No active assignments</p>
                <p className="text-xs text-ink-subtle mt-1">Assignments from LO Manager will appear here</p>
              </div>
            ) : (
              myWorkTickets.map(t => <TicketRow key={t.id} ticket={t} onClick={() => openDetail(t.id)} isLoading={loadingDetailId === t.id} />)
            )}
          </>
        )}

        {/* ── All Tickets ── */}
        {activeTab === 'all-tickets' && (
          <>
            {/* Filter bar */}
            <div className="flex flex-col sm:flex-row gap-2 mb-1">
              <div className="flex gap-2 flex-1">
                <div className="flex-1 relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" />
                  <input value={allTicketsFilter} onChange={e => setAllTicketsFilter(e.target.value)}
                    placeholder="Search tickets…"
                    className="w-full text-xs border border-hairline rounded-lg pl-8 pr-3 py-2 bg-surface-1 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-ink" />
                </div>
                <button onClick={() => loadTabData('all-tickets')}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-hairline bg-surface-1 hover:bg-surface-2 text-ink-subtle flex-shrink-0">
                  <RefreshCw size={13} />
                </button>
              </div>
              <select value={allTicketsStatus} onChange={e => setAllTicketsStatus(e.target.value)}
                className="text-xs border border-hairline rounded-lg px-3 py-2 bg-surface-1 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-ink">
                <option value="">All Statuses</option>
                {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <p className="text-[10px] text-ink-subtle mb-2">{filteredAllTickets.length} ticket{filteredAllTickets.length !== 1 ? 's' : ''}</p>
            {filteredAllTickets.length === 0 ? (
              <div className="text-center py-12 text-sm text-ink-subtle">No tickets match your filters</div>
            ) : (
              filteredAllTickets.map(t => <TicketRow key={t.id} ticket={t} onClick={() => openDetail(t.id)} isLoading={loadingDetailId === t.id} />)
            )}
          </>
        )}

        {/* ── Admin ── */}
        {activeTab === 'admin' && (
          <div className="space-y-6 max-w-2xl">
            {/* ── Reports ── */}
            <ReportCard />

            {/* SLA Config */}
            <div className="bg-surface-1 rounded-xl border border-hairline px-5 py-5">
              <p className="text-xs font-semibold text-ink mb-4 flex items-center gap-2"><Hourglass size={14} className="text-primary" /> SLA Response Times</p>
              <div className="space-y-3">
                {slaConfigs.map(cfg => (
                  <div key={cfg.id} className="flex items-center gap-3">
                    <UrgencyBadge urgency={cfg.urgency} />
                    <div className="flex-1 flex items-center gap-2">
                      <input
                        type="number" min={1} max={720}
                        defaultValue={cfg.responseHours}
                        onChange={e => setAdminSlaEdit(prev => ({ ...prev, [cfg.urgency]: Number(e.target.value) }))}
                        className="w-20 text-xs border border-hairline rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-surface-2 text-ink"
                      />
                      <span className="text-xs text-ink-muted">hours</span>
                    </div>
                    <button
                      onClick={async () => {
                        const hours = adminSlaEdit[cfg.urgency] ?? cfg.responseHours
                        setAdminSaving(true)
                        try {
                          const updated = await api.liveops.updateSlaConfig(cfg.urgency, hours)
                          setSlaConfigs(prev => prev.map(s => s.urgency === cfg.urgency ? updated : s))
                        } finally { setAdminSaving(false) }
                      }}
                      disabled={adminSaving}
                      className="text-[11px] font-medium px-3 py-1.5 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50">
                      Save
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Member Roles */}
            <div className="bg-surface-1 rounded-xl border border-hairline px-5 py-5">
              <p className="text-xs font-semibold text-ink mb-4 flex items-center gap-2"><Wrench size={14} className="text-primary" /> LiveOps Roles</p>
              <div className="space-y-2 mb-4">
                {memberRoles.length === 0 && <p className="text-xs text-ink-subtle">No roles assigned yet.</p>}
                {memberRoles.map(r => (
                  <div key={r.id} className="flex items-center justify-between px-3 py-2 bg-surface-2 rounded-lg border border-hairline">
                    <div className="flex items-center gap-2">
                      <Avatar name={r.memberName} size="sm" />
                      <span className="text-xs font-medium text-ink">{r.memberName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/20 text-primary">{ROLE_LABEL[r.role]}</span>
                      <button onClick={async () => {
                        await api.liveops.deleteMemberRole(r.id)
                        setMemberRoles(prev => prev.filter(x => x.id !== r.id))
                      }} className="w-6 h-6 flex items-center justify-center rounded text-ink-subtle hover:text-red-500 hover:bg-red-900/20">
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {/* Add role */}
              <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-hairline">
                <select value={adminNewRole.memberId} onChange={e => setAdminNewRole(r => ({ ...r, memberId: e.target.value }))}
                  className="flex-1 text-xs border border-hairline rounded-lg px-3 py-2 bg-surface-2 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-ink">
                  <option value="">Select member…</option>
                  {teamMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                <div className="flex gap-2">
                  <select value={adminNewRole.role} onChange={e => setAdminNewRole(r => ({ ...r, role: e.target.value }))}
                    className="flex-1 text-xs border border-hairline rounded-lg px-3 py-2 bg-surface-2 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-ink">
                    <option value="">Select role…</option>
                    {Object.entries(ROLE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <button onClick={async () => {
                    if (!adminNewRole.memberId || !adminNewRole.role) return
                    const r = await api.liveops.createMemberRole(adminNewRole.memberId, adminNewRole.role)
                    setMemberRoles(prev => [...prev, r])
                    setAdminNewRole({ memberId: '', role: '' })
                  }} disabled={!adminNewRole.memberId || !adminNewRole.role}
                    className="px-3 py-2 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-40 flex-shrink-0">
                    <Plus size={12} />
                  </button>
                </div>
              </div>
            </div>

            {/* Approver Config */}
            <div className="bg-surface-1 rounded-xl border border-hairline px-5 py-5">
              <p className="text-xs font-semibold text-ink mb-4 flex items-center gap-2"><SlidersHorizontal size={14} className="text-primary" /> Approval Routing</p>
              <div className="space-y-2 mb-4">
                {approverConfigs.length === 0 && <p className="text-xs text-ink-subtle">No routing config yet. Add a rule below.</p>}
                {approverConfigs.map(cfg => (
                  <div key={cfg.id} className="flex items-center justify-between px-3 py-2.5 bg-surface-2 rounded-lg border border-hairline">
                    <div>
                      <p className="text-xs font-medium text-ink">{cfg.ticketTypeName} + {cfg.businessUnitName}</p>
                      <p className="text-[10px] text-ink-subtle">
                        WL: {cfg.workstreamLeadName ?? '—'} · PL: {cfg.teamLeadName ?? '—'}
                      </p>
                    </div>
                    <button onClick={async () => {
                      await api.liveops.deleteApproverConfig(cfg.id)
                      setApproverConfigs(prev => prev.filter(x => x.id !== cfg.id))
                    }} className="w-6 h-6 flex items-center justify-center rounded text-ink-subtle hover:text-red-500 hover:bg-red-900/20">
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add new routing rule */}
              <div className="border-t border-hairline pt-4 space-y-2">
                <p className="text-[10px] font-semibold text-ink-subtle uppercase tracking-widest mb-2">Add Routing Rule</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <select value={adminNewCfg.ticketTypeId} onChange={e => setAdminNewCfg(c => ({ ...c, ticketTypeId: e.target.value }))}
                    className="text-xs border border-hairline rounded-lg px-3 py-2 bg-surface-2 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-ink">
                    <option value="">Ticket type…</option>
                    {ticketTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <select value={adminNewCfg.businessUnitId} onChange={e => setAdminNewCfg(c => ({ ...c, businessUnitId: e.target.value }))}
                    className="text-xs border border-hairline rounded-lg px-3 py-2 bg-surface-2 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-ink">
                    <option value="">Business unit…</option>
                    {businessUnits.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  <select value={adminNewCfg.workstreamLeadId} onChange={e => setAdminNewCfg(c => ({ ...c, workstreamLeadId: e.target.value }))}
                    className="text-xs border border-hairline rounded-lg px-3 py-2 bg-surface-2 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-ink">
                    <option value="">Workstream Lead (required)…</option>
                    {teamMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                  <select value={adminNewCfg.teamLeadId} onChange={e => setAdminNewCfg(c => ({ ...c, teamLeadId: e.target.value }))}
                    className="text-xs border border-hairline rounded-lg px-3 py-2 bg-surface-2 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-ink">
                    <option value="">Practice Lead (optional)…</option>
                    {teamMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <button
                  onClick={async () => {
                    if (!adminNewCfg.ticketTypeId || !adminNewCfg.businessUnitId || !adminNewCfg.workstreamLeadId) return
                    try {
                      const created = await api.liveops.createApproverConfig({
                        ticket_type_id: adminNewCfg.ticketTypeId,
                        business_unit_id: adminNewCfg.businessUnitId,
                        workstream_lead_id: adminNewCfg.workstreamLeadId || null,
                        team_lead_id: adminNewCfg.teamLeadId || null,
                      })
                      setApproverConfigs(prev => [...prev, created])
                      setAdminNewCfg({ ticketTypeId: '', businessUnitId: '', workstreamLeadId: '', teamLeadId: '' })
                    } catch (e) {
                      console.error(e)
                    }
                  }}
                  disabled={!adminNewCfg.ticketTypeId || !adminNewCfg.businessUnitId || !adminNewCfg.workstreamLeadId || adminSaving}
                  className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-40">
                  <Plus size={12} /> Add Rule
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Submit panel */}
      {showSubmit && (
        <SubmitPanel
          onClose={() => setShowSubmit(false)}
          onSubmitted={() => { setShowSubmit(false); loadTabData('my-tickets') }}
          businessUnits={businessUnits}
          ticketTypes={ticketTypes}
          useCases={useCases}
          approverConfigs={approverConfigs}
          memberEmail={memberEmail}
        />
      )}

      {/* Detail panel */}
      {detailTicket && (
        <DetailPanel
          ticket={detailTicket}
          onClose={() => setDetailTicket(null)}
          onAction={handleAction}
          memberEmail={memberEmail}
          memberId={memberId}
          isLoManager={isLoManager || isAdmin}
          isAdmin={isAdmin}
          assignableMembers={assignableMembers}
        />
      )}
    </div>
  )
}
