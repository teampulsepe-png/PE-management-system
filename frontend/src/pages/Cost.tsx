import { useEffect, useRef, useState, useCallback } from 'react'
import { Database, Server, Bot, TrendingUp, TrendingDown, Plus, X, Trash2, Loader2, RefreshCw, ChevronDown } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { api } from '../api/teamPulseApi'
import type { CostSummary, CostEntry, CostCategory } from '../types'

// ── config ────────────────────────────────────────────────────────────────────

const CAT_CFG: Record<CostCategory, { label: string; Icon: LucideIcon; hex: string; iconBg: string; iconCls: string }> = {
  database: { label: 'Database', Icon: Database, hex: '#94a3b8', iconBg: 'bg-surface-3',     iconCls: 'text-ink-subtle'    },
  compute:  { label: 'Compute',  Icon: Server,   hex: '#5e6ad2', iconBg: 'bg-primary/10',    iconCls: 'text-primary-hover' },
  agent:    { label: 'Agent',    Icon: Bot,       hex: '#8b5cf6', iconBg: 'bg-violet-900/20', iconCls: 'text-violet-400'    },
}

const CATS: CostCategory[] = ['database', 'compute', 'agent']

// ── helpers ───────────────────────────────────────────────────────────────────

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

function fmtMonth(yyyyMm: string) {
  const [y, m] = yyyyMm.split('-')
  return new Date(+y, +m - 1).toLocaleString('en-US', { month: 'short', year: '2-digit' })
}

function momDelta(cur: number, prv: number | undefined) {
  if (!prv) return null
  const p = ((cur - prv) / prv) * 100
  return { pct: Math.abs(p).toFixed(1), up: p > 0 }
}

