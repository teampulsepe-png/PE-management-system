import { useEffect, useState } from 'react'
import { Plus, Trash2, ChevronLeft, ChevronRight, Check, Clock, Circle, ExternalLink } from 'lucide-react'
import { api } from '../api/teamPulseApi'
import type { Project, ProjectItem, TeamMember, UserAccessLog } from '../types'

// ── constants ─────────────────────────────────────────────────────────────────

const ITEM_LABELS: Record<string, string> = {
  usecase_code:       'Usecase Code',
  master_data:        'Master Data',
  repo_creation:      'Repo Creation',
  databricks_cluster: 'Databricks Cluster Creation',
  user_group_name:    'User Group Name',
  budget_set:         'Budget Set',
  dpia_validation:    'DPIA Validation',
  dpia_link:          'DPIA Link',
  raid_log:           'RAID Log',
}

const PHASES = ['initiation', 'governance', 'dynamics'] as const
type Phase = typeof PHASES[number]

const PHASE_LABELS: Record<Phase, string> = {
  initiation: 'Project Initiation',
  governance: 'Governance',
  dynamics:   'Dynamics',
}

const PHASE_COLORS: Record<Phase, string> = {
  initiation: 'bg-primary/10 border-primary/30 text-primary-hover',
  governance: 'bg-violet-900/20 border-violet-900/40 text-violet-400',
  dynamics:   'bg-teal-900/20 border-teal-900/40 text-teal-400',
}

const STATUS_CONFIG: Record<string, { icon: typeof Check; cls: string; label: string }> = {
  pending:     { icon: Circle, cls: 'text-ink-subtle',   label: 'Pending' },
  in_progress: { icon: Clock,  cls: 'text-amber-400', label: 'In Progress' },
  done:        { icon: Check,  cls: 'text-teal-500',  label: 'Done' },
}

