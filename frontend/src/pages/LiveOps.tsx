import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Plus, X, Check, XCircle, AlertTriangle, ChevronRight,
  MessageSquare, Search, RefreshCw, Settings2, Zap,
  Clock, CheckCircle2, Shield, Users, Timer,
  ArrowRight, Trash2, AlertCircle, FileText, Download,
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
  high:   'bg-red-100 text-red-400 border-red-900/40',
  medium: 'bg-amber-100 text-amber-400 border-amber-500/30',
  low:    'bg-emerald-100 text-emerald-700 border-emerald-200',
}

const STATUS_COLOR: Record<string, string> = {
  draft:       'bg-surface-3 text-ink-subtle',
  pending_wl:  'bg-amber-100 text-amber-400',
  pending_tl:  'bg-amber-100 text-amber-400',
  pending_lo:  'bg-orange-100 text-orange-700',
  open:        'bg-primary/10 text-primary-hover',
  in_progress: 'bg-primary/10 text-primary-hover',
  completed:   'bg-emerald-100 text-emerald-700',
  rejected:    'bg-red-100 text-red-400',
  cancelled:   'bg-surface-3 text-ink-subtle',
  on_hold:     'bg-amber-100 text-amber-400',
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', pending_wl: 'Pending WL', pending_tl: 'Pending TL',
  pending_lo: 'Pending LO', open: 'Open', in_progress: 'In Progress',
  completed: 'Completed', rejected: 'Rejected', cancelled: 'Cancelled', on_hold: 'On Hold',
}

