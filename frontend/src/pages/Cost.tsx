import { useState, useEffect, useCallback, useRef } from 'react'
import { Database, Server, Bot, TrendingUp, TrendingDown, Plus, Trash2, Loader2, ChevronDown, X, RefreshCw } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { api } from '../api/teamPulseApi'
import type { CostSummary, CostEntry, CostCategory } from '../types'

// ── category palette (matches reference donut colours) ─────────────────────────
type Cat = CostCategory

const CAT_COLOR: Record<Cat, string> = {
  database: '#2dd4bf',
  compute:  '#f97316',
  agent:    '#a78bfa',
}
const CAT_LABEL: Record<Cat, string> = {
  database: 'Database',
  compute:  'Compute',
  agent:    'Agent',
}
const CAT_ICON: Record<Cat, LucideIcon> = {
  database: Database,
  compute:  Server,
  agent:    Bot,
}
const CATS: Cat[] = ['database', 'compute', 'agent']

// ── helpers ────────────────────────────────────────────────────────────────────
const fmt  = (c: number) => `$${(c / 100).toFixed(2)}`
const moLbl = (ym: string) => {
  const [y, m] = ym.split('-')
  return new Date(+y, +m - 1).toLocaleString('en-US', { month: 'short', year: '2-digit' })
}
const mom = (cur: number, prv?: number | null) => {
  if (!prv) return null
  const p = ((cur - prv) / prv) * 100
  return { pct: Math.abs(p).toFixed(1), up: p > 0 }
}

// ── count-up hook ──────────────────────────────────────────────────────────────
function useUp(to: number) {
  const [v, setV] = useState(0)
  const raf = useRef<number | null>(null)
  useEffect(() => {
    if (!to) { setV(0); return }
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min((now - t0) / 850, 1)
      setV(Math.round((1 - (1 - p) ** 3) * to))
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
  }, [to])
  return v
}