const PROJECT_STATUS_BADGE: Record<string, string> = {
  draft:    'bg-surface-3 text-ink-tertiary border-hairline',
  active:   'bg-teal-900/20 text-teal-400 border-teal-900/40',
  complete: 'bg-success/10 text-success border-success/30',
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function isUrl(s: string) {
  return s.startsWith('http://') || s.startsWith('https://')
}

// ── sub-components ────────────────────────────────────────────────────────────

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
      <div
        className="h-full bg-teal-500 rounded-full transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

// ── item row ──────────────────────────────────────────────────────────────────

interface ItemRowProps {
  item: ProjectItem
  members: TeamMember[]
  projectId: string
  onUpdated: (p: Project) => void
}

function ItemRow({ item, members, projectId, onUpdated }: ItemRowProps) {
  const [editing, setEditing] = useState(false)
  const [owner, setOwner] = useState(item.ownerId ?? '')
  const [deadline, setDeadline] = useState(item.deadline ?? '')
  const [deliverable, setDeliverable] = useState(item.deliverable ?? '')
  const [status, setStatus] = useState(item.status)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      const updated = await api.updateProjectItem(projectId, item.id, {
        owner_id:   owner || null,
        deadline:   deadline || null,
        deliverable: deliverable || null,
        status,
      })
      onUpdated(updated)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  function cancel() {
    setOwner(item.ownerId ?? '')
    setDeadline(item.deadline ?? '')
    setDeliverable(item.deliverable ?? '')
    setStatus(item.status)
    setEditing(false)
  }

  const { icon: Icon, cls } = STATUS_CONFIG[item.status]

  return (
    <div className={`rounded-lg border transition-all ${editing ? 'border-primary bg-primary/10' : 'border-hairline bg-surface-1 hover:border-hairline'}`}>
      {/* collapsed row */}
      {!editing ? (
        <button
          onClick={() => setEditing(true)}
          className="w-full flex items-center gap-3 px-4 py-3 text-left group"
        >
          <Icon size={15} className={`flex-shrink-0 ${cls}`} />
          <span className="flex-1 text-sm text-ink font-medium">{ITEM_LABELS[item.itemKey] ?? item.itemKey}</span>
          {item.ownerName && (
            <span className="text-xs text-ink-subtle hidden sm:block">{item.ownerName}</span>
          )}
          {item.deadline && (
            <span className="text-xs text-ink-subtle hidden md:block">{item.deadline}</span>
          )}
          {item.deliverable && (
            isUrl(item.deliverable)
              ? <a href={item.deliverable} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-xs text-primary flex items-center gap-0.5 hover:underline"><ExternalLink size={11} />Link</a>
              : <span className="text-xs text-ink-subtle max-w-32 truncate hidden lg:block">{item.deliverable}</span>
          )}
          <ChevronRight size={13} className="text-ink-subtle group-hover:text-ink-muted flex-shrink-0" />
        </button>
      ) : (
        /* expanded edit form */
        <div className="px-4 py-3 space-y-3">
          <div className="flex items-center gap-2">
            <Icon size={15} className={cls} />
            <span className="text-sm font-semibold text-ink">{ITEM_LABELS[item.itemKey] ?? item.itemKey}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-ink-subtle uppercase tracking-wide block mb-1">Owner</label>
              <select
                value={owner}
                onChange={e => setOwner(e.target.value)}
                className="w-full border border-hairline rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-surface-1 text-ink"
              >
                <option value="">Unassigned</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-ink-subtle uppercase tracking-wide block mb-1">Deadline</label>
              <input
                type="date"
                value={deadline}
                onChange={e => setDeadline(e.target.value)}
                className="w-full border border-hairline rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-surface-1 text-ink"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-ink-subtle uppercase tracking-wide block mb-1">Deliverable</label>
            <input
              value={deliverable}
              onChange={e => setDeliverable(e.target.value)}
              placeholder="URL, code, name, or any reference…"
              className="w-full border border-hairline rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-surface-1 text-ink"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-ink-subtle uppercase tracking-wide block mb-1">Status</label>
            <div className="flex gap-2">
              {Object.entries(STATUS_CONFIG).map(([k, { label }]) => (
                <button
                  key={k}
                  onClick={() => setStatus(k as ProjectItem['status'])}
                  className={`text-xs font-semibold px-3 py-1 rounded-md border transition-all ${
                    status === k
                      ? 'bg-primary text-white border-primary'
                      : 'bg-surface-1 text-ink-subtle border-hairline hover:border-hairline'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={save}
              disabled={saving}
              className="text-xs font-semibold bg-primary hover:bg-primary/90 disabled:opacity-50 text-white px-4 py-1.5 rounded-md transition-colors"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={cancel} className="text-xs text-ink-subtle hover:text-ink-muted px-2">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── access log section ────────────────────────────────────────────────────────

interface AccessLogSectionProps {
  project: Project
  members: TeamMember[]
  onUpdated: (p: Project) => void
}

function AccessLogSection({ project, members, onUpdated }: AccessLogSectionProps) {
  const [memberId, setMemberId] = useState('')
  const [action, setAction] = useState<'grant' | 'revoke'>('grant')
  const [actionedById, setActionedById] = useState('')
  const [notes, setNotes] = useState('')
  const [date, setDate] = useState(today())
  const [saving, setSaving] = useState(false)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!memberId) return
    setSaving(true)
    try {
      await api.addAccessLog(project.id, {
        member_id: memberId,
        action,
        actioned_by_id: actionedById || null,
        notes: notes.trim() || null,
        actioned_at: date,
      })
      // refresh full project
      const projects = await api.getProjects()
      const updated = projects.find(p => p.id === project.id)
      if (updated) onUpdated(updated)
      setMemberId('')
      setNotes('')
      setDate(today())
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(log: UserAccessLog) {
    await api.deleteAccessLog(project.id, log.id)
    const projects = await api.getProjects()
    const updated = projects.find(p => p.id === project.id)
    if (updated) onUpdated(updated)
  }

  return (
    <div className="space-y-3">
      {/* log table */}
      {project.accessLogs.length === 0 ? (
        <p className="text-xs text-ink-subtle italic px-1">No access changes recorded</p>
      ) : (
        <div className="space-y-1.5">
          {project.accessLogs.map(log => (
            <div key={log.id} className="flex items-start justify-between bg-surface-1 border border-hairline rounded-lg px-3 py-2.5 group">
              <div className="flex items-center gap-3">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wide ${
                  log.action === 'grant'
                    ? 'bg-teal-900/20 border-teal-900/40 text-teal-400'
                    : 'bg-red-900/20 border-red-900/40 text-red-400'
                }`}>
                  {log.action}
                </span>
                <div>
                  <p className="text-sm font-medium text-ink">{log.memberName}</p>
                  {log.actionedByName && (
                    <p className="text-xs text-ink-subtle">by {log.actionedByName} · {log.actionedAt}</p>
                  )}
                  {log.notes && <p className="text-xs text-ink-muted mt-0.5">{log.notes}</p>}
                </div>
              </div>
              <button
                onClick={() => handleDelete(log)}
                className="text-ink-subtle hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0 ml-2"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* add form */}
      <form onSubmit={handleAdd} className="border border-hairline rounded-lg p-3 space-y-2 bg-surface-2">
        <p className="text-xs font-semibold text-ink-muted">Record access change</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-ink-subtle block mb-0.5">Member</label>
            <select
              required
              value={memberId}
              onChange={e => setMemberId(e.target.value)}
              className="w-full border border-hairline rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-surface-1 text-ink"
            >
              <option value="">Select member</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-ink-subtle block mb-0.5">Action</label>
            <div className="flex gap-1.5 mt-0.5">
              {(['grant', 'revoke'] as const).map(a => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAction(a)}
                  className={`flex-1 text-xs font-semibold py-1.5 rounded-md border transition-all capitalize ${
                    action === a
                      ? a === 'grant'
                        ? 'bg-primary text-white border-primary'
                        : 'bg-red-500 text-white border-red-500'
                      : 'bg-surface-1 text-ink-subtle border-hairline'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-ink-subtle block mb-0.5">Actioned by</label>
            <select
              value={actionedById}
              onChange={e => setActionedById(e.target.value)}
              className="w-full border border-hairline rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-surface-1 text-ink"
            >
              <option value="">—</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-ink-subtle block mb-0.5">Date</label>
            <input
              type="date"
              required
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full border border-hairline rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-surface-1 text-ink"
            />
          </div>
        </div>
        <input
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          className="w-full border border-hairline rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-surface-1 text-ink"
        />
        <button
          type="submit"
          disabled={saving}
          className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-white text-xs font-semibold py-1.5 rounded-md transition-colors flex items-center justify-center gap-1"
        >
          <Plus size={12} />
          {saving ? 'Saving…' : 'Record Change'}
        </button>
      </form>
    </div>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function ProjectLifecycle() {
  const [projects, setProjects] = useState<Project[]>([])
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Project | null>(null)
  const [activePhase, setActivePhase] = useState<Phase>('initiation')

  // new project form
  const [showNewForm, setShowNewForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newOwner, setNewOwner] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    Promise.all([
      api.getProjects(),
      fetch('/api/v1/members').then(r => r.json()) as Promise<TeamMember[]>,
    ])
      .then(([p, m]) => { setProjects(p); setMembers(m) })
      .finally(() => setLoading(false))
  }, [])

  function updateProject(updated: Project) {
    setProjects(prev => prev.map(p => p.id === updated.id ? updated : p))
    setSelected(updated)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    try {
      const created = await api.createProject({
        name: newName.trim(),
        description: newDesc.trim() || null,
        owner_id: newOwner || null,
      })
      setProjects(prev => [created, ...prev])
      setSelected(created)
      setShowNewForm(false)
      setNewName(''); setNewDesc(''); setNewOwner('')
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(projectId: string) {
    if (!confirm('Delete this project and all its data?')) return
    await api.deleteProject(projectId)
    setProjects(prev => prev.filter(p => p.id !== projectId))
    if (selected?.id === projectId) setSelected(null)
  }

  async function handleStatusChange(status: string) {
    if (!selected) return
    const updated = await api.updateProject(selected.id, { status })
    updateProject(updated)
  }

  const phaseItems = (phase: Phase) =>
    selected?.items.filter(i => i.phase === phase) ?? []

  const doneOf = (items: ProjectItem[]) => items.filter(i => i.status === 'done').length

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-ink-subtle text-sm">Loading…</div>
  }

  return (
    <div className="flex h-full gap-0 min-h-0">
      {/* ── project list ── */}
      <div className={`w-full md:w-72 md:flex-shrink-0 flex-col border-r border-hairline overflow-hidden ${selected || showNewForm ? 'hidden md:flex' : 'flex'}`}>
        <div className="flex items-center justify-between px-4 pt-5 pb-3 flex-shrink-0">
          <h1 className="text-base font-bold text-ink">Projects</h1>
          <button
            onClick={() => { setShowNewForm(true); setSelected(null) }}
            className="flex items-center gap-1 bg-primary hover:bg-primary/90 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors"
          >
            <Plus size={13} />
            New
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-2">
          {projects.length === 0 && !showNewForm && (
            <p className="text-xs text-ink-subtle italic text-center mt-8">No projects yet</p>
          )}
          {projects.map(p => (
            <button
              key={p.id}
              onClick={() => { setSelected(p); setShowNewForm(false) }}
              className={`w-full text-left rounded-xl border px-3 py-3 transition-all group ${
                selected?.id === p.id
                  ? 'border-primary bg-primary/10'
                  : 'border-hairline bg-surface-1 hover:border-hairline'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-sm font-semibold text-ink leading-tight">{p.name}</p>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border flex-shrink-0 capitalize ${PROJECT_STATUS_BADGE[p.status]}`}>
                  {p.status}
                </span>
              </div>
              {p.ownerName && (
                <p className="text-xs text-ink-subtle mb-2">{p.ownerName}</p>
              )}
              <ProgressBar pct={p.progress} />
              <p className="text-[10px] text-ink-subtle mt-1">
                {doneOf(p.items)}/{p.items.length} items · {p.progress}%
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* ── main panel ── */}
      <div className={`flex-1 flex-col min-w-0 overflow-hidden ${!selected && !showNewForm ? 'hidden md:flex' : 'flex'}`}>
        {/* Mobile back button */}
        <button
          className="md:hidden flex items-center gap-1 px-4 py-3 border-b border-hairline text-sm text-primary font-medium flex-shrink-0"
          onClick={() => { setSelected(null); setShowNewForm(false) }}
        >
          <ChevronLeft size={16} />
          Projects
        </button>
        {showNewForm ? (
          /* new project form */
          <div className="flex-1 flex items-start justify-center pt-8 px-4 md:pt-16 md:px-8">
            <div className="w-full max-w-md">
              <h2 className="text-lg font-bold text-ink mb-5">New Project</h2>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">Project Name</label>
                  <input
                    required
                    autoFocus
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="e.g. Data Migration Q3"
                    className="w-full border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-surface-2 text-ink"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">Description <span className="font-normal text-ink-subtle">(optional)</span></label>
                  <textarea
                    rows={3}
                    value={newDesc}
                    onChange={e => setNewDesc(e.target.value)}
                    placeholder="What is this project about?"
                    className="w-full border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none bg-surface-2 text-ink"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">Project Lead <span className="font-normal text-ink-subtle">(optional)</span></label>
                  <select
                    value={newOwner}
                    onChange={e => setNewOwner(e.target.value)}
                    className="w-full border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-surface-2 text-ink"
                  >
                    <option value="">Unassigned</option>
                    {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={creating}
                    className="bg-primary hover:bg-primary/90 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
                  >
                    {creating ? 'Creating…' : 'Create Project'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNewForm(false)}
                    className="text-sm text-ink-subtle hover:text-ink-muted px-3"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : selected ? (
          /* project detail */
          <>
            {/* detail header */}
            <div className="flex items-start justify-between px-4 pt-4 pb-3 md:px-6 md:pt-5 md:pb-4 border-b border-hairline flex-shrink-0">
              <div className="flex-1 min-w-0 pr-4">
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-lg font-bold text-ink truncate">{selected.name}</h2>
                  <select
                    value={selected.status}
                    onChange={e => handleStatusChange(e.target.value)}
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded border focus:outline-none capitalize cursor-pointer ${PROJECT_STATUS_BADGE[selected.status]}`}
                  >
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="complete">Complete</option>
                  </select>
                </div>
                {selected.description && (
                  <p className="text-sm text-ink-muted mb-2">{selected.description}</p>
                )}
                <div className="flex items-center gap-4">
                  {selected.ownerName && (
                    <span className="text-xs text-ink-subtle">Lead: <span className="text-ink-muted font-medium">{selected.ownerName}</span></span>
                  )}
                  <span className="text-xs text-ink-subtle">{selected.progress}% complete · {doneOf(selected.items)}/{selected.items.length} items</span>
                </div>
                <div className="mt-2 max-w-sm">
                  <ProgressBar pct={selected.progress} />
                </div>
              </div>
              <button
                onClick={() => handleDelete(selected.id)}
                className="text-ink-subtle hover:text-red-400 transition-colors flex-shrink-0"
              >
                <Trash2 size={15} />
              </button>
            </div>

            {/* phase tabs */}
            <div className="flex border-b border-hairline px-2 flex-shrink-0 overflow-x-auto">
              {PHASES.map(phase => {
                const items = phaseItems(phase)
                const done = phase === 'dynamics' ? selected.accessLogs.length : doneOf(items)
                const total = phase === 'dynamics' ? null : items.length
                return (
                  <button
                    key={phase}
                    onClick={() => setActivePhase(phase)}
                    className={`flex items-center gap-2 text-xs font-semibold px-3 py-3 border-b-2 transition-all whitespace-nowrap flex-shrink-0 ${
                      activePhase === phase
                        ? 'border-primary text-primary'
                        : 'border-transparent text-ink-subtle hover:text-ink-muted'
                    }`}
                  >
                    {PHASE_LABELS[phase]}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                      activePhase === phase ? 'bg-primary/20 text-primary' : 'bg-surface-3 text-ink-subtle'
                    }`}>
                      {phase === 'dynamics' ? done : `${done}/${total}`}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* phase content */}
            <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6">
              {activePhase === 'dynamics' ? (
                <AccessLogSection
                  project={selected}
                  members={members}
                  onUpdated={updateProject}
                />
              ) : (
                <div className="space-y-2">
                  {phaseItems(activePhase).map(item => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      members={members}
                      projectId={selected.id}
                      onUpdated={updateProject}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-ink-subtle text-sm">
            Select a project or create a new one
          </div>
        )}
      </div>

    </div>
  )
}