const ROLE_LABEL: Record<LiveOpsMemberRoleType, string> = {
  workstream_lead: 'Workstream Lead', team_lead: 'Team Lead',
  lo_manager: 'LO Manager', platform_engineer: 'Platform Engineer',
  liveops_engineer: 'LiveOps Engineer',
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
  if (!deadline || ['completed', 'rejected', 'cancelled'].includes(status)) return 'none'
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
    <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border ${URGENCY_COLOR[urgency]}`}>
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

function Avatar({ name, size = 'sm' }: { name: string | null; size?: 'sm' | 'md' }) {
  const s = size === 'md' ? 'w-8 h-8 text-[11px]' : 'w-6 h-6 text-[10px]'
  return (
    <div className={`${s} rounded-md bg-primary flex items-center justify-center text-white font-semibold flex-shrink-0`}>
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

function StatCard({ icon: Icon, label, value, color, sub }: {
  icon: React.ElementType; label: string; value: number | string; color: string; sub?: string
}) {
  return (
    <div className="bg-surface-1 rounded-xl border border-hairline px-4 py-4 flex items-start gap-3">
      <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center flex-shrink-0`}>
        <Icon size={15} className="text-current" />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-bold text-ink leading-none">{value}</p>
        <p className="text-[10px] text-ink-muted mt-1">{label}</p>
        {sub && <p className="text-[10px] text-ink-subtle mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── ticket row (compact list) ─────────────────────────────────────────────────

function TicketRow({ ticket, onClick }: { ticket: LiveOpsTicketListItem; onClick: () => void }) {
  const sla = slaStatus(ticket.slaDeadline, ticket.status)
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-surface-1 rounded-xl border border-hairline px-4 py-3.5 hover:border-primary/40 hover:shadow-sm transition-all group"
    >
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-start gap-1.5 min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <TicketNumberBadge n={ticket.ticketNumber} />
            <UrgencyBadge urgency={ticket.urgency} />
            <StatusBadge status={ticket.status} />
            {sla === 'breached' && (
              <span className="text-[10px] font-semibold text-red-400 bg-red-900/20 px-1.5 py-0.5 rounded">
                {slaLabel(ticket.slaDeadline)}
              </span>
            )}
            {sla === 'warning' && (
              <span className="text-[10px] font-semibold text-amber-400 bg-amber-900/20 px-1.5 py-0.5 rounded">
                {slaLabel(ticket.slaDeadline)}
              </span>
            )}
          </div>
          <p className="text-xs font-medium text-ink">{ticket.ticketTypeName}</p>
          <p className="text-[10px] text-ink-subtle">
            {ticket.businessUnitName} · {ticket.useCaseName}
            {ticket.currentlyWithName && <> · <span className="text-ink-muted">With: {ticket.currentlyWithName}</span></>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] text-ink-subtle">{timeAgo(ticket.submittedAt ?? ticket.createdAt)}</span>
          <ChevronRight size={14} className="text-ink-subtle group-hover:text-ink-muted transition-colors" />
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
      label: 'Team Lead',
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
      label: ticket.status === 'completed' ? 'Completed' : ticket.status === 'in_progress' ? 'In Progress' : 'Resolution',
      actor: ticket.status === 'completed' ? ticket.completedAt ? timeAgo(ticket.completedAt) : null : null,
      date: ticket.completedAt,
      status:
        ticket.status === 'completed' ? 'done' :
        ['open', 'in_progress', 'on_hold'].includes(ticket.status) ? 'active' : 'waiting',
    },
  ]

  return (
    <div className="flex items-start overflow-x-auto gap-0 pb-1">
      {stages.map((stage, i) => (
        <div key={stage.label} className="flex items-start">
          <div className="flex flex-col items-center" style={{ minWidth: 80 }}>
            <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center ${
              stage.status === 'done'     ? 'border-emerald-500 bg-success/100' :
              stage.status === 'rejected' ? 'border-red-400 bg-red-400' :
              stage.status === 'active'   ? 'border-primary bg-primary/10' :
              'border-hairline bg-surface-1'
            }`}>
              {stage.status === 'done'     ? <Check size={11} className="text-white" /> :
               stage.status === 'rejected' ? <X size={11} className="text-white" /> :
               stage.status === 'active'   ? <div className="w-2 h-2 rounded-full bg-primary animate-pulse" /> :
               <div className="w-2 h-2 rounded-full bg-surface-3" />}
            </div>
            <p className="text-[9px] font-semibold text-ink-muted mt-1.5 text-center leading-tight px-1">{stage.label}</p>
            {stage.actor && <p className="text-[9px] text-ink-subtle text-center max-w-[78px] truncate">{stage.actor}</p>}
          </div>
          {i < stages.length - 1 && (
            <div className="flex items-center mt-3.5" style={{ minWidth: 20 }}>
              <div className={`h-0.5 w-full ${stage.status === 'done' ? 'bg-emerald-300' : 'bg-hairline'}`} />
            </div>
          )}
        </div>
      ))}
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
      <div className="relative w-[500px] bg-surface-1 h-full flex flex-col shadow-2xl border-l border-hairline">
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
                <select value={form.ticketTypeId} onChange={e => setForm(f => ({ ...f, ticketTypeId: e.target.value }))}
                  className="w-full text-sm border border-hairline rounded-lg px-3 py-2 bg-surface-2 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-ink">
                  <option value="">Select type…</option>
                  {ticketTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                {selectedType?.guideText && (
                  <div className="mt-2 px-3 py-2 bg-primary/10 border border-primary/20 rounded-lg text-[11px] text-primary">
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
                    <ArrowRight size={10} /> Approval Routing
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
                        <span className="text-[10px] font-semibold text-ink-subtle w-28 flex-shrink-0">Team Lead</span>
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
                <ArrowRight size={11} />
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

// ── ticket detail panel ───────────────────────────────────────────────────────

interface DetailPanelProps {
  ticket: LiveOpsTicketDetail
  onClose: () => void
  onAction: (updated: LiveOpsTicketDetail) => void
  memberEmail: string
  memberId: string | null
  myRoles: Set<string>
  isAdmin: boolean
  assignableMembers: LiveOpsAssignableMember[]
}

function DetailPanel({ ticket, onClose, onAction, memberEmail, memberId, myRoles, isAdmin, assignableMembers }: DetailPanelProps) {
  const [comment, setComment] = useState('')
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
  const [assigneeId, setAssigneeId] = useState('')
  const [assignNote, setAssignNote] = useState('')
  // LO approve+assign modal
  const [showLoApproveBox, setShowLoApproveBox] = useState(false)
  const [loApproveAssigneeId, setLoApproveAssigneeId] = useState('')
  const [loApproveNote, setLoApproveNote] = useState('')
  const [completeNote, setCompleteNote] = useState('')
  const [showCompleteBox, setShowCompleteBox] = useState(false)
  const [rejectAssignNote, setRejectAssignNote] = useState('')
  const [showRejectAssignBox, setShowRejectAssignBox] = useState(false)
  // Draft edit & resubmit
  const [showEditDraft, setShowEditDraft] = useState(false)
  const [editDesc, setEditDesc] = useState(ticket.description)
  const [editUrgency, setEditUrgency] = useState<LiveOpsUrgency>(ticket.urgency)
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

  const isLoManager = myRoles.has('lo_manager') || isAdmin
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
      const c: LiveOpsComment = await api.liveops.addComment(localTicket.id, comment.trim(), memberEmail)
      setLocalTicket(t => ({ ...t, comments: [...t.comments, c] }))
      setComment('')
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
  const canAssign = isLoManager && ['open', 'in_progress'].includes(localTicket.status) && !hasActiveAssignment
  const canHold = isLoManager && ['open', 'in_progress', 'pending_lo'].includes(localTicket.status)
  const canResume = isLoManager && localTicket.status === 'on_hold'
  const canCancel = (isSubmitter || isLoManager) && !['completed', 'rejected', 'cancelled'].includes(localTicket.status)
  const canPickup = !!myActiveAssignment && myActiveAssignment.status === 'pending'
  const canComplete = !!myActiveAssignment && myActiveAssignment.status === 'active'
  const canRejectAssignment = !!myActiveAssignment
  const isLoApproveStage = localTicket.status === 'pending_lo' && isLoManager
  const canEditDraft = localTicket.status === 'draft' && isSubmitter
  const canOverrideUrgency = isLoManager && !['completed', 'rejected', 'cancelled'].includes(localTicket.status)
  const sla = slaStatus(localTicket.slaDeadline, localTicket.status)
  const nonSystemComments = localTicket.comments.filter(c => !c.isSystem)

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-[580px] bg-surface-1 h-full flex flex-col shadow-2xl border-l border-hairline overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-hairline flex items-start justify-between gap-3 bg-surface-1">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <TicketNumberBadge n={localTicket.ticketNumber} />
              <UrgencyBadge urgency={localTicket.urgency} />
              <StatusBadge status={localTicket.status} />
              {sla === 'breached' && (
                <span className="text-[10px] font-semibold text-red-400 bg-red-900/20 px-1.5 py-0.5 rounded flex items-center gap-1">
                  <AlertCircle size={9} /> {slaLabel(localTicket.slaDeadline)}
                </span>
              )}
              {sla === 'warning' && (
                <span className="text-[10px] font-semibold text-amber-400 bg-amber-900/20 px-1.5 py-0.5 rounded flex items-center gap-1">
                  <Timer size={9} /> {slaLabel(localTicket.slaDeadline)}
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
              <p className="text-xs text-amber-800">{localTicket.onHoldReason}</p>
            </div>
          )}

          {/* Assignments */}
          {localTicket.assignments.length > 0 && (
            <div className="px-6 py-4 border-b border-hairline">
              <p className="text-[10px] font-semibold text-ink-subtle uppercase tracking-widest mb-3">Assignments</p>
              <div className="space-y-2">
                {localTicket.assignments.map(a => (
                  <div key={a.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${
                    a.status === 'active' ? 'bg-primary/10 border-primary/20' :
                    a.status === 'completed' ? 'bg-success/10 border-success/30' :
                    a.status === 'rejected' ? 'bg-red-900/20 border-red-900/40' :
                    'bg-surface-2 border-hairline'
                  }`}>
                    <Avatar name={a.assigneeName} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-ink">{a.assigneeName}</p>
                      {a.loMessage && <p className="text-[10px] text-ink-muted truncate">{a.loMessage}</p>}
                      {a.rejectionReason && <p className="text-[10px] text-red-500">Declined: {a.rejectionReason}</p>}
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      a.status === 'active' ? 'bg-primary/10 text-primary-hover' :
                      a.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                      a.status === 'rejected' ? 'bg-red-100 text-red-400' :
                      'bg-surface-3 text-ink-subtle'
                    }`}>{a.status.charAt(0).toUpperCase() + a.status.slice(1)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          {(canApprove || canPushBack || canAssign || canPickup || canComplete || canHold || canResume || canCancel || canRejectAssignment || canEditDraft || canOverrideUrgency) && (
            <div className="px-6 py-4 border-b border-hairline">
              <p className="text-[10px] font-semibold text-ink-subtle uppercase tracking-widest mb-3">Actions</p>
              <div className="space-y-3">

                {/* Edit & Resubmit — draft tickets only */}
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
                      className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90">
                      <FileText size={14} /> Edit &amp; Resubmit
                    </button>
                  )
                )}

                {/* Approve — WL or TL stage: direct approve */}
                {canApprove && !isLoApproveStage && (
                  <button onClick={() => runAction(() => api.liveops.approve(localTicket.id, null, memberEmail), 'approve')}
                    disabled={!!loadingAction}
                    className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                    {loadingAction === 'approve' ? <>{spin} Approving…</> : <><Check size={14} /> Approve</>}
                  </button>
                )}

                {/* Approve & Assign — LO stage: must select assignee */}
                {isLoApproveStage && (
                  showLoApproveBox ? (
                    <div className="space-y-2">
                      <p className="text-[10px] font-semibold text-ink-subtle uppercase tracking-widest">Approve &amp; Assign Engineer</p>
                      <select value={loApproveAssigneeId} onChange={e => setLoApproveAssigneeId(e.target.value)}
                        className="w-full text-xs border border-hairline rounded-lg px-3 py-2 bg-surface-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 text-ink">
                        <option value="">Select Engineer…</option>
                        {assignableMembers.map(m => (
                          <option key={m.id} value={m.id}>{m.name} ({m.activeAssignmentCount} active)</option>
                        ))}
                      </select>
                      <input value={loApproveNote} onChange={e => setLoApproveNote(e.target.value)}
                        placeholder="Optional message for the engineer…"
                        className="w-full text-xs border border-hairline rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 bg-surface-2 text-ink" />
                      <div className="flex gap-2">
                        <button onClick={() => { setShowLoApproveBox(false); setLoApproveAssigneeId(''); setLoApproveNote('') }}
                          className="flex-1 py-2 text-xs text-ink-muted bg-surface-1 border border-hairline rounded-lg hover:bg-surface-2">Cancel</button>
                        <button onClick={() => runAction(() => {
                          setShowLoApproveBox(false)
                          return api.liveops.approve(localTicket.id, null, memberEmail, loApproveAssigneeId, loApproveNote || null)
                        }, 'approve-lo')}
                          disabled={!loApproveAssigneeId || !!loadingAction}
                          className="flex-1 py-2 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-1.5">
                          {loadingAction === 'approve-lo' ? <>{spin} Approving…</> : 'Approve & Assign'}</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setShowLoApproveBox(true)}
                      className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700">
                      <Check size={14} /> Approve &amp; Assign
                    </button>
                  )
                )}

                {/* Push Back */}
                {canPushBack && (
                  showPushBackBox ? (
                    <div className="space-y-2">
                      <textarea value={pushBackInput} onChange={e => setPushBackInput(e.target.value)} rows={2}
                        placeholder="Reason for push back (required)…"
                        className="w-full text-xs border border-hairline rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 resize-none bg-surface-2 text-ink" />
                      <div className="flex gap-2">
                        <button onClick={() => { setShowPushBackBox(false); setPushBackInput('') }}
                          className="flex-1 py-2 text-xs text-ink-muted bg-surface-1 border border-hairline rounded-lg hover:bg-surface-2">Cancel</button>
                        <button onClick={() => runAction(() => { setShowPushBackBox(false); return api.liveops.pushBack(localTicket.id, pushBackInput, memberEmail) }, 'push-back')}
                          disabled={!pushBackInput.trim() || !!loadingAction}
                          className="flex-1 py-2 text-xs font-medium bg-amber-900/200 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 flex items-center justify-center gap-1.5">
                          {loadingAction === 'push-back' ? <>{spin} Processing…</> : 'Push Back'}</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setShowPushBackBox(true)}
                      className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-surface-1 border border-amber-500/30 text-amber-400 text-sm font-medium rounded-lg hover:bg-amber-900/20">
                      <ArrowRight size={14} className="rotate-180" /> Push Back
                    </button>
                  )
                )}

                {/* Reject */}
                {canApprove && (
                  showRejectBox ? (
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
                          {loadingAction === 'reject' ? <>{spin} Rejecting…</> : 'Reject'}</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setShowRejectBox(true)}
                      className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-surface-1 border border-red-900/40 text-red-400 text-sm font-medium rounded-lg hover:bg-red-900/20">
                      <XCircle size={14} /> Reject
                    </button>
                  )
                )}

                {/* Assign */}
                {canAssign && (
                  showAssignBox ? (
                    <div className="space-y-2">
                      <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)}
                        className="w-full text-xs border border-hairline rounded-lg px-3 py-2 bg-surface-2 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-ink">
                        <option value="">Select Engineer…</option>
                        {assignableMembers.map(m => (
                          <option key={m.id} value={m.id}>{m.name} ({m.activeAssignmentCount} active)</option>
                        ))}
                      </select>
                      <input value={assignNote} onChange={e => setAssignNote(e.target.value)} placeholder="Optional note for assignee…"
                        className="w-full text-xs border border-hairline rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-surface-2 text-ink" />
                      <div className="flex gap-2">
                        <button onClick={() => { setShowAssignBox(false); setAssigneeId(''); setAssignNote('') }}
                          className="flex-1 py-2 text-xs text-ink-muted bg-surface-1 border border-hairline rounded-lg hover:bg-surface-2">Cancel</button>
                        <button onClick={() => runAction(() => { setShowAssignBox(false); return api.liveops.assign(localTicket.id, assigneeId, assignNote || null, memberEmail) }, 'assign')}
                          disabled={!assigneeId || !!loadingAction}
                          className="flex-1 py-2 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1.5">
                          {loadingAction === 'assign' ? <>{spin} Assigning…</> : 'Assign'}</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setShowAssignBox(true)}
                      className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90">
                      <Users size={14} /> Assign
                    </button>
                  )
                )}

                {/* Pickup */}
                {canPickup && (
                  <button onClick={() => runAction(() => api.liveops.pickup(localTicket.id, memberEmail), 'pickup')}
                    disabled={!!loadingAction}
                    className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50">
                    {loadingAction === 'pickup' ? <>{spin} Picking up…</> : <><ArrowRight size={14} /> Pick Up</>}
                  </button>
                )}

                {/* Complete */}
                {canComplete && (
                  showCompleteBox ? (
                    <div className="space-y-2">
                      <textarea value={completeNote} onChange={e => setCompleteNote(e.target.value)} rows={2}
                        placeholder="Optional completion note…"
                        className="w-full text-xs border border-hairline rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 bg-surface-2 text-ink" />
                      <div className="flex gap-2">
                        <button onClick={() => setShowCompleteBox(false)} className="flex-1 py-2 text-xs text-ink-muted bg-surface-1 border border-hairline rounded-lg hover:bg-surface-2">Cancel</button>
                        <button onClick={() => runAction(() => { setShowCompleteBox(false); return api.liveops.complete(localTicket.id, completeNote || null, memberEmail) }, 'complete')}
                          disabled={!!loadingAction}
                          className="flex-1 py-2 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-1.5">
                          {loadingAction === 'complete' ? <>{spin} Saving…</> : 'Mark Complete'}</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setShowCompleteBox(true)}
                      className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700">
                      <CheckCircle2 size={14} /> Mark Complete
                    </button>
                  )
                )}

                {/* Reject assignment */}
                {canRejectAssignment && (
                  showRejectAssignBox ? (
                    <div className="space-y-2">
                      <textarea value={rejectAssignNote} onChange={e => setRejectAssignNote(e.target.value)} rows={2}
                        placeholder="Reason for declining (required)…"
                        className="w-full text-xs border border-hairline rounded-lg px-3 py-2 resize-none focus:outline-none bg-surface-2 text-ink" />
                      <div className="flex gap-2">
                        <button onClick={() => setShowRejectAssignBox(false)} className="flex-1 py-2 text-xs text-ink-muted bg-surface-1 border border-hairline rounded-lg hover:bg-surface-2">Cancel</button>
                        <button onClick={() => runAction(() => { setShowRejectAssignBox(false); return api.liveops.rejectAssignment(localTicket.id, rejectAssignNote, memberEmail) }, 'reject-assign')}
                          disabled={!rejectAssignNote.trim() || !!loadingAction}
                          className="flex-1 py-2 text-xs font-medium bg-red-600 text-white rounded-lg disabled:opacity-50 flex items-center justify-center gap-1.5">
                          {loadingAction === 'reject-assign' ? <>{spin} Processing…</> : 'Decline'}</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setShowRejectAssignBox(true)}
                      className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-surface-1 border border-hairline text-ink-muted text-sm rounded-lg hover:bg-surface-2">
                      <XCircle size={14} /> Decline Assignment
                    </button>
                  )
                )}

                {/* Hold / Resume */}
                {canHold && (
                  showHoldBox ? (
                    <div className="space-y-2">
                      <textarea value={holdInput} onChange={e => setHoldInput(e.target.value)} rows={2}
                        placeholder="Reason for hold (required)…"
                        className="w-full text-xs border border-hairline rounded-lg px-3 py-2 resize-none focus:outline-none bg-surface-2 text-ink" />
                      <div className="flex gap-2">
                        <button onClick={() => setShowHoldBox(false)} className="flex-1 py-2 text-xs text-ink-muted bg-surface-1 border border-hairline rounded-lg">Cancel</button>
                        <button onClick={() => runAction(() => { setShowHoldBox(false); return api.liveops.hold(localTicket.id, holdInput, memberEmail) }, 'hold')}
                          disabled={!holdInput.trim() || !!loadingAction}
                          className="flex-1 py-2 text-xs font-medium bg-amber-900/200 text-white rounded-lg disabled:opacity-50 flex items-center justify-center gap-1.5">
                          {loadingAction === 'hold' ? <>{spin} Processing…</> : 'Put on Hold'}</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setShowHoldBox(true)}
                      className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-surface-1 border border-amber-500/30 text-amber-400 text-sm rounded-lg hover:bg-amber-900/20">
                      <Clock size={14} /> Put on Hold
                    </button>
                  )
                )}
                {canResume && (
                  <button onClick={() => runAction(() => api.liveops.resume(localTicket.id, memberEmail), 'resume')}
                    disabled={!!loadingAction}
                    className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50">
                    {loadingAction === 'resume' ? <>{spin} Resuming…</> : <><ArrowRight size={14} /> Resume</>}
                  </button>
                )}

                {/* Urgency override */}
                {canOverrideUrgency && (
                  showUrgencyBox ? (
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
                          className="flex-1 py-2 text-xs font-medium bg-amber-900/200 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 flex items-center justify-center gap-1.5">
                          {loadingAction === 'urgency' ? <>{spin} Saving…</> : 'Update Urgency'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setShowUrgencyBox(true)}
                      className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-surface-1 border border-amber-500/30 text-amber-400 text-sm rounded-lg hover:bg-amber-900/20">
                      <AlertTriangle size={14} /> Override Urgency
                    </button>
                  )
                )}

                {/* Cancel */}
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
                          {loadingAction === 'cancel' ? <>{spin} Cancelling…</> : 'Cancel Ticket'}</button>
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
            </div>
          )}

          {/* Comments */}
          <div className="px-6 py-4">
            <p className="text-[10px] font-semibold text-ink-subtle uppercase tracking-widest mb-3">
              Comments {nonSystemComments.length > 0 && `(${nonSystemComments.length})`}
            </p>

            {/* System events as timeline */}
            {localTicket.comments.filter(c => c.isSystem).length > 0 && (
              <div className="mb-4 space-y-1.5">
                {localTicket.comments.filter(c => c.isSystem).map(c => (
                  <div key={c.id} className="flex items-start gap-2 text-[10px] text-ink-subtle">
                    <div className="w-1.5 h-1.5 rounded-full bg-surface-3 mt-1 flex-shrink-0" />
                    <span>{c.body} · {timeAgo(c.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Human comments */}
            <div className="space-y-3 mb-4">
              {nonSystemComments.length === 0 && (
                <p className="text-xs text-ink-subtle text-center py-2">No comments yet.</p>
              )}
              {nonSystemComments.map(c => (
                <div key={c.id} className="flex gap-2.5">
                  <Avatar name={c.authorName} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xs font-medium text-ink">{c.authorName ?? 'Unknown'}</span>
                      <span className="text-[10px] text-ink-subtle">{timeAgo(c.createdAt)}</span>
                    </div>
                    <p className="text-xs text-ink-muted mt-0.5 leading-relaxed">{c.body}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Add comment */}
            {!['completed', 'rejected', 'cancelled'].includes(localTicket.status) && (
              <div className="flex gap-2">
                <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2}
                  placeholder="Add a comment…"
                  className="flex-1 text-xs border border-hairline rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-surface-2 text-ink" />
                <button onClick={postComment} disabled={!comment.trim() || postingComment}
                  className="px-3 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-40 flex-shrink-0">
                  <MessageSquare size={13} />
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

  const isLoManager = myRoles.has('lo_manager')
  const isAdmin = currentUser?.role === 'admin' || !!(currentUser?.hasAdminAccess)

  // Visible tabs
  const tabs = useMemo((): Array<{ id: TabId; label: string; count?: number }> => {
    const result: Array<{ id: TabId; label: string; count?: number }> = [
      { id: 'my-tickets', label: 'My Tickets', count: myTickets.filter(t => !['completed', 'cancelled', 'rejected'].includes(t.status)).length || undefined },
    ]
    if (myRoles.has('workstream_lead') || myRoles.has('team_lead') || myRoles.has('lo_manager') || isAdmin) {
      result.push({ id: 'approvals', label: 'Approvals', count: approvalTickets.length || undefined })
    }
    if (myRoles.has('platform_engineer') || isAdmin) {
      result.push({ id: 'my-work', label: 'My Work', count: myWorkTickets.length || undefined })
    }
    if (isAdmin || isLoManager) {
      result.push({ id: 'all-tickets', label: 'All Tickets' })
      result.push({ id: 'admin', label: 'Admin' })
    }
    return result
  }, [myRoles, myTickets, approvalTickets, myWorkTickets, isAdmin])

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
        (['pending_wl', 'pending_tl', 'pending_lo'].includes(t.status) && (myRoles.has('lo_manager') || isAdmin))
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
  }, [memberEmail, memberId, myRoles, isAdmin])

  useEffect(() => { loadInitial() }, [loadInitial])
  useEffect(() => {
    if (!loadingInitial) loadTabData(activeTab)
  }, [activeTab, loadingInitial, loadTabData])

  async function openDetail(id: string) {
    const d = await api.liveops.getTicket(id)
    setDetailTicket(d)
    if (isAdmin || isLoManager) {
      const members = await api.liveops.getAssignableMembers()
      setAssignableMembers(members)
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
      <div className="flex-1 bg-surface-2 p-6 space-y-4">
        <div className="skeleton h-8 w-64 rounded-lg" />
        <div className="grid grid-cols-6 gap-3">
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
      <div className="bg-surface-1 border-b border-hairline px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-ink flex items-center gap-2">
            <Zap size={16} className="text-primary" /> LiveOps Ticketing
          </h1>
          <p className="text-[11px] text-ink-subtle mt-0.5">Operational request tracking and fulfillment</p>
        </div>
        <button onClick={() => setShowSubmit(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors">
          <Plus size={14} /> New Ticket
        </button>
      </div>

      {/* Stat bar */}
      {analytics && (
        <div className="px-6 py-4 grid grid-cols-6 gap-3 border-b border-hairline bg-surface-1">
          <StatCard icon={Zap} label="Total Open" value={analytics.totalOpen} color="bg-primary/10 text-primary-hover" />
          <StatCard icon={Clock} label="Pending Approval" value={analytics.pendingApproval} color="bg-amber-900/20 text-amber-400" />
          <StatCard icon={ArrowRight} label="In Progress" value={analytics.inProgress} color="bg-primary/10 text-primary-hover" />
          <StatCard
            icon={AlertTriangle}
            label="SLA Breaching"
            value={analytics.slaBreaching}
            color={analytics.slaBreaching > 0 ? "bg-red-900/20 text-red-400" : "bg-surface-2 text-ink-subtle"}
          />
          <StatCard icon={CheckCircle2} label="Done This Month" value={analytics.completedThisMonth} color="bg-success/10 text-success" />
          <StatCard
            icon={Timer}
            label="Avg Resolution"
            value={analytics.avgResolutionHours != null ? `${analytics.avgResolutionHours}h` : '—'}
            color="bg-surface-2 text-ink-muted"
          />
        </div>
      )}

      {/* Tab bar */}
      <div className="bg-surface-1 border-b border-hairline px-6">
        <div className="flex gap-0">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-ink-subtle hover:text-ink-muted hover:border-hairline'
              }`}>
              {tab.label}
              {tab.count != null && tab.count > 0 && (
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.id ? 'bg-primary/20 text-primary' : 'bg-surface-3 text-ink-subtle'
                }`}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">

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
                  <div className="w-12 h-12 rounded-xl bg-surface-3 flex items-center justify-center mb-3">
                    <Zap size={20} className="text-ink-subtle" />
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
                shown.map(t => <TicketRow key={t.id} ticket={t} onClick={() => openDetail(t.id)} />)
              )}
            </>
          )
        })()}

        {/* ── Approvals ── */}
        {activeTab === 'approvals' && (
          <>
            {approvalTickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center mb-3">
                  <CheckCircle2 size={20} className="text-emerald-400" />
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
                    <button onClick={() => openDetail(t.id)} className="text-[11px] text-primary font-medium px-3 py-1.5 bg-primary/10 rounded-lg hover:bg-primary/20 flex-shrink-0">
                      Review
                    </button>
                  </div>
                  {/* Quick approve (only for WL/TL stage — LO requires assign, go to detail) */}
                  <div className="flex gap-2 mt-3 pt-3 border-t border-hairline">
                    {t.status !== 'pending_lo' ? (
                      <button
                        disabled={!!approvingId}
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
                      <button onClick={() => openDetail(t.id)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
                        <Check size={12} /> Approve &amp; Assign
                      </button>
                    )}
                    <button onClick={() => openDetail(t.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium bg-surface-1 border border-red-900/40 text-red-400 rounded-lg hover:bg-red-900/20">
                      <XCircle size={12} /> Reject (with reason)
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
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                  <Shield size={20} className="text-blue-400" />
                </div>
                <p className="text-sm font-medium text-ink-muted">No active assignments</p>
                <p className="text-xs text-ink-subtle mt-1">Assignments from LO Manager will appear here</p>
              </div>
            ) : (
              myWorkTickets.map(t => <TicketRow key={t.id} ticket={t} onClick={() => openDetail(t.id)} />)
            )}
          </>
        )}

        {/* ── All Tickets ── */}
        {activeTab === 'all-tickets' && (
          <>
            {/* Filter bar */}
            <div className="flex gap-3 mb-1">
              <div className="flex-1 relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" />
                <input value={allTicketsFilter} onChange={e => setAllTicketsFilter(e.target.value)}
                  placeholder="Search tickets…"
                  className="w-full text-xs border border-hairline rounded-lg pl-8 pr-3 py-2 bg-surface-1 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-ink" />
              </div>
              <select value={allTicketsStatus} onChange={e => setAllTicketsStatus(e.target.value)}
                className="text-xs border border-hairline rounded-lg px-3 py-2 bg-surface-1 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-ink">
                <option value="">All Statuses</option>
                {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <button onClick={() => loadTabData('all-tickets')}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-hairline bg-surface-1 hover:bg-surface-2 text-ink-subtle">
                <RefreshCw size={13} />
              </button>
            </div>
            <p className="text-[10px] text-ink-subtle mb-2">{filteredAllTickets.length} ticket{filteredAllTickets.length !== 1 ? 's' : ''}</p>
            {filteredAllTickets.length === 0 ? (
              <div className="text-center py-12 text-sm text-ink-subtle">No tickets match your filters</div>
            ) : (
              filteredAllTickets.map(t => <TicketRow key={t.id} ticket={t} onClick={() => openDetail(t.id)} />)
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
              <p className="text-xs font-semibold text-ink mb-4 flex items-center gap-2"><Timer size={14} className="text-primary" /> SLA Response Times</p>
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
              <p className="text-xs font-semibold text-ink mb-4 flex items-center gap-2"><Shield size={14} className="text-primary" /> LiveOps Roles</p>
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
              <div className="flex gap-2 pt-3 border-t border-hairline">
                <select value={adminNewRole.memberId} onChange={e => setAdminNewRole(r => ({ ...r, memberId: e.target.value }))}
                  className="flex-1 text-xs border border-hairline rounded-lg px-3 py-2 bg-surface-2 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-ink">
                  <option value="">Select member…</option>
                  {teamMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                <select value={adminNewRole.role} onChange={e => setAdminNewRole(r => ({ ...r, role: e.target.value }))}
                  className="text-xs border border-hairline rounded-lg px-3 py-2 bg-surface-2 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-ink">
                  <option value="">Select role…</option>
                  {Object.entries(ROLE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <button onClick={async () => {
                  if (!adminNewRole.memberId || !adminNewRole.role) return
                  const r = await api.liveops.createMemberRole(adminNewRole.memberId, adminNewRole.role)
                  setMemberRoles(prev => [...prev, r])
                  setAdminNewRole({ memberId: '', role: '' })
                }} disabled={!adminNewRole.memberId || !adminNewRole.role}
                  className="px-3 py-2 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-40">
                  <Plus size={12} />
                </button>
              </div>
            </div>

            {/* Approver Config */}
            <div className="bg-surface-1 rounded-xl border border-hairline px-5 py-5">
              <p className="text-xs font-semibold text-ink mb-4 flex items-center gap-2"><Settings2 size={14} className="text-primary" /> Approval Routing</p>
              <div className="space-y-2 mb-4">
                {approverConfigs.length === 0 && <p className="text-xs text-ink-subtle">No routing config yet. Add a rule below.</p>}
                {approverConfigs.map(cfg => (
                  <div key={cfg.id} className="flex items-center justify-between px-3 py-2.5 bg-surface-2 rounded-lg border border-hairline">
                    <div>
                      <p className="text-xs font-medium text-ink">{cfg.ticketTypeName} + {cfg.businessUnitName}</p>
                      <p className="text-[10px] text-ink-subtle">
                        WL: {cfg.workstreamLeadName ?? '—'} · TL: {cfg.teamLeadName ?? '—'}
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
                <div className="grid grid-cols-2 gap-2">
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
                    <option value="">Team Lead (optional)…</option>
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
          myRoles={myRoles}
          isAdmin={isAdmin}
          assignableMembers={assignableMembers}
        />
      )}
    </div>
  )
}
