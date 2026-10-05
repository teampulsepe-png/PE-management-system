import { useState, useEffect } from 'react'
import { X, Send, Loader2, Copy, Check, MessageSquare } from 'lucide-react'
import { MentionsInput, Mention } from 'react-mentions'
import type { Task, TaskOccurrence, TaskComment, TeamMember, OccurrenceStatus } from '../../types'
import { useAppContext } from '../../context/AppContext'
import TaskHistory from './TaskHistory'

const mentionsInputStyle = {
  control: { fontSize: '0.75rem', lineHeight: '1.5' },
  '&multiLine': {
    highlighter: { padding: '8px 12px', border: '1px solid transparent' },
    input: {
      padding: '8px 12px',
      border: '1px solid #23252a',
      borderRadius: '8px',
      outline: 'none',
      color: '#d0d6e0',
      backgroundColor: '#0f1011',
      resize: 'none' as const,
    },
  },
  suggestions: {
    zIndex: 100,
    list: {
      backgroundColor: '#141516',
      border: '1px solid #34343a',
      borderRadius: '8px',
      boxShadow: '0 10px 40px rgb(0 0 0 / 0.6)',
      overflow: 'hidden',
      minWidth: '160px',
    },
    item: { padding: '6px 12px', fontSize: '0.75rem', cursor: 'pointer', color: '#d0d6e0' },
  },
}

const mentionStyle = { backgroundColor: 'rgba(94,106,210,0.15)', borderRadius: '2px', padding: '0 1px', color: '#828fff' }

function parseCommentBody(body: string): React.ReactNode[] {
  const regex = /@\[([^\]]+)\]\([^)]+\)/g
  const parts: React.ReactNode[] = []
  let last = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(body)) !== null) {
    if (match.index > last) parts.push(body.slice(last, match.index))
    parts.push(
      <span key={match.index} className="text-primary-hover font-medium bg-primary/10 rounded px-0.5">
        @{match[1]}
      </span>
    )
    last = match.index + match[0].length
  }
  if (last < body.length) parts.push(body.slice(last))
  return parts.length ? parts : [body]
}

interface Props {
  task: Task
  occurrence: TaskOccurrence
  comments: TaskComment[]
  commentsLoading?: boolean
  members: TeamMember[]
  historyOccurrences: TaskOccurrence[]
  onClose: () => void
  onMarkDone: (completedBy: string, completionNotes: string) => void
  onChangeStatus: (status: 'pending' | 'in_progress' | 'skipped') => void
  onAddComment: (author: string, body: string) => void
  onNavigateToPeriod: (anchor: Date) => void
}

const TEAM_STYLES: Record<string, string> = {
  pe: 'bg-primary/10 text-primary-hover',
  so: 'bg-purple-500/10 text-purple-400',
}

const TEAM_LABELS: Record<string, string> = {
  pe: 'PE',
  so: 'SO',
}

const STATUS_BADGE: Record<OccurrenceStatus, string> = {
  pending:     'bg-surface-3 text-ink-subtle',
  in_progress: 'bg-primary/10 text-primary-hover',
  done:        'bg-success/10 text-success',
  skipped:     'bg-amber-500/10 text-amber-400',
}