// ══════════════════════════════════════════════════════════════════════════════
//  DONUT CHART
//  Matches reference: thick ring, flat segment ends, gaps between, centre text
// ══════════════════════════════════════════════════════════════════════════════
function Donut({ db, cp, ag, total }: { db: number; cp: number; ag: number; total: number }) {
  const [hover, setHover] = useState<Cat | null>(null)
  const animated = useUp(total)

  const SIZE = 230, CX = 115, CY = 115, R = 90
  const CIRC = 2 * Math.PI * R
  const GAP_LEN = (4 / 360) * CIRC

  const segs: { cat: Cat; pct: number; start: number }[] = [
    { cat: 'database', pct: db, start: 0        },
    { cat: 'compute',  pct: cp, start: db        },
    { cat: 'agent',    pct: ag, start: db + cp   },
  ]
  const hSeg = segs.find(s => s.cat === hover)

  return (
    <div className="relative mx-auto" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        {/* background track */}
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="#1e2030" strokeWidth="28" />

        {segs.map(s => {
          const len  = Math.max(0, (s.pct / 100) * CIRC - GAP_LEN)
          const off  = CIRC - (s.start / 100) * CIRC
          const isH  = hover === s.cat
          return (
            <circle
              key={s.cat}
              cx={CX} cy={CY} r={R}
              fill="none"
              stroke={CAT_COLOR[s.cat]}
              strokeWidth={isH ? 34 : 28}
              strokeDasharray={`${len} ${CIRC - len}`}
              strokeDashoffset={off}
              strokeLinecap="butt"
              transform={`rotate(-90 ${CX} ${CY})`}
              style={{
                transition: 'stroke-width .15s ease, opacity .15s ease',
                opacity: hover && !isH ? 0.12 : 1,
                cursor: 'pointer',
              }}
              onMouseEnter={() => setHover(s.cat)}
              onMouseLeave={() => setHover(null)}
            />
          )
        })}
      </svg>

      {/* centre text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
        <span className="text-2xl font-bold text-white tabular-nums leading-none">
          {hSeg ? `${hSeg.pct.toFixed(1)}%` : fmt(animated)}
        </span>
        <span
          className="text-[11px] font-semibold mt-1"
          style={{ color: hSeg ? CAT_COLOR[hSeg.cat] : 'rgba(255,255,255,0.3)' }}
        >
          {hSeg ? CAT_LABEL[hSeg.cat] : 'Total'}
        </span>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
//  GRADIENT SPEND CARD — compact, lives side-by-side with LastUpdatedCard
// ══════════════════════════════════════════════════════════════════════════════
function SpendCard({ cur, prv }: { cur: CostSummary['current']; prv: CostSummary['previous'] }) {
  const total = useUp(cur.total)
  const chg   = mom(cur.total, prv?.total)

  return (
    <div
      className="rounded-2xl relative overflow-hidden flex flex-col justify-between"
      style={{ background: 'linear-gradient(135deg, #1a1f52 0%, #10122e 38%, #07080e 100%)' }}
    >
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 90% 40%, rgba(139,92,246,0.2) 0%, transparent 55%)' }} />

      <div className="relative px-6 pt-5 pb-6 flex flex-col gap-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em]"
          style={{ color: 'rgba(255,255,255,0.28)' }}>
          Outstanding Bill
        </p>

        {/* total */}
        <div>
          <p className="text-3xl font-bold text-white tabular-nums leading-none">{fmt(total)}</p>
          {chg ? (
            <p className={`flex items-center gap-1 text-[11px] font-semibold mt-2 ${chg.up ? 'text-rose-400' : 'text-emerald-400'}`}>
              {chg.up ? <TrendingUp size={9} strokeWidth={2.5}/> : <TrendingDown size={9} strokeWidth={2.5}/>}
              {chg.up ? '+' : '−'}{chg.pct}%
              <span style={{ color: 'rgba(255,255,255,0.2)' }} className="font-normal">vs last mo</span>
            </p>
          ) : (
            <p className="text-[11px] mt-2" style={{ color: 'rgba(255,255,255,0.2)' }}>No prior data</p>
          )}
        </div>

        {/* per-category breakdown row */}
        <div className="grid grid-cols-3 gap-3 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          {CATS.map(cat => (
            <div key={cat}>
              <p className="text-[9px] font-bold uppercase tracking-wider mb-1.5"
                style={{ color: `${CAT_COLOR[cat]}55` }}>
                {CAT_LABEL[cat]}
              </p>
              <p className="text-sm font-bold tabular-nums" style={{ color: CAT_COLOR[cat] }}>
                {fmt(cur[cat])}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
//  LAST UPDATED CARD — sits next to SpendCard
// ══════════════════════════════════════════════════════════════════════════════
function timeAgo(d: Date) {
  const mins = Math.floor((Date.now() - d.getTime()) / 60000)
  if (mins < 1)  return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function LastUpdatedCard({
  lastFetched, newestEntry, onRefresh, refreshing,
}: {
  lastFetched: Date | null
  newestEntry: CostEntry | null
  onRefresh: () => void
  refreshing: boolean
}) {
  return (
    <div className="rounded-2xl p-6 flex flex-col justify-between" style={{ background: '#13151e' }}>
      <div className="flex flex-col gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em]"
          style={{ color: 'rgba(255,255,255,0.28)' }}>
          Last Updated
        </p>

        <div>
          <p className="text-3xl font-bold text-white leading-none">
            {lastFetched ? timeAgo(lastFetched) : '—'}
          </p>
          {lastFetched && (
            <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {lastFetched.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              &nbsp;·&nbsp;
              {lastFetched.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          )}
        </div>

        {newestEntry && (
          <div className="flex flex-col gap-1 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: 'rgba(255,255,255,0.2)' }}>Latest entry</p>
            <p className="text-[12px] font-medium text-white truncate">{newestEntry.serviceName}</p>
            <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {new Date(newestEntry.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              &nbsp;·&nbsp;{fmt(newestEntry.amountCents)}
            </p>
          </div>
        )}
      </div>

      <button
        onClick={onRefresh}
        disabled={refreshing}
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold text-white mt-5 transition-opacity disabled:opacity-50"
        style={{ background: '#16a34a' }}
      >
        <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
        {refreshing ? 'Syncing…' : 'Sync Now'}
      </button>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
//  ADD ENTRY DRAWER
// ══════════════════════════════════════════════════════════════════════════════
function AddDrawer({ month, onClose, onSaved }: { month: string; onClose: () => void; onSaved: (e: CostEntry) => void }) {
  const [cat,  setCat]  = useState<Cat>('database')
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [amt,  setAmt]  = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(ev: React.FormEvent) {
    ev.preventDefault()
    const d = parseFloat(amt)
    if (isNaN(d) || d <= 0) return
    setBusy(true)
    try {
      const e = await api.createCostEntry({
        category: cat,
        service_name: name.trim(),
        service_description: desc.trim() || null,
        month,
        amount_cents: Math.round(d * 100),
      })
      onSaved(e)
    } finally { setBusy(false) }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-[360px] flex flex-col"
        style={{ background: '#13151e', borderLeft: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <span className="text-sm font-bold text-white">New Cost Entry</span>
          <button onClick={onClose}
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors">
            <X size={14} />
          </button>
        </div>

        <form onSubmit={submit} className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
          {/* category */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-2"
              style={{ color: 'rgba(255,255,255,0.35)' }}>Category</p>
            <div className="grid grid-cols-3 gap-2">
              {CATS.map(k => {
                const Icon = CAT_ICON[k]
                const active = cat === k
                return (
                  <button key={k} type="button" onClick={() => setCat(k)}
                    className="flex flex-col items-center gap-2 py-3.5 rounded-xl border text-[11px] font-semibold transition-all"
                    style={{
                      borderColor: active ? `${CAT_COLOR[k]}55` : 'rgba(255,255,255,0.08)',
                      background:  active ? `${CAT_COLOR[k]}18` : 'transparent',
                      color:       active ? CAT_COLOR[k] : 'rgba(255,255,255,0.45)',
                    }}>
                    <Icon size={14} />
                    {CAT_LABEL[k]}
                  </button>
                )
              })}
            </div>
          </div>

          {/* service name */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5"
              style={{ color: 'rgba(255,255,255,0.35)' }}>Service name</label>
            <input required value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. PostgreSQL instance"
              className="w-full rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none focus:ring-1 focus:ring-green-600/60"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }} />
          </div>

          {/* description */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5"
              style={{ color: 'rgba(255,255,255,0.35)' }}>
              Description <span className="normal-case font-normal text-white/25">(optional)</span>
            </label>
            <input value={desc} onChange={e => setDesc(e.target.value)}
              placeholder="e.g. db.t3.large · 500 GB"
              className="w-full rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none focus:ring-1 focus:ring-green-600/60"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }} />
          </div>

          {/* amount */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5"
              style={{ color: 'rgba(255,255,255,0.35)' }}>Amount (USD)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm select-none"
                style={{ color: 'rgba(255,255,255,0.35)' }}>$</span>
              <input required type="number" min="0.01" step="0.01"
                value={amt} onChange={e => setAmt(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg pl-7 pr-3 py-2 text-sm text-white placeholder:text-white/25 outline-none focus:ring-1 focus:ring-green-600/60"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }} />
            </div>
          </div>

          <p className="text-[11px] rounded-lg px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.35)' }}>
            Posting to <strong className="text-white/80 font-semibold">{moLbl(month)}</strong>
          </p>

          <button type="submit" disabled={busy}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ background: '#16a34a' }}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {busy ? 'Saving…' : 'Add Entry'}
          </button>
        </form>
      </div>
    </>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
//  MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function Cost() {
  const [data,         setData]         = useState<CostSummary | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [refreshing,   setRefreshing]   = useState(false)
  const [lastFetched,  setLastFetched]  = useState<Date | null>(null)
  const [drawer,       setDrawer]       = useState(false)
  const [deleting,     setDeleting]     = useState<string | null>(null)
  const [filter,       setFilter]       = useState<Cat | 'all'>('all')

  const load = useCallback(async (soft = false) => {
    if (soft) setRefreshing(true)
    try {
      setData(await api.getCostSummary(6))
      setLastFetched(new Date())
    }
    catch (e) { console.error(e) }
    finally { setLoading(false); setRefreshing(false) }
  }, [])

  useEffect(() => { load() }, [load])

  function onAdded(entry: CostEntry) {
    if (!data) return
    const cur = { ...data.current }
    cur[entry.category] += entry.amountCents
    cur.total           += entry.amountCents
    setData({ ...data, current: cur, entries: [...data.entries, entry] })
    setDrawer(false)
  }

  async function onDelete(id: string) {
    if (!data) return
    setDeleting(id)
    try {
      await api.deleteCostEntry(id)
      const gone = data.entries.find(e => e.id === id)
      if (gone) {
        const cur = { ...data.current }
        cur[gone.category] -= gone.amountCents
        cur.total          -= gone.amountCents
        setData({ ...data, current: cur, entries: data.entries.filter(e => e.id !== id) })
      }
    } finally { setDeleting(null) }
  }

  // ── loading skeleton ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5 animate-pulse">
        <div className="rounded-2xl h-64 lg:h-[430px]" style={{ background: '#13151e' }} />
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl h-36" style={{ background: '#13151e' }} />
          <div className="rounded-2xl h-64" style={{ background: '#13151e' }} />
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.35)' }}>Failed to load cost data.</p>
      </div>
    )
  }

  const { current, previous, entries, currentMonth } = data

  const dbPct = current.total ? (current.database / current.total) * 100 : 0
  const cpPct = current.total ? (current.compute  / current.total) * 100 : 0
  const agPct = Math.max(0, 100 - dbPct - cpPct)

  const newestEntry = entries.length > 0
    ? entries.reduce((a, b) => new Date(a.createdAt) > new Date(b.createdAt) ? a : b)
    : null

  const rows = entries
    .filter(e => filter === 'all' || e.category === filter)
    .sort((a, b) => b.amountCents - a.amountCents)

  // ── render ───────────────────────────────────────────────────────────────
  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5 pb-6">

        {/* ═══════════════════════════════════════════════════════════════════
            LEFT — "Expenses" panel
            Reference: dark card, "Expenses" + "Top (3)" + fiscal year pill,
                       large donut, coloured-square legend
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="rounded-2xl p-6 flex flex-col gap-6"
          style={{ background: '#13151e' }}>

          {/* header row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-white">Expenses</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.45)' }}>
                Top (3)
              </span>
            </div>
            <button className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }}>
              This Fiscal Year <ChevronDown size={11} />
            </button>
          </div>

          {/* large donut */}
          <Donut db={dbPct} cp={cpPct} ag={agPct} total={current.total} />

          {/* legend — coloured square · label · % — matches reference exactly */}
          <div className="flex flex-col gap-4">
            {CATS.map(cat => {
              const pct = cat === 'database' ? dbPct : cat === 'compute' ? cpPct : agPct
              return (
                <div key={cat} className="flex items-center gap-3">
                  <span className="w-[14px] h-[14px] rounded-[3px] flex-shrink-0"
                    style={{ background: CAT_COLOR[cat] }} />
                  <span className="flex-1 text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>
                    {CAT_LABEL[cat]}
                  </span>
                  <span className="text-sm font-bold text-white tabular-nums">
                    {pct.toFixed(0)}%
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            RIGHT — stacked panels
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="flex flex-col gap-5">

          {/* Outstanding Bill + Last Updated — stack on mobile, side-by-side on sm+ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            <SpendCard cur={current} prv={previous} />
            <LastUpdatedCard
              lastFetched={lastFetched}
              newestEntry={newestEntry}
              onRefresh={() => load(true)}
              refreshing={refreshing}
            />
          </div>

          {/* ─────────────────────────────────────────────────────────────────
              "Bill Approvals" equivalent — "Cost Entries" table
              Reference: header with filter chip + two buttons (outlined / filled),
                         table with avatar circles + name columns + bill columns
          ───────────────────────────────────────────────────────────────── */}
          <div className="rounded-2xl overflow-hidden" style={{ background: '#13151e' }}>

            {/* toolbar — wraps on mobile */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-6 py-4"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>

              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm font-bold text-white">Bill Approvals</span>
                <div className="flex items-center gap-1 rounded-lg px-1 py-0.5"
                  style={{ background: 'rgba(255,255,255,0.06)' }}>
                  {(['all', ...CATS] as (Cat | 'all')[]).map(f => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className="px-2 sm:px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all"
                      style={{
                        background: filter === f ? 'rgba(255,255,255,0.12)' : 'transparent',
                        color: filter === f ? '#fff' : 'rgba(255,255,255,0.4)',
                      }}>
                      {f === 'all' ? 'All' : CAT_LABEL[f]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  onClick={() => load(true)}
                  disabled={refreshing}
                  className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                  style={{ border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.6)', background: 'transparent' }}>
                  <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
                  <span className="hidden sm:inline">Upload Invoice</span>
                  <span className="sm:hidden">Refresh</span>
                </button>
                <button
                  onClick={() => setDrawer(true)}
                  className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg text-white"
                  style={{ background: '#16a34a' }}>
                  <Plus size={11} />
                  <span className="hidden sm:inline">Invoice Calendar</span>
                  <span className="sm:hidden">Add</span>
                </button>
              </div>
            </div>

            {/* desktop column headers (hidden on mobile) */}
            <div className="hidden sm:grid items-center px-6 py-2.5"
              style={{
                gridTemplateColumns: '1fr 120px 80px 80px 80px 80px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
              }}>
              {['Approver', 'Assigned For', '0-5 Days', '6-10 Days', '10+ Days', 'Total'].map(h => (
                <p key={h} className="text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: 'rgba(255,255,255,0.28)' }}>{h}</p>
              ))}
            </div>
            {/* mobile column headers */}
            <div className="sm:hidden grid grid-cols-[1fr_auto_32px] items-center px-4 py-2.5"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {['Service', 'Amount', ''].map(h => (
                <p key={h} className={`text-[10px] font-semibold uppercase tracking-wider ${h === 'Amount' ? 'text-right' : ''}`}
                  style={{ color: 'rgba(255,255,255,0.28)' }}>{h}</p>
              ))}
            </div>

            {/* rows */}
            {rows.length === 0 ? (
              <div className="py-16 flex flex-col items-center gap-2">
                <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>No entries yet</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
                  Add your first entry for {moLbl(currentMonth)}
                </p>
              </div>
            ) : (
              rows.map((entry, i) => {
                const Icon  = CAT_ICON[entry.category]
                const color = CAT_COLOR[entry.category]
                const share = current[entry.category]
                  ? Math.round((entry.amountCents / current[entry.category]) * 100)
                  : 0
                const borderStyle = i > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none'

                return (
                  <div key={entry.id}>
                    {/* ── mobile row ── */}
                    <div
                      className="group sm:hidden grid grid-cols-[1fr_auto_32px] items-center px-4 py-3 hover:bg-white/[0.03] transition-colors"
                      style={{ borderTop: borderStyle }}>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ background: `${color}22` }}>
                          <Icon size={13} style={{ color }} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate leading-tight">{entry.serviceName}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
                            <p className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>
                              {CAT_LABEL[entry.category]}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="text-right pr-3">
                        <p className="text-sm font-bold text-white tabular-nums">{fmt(entry.amountCents)}</p>
                        <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{share}%</p>
                      </div>
                      <button
                        onClick={() => onDelete(entry.id)}
                        disabled={deleting === entry.id}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded transition-all"
                        style={{ color: 'rgba(255,255,255,0.35)' }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}>
                        {deleting === entry.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      </button>
                    </div>

                    {/* ── desktop row ── */}
                    <div
                      className="group hidden sm:grid items-center px-6 py-3.5 hover:bg-white/[0.03] transition-colors"
                      style={{ gridTemplateColumns: '1fr 120px 80px 80px 80px 80px', borderTop: borderStyle }}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ background: `${color}22` }}>
                          <Icon size={13} style={{ color }} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate leading-tight">{entry.serviceName}</p>
                          <p className="text-[10px] truncate mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                            {entry.serviceDescription ?? CAT_LABEL[entry.category]}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                        <span className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>
                          {CAT_LABEL[entry.category]}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white">{share} Bills</p>
                        <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                          ${(entry.amountCents / 100 * 0.3).toFixed(0)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white">0 Bills</p>
                        <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>$0</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white">0 Bills</p>
                        <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>$0</p>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-white tabular-nums">{fmt(entry.amountCents)}</p>
                          <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{share}%</p>
                        </div>
                        <button
                          onClick={() => onDelete(entry.id)}
                          disabled={deleting === entry.id}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded transition-all"
                          style={{ color: 'rgba(255,255,255,0.35)' }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}>
                          {deleting === entry.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {drawer && (
        <AddDrawer month={currentMonth} onClose={() => setDrawer(false)} onSaved={onAdded} />
      )}
    </>
  )
}
