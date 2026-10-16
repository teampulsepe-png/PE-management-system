import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, AlertCircle, X, GitPullRequest, ExternalLink, User, Calendar, Tag, MessageSquare, GitBranch, LayoutGrid, Send, Check } from 'lucide-react'

// ── column & type config ──────────────────────────────────────────────────────

const COLUMNS = [
  { id: 'New',                          label: 'New',             dotCls: 'bg-blue-500',   countCls: 'bg-blue-500/15 text-blue-400' },
  { id: 'Upcoming Sprint Priorities',   label: 'Upcoming Sprint', dotCls: 'bg-violet-500', countCls: 'bg-violet-500/15 text-violet-400' },
  { id: 'Current Sprint',               label: 'Current Sprint',  dotCls: 'bg-amber-500',  countCls: 'bg-amber-500/15 text-amber-400' },
  { id: 'DAT',                          label: 'DAT',             dotCls: 'bg-cyan-500',   countCls: 'bg-cyan-500/15 text-cyan-400' },
  { id: 'On Hold',                      label: 'On Hold',         dotCls: 'bg-orange-500', countCls: 'bg-orange-500/15 text-orange-400' },
  { id: 'Closed',                       label: 'Closed',          dotCls: 'bg-ink-subtle', countCls: 'bg-surface-3 text-ink-subtle' },
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
  New:      'bg-blue-900/20 text-blue-400 border border-blue-900/40',
  Active:   'bg-amber-900/20 text-amber-400 border border-amber-900/40',
  'On Hold':'bg-orange-900/20 text-orange-400 border border-orange-900/40',
  Resolved: 'bg-green-900/20 text-green-400 border border-green-900/40',
  Closed:   'bg-surface-3 text-ink-subtle border border-hairline',
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
  changed_by: string
  changed_date: string
  created_date: string
  start_date: string
  description: string
  acceptance_criteria: string
  repro_steps: string
  tags: string[]
  priority: number | null
  item_priority: string
  severity: string
  story_points: number | null
  reason: string
  sprint: string
  area: string
  use_case_name: string
  bu_project: string
  team: string
  comment_count: number
  url: string
}

interface Comment {
  id: number
  text: string
  author: string
  date: string
}

interface AssigneeCount {
  name: string
  count: number
}

interface SprintSummary {
  total: number
  by_type: Record<string, number>
  by_assignee: AssigneeCount[]
  unassigned: number
  message: string
  recipients: string[]
  wa_configured: boolean
}

interface SendResult {
  sent_to: string[]
  failed: string[]
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

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '')
}

// ── html content renderer ─────────────────────────────────────────────────────

