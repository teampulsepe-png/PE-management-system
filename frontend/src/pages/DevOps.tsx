import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, AlertCircle, X, GitPullRequest, ExternalLink, User, Calendar, Tag } from 'lucide-react'

// ── column & type config ──────────────────────────────────────────────────────

const COLUMNS = [
  { id: 'New',                          label: 'New',              dotCls: 'bg-blue-500',    countCls: 'bg-blue-500/15 text-blue-400' },
  { id: 'Upcoming Sprint Priorities',   label: 'Upcoming Sprint',  dotCls: 'bg-violet-500',  countCls: 'bg-violet-500/15 text-violet-400' },
  { id: 'Current Sprint',               label: 'Current Sprint',   dotCls: 'bg-amber-500',   countCls: 'bg-amber-500/15 text-amber-400' },
  { id: 'DAT',                          label: 'DAT',              dotCls: 'bg-cyan-500',    countCls: 'bg-cyan-500/15 text-cyan-400' },
  { id: 'On Hold',                      label: 'On Hold',          dotCls: 'bg-orange-500',  countCls: 'bg-orange-500/15 text-orange-400' },
  { id: 'Closed',                       label: 'Closed',           dotCls: 'bg-ink-subtle',  countCls: 'bg-surface-3 text-ink-subtle' },
] as const

const KNOWN_STATES = new Set<string>(COLUMNS.map(c => c.id))

const TYPE_CFG: Record<string, { short: string; cls: string }> = {
  Bug:          { short: 'Bug',     cls: 'bg-red-900/25 text-red-400 border border-red-900/40' },
  Task:         { short: 'Task',    cls: 'bg-blue-900/25 text-blue-400 border border-blue-900/40' },
  'User Story': { short: 'Story',   cls: 'bg-violet-900/25 text-violet-400 border border-violet-900/40' },
  Feature:      { short: 'Feature', cls: 'bg-green-900/25 text-green-400 border border-green-900/40' },
  Epic:         { short: 'Epic',    cls: 'bg-orange-900/25 text-orange-400 border border-orange-900/40' },
}
const TYPE_DEFAULT = { short: 'Item', cls: 'bg-surface-3 text-ink-subtle border border-hairline' }

const STATE_CFG: Record<string, string> = {
  New:              'bg-blue-900/20 text-blue-400 border border-blue-900/40',
  'Upcoming Sprint':'bg-violet-900/20 text-violet-400 border border-violet-900/40',
  Active:           'bg-amber-900/20 text-amber-400 border border-amber-900/40',
  'On Hold':        'bg-orange-900/20 text-orange-400 border border-orange-900/40',
  Resolved:         'bg-green-900/20 text-green-400 border border-green-900/40',
  Closed:           'bg-surface-3 text-ink-subtle border border-hairline',
}

// ── types ─────────────────────────────────────────────────────────────────────

interface WorkItem {
  id: number
  title: string
  state: string
  board_column: string
  type: string
  assigned_to: string
  created_by: string
  changed_date: string
  created_date: string
  description: string
  tags: string[]
  priority: number | null
  url: string
}

interface ColumnDef {
  id: string
  label: string
  dotCls: string
  countCls: string
}

// ── helpers ───────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

function formatDate(iso: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function initials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0].toUpperCase()).join('')
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()
}

// ── ticket detail panel ───────────────────────────────────────────────────────

