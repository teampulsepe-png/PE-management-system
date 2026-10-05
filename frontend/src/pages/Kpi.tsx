import { useState, useEffect, useMemo, Fragment } from 'react'
import { TrendingUp, AlertTriangle, XCircle, Clock, X, Check, Loader2, Plus, Trash2 } from 'lucide-react'
import type { KpiEntry, KpiStatus, KpiFrequency, KpiPdca } from '../types'
import { api } from '../api/teamPulseApi'

// ─── constants ────────────────────────────────────────────────────────────────

const FREQ_LABEL: Record<KpiFrequency, string> = {
  monthly: 'Monthly', quarterly: 'Quarterly', annually: 'Annually',
}

const PDCA_CFG: Record<KpiPdca, { label: string; dot: string; bg: string; border: string; text: string }> = {
  plan:  { label: 'Plan',  dot: 'bg-blue-400',    bg: 'bg-blue-900/20',    border: 'border-blue-700',   text: 'text-blue-300'    },
  do:    { label: 'Do',    dot: 'bg-emerald-400', bg: 'bg-emerald-900/20', border: 'border-emerald-700', text: 'text-emerald-300' },
  check: { label: 'Check', dot: 'bg-amber-400',   bg: 'bg-amber-900/20',   border: 'border-amber-700',  text: 'text-amber-300'   },
  act:   { label: 'Act',   dot: 'bg-violet-400',  bg: 'bg-violet-900/20',  border: 'border-violet-700', text: 'text-violet-300'  },
}