function HtmlContent({ html, className = '' }: { html: string; className?: string }) {
  return (
    <div
      className={`text-sm text-ink-muted leading-relaxed [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:mb-2 [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:mb-2 [&_li]:mb-1 [&_b]:text-ink [&_strong]:text-ink [&_h1]:text-base [&_h1]:font-semibold [&_h1]:text-ink [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-ink [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:text-ink [&_a]:text-primary [&_a]:underline ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
    />
  )
}

// ── ticket detail modal ───────────────────────────────────────────────────────

type DetailTab = 'details' | 'comments'

function TicketDetailPanel({ item, onClose }: { item: WorkItem; onClose: () => void }) {
  const [tab, setTab] = useState<DetailTab>('details')
  const [comments, setComments] = useState<Comment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(true)
  const [commentsError, setCommentsError] = useState(false)

  useEffect(() => {
    fetch(`/api/v1/devops/tickets/${item.id}/comments`)
      .then(r => r.json())
      .then(data => setComments(Array.isArray(data) ? data : []))
      .catch(() => setCommentsError(true))
      .finally(() => setCommentsLoading(false))
  }, [item.id])

  const typeCfg = TYPE_CFG[item.type] ?? TYPE_DEFAULT
  const stateCls = STATE_CFG[item.state] ?? 'bg-surface-3 text-ink-subtle border border-hairline'

  const isBug   = item.type === 'Bug'
  const isStory = item.type === 'User Story'

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative bg-surface-1 border border-hairline rounded-2xl shadow-2xl flex flex-col w-full max-w-5xl"
        style={{ height: '78vh' }}
      >
        {/* ── Header ── */}
        <div className="flex items-start justify-between px-8 py-5 border-b border-hairline flex-shrink-0">
          <div className="flex-1 min-w-0 pr-6">
            <div className="flex items-center gap-2 mb-2.5">
              <div className="flex items-center gap-1 bg-primary/10 border border-primary/25 rounded-lg px-2.5 py-0.5">
                <span className="text-xs font-bold text-primary/60">#</span>
                <span className="text-base font-bold text-primary">{item.id}</span>
              </div>
              <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full ${typeCfg.cls}`}>{item.type}</span>
              <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full ${stateCls}`}>{item.state}</span>
              {item.story_points != null && (
                <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-surface-3 border border-hairline text-ink-subtle">
                  {item.story_points} pts
                </span>
              )}
            </div>
            <h2 className="text-lg font-semibold text-ink leading-snug">{item.title}</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-surface-2 text-ink-subtle flex-shrink-0 mt-0.5">
            <X size={17} />
          </button>
        </div>

        {/* ── Tabs ── */}
        <div className="flex items-center gap-1 px-8 border-b border-hairline flex-shrink-0">
          <button
            onClick={() => setTab('details')}
            className={`py-2.5 px-1 mr-4 text-xs font-medium border-b-2 transition-colors ${tab === 'details' ? 'border-primary text-primary' : 'border-transparent text-ink-subtle hover:text-ink-muted'}`}
          >
            Details
          </button>
          <button
            onClick={() => setTab('comments')}
            className={`py-2.5 px-1 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${tab === 'comments' ? 'border-primary text-primary' : 'border-transparent text-ink-subtle hover:text-ink-muted'}`}
          >
            Comments
            {!commentsLoading && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-surface-3 text-ink-subtle">{comments.length}</span>
            )}
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-hidden flex min-h-0">

          {/* Left: main content */}
          <div className="flex-1 overflow-y-auto px-8 py-6 border-r border-hairline space-y-7">

            {tab === 'details' && (
              <>
                {/* Description */}
                <section>
                  <p className="text-[10px] font-semibold text-ink-tertiary uppercase tracking-widest mb-3">Description</p>
                  {item.description
                    ? <HtmlContent html={item.description} />
                    : <p className="text-sm text-ink-tertiary italic">No description provided.</p>
                  }
                </section>

                {/* Acceptance Criteria — User Stories */}
                {isStory && (
                  <section>
                    <p className="text-[10px] font-semibold text-ink-tertiary uppercase tracking-widest mb-3">Acceptance Criteria</p>
                    {item.acceptance_criteria
                      ? <HtmlContent html={item.acceptance_criteria} />
                      : <p className="text-sm text-ink-tertiary italic">No acceptance criteria defined.</p>
                    }
                  </section>
                )}

                {/* Repro Steps — Bugs */}
                {isBug && (
                  <section>
                    <p className="text-[10px] font-semibold text-ink-tertiary uppercase tracking-widest mb-3">Repro Steps</p>
                    {item.repro_steps
                      ? <HtmlContent html={item.repro_steps} />
                      : <p className="text-sm text-ink-tertiary italic">No repro steps provided.</p>
                    }
                  </section>
                )}
              </>
            )}

            {tab === 'comments' && (
              <>
                {commentsLoading ? (
                  <div className="space-y-4">
                    {[1, 2].map(i => (
                      <div key={i} className="space-y-2">
                        <div className="h-4 bg-surface-3 rounded animate-pulse w-32" />
                        <div className="h-16 bg-surface-3 rounded-xl animate-pulse" />
                      </div>
                    ))}
                  </div>
                ) : commentsError ? (
                  <p className="text-sm text-ink-tertiary italic">Could not load comments.</p>
                ) : comments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <MessageSquare size={28} className="text-ink-tertiary mb-3" />
                    <p className="text-sm text-ink-tertiary">No comments yet.</p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {comments.map(c => (
                      <div key={c.id} className="flex gap-3">
                        <div className="w-7 h-7 rounded-full bg-surface-3 border border-hairline flex items-center justify-center text-[10px] font-bold text-ink-subtle flex-shrink-0 mt-0.5">
                          {initials(c.author)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-xs font-semibold text-ink">{c.author}</span>
                            <span className="text-[10px] text-ink-tertiary">{formatDate(c.date)}</span>
                          </div>
                          <div className="bg-surface-2 rounded-xl px-4 py-3">
                            <HtmlContent html={c.text} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right: metadata sidebar */}
          <div className="w-64 flex-shrink-0 overflow-y-auto px-5 py-6 space-y-5">

            <MetaRow label="Assigned To">
              <div className="flex items-center gap-2 mt-1">
                {item.assigned_to !== 'Unassigned' ? (
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0">
                    {initials(item.assigned_to)}
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full bg-surface-3 border border-hairline flex items-center justify-center flex-shrink-0">
                    <User size={12} className="text-ink-tertiary" />
                  </div>
                )}
                <span className="text-xs text-ink truncate">{item.assigned_to}</span>
              </div>
            </MetaRow>

            <MetaRow label="Raised By">
              <div className="flex items-center gap-2 mt-1">
                <div className="w-6 h-6 rounded-full bg-surface-3 border border-hairline flex items-center justify-center text-[9px] font-bold text-ink-subtle flex-shrink-0">
                  {initials(item.created_by)}
                </div>
                <span className="text-xs text-ink truncate">{item.created_by}</span>
              </div>
            </MetaRow>

            {item.changed_by && (
              <MetaRow label="Last Updated By">
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-6 h-6 rounded-full bg-surface-3 border border-hairline flex items-center justify-center text-[9px] font-bold text-ink-subtle flex-shrink-0">
                    {initials(item.changed_by)}
                  </div>
                  <span className="text-xs text-ink truncate">{item.changed_by}</span>
                </div>
              </MetaRow>
            )}

            {item.use_case_name && (
              <MetaRow label="Use Case">
                <span className="text-xs text-ink mt-1 block font-medium">{item.use_case_name}</span>
              </MetaRow>
            )}

            {item.bu_project && (
              <MetaRow label="BU / Project">
                <span className="text-xs text-ink mt-1 block">{item.bu_project}</span>
              </MetaRow>
            )}

            {item.team && (
              <MetaRow label="Team">
                <span className="text-xs text-ink mt-1 block">{item.team}</span>
              </MetaRow>
            )}

            {item.sprint && (
              <MetaRow label="Sprint">
                <div className="flex items-center gap-1.5 mt-1">
                  <GitBranch size={12} className="text-ink-tertiary flex-shrink-0" />
                  <span className="text-xs text-ink">{item.sprint}</span>
                </div>
              </MetaRow>
            )}

            {item.area && (
              <MetaRow label="Area">
                <div className="flex items-center gap-1.5 mt-1">
                  <LayoutGrid size={12} className="text-ink-tertiary flex-shrink-0" />
                  <span className="text-xs text-ink">{item.area}</span>
                </div>
              </MetaRow>
            )}

            {item.item_priority && (
              <MetaRow label="Priority">
                <span className={`inline-block text-[10px] font-semibold px-2.5 py-0.5 rounded-full mt-1 ${
                  item.item_priority === 'High'    ? 'bg-red-900/20 text-red-400 border border-red-900/40' :
                  item.item_priority === 'Medium'  ? 'bg-amber-900/20 text-amber-400 border border-amber-900/40' :
                  item.item_priority === 'Low'     ? 'bg-green-900/20 text-green-400 border border-green-900/40' :
                  'bg-surface-3 text-ink-subtle border border-hairline'
                }`}>{item.item_priority}</span>
              </MetaRow>
            )}

            {item.story_points != null && (
              <MetaRow label="Story Points">
                <span className="text-xs font-semibold text-ink mt-1 block">{item.story_points}</span>
              </MetaRow>
            )}

            <MetaRow label="Created">
              <div className="flex items-center gap-1.5 mt-1">
                <Calendar size={12} className="text-ink-tertiary flex-shrink-0" />
                <span className="text-xs text-ink">{formatDate(item.created_date)}</span>
              </div>
            </MetaRow>

            {item.start_date && (
              <MetaRow label="Start Date">
                <div className="flex items-center gap-1.5 mt-1">
                  <Calendar size={12} className="text-ink-tertiary flex-shrink-0" />
                  <span className="text-xs text-ink">{formatDate(item.start_date)}</span>
                </div>
              </MetaRow>
            )}

            <MetaRow label="Last Updated">
              <div className="flex items-center gap-1.5 mt-1">
                <Calendar size={12} className="text-ink-tertiary flex-shrink-0" />
                <span className="text-xs text-ink">{formatDate(item.changed_date)}</span>
              </div>
            </MetaRow>

            {isBug && item.severity && (
              <MetaRow label="Severity">
                <span className="text-xs text-ink mt-1 block">{item.severity}</span>
              </MetaRow>
            )}

            {item.reason && (
              <MetaRow label="Reason">
                <span className="text-xs text-ink-muted mt-1 block">{item.reason}</span>
              </MetaRow>
            )}

            {item.tags.length > 0 && (
              <MetaRow label="Tags">
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {item.tags.map(tag => (
                    <span key={tag} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-surface-3 border border-hairline text-ink-subtle">
                      {tag}
                    </span>
                  ))}
                </div>
              </MetaRow>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex-shrink-0 px-8 py-3.5 border-t border-hairline flex justify-end">
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

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-hairline pt-4 first:border-0 first:pt-0">
      <p className="text-[10px] font-semibold text-ink-tertiary uppercase tracking-widest">{label}</p>
      {children}
    </div>
  )
}

// ── ticket card ───────────────────────────────────────────────────────────────

function TicketCard({ item, onClick }: { item: WorkItem; onClick: () => void }) {
  const typeCfg = TYPE_CFG[item.type] ?? TYPE_DEFAULT
  const time = relativeTime(item.changed_date)
  const [copied, setCopied] = useState(false)

  function copyId(e: React.MouseEvent) {
    e.stopPropagation()
    navigator.clipboard.writeText(String(item.id)).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div
      onClick={onClick}
      className="group cursor-pointer bg-surface-2 hover:bg-surface-3 border border-hairline hover:border-hairline-strong rounded-xl p-3.5 transition-all"
    >
      {/* ID + type */}
      <div className="flex items-center justify-between mb-2.5">
        <div
          onClick={copyId}
          title="Copy ID"
          className={`flex items-center gap-1 border rounded-lg px-2.5 py-1 cursor-pointer select-none transition-all duration-150 ${
            copied
              ? 'bg-green-500/15 border-green-500/30'
              : 'bg-primary/10 border-primary/20 hover:bg-primary/20'
          }`}
        >
          <span className={`text-[11px] font-bold transition-colors ${copied ? 'text-green-400' : 'text-primary/70'}`}>#</span>
          <span className={`text-sm font-bold tracking-wide transition-colors ${copied ? 'text-green-400' : 'text-primary'}`}>
            {copied ? 'Copied!' : item.id}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {item.comment_count > 0 && (
            <div className="flex items-center gap-0.5 text-ink-tertiary">
              <MessageSquare size={11} />
              <span className="text-[10px]">{item.comment_count}</span>
            </div>
          )}
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${typeCfg.cls}`}>
            {typeCfg.short}
          </span>
        </div>
      </div>

      {/* Title */}
      <p className="text-xs font-medium text-ink leading-snug line-clamp-2 mb-2.5">
        {item.title}
      </p>

      {/* Team tag */}
      {item.team && (
        <span className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full bg-surface-3 border border-hairline text-ink-subtle mb-2.5">
          {item.team}
        </span>
      )}

      {/* Assigned to + raised by + time */}
      <div className="flex items-center gap-1.5">
        {/* Assigned */}
        <div className="flex items-center gap-1 flex-1 min-w-0">
          {item.assigned_to !== 'Unassigned' ? (
            <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-[9px] font-semibold text-white flex-shrink-0" title={`Assigned: ${item.assigned_to}`}>
              {initials(item.assigned_to)}
            </div>
          ) : (
            <div className="w-5 h-5 rounded-full bg-surface-3 border border-hairline flex items-center justify-center flex-shrink-0">
              <span className="text-[8px] text-ink-tertiary">—</span>
            </div>
          )}
          <span className="text-[10px] text-ink-tertiary truncate">{item.assigned_to}</span>
        </div>

        {/* Raised by */}
        {item.created_by && item.created_by !== 'Unknown' && (
          <div className="flex items-center gap-1 flex-shrink-0" title={`Raised by: ${item.created_by}`}>
            <div className="w-5 h-5 rounded-full bg-surface-3 border border-hairline flex items-center justify-center text-[9px] font-semibold text-ink-subtle flex-shrink-0">
              {initials(item.created_by)}
            </div>
          </div>
        )}

        {time && <span className="text-[10px] text-ink-tertiary flex-shrink-0 ml-auto">{time}</span>}
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
          items.map(item => <TicketCard key={item.id} item={item} onClick={() => onSelect(item)} />)
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
      setItems(await res.json())
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
            <span className="text-[10px] text-ink-tertiary hidden sm:block">{relativeTime(lastRefresh.toISOString())}</span>
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
          <button onClick={() => setError(null)} className="p-0.5 hover:opacity-70 flex-shrink-0"><X size={13} /></button>
        </div>
      )}

      {/* Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-4 h-full pb-4" style={{ minWidth: 'max-content' }}>
          {loading && items.length === 0
            ? COLUMNS.map(c => <SkeletonColumn key={c.id} />)
            : COLUMNS.map(col => (
                <KanbanColumn key={col.id} col={col} items={grouped[col.id] ?? []} onSelect={setSelected} />
              ))
          }
        </div>
      </div>

      {selected && <TicketDetailPanel item={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