function timeAgo(d: Date) {
  const s = Math.floor((Date.now() - d.getTime()) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  return `${Math.floor(m / 60)}h ago`
}

// ── animated counter ──────────────────────────────────────────────────────────

function useCountUp(target: number, ms = 900) {
  const [val, setVal] = useState(0)
  const raf = useRef<number | null>(null)
  useEffect(() => {
    if (target === 0) { setVal(0); return }
    const t0 = performance.now()
    const step = (now: number) => {
      const p = Math.min((now - t0) / ms, 1)
      setVal(Math.round((1 - (1 - p) ** 3) * target))
      if (p < 1) raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
  }, [target, ms])
  return val
}

// ── big donut chart ───────────────────────────────────────────────────────────

function BigDonut({ dbPct, cpPct, agPct, total }: { dbPct: number; cpPct: number; agPct: number; total: number }) {
  const [hovered, setHovered] = useState<CostCategory | null>(null)
  const animTotal = useCountUp(total)

  const SIZE = 220; const CX = 110; const CY = 110; const R = 88
  const circ = 2 * Math.PI * R
  const GAP = 2.5

  const segs: { cat: CostCategory; pct: number; offset: number; color: string }[] = [
    { cat: 'database', pct: dbPct, offset: 0,           color: '#94a3b8' },
    { cat: 'compute',  pct: cpPct, offset: dbPct,       color: '#5e6ad2' },
    { cat: 'agent',    pct: agPct, offset: dbPct + cpPct, color: '#8b5cf6' },
  ]

  const hoveredSeg = segs.find(s => s.cat === hovered)

  return (
    <div className="relative flex-shrink-0" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        {/* track */}
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="#1e2025" strokeWidth="22" />

        {segs.map(seg => {
          const dashLen = Math.max(0, (seg.pct / 100) * circ - GAP)
          const dashOff = circ - (seg.offset / 100) * circ
          const isHov = hovered === seg.cat
          return (
            <circle
              key={seg.cat}
              cx={CX} cy={CY} r={R}
              fill="none"
              stroke={seg.color}
              strokeWidth={isHov ? 26 : 22}
              strokeDasharray={`${dashLen} ${circ - dashLen}`}
              strokeDashoffset={dashOff}
              strokeLinecap="round"
              transform={`rotate(-90 ${CX} ${CY})`}
              style={{ cursor: 'pointer', transition: 'stroke-width 0.15s ease, opacity 0.15s ease', opacity: hovered && !isHov ? 0.35 : 1 }}
              onMouseEnter={() => setHovered(seg.cat)}
              onMouseLeave={() => setHovered(null)}
            />
          )
        })}
      </svg>

      {/* center label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
        {hoveredSeg ? (
          <>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: hoveredSeg.color }}>
              {CAT_CFG[hoveredSeg.cat].label}
            </p>
            <p className="text-xl font-bold text-ink tabular-nums">{hoveredSeg.pct.toFixed(1)}%</p>
          </>
        ) : (
          <>
            <p className="text-[10px] font-bold text-ink-tertiary uppercase tracking-widest mb-0.5">Total</p>
            <p className="text-xl font-bold text-ink tabular-nums">{fmt(animTotal)}</p>
          </>
        )}
      </div>
    </div>
  )
}

// ── sparkline ─────────────────────────────────────────────────────────────────

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null
  const W = 80; const H = 22; const P = 2
  const lo = Math.min(...values); const hi = Math.max(...values)
  const range = hi - lo || 1
  const pts = values.map((v, i) => {
    const x = P + (i / (values.length - 1)) * (W - P * 2)
    const y = H - P - ((v - lo) / range) * (H - P * 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.75" />
    </svg>
  )
}

// ── trend chart ───────────────────────────────────────────────────────────────

function TrendChart({ history }: { history: CostSummary['history'] }) {
  const [hovered, setHovered] = useState<number | null>(null)
  const ML = 44; const MR = 12; const MT = 16; const MB = 26
  const VW = 520; const VH = 150
  const PW = VW - ML - MR; const PH = VH - MT - MB
  const maxTotal = Math.max(...history.map(h => h.database + h.compute + h.agent), 1)
  const MAX_Y = Math.ceil(maxTotal / 100) * 100 + 100
  const sc = PH / MAX_Y
  const BW = 38
  const slotW = PW / (history.length || 1)
  const baseY = MT + PH

  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full" onMouseLeave={() => setHovered(null)}>
      <defs>
        <linearGradient id="gc-db" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#94a3b8" stopOpacity="0.8"/><stop offset="100%" stopColor="#94a3b8" stopOpacity="0.35"/></linearGradient>
        <linearGradient id="gc-cp" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#5e6ad2" stopOpacity="0.9"/><stop offset="100%" stopColor="#5e6ad2" stopOpacity="0.45"/></linearGradient>
        <linearGradient id="gc-ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.9"/><stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.45"/></linearGradient>
      </defs>

      {[0.25, 0.5, 0.75].map(f => {
        const t = Math.round((MAX_Y * f) / 100) * 100
        const y = baseY - t * sc
        return (
          <g key={f}>
            <line x1={ML} y1={y} x2={VW - MR} y2={y} stroke="#1e2025" strokeWidth="1" strokeDasharray="4 3" />
            <text x={ML - 5} y={y + 3.5} textAnchor="end" fontSize="8.5" fill="#62666d">${Math.round(t / 100)}</text>
          </g>
        )
      })}
      <line x1={ML} y1={baseY} x2={VW - MR} y2={baseY} stroke="#2a2c32" strokeWidth="1" />

      {history.map((h, i) => {
        const bx  = ML + i * slotW + (slotW - BW) / 2
        const dbH = h.database * sc; const cpH = h.compute * sc; const agH = h.agent * sc
        const totH = dbH + cpH + agH
        const isLast = i === history.length - 1
        const isHov = hovered === i
        const op = isHov || isLast ? 1 : 0.4

        return (
          <g key={h.month} opacity={op} style={{ cursor: 'default' }} onMouseEnter={() => setHovered(i)}>
            {isHov && <rect x={bx - 8} y={MT - 4} width={BW + 16} height={PH + 4} rx="6" fill="#141516" />}
            {dbH > 0 && <rect x={bx} y={baseY - dbH} width={BW} height={dbH} fill="url(#gc-db)" rx="2" />}
            {cpH > 0 && <rect x={bx} y={baseY - dbH - cpH} width={BW} height={cpH} fill="url(#gc-cp)" />}
            {agH > 0 && <rect x={bx} y={baseY - totH} width={BW} height={agH} fill="url(#gc-ag)" />}
            {totH > 4 && <rect x={bx} y={baseY - totH} width={BW} height={Math.min(5, totH)} rx="2.5" fill="#8b5cf6" opacity="0.85" />}
            {isLast && !isHov && (
              <text x={bx + BW / 2} y={baseY - totH - 6} textAnchor="middle" fontSize="8" fill="#8a8f98" fontWeight="600">
                {fmt(h.database + h.compute + h.agent)}
              </text>
            )}
            <text x={bx + BW / 2} y={baseY + 16} textAnchor="middle" fontSize="8.5"
              fill={isLast || isHov ? '#d0d6e0' : '#62666d'}
              fontWeight={isLast || isHov ? '600' : '400'}>
              {fmtMonth(h.month)}
            </text>
          </g>
        )
      })}

      {hovered !== null && history[hovered] && (() => {
        const h = history[hovered]
        const total = h.database + h.compute + h.agent
        const bx = ML + hovered * slotW + (slotW - BW) / 2
        const tx = Math.min(Math.max(bx - 50, ML), VW - MR - 120)
        const ty = Math.max(baseY - total * sc - 74, MT)
        return (
          <g>
            <rect x={tx} y={ty} width={120} height={66} rx="6" fill="#0f1011" stroke="#2a2c32" strokeWidth="1" />
            <text x={tx + 9} y={ty + 15} fontSize="9" fill="#d0d6e0" fontWeight="700">{fmtMonth(h.month)} · {fmt(total)}</text>
            {(['database','compute','agent'] as CostCategory[]).map((k, idx) => (
              <g key={k}>
                <rect x={tx + 9} y={ty + 24 + idx * 13} width={6} height={6} rx="1.5" fill={['#94a3b8','#5e6ad2','#8b5cf6'][idx]} />
                <text x={tx + 19} y={ty + 31 + idx * 13} fontSize="8" fill="#8a8f98">{['DB','Compute','Agent'][idx]}</text>
                <text x={tx + 112} y={ty + 31 + idx * 13} textAnchor="end" fontSize="8" fill="#d0d6e0" fontWeight="600">{fmt(h[k])}</text>
              </g>
            ))}
          </g>
        )
      })()}
    </svg>
  )
}

// ── sync banner ───────────────────────────────────────────────────────────────

function SyncBanner({ lastUpdated, refreshing, onRefresh }: {
  lastUpdated: Date | null; refreshing: boolean; onRefresh: () => void
}) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  const isStale = !lastUpdated || Date.now() - lastUpdated.getTime() > 5 * 60 * 1000
  const label   = lastUpdated ? timeAgo(lastUpdated) : null
  const fullTs  = lastUpdated
    ? lastUpdated.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="relative flex items-center gap-4 px-4 py-3 rounded-xl bg-surface-1 border border-hairline overflow-hidden">
      <div className={`absolute left-0 top-0 bottom-0 w-0.5 rounded-l-xl ${isStale ? 'bg-amber-500' : 'bg-success'}`} />

      <div className="relative flex-shrink-0 pl-1">
        <div className={`w-1.5 h-1.5 rounded-full ${isStale ? 'bg-amber-500' : 'bg-success'}`} />
        {isStale && !refreshing && (
          <div className="absolute inset-0 rounded-full bg-amber-500 animate-ping opacity-50" />
        )}
      </div>

      <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-bold text-ink-tertiary uppercase tracking-widest">Cost Data</span>
        {refreshing
          ? <span className="text-xs text-ink-subtle">Fetching latest figures…</span>
          : label
            ? <span className="text-xs text-ink-subtle">Last synced <span className="text-ink font-semibold">{label}</span>{fullTs && <span className="text-ink-tertiary"> · {fullTs}</span>}</span>
            : <span className="text-xs text-ink-subtle">Not yet synced this session</span>
        }
        {isStale && !refreshing && label && (
          <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">Stale</span>
        )}
      </div>

      <button
        onClick={onRefresh}
        disabled={refreshing}
        className={`group flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all duration-200 flex-shrink-0 ${
          refreshing
            ? 'bg-surface-2 text-ink-tertiary cursor-not-allowed'
            : 'bg-primary/10 text-primary-hover border border-primary/25 hover:bg-primary hover:text-white hover:border-primary hover:shadow-lg hover:shadow-primary/20 active:scale-95'
        }`}
      >
        <RefreshCw size={11} className={`transition-transform duration-500 ${refreshing ? 'animate-spin' : 'group-hover:rotate-180'}`} />
        {refreshing ? 'Syncing…' : 'Sync Now'}
      </button>
    </div>
  )
}

// ── skeleton ──────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="flex items-center justify-between"><div className="skeleton h-5 w-36" /><div className="skeleton h-7 w-24 rounded-lg" /></div>
      <div className="skeleton h-12 rounded-xl" />
      <div className="grid grid-cols-[240px_1fr] gap-5">
        <div className="skeleton rounded-2xl h-96" />
        <div className="flex flex-col gap-4">
          <div className="skeleton rounded-2xl h-36" />
          <div className="skeleton rounded-2xl flex-1" />
        </div>
      </div>
    </div>
  )
}

// ── add-entry panel ───────────────────────────────────────────────────────────

function AddEntryPanel({ currentMonth, onClose, onCreated }: {
  currentMonth: string; onClose: () => void; onCreated: (e: CostEntry) => void
}) {
  const [category,    setCategory]    = useState<CostCategory>('database')
  const [serviceName, setServiceName] = useState('')
  const [serviceDesc, setServiceDesc] = useState('')
  const [amountStr,   setAmountStr]   = useState('')
  const [saving,      setSaving]      = useState(false)

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    const dollars = parseFloat(amountStr)
    if (isNaN(dollars) || dollars <= 0) return
    setSaving(true)
    try {
      const created = await api.createCostEntry({
        category, service_name: serviceName.trim(),
        service_description: serviceDesc.trim() || null,
        month: currentMonth, amount_cents: Math.round(dollars * 100),
      })
      onCreated(created)
    } finally { setSaving(false) }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 md:static md:z-auto md:flex-shrink-0">
        <div className="w-full md:w-80 bg-surface-1 border-t border-hairline md:border-t-0 md:border-l border-hairline flex flex-col overflow-hidden rounded-t-2xl md:rounded-none max-h-[88vh] md:max-h-none">
          <div className="flex items-center justify-between px-5 py-4 border-b border-hairline">
            <h2 className="text-sm font-bold text-ink">Add Cost Entry</h2>
            <button onClick={onClose} className="text-ink-subtle hover:text-ink transition-colors"><X size={16} /></button>
          </div>
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-ink-muted mb-1.5">Category</label>
              <div className="grid grid-cols-3 gap-2">
                {CATS.map(c => {
                  const cfg = CAT_CFG[c]
                  const { Icon } = cfg
                  return (
                    <button key={c} type="button" onClick={() => setCategory(c)}
                      className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-[11px] font-semibold transition-all ${
                        category === c ? 'bg-primary/10 border-primary/40 text-primary-hover' : 'border-hairline text-ink-subtle hover:bg-surface-2'
                      }`}>
                      <Icon size={14} />
                      {cfg.label}
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-muted mb-1">Service name</label>
              <input required value={serviceName} onChange={e => setServiceName(e.target.value)}
                placeholder="e.g. PostgreSQL instance"
                className="w-full border border-hairline rounded-lg px-3 py-2 text-sm bg-surface-2 text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-muted mb-1">Description <span className="font-normal text-ink-subtle">(optional)</span></label>
              <input value={serviceDesc} onChange={e => setServiceDesc(e.target.value)}
                placeholder="e.g. db.t3.large"
                className="w-full border border-hairline rounded-lg px-3 py-2 text-sm bg-surface-2 text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-muted mb-1">Amount (USD)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle text-sm">$</span>
                <input required type="number" min="0.01" step="0.01" value={amountStr} onChange={e => setAmountStr(e.target.value)}
                  placeholder="0.00"
                  className="w-full border border-hairline rounded-lg pl-7 pr-3 py-2 text-sm bg-surface-2 text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
              </div>
            </div>
            <div className="text-xs text-ink-muted bg-surface-2 rounded-lg px-3 py-2">
              Month: <span className="font-semibold text-ink">{fmtMonth(currentMonth)}</span>
            </div>
            <button type="submit" disabled={saving}
              className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {saving ? 'Saving…' : 'Add Entry'}
            </button>
          </form>
        </div>
      </div>
    </>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function Cost() {
  const [summary,     setSummary]     = useState<CostSummary | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [refreshing,  setRefreshing]  = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [showAdd,     setShowAdd]     = useState(false)
  const [deletingId,  setDeletingId]  = useState<string | null>(null)
  const [filterCat,   setFilterCat]   = useState<CostCategory | 'all'>('all')

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    try {
      const data = await api.getCostSummary(6)
      setSummary(data)
      setLastUpdated(new Date())
    } catch (e) { console.error(e) }
    finally {
      if (isRefresh) setRefreshing(false)
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  function handleCreated(entry: CostEntry) {
    if (!summary) return
    const cur = { ...summary.current }
    cur[entry.category] += entry.amountCents
    cur.total += entry.amountCents
    setSummary({ ...summary, current: cur, entries: [...summary.entries, entry] })
    setShowAdd(false)
  }

  async function handleDelete(id: string) {
    if (!summary) return
    setDeletingId(id)
    try {
      await api.deleteCostEntry(id)
      const removed = summary.entries.find(e => e.id === id)
      if (removed) {
        const cur = { ...summary.current }
        cur[removed.category] -= removed.amountCents
        cur.total -= removed.amountCents
        setSummary({ ...summary, current: cur, entries: summary.entries.filter(e => e.id !== id) })
      }
    } finally { setDeletingId(null) }
  }

  if (loading) return <Skeleton />
  if (!summary) return <div className="flex items-center justify-center h-64 text-ink-subtle text-sm">Failed to load.</div>

  const { current, previous, history, entries, currentMonth } = summary
  const dbPct = current.total ? (current.database / current.total) * 100 : 0
  const cpPct = current.total ? (current.compute  / current.total) * 100 : 0
  const agPct = Math.max(0, 100 - dbPct - cpPct)

  const visibleEntries = entries
    .filter(e => filterCat === 'all' || e.category === filterCat)
    .sort((a, b) => b.amountCents - a.amountCents)

  return (
    <div className={`flex gap-0 h-full min-h-0 ${showAdd ? 'overflow-hidden' : ''}`}>
      <div className="flex-1 flex flex-col gap-4 overflow-y-auto pb-4 min-w-0">

        {/* header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-ink">Expenses</h1>
            <p className="text-xs text-ink-subtle mt-0.5">Infrastructure spend · {fmtMonth(currentMonth)}</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 text-xs font-semibold text-ink-subtle bg-surface-2 border border-hairline hover:bg-surface-3 px-3 py-1.5 rounded-lg transition-colors">
              This Fiscal Year <ChevronDown size={12} />
            </button>
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
              <Plus size={13} /> Add Entry
            </button>
          </div>
        </div>

        {/* sync banner */}
        <SyncBanner lastUpdated={lastUpdated} refreshing={refreshing} onRefresh={() => fetchData(true)} />

        {/* main two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5 items-start">

          {/* ── LEFT: Expenses donut panel ── */}
          <div className="bg-surface-1 border border-hairline rounded-2xl p-5 flex flex-col items-center gap-5">
            <div className="w-full flex items-center justify-between">
              <span className="text-xs font-bold text-ink">Breakdown</span>
              <span className="text-[10px] font-semibold text-ink-tertiary bg-surface-3 px-2 py-0.5 rounded-md">Top 3</span>
            </div>

            <BigDonut dbPct={dbPct} cpPct={cpPct} agPct={agPct} total={current.total} />

            {/* legend */}
            <div className="w-full space-y-3">
              {CATS.map(cat => {
                const cfg  = CAT_CFG[cat]
                const pct  = cat === 'database' ? dbPct : cat === 'compute' ? cpPct : agPct
                const hist = history.map(h => h[cat])
                return (
                  <div key={cat} className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.hex }} />
                    <span className="text-xs text-ink-subtle flex-1 min-w-0 truncate">{cfg.label}</span>
                    <Sparkline values={hist} color={cfg.hex} />
                    <span className="text-xs font-bold text-ink tabular-nums w-8 text-right">{pct.toFixed(0)}%</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── RIGHT: Stats + entries ── */}
          <div className="flex flex-col gap-4">

            {/* gradient stats banner — like the reference */}
            <div className="relative rounded-2xl overflow-hidden">
              {/* gradient bg */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#1e2052] via-[#181932] to-[#0f1011]" />
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/15 via-violet-900/10 to-transparent" />

              <div className="relative px-6 pt-5 pb-6">
                <p className="text-xs font-bold text-white/50 uppercase tracking-widest mb-4">Monthly Spend</p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {/* Total */}
                  <StatBannerCol
                    label="Total MTD"
                    value={current.total}
                    delta={momDelta(current.total, previous?.total)}
                    accent="white"
                  />
                  {CATS.map(cat => (
                    <StatBannerCol
                      key={cat}
                      label={CAT_CFG[cat].label}
                      value={current[cat]}
                      delta={momDelta(current[cat], previous?.[cat])}
                      accent={CAT_CFG[cat].hex}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* trend chart */}
            <div className="bg-surface-1 border border-hairline rounded-2xl px-5 pt-5 pb-3">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-semibold text-ink">6-Month Trend</p>
                  <p className="text-[10px] text-ink-subtle mt-0.5">Hover bars for breakdown</p>
                </div>
                <div className="flex items-center gap-3">
                  {(['Database','#94a3b8'],['Compute','#5e6ad2'],['Agent','#8b5cf6'] as [string,string][]).map(([lbl,hex]) => (
                    <div key={lbl} className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: hex }} />
                      <span className="text-[10px] text-ink-muted">{lbl}</span>
                    </div>
                  ))}
                </div>
              </div>
              {history.length > 0
                ? <TrendChart history={history} />
                : <div className="h-32 flex items-center justify-center text-ink-subtle text-sm">No history yet</div>
              }
            </div>

            {/* entries table */}
            <div className="bg-surface-1 border border-hairline rounded-2xl overflow-hidden">
              {/* table header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-hairline">
                <div className="flex items-center gap-1">
                  {(['all', ...CATS] as (CostCategory | 'all')[]).map(c => (
                    <button key={c} onClick={() => setFilterCat(c)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                        filterCat === c
                          ? 'bg-primary/10 text-primary-hover border border-primary/25'
                          : 'text-ink-subtle hover:text-ink hover:bg-surface-2'
                      }`}>
                      {c === 'all' ? 'All' : CAT_CFG[c].label}
                    </button>
                  ))}
                </div>
                <span className="text-[10px] text-ink-tertiary">{visibleEntries.length} entr{visibleEntries.length === 1 ? 'y' : 'ies'}</span>
              </div>

              {/* rows */}
              {visibleEntries.length === 0 ? (
                <div className="py-14 flex flex-col items-center justify-center gap-2">
                  <p className="text-sm font-medium text-ink-subtle">No entries</p>
                  <p className="text-xs text-ink-tertiary">Add your first cost entry for this month</p>
                </div>
              ) : (
                <div>
                  {visibleEntries.map((entry, i) => {
                    const cfg   = CAT_CFG[entry.category]
                    const { Icon } = cfg
                    const share = current[entry.category] ? (entry.amountCents / current[entry.category]) * 100 : 0
                    return (
                      <div key={entry.id}
                        className={`group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-surface-2 ${i !== 0 ? 'border-t border-hairline' : ''}`}>

                        {/* icon */}
                        <div className={`w-8 h-8 rounded-lg ${cfg.iconBg} flex items-center justify-center flex-shrink-0`}>
                          <Icon size={13} className={cfg.iconCls} />
                        </div>

                        {/* name + desc */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-ink truncate">{entry.serviceName}</p>
                          <p className="text-[11px] text-ink-tertiary mt-0.5 truncate">{entry.serviceDescription ?? cfg.label}</p>
                        </div>

                        {/* mini bar */}
                        <div className="hidden sm:flex flex-col gap-1 w-24">
                          <div className="h-1 bg-surface-3 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${share.toFixed(1)}%`, backgroundColor: cfg.hex }} />
                          </div>
                          <p className="text-[10px] text-ink-tertiary">{share.toFixed(0)}% of {cfg.label}</p>
                        </div>

                        {/* amount */}
                        <p className="text-sm font-bold text-ink tabular-nums w-20 text-right">{fmt(entry.amountCents)}</p>

                        {/* delete */}
                        <button onClick={() => handleDelete(entry.id)} disabled={deletingId === entry.id}
                          className="opacity-0 group-hover:opacity-100 text-ink-subtle hover:text-red-400 transition-all disabled:opacity-50 flex-shrink-0">
                          {deletingId === entry.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {showAdd && (
        <AddEntryPanel currentMonth={currentMonth} onClose={() => setShowAdd(false)} onCreated={handleCreated} />
      )}
    </div>
  )
}

// ── stat banner column ────────────────────────────────────────────────────────

function StatBannerCol({ label, value, delta, accent }: {
  label: string
  value: number
  delta: ReturnType<typeof momDelta>
  accent: string
}) {
  const val = useCountUp(value)
  const isWhite = accent === 'white'
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: isWhite ? 'rgba(255,255,255,0.45)' : `${accent}99` }}>
        {label}
      </p>
      <p className="text-2xl font-bold tabular-nums leading-none mb-1.5" style={{ color: isWhite ? '#ffffff' : accent }}>
        {fmt(val)}
      </p>
      {delta ? (
        <div className={`flex items-center gap-1 text-[11px] font-semibold ${delta.up ? 'text-red-400' : 'text-emerald-400'}`}>
          {delta.up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
          {delta.up ? '+' : '-'}{delta.pct}% MoM
        </div>
      ) : (
        <p className="text-[11px] text-white/25">No prior data</p>
      )}
    </div>
  )
}