function PdcaBadge({ value }: { value: KpiPdca }) {
  const c = PDCA_CFG[value]
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-md border ${c.bg} ${c.border} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`} />
      {c.label}
    </span>
  )
}

type StatusCfg = { label: string; dot: string; badge: string; bar: string; icon: React.ReactNode }
const STATUS: Record<KpiStatus, StatusCfg> = {
  achieved: { label:'Achieved', dot:'bg-green-500',  badge:'bg-green-900/30 text-green-400',  bar:'bg-green-400',  icon:<TrendingUp size={10}/> },
  at_risk:  { label:'At Risk',  dot:'bg-amber-400',  badge:'bg-amber-900/30 text-amber-400',  bar:'bg-amber-400',  icon:<AlertTriangle size={10}/> },
  behind:   { label:'Behind',   dot:'bg-red-500',    badge:'bg-red-900/30 text-red-400',      bar:'bg-red-400',    icon:<XCircle size={10}/> },
  pending:  { label:'Pending',  dot:'bg-ink-subtle',     badge:'bg-surface-3 text-ink-subtle',        bar:'bg-surface-3',  icon:<Clock size={10}/> },
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function evalStatus(pct: number | null, target: number): KpiStatus {
  if (pct === null) return 'pending'
  if (pct >= target) return 'achieved'
  if (pct >= target * 0.8) return 'at_risk'
  return 'behind'
}

// ─── Side panel ───────────────────────────────────────────────────────────────

function recomputeMetric(metric: KpiEntry): KpiEntry {
  const withData = metric.evaluations.filter(e => e.actual !== null && e.actual > 0)
  const totalActual = withData.reduce((s, e) => s + (e.actual ?? 0), 0)
  const totalPlanned = metric.planned * withData.length
  const pct = totalPlanned > 0 ? Math.round((totalActual / totalPlanned) * 1000) / 10 : null
  const status: KpiEntry['status'] = pct === null ? 'pending'
    : pct >= metric.target ? 'achieved'
    : pct >= metric.target * 0.8 ? 'at_risk'
    : 'behind'
  return { ...metric, overallPercentage: pct, status }
}

function KpiPanel({
  entry, onUpdate, onClose,
}: { entry: KpiEntry; onUpdate: (u: KpiEntry) => void; onClose: () => void }) {
  const [saving, setSaving]   = useState(false)
  const [draftRemarks, setDraftRemarks] = useState(entry.remarks ?? '')

  // entry-add state: which evaluation is open for a new entry
  const [addingFor, setAddingFor] = useState<string | null>(null)
  const [newDate, setNewDate]     = useState('')
  const [entryBusy, setEntryBusy] = useState<string | null>(null)  // id of entry being deleted

  useEffect(() => {
    setDraftRemarks(entry.remarks ?? '')
    setAddingFor(null)
    setNewDate('')
  }, [entry.id])

  async function save() {
    setSaving(true)
    try {
      const updated = await api.updateKpiMetric(entry.id, {
        remarks: draftRemarks.trim() || null,
      })
      onUpdate(updated)
    } catch (err) { console.error(err) }
    finally { setSaving(false) }
  }

  async function addEntry(evaluationId: string) {
    if (!newDate) return
    setEntryBusy(evaluationId)
    try {
      const updatedEval = await api.addKpiEvaluationEntry(evaluationId, newDate)
      const newMetric = recomputeMetric({
        ...entry,
        evaluations: entry.evaluations.map(e => e.id === evaluationId ? updatedEval : e),
      })
      onUpdate(newMetric)
      setAddingFor(null)
      setNewDate('')
    } catch (err) { console.error(err) }
    finally { setEntryBusy(null) }
  }

  async function removeEntry(evaluationId: string, entryId: string) {
    setEntryBusy(entryId)
    try {
      await api.deleteKpiEvaluationEntry(entryId)
      const newMetric = recomputeMetric({
        ...entry,
        evaluations: entry.evaluations.map(e => {
          if (e.id !== evaluationId) return e
          const newEntries = e.entries.filter(x => x.id !== entryId)
          return { ...e, entries: newEntries, actual: newEntries.length || null, completedAt: newEntries.length ? e.completedAt : null }
        }),
      })
      onUpdate(newMetric)
    } catch (err) { console.error(err) }
    finally { setEntryBusy(null) }
  }

  const cfg = STATUS[entry.status]

  return (
    <div className="w-full md:w-[320px] flex-shrink-0 flex flex-col bg-surface-1 rounded-t-2xl md:rounded-xl border border-hairline shadow-sm overflow-hidden max-h-[88vh] md:max-h-none">

      {/* Header */}
      <div className="px-5 py-4 border-b border-hairline">
        <div className="flex items-start justify-between mb-2">
          <p className="text-xs font-medium text-ink-muted leading-snug">{entry.category}</p>
          <button onClick={onClose} className="text-ink-subtle hover:text-ink-muted -mt-0.5 -mr-1 transition-colors">
            <X size={14} />
          </button>
        </div>
        <p className="text-sm font-semibold text-ink mb-2.5">{entry.metricName}</p>
        <div className="flex items-center gap-2">
          <PdcaBadge value={entry.pdca} />
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-surface-3 text-ink-subtle">
            {FREQ_LABEL[entry.frequency]}
          </span>
          <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ml-auto ${cfg.badge}`}>
            {cfg.icon}
            {entry.overallPercentage !== null ? `${entry.overallPercentage}%` : 'Pending'}
          </span>
        </div>
      </div>

      {/* Info strip */}
      <div className="grid grid-cols-3 divide-x divide-hairline border-b border-hairline bg-surface-2 text-center">
        {[
          { label: 'Planned', value: String(entry.planned) },
          { label: 'Target',  value: `${entry.target}%` },
          { label: 'Owner',   value: entry.kpiOwner },
        ].map(({ label, value }) => (
          <div key={label} className="py-2.5 px-2">
            <p className="text-[9px] font-semibold text-ink-subtle uppercase tracking-wider mb-0.5">{label}</p>
            <p className="text-xs font-semibold text-ink-muted truncate">{value}</p>
          </div>
        ))}
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">

        {/* Evaluations */}
        <div className="px-4 py-4">
          <p className="text-[10px] font-semibold text-ink-subtle uppercase tracking-widest mb-3">Evaluations</p>
          <div className="space-y-4">
            {entry.evaluations.map(ev => {
              const actual = ev.entries.length
              const pct    = Math.round((actual / entry.planned) * 100)
              const st     = evalStatus(pct, entry.target)
              const ec     = STATUS[st]
              const isAdding = addingFor === ev.id
              const isBusy   = entryBusy === ev.id

              return (
                <div key={ev.id} className="space-y-1.5">
                  {/* Period header row */}
                  <div className="grid grid-cols-[28px_1fr_64px_32px] items-center gap-2">
                    <span className="text-[11px] font-semibold text-ink-muted text-right">{ev.periodLabel}</span>
                    <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${ec.bar}`} style={{ width: `${Math.min(pct ?? 0, 100)}%` }} />
                    </div>
                    <span className="text-[11px] font-semibold tabular-nums text-ink-muted text-center">
                      {actual}/{entry.planned}
                    </span>
                    <span className={`text-[11px] font-semibold tabular-nums text-right ${
                      pct >= entry.target ? 'text-green-400'
                      : pct >= entry.target * 0.8 ? 'text-amber-400'
                      : pct > 0 ? 'text-red-400'
                      : 'text-ink-subtle'
                    }`}>
                      {pct}%
                    </span>
                  </div>

                  {/* Individual session records */}
                  {ev.entries.length > 0 && (
                    <div className="ml-9 space-y-1">
                      {ev.entries.map((e, idx) => {
                        const label = new Date(e.doneAt + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                        return (
                          <div key={e.id} className="flex items-center gap-1.5 group">
                            <span className="w-3.5 h-3.5 rounded-full bg-green-900/30 flex items-center justify-center flex-shrink-0">
                              <Check size={8} className="text-green-400" />
                            </span>
                            <span className="text-[11px] text-ink-muted flex-1">Session {idx + 1} · {label}</span>
                            <button
                              onClick={() => removeEntry(ev.id, e.id)}
                              disabled={!!entryBusy}
                              className="opacity-0 group-hover:opacity-100 text-ink-subtle hover:text-red-400 transition-all disabled:opacity-30"
                            >
                              {entryBusy === e.id
                                ? <Loader2 size={11} className="animate-spin" />
                                : <Trash2 size={11} />
                              }
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Add entry row */}
                  <div className="ml-9">
                    {isAdding ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="date"
                          value={newDate}
                          max={new Date().toISOString().slice(0, 10)}
                          onChange={e => setNewDate(e.target.value)}
                          autoFocus
                          className="flex-1 text-[11px] text-ink border border-hairline rounded-md px-2 py-1 focus:outline-none focus:border-primary bg-surface-2"
                        />
                        <button
                          onClick={() => addEntry(ev.id)}
                          disabled={!newDate || isBusy}
                          className="text-primary hover:text-primary/80 disabled:opacity-30"
                        >
                          {isBusy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                        </button>
                        <button onClick={() => { setAddingFor(null); setNewDate('') }} className="text-ink-subtle hover:text-ink-muted">
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setAddingFor(ev.id); setNewDate('') }}
                        disabled={!!entryBusy}
                        className="flex items-center gap-1 text-[11px] text-ink-subtle hover:text-primary transition-colors disabled:opacity-30"
                      >
                        <Plus size={11} />
                        Add session
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Details */}
        <div className="px-4 pb-4 pt-1 border-t border-hairline space-y-3">
          <p className="text-[10px] font-semibold text-ink-subtle uppercase tracking-widest pt-3">Details</p>
          <div>
            <p className="text-[11px] text-ink-subtle mb-1">Responsible Party</p>
            <p className="text-sm text-ink">{entry.responsibleParty || 'Not assigned'}</p>
          </div>
          <div>
            <label className="text-[11px] text-ink-subtle block mb-1">Remarks</label>
            <textarea
              value={draftRemarks}
              onChange={e => setDraftRemarks(e.target.value)}
              placeholder="Add remarks…"
              rows={3}
              className="w-full text-sm text-ink-muted border border-hairline rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary bg-surface-2 resize-none leading-relaxed placeholder:text-ink-subtle"
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-hairline flex items-center justify-end gap-2">
        <button onClick={onClose} disabled={saving}
          className="text-xs text-ink-muted hover:text-ink px-3 py-1.5 rounded-lg border border-hairline hover:bg-surface-2 disabled:opacity-50 transition-colors">
          Cancel
        </button>
        <button onClick={save} disabled={saving}
          className="flex items-center gap-1.5 text-xs text-white bg-primary hover:bg-primary/90 px-4 py-1.5 rounded-lg disabled:opacity-50 transition-colors">
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
          Save
        </button>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Kpi() {
  const now = new Date()
  const [year, setYear]                       = useState(now.getFullYear())
  const [entries, setEntries]                 = useState<KpiEntry[]>([])
  const [loading, setLoading]                 = useState(true)
  const [activeCategory, setActiveCategory]   = useState<string | null>(null)
  const [activeFrequency, setActiveFrequency] = useState<KpiFrequency | null>(null)
  const [selectedEntry, setSelectedEntry]     = useState<KpiEntry | null>(null)

  useEffect(() => {
    setLoading(true)
    setSelectedEntry(null)
    api.getKpiEntries(year)
      .then(data => { setEntries(data); setActiveCategory(null); setActiveFrequency(null) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [year])

  function handleUpdate(updated: KpiEntry) {
    setEntries(prev => prev.map(e => e.id === updated.id ? updated : e))
    setSelectedEntry(updated)
  }

  const categories  = useMemo(() => [...new Set(entries.map(e => e.category))].sort(), [entries])
  const frequencies = useMemo(
    () => (Object.keys(FREQ_LABEL) as KpiFrequency[]).filter(f => entries.some(e => e.frequency === f)),
    [entries]
  )

  const counts = useMemo(() => ({
    total:    entries.length,
    achieved: entries.filter(e => e.status === 'achieved').length,
    at_risk:  entries.filter(e => e.status === 'at_risk').length,
    behind:   entries.filter(e => e.status === 'behind').length,
    pending:  entries.filter(e => e.status === 'pending').length,
  }), [entries])

  const visible = useMemo(() => {
    let filtered = entries
    if (activeCategory)  filtered = filtered.filter(e => e.category === activeCategory)
    if (activeFrequency) filtered = filtered.filter(e => e.frequency === activeFrequency)
    const grouped = new Map<string, KpiEntry[]>()
    for (const e of filtered) {
      if (!grouped.has(e.category)) grouped.set(e.category, [])
      grouped.get(e.category)!.push(e)
    }
    return grouped
  }, [entries, activeCategory, activeFrequency])

  // Close panel if the selected entry is filtered out
  useEffect(() => {
    if (selectedEntry && ![...visible.values()].flat().some(e => e.id === selectedEntry.id)) {
      setSelectedEntry(null)
    }
  }, [visible])

  const yearOptions = [now.getFullYear() - 2, now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]

  return (
    <div className="flex gap-4 h-full min-h-0">

      {/* ── Left: table ── */}
      <div className="flex-1 min-w-0 flex flex-col gap-4 overflow-y-auto">

        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-ink">KPI Dashboard</h1>
            {!loading && entries.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="text-xs text-ink-subtle">{counts.total} metrics</span>
                {(['achieved','at_risk','behind','pending'] as KpiStatus[]).map(s =>
                  counts[s] > 0 && (
                    <span key={s} className="flex items-center gap-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${STATUS[s].dot}`} />
                      <span className="text-xs text-ink-muted">{counts[s]} {STATUS[s].label}</span>
                    </span>
                  )
                )}
              </div>
            )}
          </div>
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="text-xs px-3 py-2 border border-hairline rounded-lg focus:outline-none focus:border-primary bg-surface-2 text-ink"
          >
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-24 text-sm text-ink-subtle">
            <Loader2 size={16} className="animate-spin" /> Loading…
          </div>
        ) : entries.length === 0 ? (
          <div className="bg-surface-1 rounded-xl border border-hairline shadow-sm py-20 text-center">
            <p className="text-sm font-medium text-ink-subtle">No KPIs for {year}</p>
          </div>
        ) : (
          <>
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 bg-surface-1 border border-hairline rounded-xl px-4 py-3 shadow-sm">
              {/* Category — dropdown */}
              <div className="flex items-center gap-2.5">
                <span className="text-[10px] font-semibold text-ink-subtle uppercase tracking-widest select-none flex-shrink-0">Category</span>
                <select
                  value={activeCategory ?? ''}
                  onChange={e => setActiveCategory(e.target.value || null)}
                  className="max-w-[180px] text-xs font-medium text-ink-muted bg-surface-2 border-none rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer appearance-none pr-7 bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%239ca3af%22 stroke-width=%222%22%3E%3Cpath d=%22M6 9l6 6 6-6%22/%3E%3C/svg%3E')] bg-no-repeat bg-[right_8px_center] truncate"
                >
                  <option value="">All categories</option>
                 {categories.map(cat => (
                <option key={cat} value={cat}>
                {cat.length > 30 ? `${cat.substring(0, 30)}...` : cat}
                </option>
                ))}
                </select>
              </div>

              {/* Divider */}
              {frequencies.length > 1 && <span className="w-px h-5 bg-hairline flex-shrink-0" />}

              {/* Frequency — segmented pills */}
              {frequencies.length > 1 && (
                <div className="flex items-center gap-2.5">
                  <span className="text-[10px] font-semibold text-ink-subtle uppercase tracking-widest select-none flex-shrink-0">Frequency</span>
                  <div className="flex items-center gap-0.5 bg-surface-2 rounded-lg p-0.5">
                    {[null, ...frequencies].map(freq => (
                      <button
                        key={freq ?? '__all__'}
                        onClick={() => setActiveFrequency(freq)}
                        className={`text-xs px-3 py-1 rounded-md font-medium transition-all ${
                          activeFrequency === freq
                            ? 'bg-surface-1 text-primary shadow-sm font-semibold'
                            : 'text-ink-subtle hover:text-ink-muted'
                        }`}
                      >
                        {freq ? FREQ_LABEL[freq] : 'All'}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Table */}
            <div className="bg-surface-1 rounded-xl border border-hairline shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[640px]">
                <thead>
                  <tr className="border-b border-hairline">
                    <th className="text-left text-[10px] font-semibold text-ink-subtle uppercase tracking-widest py-3 pl-5 pr-3 bg-surface-2">Metric</th>
                    <th className="text-left text-[10px] font-semibold text-ink-subtle uppercase tracking-widest py-3 px-3 bg-surface-2">PDCA</th>
                    <th className="text-left text-[10px] font-semibold text-ink-subtle uppercase tracking-widest py-3 px-3 bg-surface-2">Frequency</th>
                    <th className="text-center text-[10px] font-semibold text-ink-subtle uppercase tracking-widest py-3 px-3 bg-surface-2">Planned</th>
                    <th className="text-center text-[10px] font-semibold text-ink-subtle uppercase tracking-widest py-3 px-3 bg-surface-2">Target</th>
                    <th className="text-left text-[10px] font-semibold text-ink-subtle uppercase tracking-widest py-3 px-3 bg-surface-2">Progress</th>
                    <th className="text-left text-[10px] font-semibold text-ink-subtle uppercase tracking-widest py-3 pl-3 pr-5 bg-surface-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[...visible.entries()].map(([category, metrics]) => (
                    <Fragment key={category}>
                      {/* Category divider */}
                      <tr>
                        <td colSpan={7} className="py-2.5 pl-5 pr-4 bg-surface-2 border-y border-hairline">
                          <span className="text-xs font-semibold text-ink-muted leading-snug">{category}</span>
                        </td>
                      </tr>

                      {/* Metric rows */}
                      {metrics.map((entry, idx) => {
                        const cfg = STATUS[entry.status]
                        const isSelected = selectedEntry?.id === entry.id
                        const pct = entry.overallPercentage

                        return (
                          <tr
                            key={entry.id}
                            onClick={() => setSelectedEntry(p => p?.id === entry.id ? null : entry)}
                            className={`cursor-pointer border-b border-hairline transition-colors ${
                              isSelected ? 'bg-primary/10' : idx % 2 === 0 ? 'hover:bg-surface-2' : 'bg-surface-2/50 hover:bg-surface-2'
                            }`}
                          >
                            {/* Name */}
                            <td className="py-3.5 pl-5 pr-3">
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                                <span className={`text-sm font-medium ${isSelected ? 'text-primary' : 'text-ink'}`}>
                                  {entry.metricName}
                                </span>
                              </div>
                            </td>

                            {/* PDCA */}
                            <td className="py-3.5 px-3">
                              <PdcaBadge value={entry.pdca} />
                            </td>

                            {/* Frequency */}
                            <td className="py-3.5 px-3">
                              <span className="text-xs text-ink-muted">{FREQ_LABEL[entry.frequency]}</span>
                            </td>

                            {/* Planned */}
                            <td className="py-3.5 px-3 text-center">
                              <span className="text-sm font-medium text-ink tabular-nums">{entry.planned}</span>
                            </td>

                            {/* Target */}
                            <td className="py-3.5 px-3 text-center">
                              <span className="text-sm font-medium text-ink tabular-nums">{entry.target}%</span>
                            </td>

                            {/* Progress */}
                            <td className="py-3.5 px-3 w-36">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-surface-3 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${cfg.bar}`} style={{ width: `${Math.min(pct ?? 0, 100)}%` }} />
                                </div>
                                <span className="text-xs text-ink-muted tabular-nums w-8 text-right">{pct ?? 0}%</span>
                              </div>
                            </td>

                            {/* Status */}
                            <td className="py-3.5 pl-3 pr-5">
                              <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full ${cfg.badge}`}>
                                {cfg.icon} {cfg.label}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </Fragment>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Right: side panel — bottom sheet on mobile, sidebar on desktop ── */}
      {selectedEntry && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40 md:hidden"
            onClick={() => setSelectedEntry(null)}
          />
          <div className="fixed inset-x-0 bottom-0 z-50 md:static md:z-auto md:flex-shrink-0">
            <KpiPanel
              key={selectedEntry.id}
              entry={selectedEntry}
              onUpdate={handleUpdate}
              onClose={() => setSelectedEntry(null)}
            />
          </div>
        </>
      )}
    </div>
  )
}