const STATUS_LABEL: Record<OccurrenceStatus, string> = {
  pending:     'Pending',
  in_progress: 'In Progress',
  done:        'Done',
  skipped:     'Skipped',
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

export default function TaskDetailPanel({
  task, occurrence, comments, commentsLoading = false, members, historyOccurrences,
  onClose, onMarkDone, onChangeStatus, onAddComment, onNavigateToPeriod,
}: Props) {
  const { currentUser } = useAppContext()
  const [showDoneForm, setShowDoneForm] = useState(false)
  const [completedBy, setCompletedBy] = useState('')
  const [completionNotes, setCompletionNotes] = useState('')
  const [commentBody, setCommentBody] = useState('')
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  function copyTaskId() {
    navigator.clipboard.writeText(task.id)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const commentAuthorName = currentUser?.name ?? currentUser?.email ?? 'Unknown'

  useEffect(() => {
    setShowDoneForm(false)
    setCompletedBy('')
    setCompletionNotes('')
  }, [occurrence.period])

  const status = occurrence.status

  function openDoneForm() {
    if (currentUser?.memberId && members.some(m => m.id === currentUser.memberId)) {
      setCompletedBy(currentUser.name ?? '')
    }
    setShowDoneForm(true)
  }

  async function run(key: string, fn: () => Promise<void> | void) {
    setBusyAction(key)
    try {
      await fn()
    } finally {
      setBusyAction(null)
    }
  }

  async function handleMarkDone() {
    if (!completedBy.trim()) return
    await run('done', () => onMarkDone(completedBy.trim(), completionNotes.trim()))
    setShowDoneForm(false)
    setCompletedBy('')
    setCompletionNotes('')
  }

  function handleAddComment() {
    if (!commentBody.trim()) return
    onAddComment(commentAuthorName, commentBody.trim())
    setCommentBody('')
  }

  return (
    <div className="w-full md:w-80 flex-shrink-0 bg-surface-1 rounded-t-2xl md:rounded-xl flex flex-col overflow-hidden border border-hairline max-h-[88vh] md:max-h-none">
      {/* Header */}
      <div className="px-5 py-4 border-b border-hairline">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-sm font-semibold text-ink leading-snug" style={{ letterSpacing: '-0.2px' }}>{task.title}</h2>
          <button
            onClick={onClose}
            className="text-ink-tertiary hover:text-ink-subtle transition-colors flex-shrink-0 mt-0.5"
          >
            <X size={16} />
          </button>
        </div>

        {/* Task ID chip */}
        <button
          onClick={copyTaskId}
          title="Copy task ID"
          className="mt-2 inline-flex items-center gap-1.5 bg-surface-3 hover:bg-hairline text-ink-tertiary px-2.5 py-1 rounded-md transition-colors group"
        >
          <span className="text-[11px] font-mono">{task.id}</span>
          {copied
            ? <Check size={11} className="text-success flex-shrink-0" />
            : <Copy size={11} className="text-ink-tertiary group-hover:text-ink-subtle flex-shrink-0" />
          }
        </button>

        <div className="flex items-center gap-2 mt-2">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${TEAM_STYLES[task.team]}`}>
            {TEAM_LABELS[task.team]}
          </span>
          <span className="text-[10px] text-ink-tertiary capitalize">{task.recurrence}</span>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {task.description && (
          <p className="text-xs text-ink-subtle leading-relaxed">{task.description}</p>
        )}

        {/* Status + actions */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-tertiary">Status</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[status]}`}>
              {STATUS_LABEL[status]}
            </span>
          </div>

          {status === 'pending' && !showDoneForm && (
            <div className="flex gap-2">
              <button
                onClick={() => run('start', () => onChangeStatus('in_progress'))}
                disabled={busyAction !== null}
                className="flex-1 py-2 text-xs font-medium text-primary-hover border border-primary/30 rounded-lg hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {busyAction === 'start' ? <Loader2 size={12} className="animate-spin mx-auto" /> : 'Start'}
              </button>
              <button
                onClick={openDoneForm}
                disabled={busyAction !== null}
                className="flex-1 py-2 text-xs font-medium text-white bg-success rounded-lg hover:bg-success/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Mark as Done
              </button>
            </div>
          )}

          {status === 'in_progress' && !showDoneForm && (
            <div className="space-y-2">
              <button
                onClick={openDoneForm}
                disabled={busyAction !== null}
                className="w-full py-2 text-xs font-medium text-white bg-success rounded-lg hover:bg-success/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Mark as Done
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => run('reset', () => onChangeStatus('pending'))}
                  disabled={busyAction !== null}
                  className="flex-1 py-2 text-xs font-medium text-ink-subtle border border-hairline rounded-lg hover:bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {busyAction === 'reset' ? <Loader2 size={12} className="animate-spin mx-auto" /> : 'Reset'}
                </button>
                <button
                  onClick={() => run('skip', () => onChangeStatus('skipped'))}
                  disabled={busyAction !== null}
                  className="flex-1 py-2 text-xs font-medium text-amber-400 border border-amber-500/30 rounded-lg hover:bg-amber-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {busyAction === 'skip' ? <Loader2 size={12} className="animate-spin mx-auto" /> : 'Skip'}
                </button>
              </div>
            </div>
          )}

          {status === 'done' && (
            <div className="space-y-2">
              {occurrence.completedBy && (
                <p className="text-xs text-ink-subtle">
                  <span className="font-medium text-ink-muted">By: </span>
                  {occurrence.completedBy}
                </p>
              )}
              {occurrence.completionNotes && (
                <p className="text-xs text-ink-subtle">
                  <span className="font-medium text-ink-muted">Notes: </span>
                  {occurrence.completionNotes}
                </p>
              )}
              <button
                onClick={() => run('undo', () => onChangeStatus('pending'))}
                disabled={busyAction !== null}
                className="text-xs text-ink-tertiary hover:text-ink-subtle disabled:opacity-50 disabled:cursor-not-allowed underline transition-colors inline-flex items-center gap-1"
              >
                {busyAction === 'undo' ? <Loader2 size={11} className="animate-spin" /> : null}
                Undo
              </button>
            </div>
          )}

          {status === 'skipped' && (
            <button
              onClick={() => run('undo', () => onChangeStatus('pending'))}
              disabled={busyAction !== null}
              className="text-xs text-ink-tertiary hover:text-ink-subtle disabled:opacity-50 disabled:cursor-not-allowed underline transition-colors inline-flex items-center gap-1"
            >
              {busyAction === 'undo' ? <Loader2 size={11} className="animate-spin" /> : null}
              Undo skip
            </button>
          )}

          {showDoneForm && (
            <div className="space-y-2.5 pt-1">
              <select
                value={completedBy}
                onChange={e => setCompletedBy(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-hairline rounded-lg focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors bg-surface-2 text-ink-muted"
              >
                <option value="">Select who did it...</option>
                {members.map(m => (
                  <option key={m.id} value={m.name}>{m.name}</option>
                ))}
              </select>
              <textarea
                value={completionNotes}
                onChange={e => setCompletionNotes(e.target.value)}
                placeholder="What was done? (optional)"
                rows={3}
                className="w-full text-xs px-3 py-2 border border-hairline rounded-lg focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 resize-none transition-colors bg-surface-2 text-ink-muted placeholder:text-ink-tertiary"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowDoneForm(false); setCompletedBy(''); setCompletionNotes('') }}
                  disabled={busyAction !== null}
                  className="flex-1 py-2 text-xs font-medium text-ink-subtle border border-hairline rounded-lg hover:bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleMarkDone}
                  disabled={!completedBy.trim() || busyAction !== null}
                  className="flex-1 py-2 text-xs font-medium text-white bg-success rounded-lg hover:bg-success/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {busyAction === 'done' ? <Loader2 size={12} className="animate-spin mx-auto" /> : 'Confirm Done'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-hairline" />

        {/* History grid */}
        <TaskHistory
          task={task}
          historyOccurrences={historyOccurrences}
          activePeriodKey={occurrence.period}
          onNavigateToPeriod={onNavigateToPeriod}
        />

        <div className="border-t border-hairline" />

        {/* Comments */}
        <div className="space-y-3">
          <p className="text-xs font-medium text-ink-muted">Comments</p>

          {commentsLoading ? (
            <div className="flex items-center gap-2 text-ink-tertiary py-1">
              <Loader2 size={12} className="animate-spin flex-shrink-0" />
              <span className="text-xs">Loading comments…</span>
            </div>
          ) : comments.length === 0 ? (
            <div className="flex items-center gap-1.5 text-ink-tertiary">
              <MessageSquare size={12} className="flex-shrink-0" />
              <span className="text-xs">No comments yet</span>
            </div>
          ) : (
            <div className="space-y-3">
              {comments.map((c: TaskComment) => (
                <div key={c.id}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-medium text-ink-muted">{c.author}</span>
                    <span className="text-[10px] text-ink-tertiary">{formatTime(c.createdAt)}</span>
                  </div>
                  <p className="text-xs text-ink-subtle leading-relaxed">{parseCommentBody(c.body)}</p>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2 pt-1">
            <p className="text-[10px] text-ink-tertiary">
              Commenting as <span className="font-medium text-ink-subtle">{commentAuthorName}</span>
            </p>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <MentionsInput
                  value={commentBody}
                  onChange={(_, newValue) => setCommentBody(newValue)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleAddComment()
                    }
                  }}
                  placeholder="Add a comment… use @ to mention"
                  style={mentionsInputStyle}
                  a11ySuggestionsListLabel="Team members"
                >
                  <Mention
                    trigger="@"
                    data={members
                      .filter(m => m.id !== currentUser?.memberId)
                      .map(m => ({ id: m.id, display: m.name }))
                    }
                    style={mentionStyle}
                    displayTransform={(_, display) => `@${display}`}
                    renderSuggestion={(_suggestion, _search, highlightedDisplay, _index, focused) => (
                      <div style={{ backgroundColor: focused ? 'rgba(94,106,210,0.15)' : '#141516', color: focused ? '#828fff' : '#d0d6e0' }}>
                        {highlightedDisplay}
                      </div>
                    )}
                  />
                </MentionsInput>
              </div>
              <button
                onClick={handleAddComment}
                disabled={!commentBody.trim()}
                className="p-2 text-white bg-primary rounded-lg hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0 mb-0.5"
              >
                <Send size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