function TicketDetailPanel({ item, onClose }: { item: WorkItem; onClose: () => void }) {
  const typeCfg = TYPE_CFG[item.type] ?? TYPE_DEFAULT
  const stateCls = STATE_CFG[item.state] ?? 'bg-surface-3 text-ink-subtle border border-hairline'
  const description = item.description ? stripHtml(item.description) : null

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface-1 border border-hairline rounded-2xl shadow-2xl flex flex-col w-full max-w-4xl" style={{ height: '75vh' }}>

        {/* Header */}
        <div className="flex items-start justify-between px-8 py-6 border-b border-hairline flex-shrink-0">
          <div className="flex-1 min-w-0 pr-6">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="flex items-center gap-1.5 bg-primary/10 border border-primary/25 rounded-lg px-3 py-1">
                <span className="text-xs font-bold text-primary/70">#</span>
                <span className="text-base font-bold text-primary tracking-wide">{item.id}</span>
              </div>
              <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${typeCfg.cls}`}>
                {typeCfg.short}
              </span>
              <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${stateCls}`}>
                {item.state}
              </span>
            </div>
            <h2 className="text-xl font-semibold text-ink leading-snug">{item.title}</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-surface-2 text-ink-subtle flex-shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Body — two column layout */}
        <div className="flex-1 overflow-hidden flex min-h-0">

          {/* Left: description */}
          <div className="flex-1 overflow-y-auto px-8 py-6 border-r border-hairline">
            <p className="text-[10px] font-semibold text-ink-tertiary uppercase tracking-widest mb-3">Description</p>
            {description ? (
              <p className="text-sm text-ink-muted leading-relaxed whitespace-pre-wrap">{description}</p>
            ) : (
              <p className="text-sm text-ink-tertiary italic">No description provided.</p>
            )}
          </div>

          {/* Right: meta */}
          <div className="w-72 flex-shrink-0 overflow-y-auto px-6 py-6 space-y-4">

            <div>
              <p className="text-[10px] font-semibold text-ink-tertiary uppercase tracking-widest mb-2">Assigned To</p>
              <div className="flex items-center gap-2.5">
                {item.assigned_to !== 'Unassigned' ? (
                  <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                    {initials(item.assigned_to)}
                  </div>
                ) : (
                  <div className="w-7 h-7 rounded-full bg-surface-3 border border-hairline flex items-center justify-center flex-shrink-0">
                    <User size={13} className="text-ink-tertiary" />
                  </div>
                )}
                <span className="text-sm text-ink truncate">{item.assigned_to}</span>
              </div>
            </div>

            <div className="border-t border-hairline pt-4">
              <p className="text-[10px] font-semibold text-ink-tertiary uppercase tracking-widest mb-2">Created By</p>
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-surface-3 border border-hairline flex items-center justify-center text-[10px] font-bold text-ink-subtle flex-shrink-0">
                  {initials(item.created_by)}
                </div>
                <span className="text-sm text-ink truncate">{item.created_by}</span>
              </div>
            </div>

            <div className="border-t border-hairline pt-4">
              <p className="text-[10px] font-semibold text-ink-tertiary uppercase tracking-widest mb-1.5">Created</p>
              <div className="flex items-center gap-1.5">
                <Calendar size={13} className="text-ink-tertiary flex-shrink-0" />
                <span className="text-sm text-ink">{formatDate(item.created_date)}</span>
              </div>
            </div>

            <div className="border-t border-hairline pt-4">
              <p className="text-[10px] font-semibold text-ink-tertiary uppercase tracking-widest mb-1.5">Last Updated</p>
              <div className="flex items-center gap-1.5">
                <Calendar size={13} className="text-ink-tertiary flex-shrink-0" />
                <span className="text-sm text-ink">{formatDate(item.changed_date)}</span>
              </div>
            </div>

            {item.priority !== null && (
              <div className="border-t border-hairline pt-4">
                <p className="text-[10px] font-semibold text-ink-tertiary uppercase tracking-widest mb-1.5">Priority</p>
                <span className="text-sm font-semibold text-ink">{item.priority}</span>
              </div>
            )}

            {item.tags.length > 0 && (
              <div className="border-t border-hairline pt-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <Tag size={11} className="text-ink-tertiary" />
                  <p className="text-[10px] font-semibold text-ink-tertiary uppercase tracking-widest">Tags</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {item.tags.map(tag => (
                    <span key={tag} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-surface-3 border border-hairline text-ink-subtle">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-8 py-4 border-t border-hairline flex justify-end">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-ink-muted bg-surface-2 hover:bg-surface-3 border border-hairline rounded-xl transition-colors"
          >
            <ExternalLink size={13} />
            Open in Azure DevOps
          </a>
        </div>
      </div>
    </div>
  )
}

// ── ticket card ───────────────────────────────────────────────────────────────

function TicketCard({ item, onClick }: { item: WorkItem; onClick: () => void }) {
  const typeCfg = TYPE_CFG[item.type] ?? TYPE_DEFAULT
  const time = relativeTime(item.changed_date)

  return (
    <div
      onClick={onClick}
      className="group cursor-pointer bg-surface-2 hover:bg-surface-3 border border-hairline hover:border-hairline-strong rounded-xl p-3.5 transition-all"
    >
      {/* ID badge — prominent */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1 bg-primary/10 border border-primary/20 rounded-lg px-2.5 py-1">
          <span className="text-[11px] font-bold text-primary/70">#</span>
          <span className="text-sm font-bold text-primary tracking-wide">{item.id}</span>
        </div>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${typeCfg.cls}`}>
          {typeCfg.short}
        </span>
      </div>

      <p className="text-xs font-medium text-ink leading-snug line-clamp-2 mb-3">
        {item.title}
      </p>

      <div className="flex items-center gap-2">
        {item.assigned_to !== 'Unassigned' ? (
          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-[9px] font-semibold text-white flex-shrink-0">
            {initials(item.assigned_to)}
          </div>
        ) : (
          <div className="w-5 h-5 rounded-full bg-surface-3 border border-hairline flex items-center justify-center flex-shrink-0">
            <span className="text-[8px] text-ink-tertiary">—</span>
          </div>
        )}
        <span className="text-[10px] text-ink-tertiary truncate flex-1">{item.assigned_to}</span>
        {time && <span className="text-[10px] text-ink-tertiary flex-shrink-0">{time}</span>}
      </div>
    </div>
  )
}

// ── skeleton ──────────────────────────────────────────────────────────────────

function SkeletonColumn() {
  return (
    <div className="flex-shrink-0 w-72">
      <div className="h-8 bg-surface-2 rounded-xl mb-3 animate-pulse" />
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 bg-surface-2 rounded-xl animate-pulse" style={{ opacity: 1 - i * 0.2 }} />
        ))}
      </div>
    </div>
  )
}

// ── kanban column ─────────────────────────────────────────────────────────────

function KanbanColumn({ col, items, onSelect }: { col: ColumnDef; items: WorkItem[]; onSelect: (item: WorkItem) => void }) {
  return (
    <div className="flex-shrink-0 w-72 flex flex-col">
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${col.dotCls}`} />
        <span className="text-xs font-semibold text-ink">{col.label}</span>
        <span className={`ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full ${col.countCls}`}>
          {items.length}
        </span>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto max-h-[calc(100vh-220px)] pr-0.5">
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-hairline py-8 text-center">
            <p className="text-[10px] text-ink-tertiary">No tickets</p>
          </div>
        ) : (
          items.map(item => (
            <TicketCard key={item.id} item={item} onClick={() => onSelect(item)} />
          ))
        )}
      </div>
    </div>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function DevOps() {
  const [items, setItems] = useState<WorkItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [selected, setSelected] = useState<WorkItem | null>(null)

  const fetchTickets = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/devops/tickets')
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail ?? `Server error ${res.status}`)
      }
      const data: WorkItem[] = await res.json()
      setItems(data)
      setLastRefresh(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tickets.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTickets() }, [fetchTickets])

  const grouped = items.reduce<Record<string, WorkItem[]>>((acc, item) => {
    if (!KNOWN_STATES.has(item.board_column)) return acc
    if (!acc[item.board_column]) acc[item.board_column] = []
    acc[item.board_column].push(item)
    return acc
  }, {})

  const allColumns: ColumnDef[] = [...COLUMNS]

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <GitPullRequest size={16} className="text-primary" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-ink leading-tight">DevOps Board</h1>
            <p className="text-[10px] text-ink-subtle">OCTAVE_Platform · Azure DevOps</p>
          </div>
          {items.length > 0 && (
            <span className="text-[10px] font-semibold text-ink-subtle bg-surface-3 border border-hairline px-2 py-0.5 rounded-full">
              {items.length} items
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {lastRefresh && (
            <span className="text-[10px] text-ink-tertiary hidden sm:block">
              {relativeTime(lastRefresh.toISOString())}
            </span>
          )}
          <button
            onClick={fetchTickets}
            disabled={loading}
            title="Refresh"
            className="p-2 rounded-lg hover:bg-surface-2 text-ink-subtle disabled:opacity-40 transition-colors"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex-shrink-0 flex items-center gap-2.5 px-4 py-3 mb-4 rounded-xl bg-red-900/15 border border-red-900/30 text-red-400 text-xs">
          <AlertCircle size={14} className="flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="p-0.5 hover:opacity-70 flex-shrink-0">
            <X size={13} />
          </button>
        </div>
      )}

      {/* Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-4 h-full pb-4" style={{ minWidth: 'max-content' }}>
          {loading && items.length === 0
            ? COLUMNS.map(c => <SkeletonColumn key={c.id} />)
            : allColumns.map(col => (
                <KanbanColumn
                  key={col.id}
                  col={col}
                  items={grouped[col.id] ?? []}
                  onSelect={setSelected}
                />
              ))
          }
        </div>
      </div>

      {/* Detail panel */}
      {selected && <TicketDetailPanel item={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
