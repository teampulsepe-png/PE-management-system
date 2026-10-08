import { useState, useEffect, useCallback, useRef } from 'react'
import { User, Users, Building2, ShieldCheck, Plus, Pencil, Trash2, X, ChevronDown, Check, AlertTriangle, ArrowLeft, UserPlus, Sun, Moon, Monitor, Palette, Crown, CheckSquare, Scale, GaugeCircle, LineSquiggle, Sparkles, Cog, LayoutList, DollarSign, Zap, Ticket as TicketIcon, BotMessageSquare, Clock, XCircle, CheckCircle } from 'lucide-react'
import type { TeamPermissions, MemberRequest } from '../types'
import { useAppContext } from '../context/AppContext'
import type { Theme } from '../context/AppContext'
import { api } from '../api/teamPulseApi'
import type { MemberDetail, TeamWithMembers, Role, TeamMember } from '../types'

// ── Role badge ────────────────────────────────────────────────────────────────

const ROLE_STYLES: Record<string, string> = {
  admin: 'bg-red-900/30 text-red-400 border border-red-900/50',
  head:  'bg-purple-900/30 text-purple-400 border border-purple-900/50',
  lead:  'bg-primary/10 text-primary-hover border border-primary/30',
  user:  'bg-surface-3 text-ink-subtle border border-hairline',
}

function RoleBadge({ role }: { role: string | null }) {
  if (!role) return <span className="text-[10px] text-ink-subtle">—</span>
  return (
    <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${ROLE_STYLES[role] ?? 'bg-surface-3 text-ink-subtle'}`}>
      {role}
    </span>
  )
}

// ── Permission matrix ─────────────────────────────────────────────────────────

const PERMISSION_MATRIX = [
  { feature: 'Dashboard',           user: true,  lead: true,  head: true,  admin: true  },
  { feature: 'Tasks (own team)',     user: true,  lead: true,  head: true,  admin: true  },
  { feature: 'Tasks (all teams)',    user: false, lead: false, head: true,  admin: true  },
  { feature: 'Create/delete tasks',  user: false, lead: true,  head: true,  admin: true  },
  { feature: 'KPI (own metrics)',    user: true,  lead: true,  head: true,  admin: true  },
  { feature: 'KPI (all metrics)',    user: false, lead: false, head: true,  admin: true  },
  { feature: 'AI Subscriptions',     user: true,  lead: true,  head: true,  admin: true  },
  { feature: 'Project Lifecycle',    user: true,  lead: true,  head: true,  admin: true  },
  { feature: 'Tracker Board',        user: true,  lead: true,  head: true,  admin: true  },
  { feature: 'Workload',             user: true,  lead: true,  head: true,  admin: true  },
  { feature: 'Manage users & teams', user: false, lead: false, head: false, admin: true  },
  { feature: 'Grant admin access',   user: false, lead: false, head: false, admin: true  },
]

// ── Confirm dialog ────────────────────────────────────────────────────────────

function ConfirmDialog({ title, message, onConfirm, onCancel }: {
  title: string; message: string; onConfirm: () => void; onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-surface-1 rounded-xl border border-hairline shadow-xl w-full max-w-sm mx-4 p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-red-900/20 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={16} className="text-red-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">{title}</p>
            <p className="text-xs text-ink-muted mt-1">{message}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 justify-end">
          <button onClick={onCancel} className="px-3 py-1.5 text-xs font-medium text-ink-muted bg-surface-2 hover:bg-surface-3 rounded-lg transition-colors">Cancel</button>
          <button onClick={onConfirm} className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors">Confirm</button>
        </div>
      </div>
    </div>
  )
}

// ── Member slide-out panel (admin only) ───────────────────────────────────────

interface MemberFormState {
  name: string; email: string; roleName: string; teamId: string; headTeamIds: string[]
}

function MemberPanel({ member, teams, onSave, onClose }: {
  member: MemberDetail | null; teams: TeamWithMembers[]
  onSave: (data: MemberFormState) => Promise<void>; onClose: () => void
}) {
  const isNew = !member
  const [form, setForm] = useState<MemberFormState>({
    name: member?.name ?? '', email: member?.email ?? '',
    roleName: member?.roleName ?? 'user',
    teamId: member?.teamId ?? '', headTeamIds: member?.headTeamIds ?? [],
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError(null)
    try { await onSave(form) } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save'); setSaving(false)
    }
  }

  const toggleHeadTeam = (teamId: string) => setForm(p => ({
    ...p,
    headTeamIds: p.headTeamIds.includes(teamId) ? p.headTeamIds.filter(id => id !== teamId) : [...p.headTeamIds, teamId],
  }))

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface-1 border-l border-hairline w-full max-w-sm shadow-2xl flex flex-col h-full">
        <div className="flex items-center justify-between px-5 py-4 border-b border-hairline">
          <div>
            <p className="text-sm font-semibold text-ink">{isNew ? 'Add Member' : 'Edit Member'}</p>
            <p className="text-[10px] text-ink-subtle mt-0.5">{isNew ? 'Create a new team member' : 'Update member details'}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-2 text-ink-subtle"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {error && <div className="bg-red-900/20 border border-red-900/40 rounded-lg px-3 py-2 text-xs text-red-400">{error}</div>}
          <div>
            <label className="block text-[10px] font-semibold text-ink-subtle uppercase tracking-widest mb-1.5">Full Name *</label>
            <input type="text" required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Jane Smith"
              className="w-full text-xs px-3 py-2 rounded-lg border border-hairline bg-surface-2 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 placeholder-subtle text-ink" />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-ink-subtle uppercase tracking-widest mb-1.5">Email</label>
            <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              placeholder="jane@company.com"
              className="w-full text-xs px-3 py-2 rounded-lg border border-hairline bg-surface-2 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 placeholder-subtle text-ink" />
            <p className="text-[10px] text-ink-subtle mt-1">Used to match the login identity</p>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-ink-subtle uppercase tracking-widest mb-1.5">Role *</label>
            <div className="relative">
              <select value={form.roleName}
                onChange={e => setForm(p => ({ ...p, roleName: e.target.value, teamId: e.target.value === 'admin' ? '' : p.teamId, headTeamIds: e.target.value !== 'head' ? [] : p.headTeamIds }))}
                className="w-full appearance-none text-xs px-3 py-2 pr-7 rounded-lg border border-hairline bg-surface-2 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 text-ink">
                <option value="user">User — Team member</option>
                <option value="lead">Lead — Team lead</option>
                <option value="head">Head — Multi-team oversight</option>
                <option value="admin">Admin — Full system access</option>
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-subtle pointer-events-none" />
            </div>
            <p className={`mt-1.5 text-[10px] px-2 py-1 rounded-md ${ROLE_STYLES[form.roleName] ?? ''}`}>
              {form.roleName === 'admin' && 'Full access to everything. Not assigned to any team.'}
              {form.roleName === 'head' && 'Cross-team visibility. Assign teams below.'}
              {form.roleName === 'lead' && 'Manages tasks and members for their team.'}
              {form.roleName === 'user' && 'Standard team member, personal task scope.'}
            </p>
          </div>
          {form.roleName !== 'admin' && (
            <div>
              <label className="block text-[10px] font-semibold text-ink-subtle uppercase tracking-widest mb-1.5">Primary Team *</label>
              <div className="relative">
                <select value={form.teamId} onChange={e => setForm(p => ({ ...p, teamId: e.target.value }))}
                  required={form.roleName !== 'admin'}
                  className="w-full appearance-none text-xs px-3 py-2 pr-7 rounded-lg border border-hairline bg-surface-2 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 text-ink">
                  <option value="">Select a team…</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-subtle pointer-events-none" />
              </div>
            </div>
          )}
          {form.roleName === 'head' && (
            <div>
              <label className="block text-[10px] font-semibold text-ink-subtle uppercase tracking-widest mb-1.5">Oversight Teams</label>
              <div className="space-y-1">
                {teams.map(t => (
                  <label key={t.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-hairline cursor-pointer hover:bg-surface-2 transition-colors">
                    <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors ${form.headTeamIds.includes(t.id) ? 'bg-primary' : 'border border-hairline'}`}
                      onClick={() => toggleHeadTeam(t.id)}>
                      {form.headTeamIds.includes(t.id) && <Check size={10} className="text-white" />}
                    </div>
                    <span className="text-xs text-ink">{t.name}</span>
                    <span className="ml-auto text-[10px] text-ink-subtle">{t.memberCount} members</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </form>
        <div className="px-5 py-4 border-t border-hairline flex items-center gap-2">
          <button type="button" onClick={onClose} className="flex-1 px-3 py-2 text-xs font-medium text-ink-muted bg-surface-2 hover:bg-surface-3 rounded-lg transition-colors">Cancel</button>
          <button onClick={handleSubmit as unknown as React.MouseEventHandler} disabled={saving}
            className="flex-1 px-3 py-2 text-xs font-semibold text-white bg-primary hover:bg-primary/90 disabled:opacity-50 rounded-lg transition-colors">
            {saving ? 'Saving…' : isNew ? 'Add Member' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Create team modal ─────────────────────────────────────────────────────────

function CreateTeamModal({ onSave, onClose }: { onSave: (name: string) => Promise<void>; onClose: () => void }) {
  const [name, setName] = useState(''); const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!name.trim()) return; setSaving(true); setError(null)
    try { await onSave(name.trim()) } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed'); setSaving(false) }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-surface-1 rounded-xl border border-hairline shadow-xl w-full max-w-sm mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-hairline">
          <p className="text-sm font-semibold text-ink">Create Team</p>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-2 text-ink-subtle"><X size={15} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <div className="bg-red-900/20 border border-red-900/40 rounded-lg px-3 py-2 text-xs text-red-400">{error}</div>}
          <div>
            <label className="block text-[10px] font-semibold text-ink-subtle uppercase tracking-widest mb-1.5">Team Name *</label>
            <input type="text" autoFocus required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Platform Engineering"
              className="w-full text-xs px-3 py-2 rounded-lg border border-hairline bg-surface-2 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 placeholder-subtle text-ink" />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-3 py-2 text-xs font-medium text-ink-muted bg-surface-2 hover:bg-surface-3 rounded-lg">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-3 py-2 text-xs font-semibold text-white bg-primary hover:bg-primary/90 disabled:opacity-50 rounded-lg">
              {saving ? 'Creating…' : 'Create Team'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Profile tab (all roles) ───────────────────────────────────────────────────

function ProfileTab() {
  const { currentUser } = useAppContext()
  if (!currentUser) return null

  const initials = currentUser.name
    ? currentUser.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : currentUser.email[0].toUpperCase()

  return (
    <div className="max-w-lg">
      <div className="bg-surface-1 rounded-xl border border-hairline p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center text-white text-lg font-bold shadow-sm">
            {initials}
          </div>
          <div>
            <p className="text-base font-semibold text-ink">{currentUser.name ?? currentUser.email.split('@')[0]}</p>
            <p className="text-xs text-ink-muted mt-0.5">{currentUser.email}</p>
            <div className="mt-1.5">
              <RoleBadge role={currentUser.role} />
            </div>
          </div>
        </div>

        <div className="space-y-3 border-t border-hairline pt-4">
          <div className="flex items-center justify-between py-2">
            <span className="text-[10px] font-semibold text-ink-subtle uppercase tracking-widest">Member ID</span>
            <span className="text-xs text-ink-muted font-mono">{currentUser.memberId ?? '—'}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-t border-hairline">
            <span className="text-[10px] font-semibold text-ink-subtle uppercase tracking-widest">Primary Team</span>
            <span className="text-xs text-ink font-medium">
              {currentUser.teamId ? currentUser.teamId.toUpperCase() : (currentUser.role === 'admin' ? 'System Admin' : '—')}
            </span>
          </div>
          {currentUser.role === 'head' && currentUser.headTeamNames.length > 0 && (
            <div className="flex items-start justify-between py-2 border-t border-hairline">
              <span className="text-[10px] font-semibold text-ink-subtle uppercase tracking-widest mt-0.5">Oversight Teams</span>
              <div className="flex flex-wrap gap-1 justify-end max-w-[60%]">
                {currentUser.headTeamNames.map(name => (
                  <span key={name} className="text-[10px] bg-purple-900/20 text-purple-400 border border-purple-900/40 px-2 py-0.5 rounded-full font-semibold">{name}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        <p className="mt-4 pt-4 border-t border-hairline text-[10px] text-ink-subtle">
          To update your profile details, contact your system administrator.
        </p>
      </div>
    </div>
  )
}

// ── My Team tab (lead) ────────────────────────────────────────────────────────

function MyTeamTab() {
  const { currentUser } = useAppContext()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentUser?.teamId) { setLoading(false); return }
    api.getTeamMembers(currentUser.teamId)
      .then(setMembers)
      .finally(() => setLoading(false))
  }, [currentUser?.teamId])

  if (!currentUser?.teamId) return (
    <div className="text-xs text-ink-subtle py-8 text-center">No team assigned.</div>
  )

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <Building2 size={16} className="text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold text-ink">{currentUser.teamId.toUpperCase()} Team</p>
          <p className="text-[10px] text-ink-subtle">{members.length} member{members.length !== 1 ? 's' : ''}</p>
        </div>
      </div>
      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="skeleton h-12 rounded-lg" />)}</div>
      ) : (
        <div className="bg-surface-1 rounded-xl border border-hairline divide-y divide-hairline">
          {members.map(m => (
            <div key={m.id} className="flex items-center gap-3 px-4 py-3">
              <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center text-white text-[10px] font-semibold flex-shrink-0">
                {m.name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-ink truncate">{m.name}</p>
                <p className="text-[10px] text-ink-subtle truncate">{m.email ?? '—'}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── My Teams tab (head) ───────────────────────────────────────────────────────

function MyTeamsTab() {
  const { currentUser } = useAppContext()
  const [teamMembers, setTeamMembers] = useState<Record<string, TeamMember[]>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentUser?.headTeamIds?.length) { setLoading(false); return }
    Promise.all(
      currentUser.headTeamIds.map(tid => api.getTeamMembers(tid).then(ms => ({ tid, ms })))
    ).then(results => {
      const map: Record<string, TeamMember[]> = {}
      results.forEach(({ tid, ms }) => { map[tid] = ms })
      setTeamMembers(map)
    }).finally(() => setLoading(false))
  }, [currentUser?.headTeamIds])

  if (!currentUser?.headTeamIds?.length) return (
    <div className="text-xs text-ink-subtle py-8 text-center">No teams assigned. Ask an admin to assign teams to your account.</div>
  )

  if (loading) return <div className="space-y-3">{[1,2].map(i => <div key={i} className="skeleton h-40 rounded-xl" />)}</div>

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {currentUser.headTeamIds.map((tid, idx) => {
        const name = currentUser.headTeamNames[idx] ?? tid.toUpperCase()
        const members = teamMembers[tid] ?? []
        return (
          <div key={tid} className="bg-surface-1 rounded-xl border border-hairline p-5 hover:border-primary/40 hover:shadow-sm transition-all">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-purple-900/20 flex items-center justify-center">
                <Building2 size={15} className="text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">{name}</p>
                <p className="text-[10px] text-ink-subtle">{members.length} member{members.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <div className="space-y-1.5">
              {members.length === 0 ? (
                <p className="text-[10px] text-ink-subtle italic">No members yet</p>
              ) : members.map(m => (
                <div key={m.id} className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded bg-surface-3 flex items-center justify-center text-ink-muted text-[9px] font-semibold flex-shrink-0">
                    {m.name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
                  </div>
                  <span className="text-xs text-ink flex-1 truncate">{m.name}</span>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── User detail panel ─────────────────────────────────────────────────────────

function UserDetailPanel({ member, currentUserId, onClose, onRefresh }: {
  member: MemberDetail
  currentUserId: string | null
  onClose: () => void
  onRefresh: (updated: MemberDetail) => void
}) {
  const [adminAccess, setAdminAccess] = useState(member.hasAdminAccess)
  const [toggling, setToggling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isAdminRole = member.roleName === 'admin'
  const isSelf = member.id === currentUserId

  const handleToggle = async () => {
    if (isAdminRole || isSelf) return
    setToggling(true); setError(null)
    try {
      const updated = await api.settings.updateMember(member.id, { has_admin_access: !adminAccess })
      setAdminAccess(!adminAccess)
      onRefresh(updated)
    } catch {
      setError('Failed to update. Please try again.')
    } finally {
      setToggling(false)
    }
  }

  const initials = member.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface-1 border-l border-hairline w-full max-w-sm shadow-2xl flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-hairline">
          <p className="text-sm font-semibold text-ink">Member Profile</p>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-2 text-ink-subtle"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Identity */}
          <div className="px-5 py-6 border-b border-hairline">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center text-white text-lg font-bold shadow-sm flex-shrink-0">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-base font-semibold text-ink truncate">{member.name}</p>
                <p className="text-xs text-ink-muted truncate">{member.email ?? '—'}</p>
                <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                  <RoleBadge role={member.roleName} />
                  {(adminAccess && !isAdminRole) && (
                    <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                      +admin access
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1.5 border-t border-hairline">
                <span className="text-[10px] font-semibold text-ink-subtle uppercase tracking-widest">Team</span>
                <span className="text-ink font-medium">{member.teamName ?? (isAdminRole ? 'System Admin' : '—')}</span>
              </div>
              {member.headTeamNames.length > 0 && (
                <div className="flex items-start justify-between py-1.5 border-t border-hairline">
                  <span className="text-[10px] font-semibold text-ink-subtle uppercase tracking-widest mt-0.5">Oversight</span>
                  <div className="flex flex-wrap gap-1 justify-end max-w-[60%]">
                    {member.headTeamNames.map(n => (
                      <span key={n} className="text-[10px] bg-purple-900/20 text-purple-400 border border-purple-900/40 px-2 py-0.5 rounded-full font-semibold">{n}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Admin Access toggle */}
          <div className="px-5 py-5">
            <p className="text-[10px] font-semibold text-ink-subtle uppercase tracking-widest mb-3">Access Control</p>
            <div className={`rounded-xl border p-4 transition-colors ${
              adminAccess && !isAdminRole
                ? 'border-red-900/40 bg-red-900/10'
                : 'border-hairline bg-surface-1'
            }`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  <p className="text-xs font-semibold text-ink">Admin Access</p>
                  <p className="text-[10px] text-ink-muted mt-0.5 leading-relaxed">
                    {isAdminRole
                      ? 'This member has the admin role — full access is always enabled.'
                      : adminAccess
                        ? 'Full admin access granted. Role and team are unchanged.'
                        : 'Grant full system access without changing their role or team.'}
                  </p>
                </div>
                {isAdminRole ? (
                  <div className="w-11 h-6 rounded-full bg-red-400 opacity-60 flex-shrink-0 cursor-not-allowed">
                    <span className="block h-4 w-4 m-1 ml-6 rounded-full bg-white shadow" />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleToggle}
                    disabled={toggling || isSelf}
                    title={isSelf ? "You cannot change your own admin access" : undefined}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
                      adminAccess ? 'bg-red-500' : 'bg-surface-3'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${adminAccess ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                )}
              </div>
              {isSelf && (
                <p className="text-[10px] text-amber-400 mt-2">You cannot modify your own admin access.</p>
              )}
              {error && <p className="text-[10px] text-red-400 mt-2">{error}</p>}
            </div>

            {!isAdminRole && (
              <p className="text-[10px] text-ink-subtle mt-3 leading-relaxed">
                Admin access is independent of role. A lead or user with this toggle on can manage users, teams, and settings just like an admin — but their role badge and team assignment remain unchanged.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Users tab (admin) ─────────────────────────────────────────────────────────

function UsersTab({ teams, onRefresh }: { teams: TeamWithMembers[]; onRefresh: () => void }) {
  const { currentUser } = useAppContext()
  const [members, setMembers] = useState<MemberDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [editTarget, setEditTarget] = useState<MemberDetail | 'new' | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<MemberDetail | null>(null)
  const [detailMember, setDetailMember] = useState<MemberDetail | null>(null)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try { const data = await api.settings.getMembers(); setMembers(data) } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = members.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    (m.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (m.roleName ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const handleSave = async (form: MemberFormState) => {
    const isNew = editTarget === 'new'
    const payload = {
      name: form.name, email: form.email || null, role_name: form.roleName,
      team_id: form.roleName === 'admin' ? null : (form.teamId || null),
      head_team_ids: form.roleName === 'head' ? form.headTeamIds : undefined,
    }
    if (isNew) await api.settings.createMember(payload)
    else await api.settings.updateMember((editTarget as MemberDetail).id, payload)
    setEditTarget(null); load(); onRefresh()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await api.settings.deleteMember(deleteTarget.id)
    setDeleteTarget(null)
    if (detailMember?.id === deleteTarget.id) setDetailMember(null)
    load(); onRefresh()
  }

  const handleDetailRefresh = (updated: MemberDetail) => {
    setMembers(prev => prev.map(m => m.id === updated.id ? updated : m))
    if (detailMember?.id === updated.id) setDetailMember(updated)
    onRefresh()
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search members…"
          className="flex-1 text-xs px-3 py-2 rounded-lg border border-hairline bg-surface-1 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 placeholder-subtle text-ink" />
        <button onClick={() => setEditTarget('new')} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors">
          <Plus size={13} /> Add Member
        </button>
      </div>
      {loading ? (
        <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="skeleton h-12 rounded-lg" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-ink-subtle text-xs">No members found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-hairline">
                <th className="text-left pb-2.5 text-[10px] font-semibold text-ink-subtle uppercase tracking-widest pr-4">Member</th>
                <th className="text-left pb-2.5 text-[10px] font-semibold text-ink-subtle uppercase tracking-widest pr-4">Role</th>
                <th className="text-left pb-2.5 text-[10px] font-semibold text-ink-subtle uppercase tracking-widest pr-4">Team</th>
                <th className="text-left pb-2.5 text-[10px] font-semibold text-ink-subtle uppercase tracking-widest">Oversight</th>
                <th className="pb-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {filtered.map(m => (
                <tr
                  key={m.id}
                  onClick={() => setDetailMember(m)}
                  className={`group cursor-pointer hover:bg-surface-2 transition-colors ${detailMember?.id === m.id ? 'bg-primary/5' : ''}`}
                >
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center text-white text-[10px] font-semibold flex-shrink-0">
                        {m.name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-ink">{m.name}</p>
                        <p className="text-[10px] text-ink-subtle">{m.email ?? '—'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <RoleBadge role={m.roleName} />
                      {m.hasAdminAccess && m.roleName !== 'admin' && (
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 border border-red-200">+admin</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-ink-muted">{m.teamName ?? <span className="text-ink-subtle">—</span>}</td>
                  <td className="py-3 text-ink-muted">
                    {m.headTeamNames.length > 0 ? m.headTeamNames.join(', ') : <span className="text-ink-subtle">—</span>}
                  </td>
                  <td className="py-3" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                      <button onClick={() => setEditTarget(m)} className="p-1.5 rounded-md hover:bg-primary/10 text-ink-subtle hover:text-primary transition-colors" title="Edit"><Pencil size={13} /></button>
                      <button onClick={() => setDeleteTarget(m)} className="p-1.5 rounded-md hover:bg-red-900/20 text-ink-subtle hover:text-red-400 transition-colors" title="Delete"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editTarget !== null && <MemberPanel member={editTarget === 'new' ? null : editTarget} teams={teams} onSave={handleSave} onClose={() => setEditTarget(null)} />}
      {deleteTarget && <ConfirmDialog title={`Delete ${deleteTarget.name}?`} message="This will permanently remove this member and all their data." onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />}
      {detailMember && <UserDetailPanel member={detailMember} currentUserId={currentUser?.memberId ?? null} onClose={() => setDetailMember(null)} onRefresh={handleDetailRefresh} />}
    </div>
  )
}

// ── Add-to-team panel (slide-out with existing/new tabs) ─────────────────────

function AddToTeamPanel({ team, teams, onDone, onClose }: {
  team: TeamWithMembers; teams: TeamWithMembers[]
  onDone: () => void; onClose: () => void
}) {
  const [tab, setTab] = useState<'existing' | 'new'>('existing')
  const [allMembers, setAllMembers] = useState<MemberDetail[]>([])
  const [loadingMembers, setLoadingMembers] = useState(true)
  const [search, setSearch] = useState('')
  const [assigningId, setAssigningId] = useState<string | null>(null)

  useEffect(() => {
    api.settings.getMembers().then(setAllMembers).finally(() => setLoadingMembers(false))
  }, [])

  const candidates = allMembers.filter(m =>
    m.teamId !== team.id && m.roleName !== 'admin'
  )
  const filtered = candidates.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    (m.email ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const assignMember = async (memberId: string) => {
    setAssigningId(memberId)
    try { await api.settings.updateMember(memberId, { team_id: team.id }); onDone() }
    finally { setAssigningId(null) }
  }

  const handleCreateNew = async (form: MemberFormState) => {
    await api.settings.createMember({
      name: form.name,
      email: form.email || null,
      role_name: form.roleName,
      team_id: form.roleName === 'admin' ? null : team.id,
      head_team_ids: form.roleName === 'head' ? form.headTeamIds : undefined,
    })
    onDone(); onClose()
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface-1 border-l border-hairline w-full max-w-sm shadow-2xl flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-hairline">
          <div>
            <p className="text-sm font-semibold text-ink">Add to {team.name}</p>
            <p className="text-[10px] text-ink-subtle mt-0.5">Assign existing or create a new member</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-2 text-ink-subtle"><X size={16} /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-hairline px-5">
          {(['existing', 'new'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`py-2.5 px-1 mr-5 text-xs font-medium border-b-2 transition-colors ${tab === t ? 'border-primary text-primary' : 'border-transparent text-ink-subtle hover:text-ink-muted'}`}>
              {t === 'existing' ? 'Existing Member' : 'Create New'}
            </button>
          ))}
        </div>

        {tab === 'existing' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-5 py-3 border-b border-hairline">
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email…"
                className="w-full text-xs px-3 py-2 rounded-lg border border-hairline bg-surface-2 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 placeholder-subtle text-ink" />
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-hairline">
              {loadingMembers ? (
                <div className="p-5 space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 bg-surface-3 rounded-lg animate-pulse" />)}</div>
              ) : filtered.length === 0 ? (
                <p className="text-xs text-ink-subtle text-center py-10">
                  {candidates.length === 0 ? 'All members are already in this team.' : 'No members match your search.'}
                </p>
              ) : filtered.map(m => (
                <div key={m.id} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2 transition-colors">
                  <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center text-white text-[10px] font-semibold flex-shrink-0">
                    {m.name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-ink truncate">{m.name}</p>
                    <p className="text-[10px] text-ink-subtle truncate">
                      {m.teamName ? `Currently in ${m.teamName}` : 'Unassigned'} · <RoleBadge role={m.roleName} />
                    </p>
                  </div>
                  <button onClick={() => assignMember(m.id)} disabled={assigningId === m.id}
                    className="text-[10px] font-semibold px-2.5 py-1.5 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors flex-shrink-0">
                    {assigningId === m.id ? '…' : 'Add'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'new' && (
          <NewMemberForm teams={teams} defaultTeamId={team.id} onSave={handleCreateNew} onClose={onClose} />
        )}
      </div>
    </div>
  )
}

function NewMemberForm({ teams, defaultTeamId, onSave, onClose }: {
  teams: TeamWithMembers[]; defaultTeamId: string
  onSave: (form: MemberFormState) => Promise<void>; onClose: () => void
}) {
  const [form, setForm] = useState<MemberFormState>({
    name: '', email: '', roleName: 'user', teamId: defaultTeamId, headTeamIds: [],
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError(null)
    try { await onSave(form) } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save'); setSaving(false)
    }
  }

  const toggleHeadTeam = (teamId: string) => setForm(p => ({
    ...p,
    headTeamIds: p.headTeamIds.includes(teamId) ? p.headTeamIds.filter(id => id !== teamId) : [...p.headTeamIds, teamId],
  }))

  return (
    <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
        {error && <div className="bg-red-900/20 border border-red-900/40 rounded-lg px-3 py-2 text-xs text-red-400">{error}</div>}
        <div>
          <label className="block text-[10px] font-semibold text-ink-subtle uppercase tracking-widest mb-1.5">Full Name *</label>
          <input type="text" required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            placeholder="e.g. Jane Smith"
            className="w-full text-xs px-3 py-2 rounded-lg border border-hairline bg-surface-2 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 placeholder-subtle text-ink" />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-ink-subtle uppercase tracking-widest mb-1.5">Email</label>
          <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
            placeholder="jane@company.com"
            className="w-full text-xs px-3 py-2 rounded-lg border border-hairline bg-surface-2 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 placeholder-subtle text-ink" />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-ink-subtle uppercase tracking-widest mb-1.5">Role *</label>
          <div className="relative">
            <select value={form.roleName}
              onChange={e => setForm(p => ({ ...p, roleName: e.target.value, headTeamIds: e.target.value !== 'head' ? [] : p.headTeamIds }))}
              className="w-full appearance-none text-xs px-3 py-2 pr-7 rounded-lg border border-hairline bg-surface-2 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 text-ink">
              <option value="user">User</option>
              <option value="lead">Lead</option>
              <option value="head">Head</option>
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-subtle pointer-events-none" />
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-ink-subtle uppercase tracking-widest mb-1.5">Team</label>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-hairline bg-surface-3">
            <Building2 size={12} className="text-ink-subtle" />
            <span className="text-xs text-ink-muted">{teams.find(t => t.id === defaultTeamId)?.name ?? defaultTeamId}</span>
            <span className="ml-auto text-[10px] text-ink-subtle">pre-assigned</span>
          </div>
        </div>
        {form.roleName === 'head' && (
          <div>
            <label className="block text-[10px] font-semibold text-ink-subtle uppercase tracking-widest mb-1.5">Oversight Teams</label>
            <div className="space-y-1">
              {teams.map(t => (
                <label key={t.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-hairline cursor-pointer hover:bg-surface-2">
                  <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors ${form.headTeamIds.includes(t.id) ? 'bg-primary' : 'border border-hairline'}`}
                    onClick={() => toggleHeadTeam(t.id)}>
                    {form.headTeamIds.includes(t.id) && <Check size={10} className="text-white" />}
                  </div>
                  <span className="text-xs text-ink">{t.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="px-5 py-4 border-t border-hairline flex items-center gap-2">
        <button type="button" onClick={onClose} className="flex-1 px-3 py-2 text-xs font-medium text-ink-muted bg-surface-2 hover:bg-surface-3 rounded-lg">Cancel</button>
        <button type="submit" disabled={saving} className="flex-1 px-3 py-2 text-xs font-semibold text-white bg-primary hover:bg-primary/90 disabled:opacity-50 rounded-lg">
          {saving ? 'Adding…' : 'Add to Team'}
        </button>
      </div>
    </form>
  )
}

// ── Feature definitions for permission toggles ────────────────────────────────

const FEATURE_DEFS: { key: keyof Omit<TeamPermissions, 'teamId'>; label: string; description: string; icon: React.ElementType; section: string }[] = [
  { key: 'tasks',            label: 'Tasks',             description: 'Weekly/monthly task tracking',      icon: CheckSquare,    section: 'Core' },
  { key: 'kpi',              label: 'KPI Metrics',       description: 'Performance metrics & goals',       icon: Scale,          section: 'Core' },
  { key: 'workload',         label: 'Workload',          description: 'Team workload supervision',          icon: GaugeCircle,    section: 'Core' },
  { key: 'pipelines',        label: 'Pipelines',         description: 'Delivery pipeline visibility',       icon: LineSquiggle,   section: 'Core' },
  { key: 'aiSubscriptions',  label: 'AI Subscriptions',  description: 'AI tool subscription manager',      icon: Sparkles,       section: 'Tools' },
  { key: 'projectLifecycle', label: 'Project Lifecycle', description: 'Project onboarding checklists',     icon: Cog,            section: 'Tools' },
  { key: 'tracker',          label: 'Tracker Board',     description: 'Task & delivery tracking board',    icon: LayoutList,     section: 'Tools' },
  { key: 'cost',             label: 'Cost Management',   description: 'Infrastructure cost tracking',      icon: DollarSign,     section: 'Tools' },
  { key: 'liveops',          label: 'LiveOps',           description: 'Live operations ticketing system',  icon: Zap,            section: 'Tickets' },
  { key: 'devops',           label: 'DevOps',            description: 'DevOps ticket management',          icon: TicketIcon,     section: 'Tickets' },
  { key: 'agent',            label: 'Agent',             description: 'Self-service operations requests',  icon: BotMessageSquare, section: 'Self Service' },
]

// ── Wise-style toggle switch ──────────────────────────────────────────────────

function ToggleSwitch({ enabled, onChange, disabled }: { enabled: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!enabled)}
      className={`relative inline-flex h-7 w-12 rounded-full transition-colors flex-shrink-0 focus:outline-none ${
        enabled ? 'bg-primary' : 'bg-surface-3'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform mt-1 ${
        enabled ? 'translate-x-6' : 'translate-x-1'
      }`} />
    </button>
  )
}

// ── Custom role picker dropdown ───────────────────────────────────────────────

const ROLE_OPTIONS = [
  {
    value: 'user',
    label: 'Member',
    description: 'Standard access — views tasks, KPIs, and team data',
    pill: 'bg-surface-3 text-ink-subtle border border-hairline',
  },
  {
    value: 'lead',
    label: 'Team Lead',
    description: 'Manages tasks, sets priorities, and oversees the team',
    pill: 'bg-primary/10 text-primary-hover border border-primary/30',
  },
  {
    value: 'head',
    label: 'Head',
    description: 'Cross-team visibility and reporting access',
    pill: 'bg-purple-900/20 text-purple-400 border border-purple-900/40',
  },
]

function RoleDropdown({ member, existingLead, onRoleChange, onRemove, disabled }: {
  member: MemberDetail
  existingLead: MemberDetail | null
  onRoleChange: (role: string) => void
  onRemove: () => void
  disabled: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const current = ROLE_OPTIONS.find(o => o.value === (member.roleName ?? 'user')) ?? ROLE_OPTIONS[0]

  return (
    <div ref={ref} className="relative flex-shrink-0">
      {/* Trigger pill */}
      <button
        type="button"
        onClick={() => !disabled && setOpen(v => !v)}
        disabled={disabled}
        className={`flex items-center gap-1.5 pl-3 pr-2.5 py-1.5 rounded-full text-xs font-semibold transition-all ${current.pill} ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:opacity-75'}`}
      >
        {current.label}
        <ChevronDown size={11} className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Floating panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-72 bg-surface-1 rounded-2xl shadow-2xl border border-hairline-strong overflow-hidden">
          {/* Role options */}
          <div className="p-2 space-y-0.5">
            {ROLE_OPTIONS.map(opt => {
              const isCurrent = (member.roleName ?? 'user') === opt.value
              const wouldReplaceLead = opt.value === 'lead' && existingLead && existingLead.id !== member.id
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    if (!isCurrent) onRoleChange(opt.value)
                    setOpen(false)
                  }}
                  className={`w-full flex items-start gap-3 px-3 py-3 rounded-xl text-left transition-colors ${
                    isCurrent ? 'bg-primary/10' : 'hover:bg-surface-2'
                  }`}
                >
                  {/* Pill swatch */}
                  <span className={`mt-0.5 flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${opt.pill}`}>
                    {opt.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-ink-subtle leading-snug">{opt.description}</p>
                    {wouldReplaceLead && (
                      <p className="text-[10px] text-amber-400 mt-1 font-medium">
                        ↳ {existingLead!.name} will be demoted to Member
                      </p>
                    )}
                  </div>
                  {isCurrent && <Check size={13} className="text-success flex-shrink-0 mt-0.5" />}
                </button>
              )
            })}
          </div>

          {/* Separator + remove action */}
          <div className="border-t border-hairline p-2">
            <button
              type="button"
              onClick={() => { onRemove(); setOpen(false) }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-red-900/10 transition-colors text-left"
            >
              <div className="w-6 h-6 rounded-full bg-red-900/20 flex items-center justify-center flex-shrink-0">
                <X size={11} className="text-red-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-red-400">Remove from team</p>
                <p className="text-[10px] text-ink-tertiary">Member stays in the system, unassigned</p>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Team member row (Wise design) ─────────────────────────────────────────────

function TeamMemberRoleRow({ member, existingLead, onUpdate, onRemove }: {
  member: MemberDetail
  existingLead: MemberDetail | null
  onUpdate: () => void
  onRemove: (m: MemberDetail) => void
}) {
  const [saving, setSaving] = useState(false)
  const [confirmPromoteRole, setConfirmPromoteRole] = useState<string | null>(null)

  const applyRoleChange = async (newRole: string) => {
    setSaving(true)
    try {
      if (newRole === 'lead' && existingLead && existingLead.id !== member.id) {
        await api.settings.updateMember(existingLead.id, { role_name: 'user' })
      }
      await api.settings.updateMember(member.id, { role_name: newRole })
      onUpdate()
    } finally {
      setSaving(false)
      setConfirmPromoteRole(null)
    }
  }

  const handleRoleChange = (newRole: string) => {
    if (newRole === (member.roleName ?? 'user')) return
    if (newRole === 'lead' && existingLead && existingLead.id !== member.id) {
      setConfirmPromoteRole(newRole)
      return
    }
    applyRoleChange(newRole)
  }

  const isLead = member.roleName === 'lead'
  const initials = member.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <>
      <div className={`flex items-center gap-4 px-5 py-4 transition-colors ${isLead ? 'bg-primary/5' : 'hover:bg-surface-2'}`}>
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${isLead ? 'bg-primary text-white' : 'bg-surface-3 text-ink'}`}>
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold text-ink truncate">{member.name}</p>
            {isLead && <Crown size={11} className="text-success flex-shrink-0" />}
          </div>
          <p className="text-xs text-ink-tertiary truncate">{member.email ?? '—'}</p>
        </div>
        <RoleDropdown
          member={member}
          existingLead={existingLead}
          onRoleChange={handleRoleChange}
          onRemove={() => onRemove(member)}
          disabled={saving}
        />
      </div>

      {confirmPromoteRole && existingLead && (
        <ConfirmDialog
          title="Change Team Lead?"
          message={`${existingLead.name} is currently the lead. They'll be set back to Member and ${member.name} will become the new Team Lead.`}
          onConfirm={() => applyRoleChange(confirmPromoteRole)}
          onCancel={() => setConfirmPromoteRole(null)}
        />
      )}
    </>
  )
}

// ── Teams tab (admin) — drill-down navigation ─────────────────────────────────

function TeamsTab({ teams, onRefresh }: { teams: TeamWithMembers[]; onRefresh: () => void }) {
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showAddPanel, setShowAddPanel] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<TeamWithMembers | null>(null)
  const [renameTarget, setRenameTarget] = useState<TeamWithMembers | null>(null)
  const [renameName, setRenameName] = useState('')
  const [removeTarget, setRemoveTarget] = useState<MemberDetail | null>(null)
  const [permissions, setPermissions] = useState<TeamPermissions | null>(null)
  const [permLoading, setPermLoading] = useState(false)

  const selectedTeam = teams.find(t => t.id === selectedTeamId) ?? null

  // Load permissions when drilling into a team
  useEffect(() => {
    if (!selectedTeamId) { setPermissions(null); return }
    setPermLoading(true)
    api.settings.getTeamPermissions(selectedTeamId)
      .then(setPermissions)
      .catch(console.error)
      .finally(() => setPermLoading(false))
  }, [selectedTeamId])

  const handleCreate = async (name: string) => { await api.settings.createTeam(name); setShowCreate(false); onRefresh() }
  const handleDelete = async () => {
    if (!deleteTarget) return
    await api.settings.deleteTeam(deleteTarget.id)
    setDeleteTarget(null)
    if (selectedTeamId === deleteTarget.id) setSelectedTeamId(null)
    onRefresh()
  }
  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault(); if (!renameTarget || !renameName.trim()) return
    await api.settings.updateTeam(renameTarget.id, renameName.trim()); setRenameTarget(null); onRefresh()
  }
  const handleAddDone = () => { setShowAddPanel(false); onRefresh() }
  const handleRemoveFromTeam = async () => {
    if (!removeTarget) return
    await api.settings.updateMember(removeTarget.id, { unassign_team: true })
    setRemoveTarget(null)
    onRefresh()
  }
  const handleTogglePermission = async (feature: string, enabled: boolean) => {
    if (!selectedTeamId) return
    const updated = await api.settings.updateTeamPermission(selectedTeamId, feature, enabled)
    setPermissions(updated)
  }

  // ── Team detail view ──────────────────────────────────────────────────────────

  if (selectedTeam) {
    const teamLead = selectedTeam.members.find(m => m.roleName === 'lead') ?? null

    // Group features by section
    const sections = ['Core', 'Tools', 'Tickets', 'Self Service']

    return (
      <div className="bg-surface-2 -mx-8 -mt-2 min-h-full px-8 pt-8 pb-12 rounded-2xl">

        {/* Breadcrumb */}
        <button
          onClick={() => setSelectedTeamId(null)}
          className="flex items-center gap-1.5 text-sm font-medium text-ink-subtle hover:text-ink mb-6 transition-colors group"
        >
          <ArrowLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
          All Teams
        </button>

        {/* Header row */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-ink tracking-tight">{selectedTeam.name}</h1>
            <p className="text-sm text-ink-tertiary mt-1">
              {selectedTeam.memberCount} member{selectedTeam.memberCount !== 1 ? 's' : ''}
              {teamLead && <span className="ml-2 text-success font-medium">· Lead: {teamLead.name}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => { setRenameTarget(selectedTeam); setRenameName(selectedTeam.name) }}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-ink bg-surface-3 border border-hairline rounded-2xl hover:bg-surface-4 transition-colors"
            >
              <Pencil size={13} /> Rename
            </button>
            <button
              onClick={() => setDeleteTarget(selectedTeam)}
              disabled={selectedTeam.memberCount > 0}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-red-400 bg-surface-3 border border-hairline rounded-2xl hover:bg-red-900/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 size={13} /> Delete
            </button>
            <button
              onClick={() => setShowAddPanel(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-primary rounded-2xl hover:bg-primary-hover transition-colors"
            >
              <UserPlus size={14} /> Add Member
            </button>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-12 gap-5">

          {/* Left: Members card */}
          <div className="col-span-7">
            <div className="bg-surface-1 rounded-2xl overflow-hidden border border-hairline">
              <div className="px-6 pt-6 pb-4 border-b border-hairline">
                <h2 className="text-base font-semibold text-ink">Team Members</h2>
                <p className="text-xs text-ink-tertiary mt-0.5">Select a role from the dropdown to promote or demote. Hover to remove.</p>
              </div>

              {selectedTeam.members.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-surface-3 flex items-center justify-center mb-4">
                    <Users size={20} className="text-ink-tertiary" />
                  </div>
                  <p className="text-sm font-semibold text-ink mb-1">No members yet</p>
                  <p className="text-xs text-ink-tertiary mb-5">Add your first member to get started.</p>
                  <button
                    onClick={() => setShowAddPanel(true)}
                    className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-primary rounded-2xl hover:bg-primary-hover transition-colors"
                  >
                    <UserPlus size={14} /> Add First Member
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-hairline">
                  {selectedTeam.members.map(m => (
                    <TeamMemberRoleRow
                      key={m.id}
                      member={m}
                      existingLead={teamLead}
                      onUpdate={onRefresh}
                      onRemove={setRemoveTarget}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Leadership + Permissions */}
          <div className="col-span-5 space-y-4">

            {/* Leadership card */}
            <div className="bg-surface-1 rounded-2xl p-6 border border-hairline">
              <h2 className="text-base font-semibold text-ink mb-4">Team Leadership</h2>
              {teamLead ? (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {teamLead.name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold text-ink truncate">{teamLead.name}</p>
                      <Crown size={11} className="text-success flex-shrink-0" />
                    </div>
                    <p className="text-xs text-ink-tertiary truncate">{teamLead.email ?? 'Team Lead'}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 py-2">
                  <div className="w-10 h-10 rounded-full bg-surface-3 flex items-center justify-center flex-shrink-0">
                    <Crown size={16} className="text-ink-tertiary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-ink">No lead assigned</p>
                    <p className="text-xs text-ink-tertiary">Promote a member to Team Lead above</p>
                  </div>
                </div>
              )}
            </div>

            {/* Module access card */}
            <div className="bg-surface-1 rounded-2xl overflow-hidden border border-hairline">
              <div className="px-6 pt-6 pb-4 border-b border-hairline">
                <h2 className="text-base font-semibold text-ink">Module Access</h2>
                <p className="text-xs text-ink-tertiary mt-0.5">Control which features are visible to this team</p>
              </div>

              {permLoading ? (
                <div className="p-6 space-y-3">
                  {[1,2,3,4].map(i => <div key={i} className="h-10 bg-surface-3 rounded-xl animate-pulse" />)}
                </div>
              ) : (
                <div className="px-5 py-4">
                  {sections.map(section => {
                    const sectionFeatures = FEATURE_DEFS.filter(f => f.section === section)
                    return (
                      <div key={section} className="mb-5 last:mb-0">
                        <p className="text-[10px] font-semibold text-ink-tertiary uppercase tracking-widest mb-2">{section}</p>
                        <div className="space-y-1">
                          {sectionFeatures.map(feat => {
                            const Icon = feat.icon
                            const isEnabled = permissions ? permissions[feat.key] !== false : true
                            return (
                              <div key={feat.key} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${isEnabled ? '' : 'opacity-50'}`}>
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${isEnabled ? 'bg-primary/10' : 'bg-surface-3'}`}>
                                  <Icon size={13} className={isEnabled ? 'text-primary-hover' : 'text-ink-tertiary'} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-ink leading-tight">{feat.label}</p>
                                  <p className="text-[10px] text-ink-tertiary leading-tight">{feat.description}</p>
                                </div>
                                <ToggleSwitch
                                  enabled={isEnabled}
                                  onChange={(v) => handleTogglePermission(feat.key, v)}
                                />
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>


          </div>
        </div>

        {/* Rename modal */}
        {renameTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-surface-1 rounded-2xl shadow-xl w-full max-w-sm mx-4 border border-hairline-strong">
              <div className="flex items-center justify-between px-6 py-5 border-b border-hairline">
                <p className="text-base font-semibold text-ink">Rename Team</p>
                <button onClick={() => setRenameTarget(null)} className="p-1.5 rounded-full hover:bg-surface-3 text-ink-tertiary"><X size={16} /></button>
              </div>
              <form onSubmit={handleRename} className="p-6 space-y-4">
                <input autoFocus type="text" required value={renameName} onChange={e => setRenameName(e.target.value)}
                  className="w-full text-sm px-4 py-3 rounded-xl border border-hairline-strong bg-surface-2 text-ink focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-ink-tertiary" />
                <div className="flex gap-3">
                  <button type="button" onClick={() => setRenameTarget(null)} className="flex-1 px-4 py-2.5 text-sm font-medium text-ink bg-surface-3 border border-hairline rounded-2xl hover:bg-surface-4">Cancel</button>
                  <button type="submit" className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-primary rounded-2xl hover:bg-primary-hover">Save</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {deleteTarget && <ConfirmDialog
          title={`Delete ${deleteTarget.name}?`}
          message={deleteTarget.memberCount > 0 ? `Move the ${deleteTarget.memberCount} member(s) to another team before deleting.` : 'This will permanently delete this team.'}
          onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />}

        {removeTarget && <ConfirmDialog
          title={`Remove ${removeTarget.name}?`}
          message={`${removeTarget.name} will be unassigned from ${selectedTeam.name}. They'll still exist as a member without a team.`}
          onConfirm={handleRemoveFromTeam} onCancel={() => setRemoveTarget(null)} />}

        {showAddPanel && selectedTeam && <AddToTeamPanel team={selectedTeam} teams={teams} onDone={handleAddDone} onClose={() => setShowAddPanel(false)} />}
      </div>
    )
  }

  // ── Team grid view ────────────────────────────────────────────────────────────

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-ink-subtle">{teams.length} team{teams.length !== 1 ? 's' : ''}</p>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-primary hover:bg-primary-hover rounded-2xl transition-colors">
          <Plus size={14} /> Create Team
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teams.map(team => {
          const lead = team.members.find(m => m.roleName === 'lead')
          return (
            <button key={team.id} onClick={() => setSelectedTeamId(team.id)}
              className="group bg-surface-1 border border-hairline rounded-2xl p-6 hover:bg-surface-2 transition-all text-left relative">
              <div className="flex items-start justify-between mb-5">
                <div className="w-11 h-11 rounded-2xl bg-surface-3 group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                  <Building2 size={18} className="text-ink-subtle group-hover:text-primary-hover" />
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                  <button onClick={() => { setRenameTarget(team); setRenameName(team.name) }}
                    className="p-1.5 rounded-full hover:bg-surface-3 text-ink-tertiary hover:text-ink transition-colors">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => setDeleteTarget(team)} disabled={team.memberCount > 0}
                    className="p-1.5 rounded-full hover:bg-red-900/20 text-ink-tertiary hover:text-red-400 transition-colors disabled:opacity-30">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <p className="text-base font-semibold text-ink mb-1">{team.name}</p>
              <p className="text-xs text-ink-tertiary mb-4">{team.memberCount} member{team.memberCount !== 1 ? 's' : ''}</p>
              {lead && (
                <div className="flex items-center gap-1.5 mb-4">
                  <Crown size={10} className="text-success" />
                  <span className="text-xs text-ink-subtle">{lead.name}</span>
                </div>
              )}
              {team.members.length > 0 && (
                <div className="flex -space-x-2">
                  {team.members.slice(0, 6).map(m => (
                    <div key={m.id} title={m.name}
                      className="w-7 h-7 rounded-full bg-primary border-2 border-canvas flex items-center justify-center text-white text-[9px] font-bold">
                      {m.name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
                    </div>
                  ))}
                  {team.members.length > 6 && (
                    <div className="w-7 h-7 rounded-full bg-surface-3 border-2 border-canvas flex items-center justify-center text-ink-subtle text-[9px] font-bold">
                      +{team.members.length - 6}
                    </div>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {renameTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-1 rounded-2xl shadow-xl w-full max-w-sm mx-4 border border-hairline-strong">
            <div className="flex items-center justify-between px-6 py-5 border-b border-hairline">
              <p className="text-base font-semibold text-ink">Rename Team</p>
              <button onClick={() => setRenameTarget(null)} className="p-1.5 rounded-full hover:bg-surface-3 text-ink-tertiary"><X size={16} /></button>
            </div>
            <form onSubmit={handleRename} className="p-6 space-y-4">
              <input autoFocus type="text" required value={renameName} onChange={e => setRenameName(e.target.value)}
                className="w-full text-sm px-4 py-3 rounded-xl border border-hairline-strong bg-surface-2 text-ink focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-ink-tertiary" />
              <div className="flex gap-3">
                <button type="button" onClick={() => setRenameTarget(null)} className="flex-1 px-4 py-2.5 text-sm font-medium text-ink bg-surface-3 border border-hairline rounded-2xl hover:bg-surface-4">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-primary rounded-2xl hover:bg-primary-hover">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCreate && <CreateTeamModal onSave={handleCreate} onClose={() => setShowCreate(false)} />}
      {deleteTarget && (
        <ConfirmDialog
          title={`Delete ${deleteTarget.name}?`}
          message={deleteTarget.memberCount > 0 ? `Move the ${deleteTarget.memberCount} member(s) to another team first.` : 'This will permanently delete this team.'}
          onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
      )}
    </div>
  )
}

// ── Appearance tab (all roles) ────────────────────────────────────────────────

interface ThemeOption {
  value: Theme
  label: string
  description: string
  icon: React.ElementType
  preview: React.ReactNode
}

function AppearanceTab() {
  const { theme, setTheme } = useAppContext()

  const options: ThemeOption[] = [
    {
      value: 'light',
      label: 'Light',
      description: 'Clean white interface',
      icon: Sun,
      preview: (
        <div className="mt-3 rounded-lg border border-hairline overflow-hidden h-16">
          <div className="bg-surface-3 h-3 flex items-center gap-1 px-2">
            <div className="w-1.5 h-1.5 rounded-full bg-surface-2" />
            <div className="w-8 h-1 bg-surface-2 rounded" />
          </div>
          <div className="bg-surface-1 h-13 p-2 flex gap-1.5">
            <div className="w-5 bg-surface-2 rounded h-full" />
            <div className="flex-1 space-y-1.5 pt-0.5">
              <div className="h-1.5 bg-surface-3 rounded w-3/4" />
              <div className="h-1.5 bg-surface-2 rounded w-1/2" />
              <div className="h-1.5 bg-surface-2 rounded w-2/3" />
            </div>
          </div>
        </div>
      ),
    },
    {
      value: 'dark',
      label: 'Dark',
      description: 'Easy on the eyes',
      icon: Moon,
      preview: (
        <div className="mt-3 rounded-lg border border-hairline overflow-hidden h-16">
          <div className="bg-surface-2 h-3 flex items-center gap-1 px-2">
            <div className="w-1.5 h-1.5 rounded-full bg-surface-3" />
            <div className="w-8 h-1 bg-surface-3 rounded" />
          </div>
          <div className="bg-surface-1 h-13 p-2 flex gap-1.5">
            <div className="w-5 bg-surface-2 rounded h-full" />
            <div className="flex-1 space-y-1.5 pt-0.5">
              <div className="h-1.5 bg-surface-3 rounded w-3/4" />
              <div className="h-1.5 bg-surface-2 rounded w-1/2" />
              <div className="h-1.5 bg-surface-2 rounded w-2/3" />
            </div>
          </div>
        </div>
      ),
    },
    {
      value: 'system',
      label: 'System',
      description: 'Follows your OS setting',
      icon: Monitor,
      preview: (
        <div className="mt-3 rounded-lg border border-hairline overflow-hidden h-16 flex">
          <div className="flex-1">
            <div className="bg-surface-3 h-3" />
            <div className="bg-surface-1 h-13 p-1.5 space-y-1">
              <div className="h-1.5 bg-surface-3 rounded w-full" />
              <div className="h-1.5 bg-surface-2 rounded w-3/4" />
              <div className="h-1.5 bg-surface-2 rounded w-1/2" />
            </div>
          </div>
          <div className="w-px bg-hairline" />
          <div className="flex-1">
            <div className="bg-surface-2 h-3" />
            <div className="bg-surface-1 h-13 p-1.5 space-y-1">
              <div className="h-1.5 bg-surface-3 rounded w-full" />
              <div className="h-1.5 bg-surface-2 rounded w-3/4" />
              <div className="h-1.5 bg-surface-2 rounded w-1/2" />
            </div>
          </div>
        </div>
      ),
    },
  ]

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <p className="text-[10px] font-semibold text-ink-subtle uppercase tracking-widest mb-3">Theme</p>
        <div className="grid grid-cols-3 gap-3">
          {options.map(opt => {
            const Icon = opt.icon
            const selected = theme === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                className={`relative text-left p-4 rounded-xl border-2 transition-all ${
                  selected
                    ? 'border-primary bg-primary/10'
                    : 'border-hairline bg-surface-1 hover:border-primary/40'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center ${
                    selected ? 'bg-primary/20 text-primary' : 'bg-surface-3 text-ink-subtle'
                  }`}>
                    <Icon size={13} />
                  </div>
                  <span className={`text-xs font-semibold ${selected ? 'text-primary' : 'text-ink'}`}>
                    {opt.label}
                  </span>
                  {selected && (
                    <span className="ml-auto w-4 h-4 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                      <Check size={9} className="text-white" />
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-ink-subtle mb-1">{opt.description}</p>
                {opt.preview}
              </button>
            )
          })}
        </div>
      </div>

      <div className="bg-surface-1 rounded-xl border border-hairline p-4">
        <div className="flex items-center gap-2 mb-3">
          <Monitor size={14} className="text-ink-subtle" />
          <p className="text-xs font-semibold text-ink">Current display</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            theme === 'light' ? 'bg-amber-100 text-amber-600' :
            theme === 'dark'  ? 'bg-primary/20 text-primary' :
            'bg-surface-3 text-ink-subtle'
          }`}>
            {theme === 'light' ? <Sun size={16} /> : theme === 'dark' ? <Moon size={16} /> : <Monitor size={16} />}
          </div>
          <div>
            <p className="text-xs font-medium text-ink capitalize">{theme} mode active</p>
            <p className="text-[10px] text-ink-subtle">
              {theme === 'system' ? 'Automatically switches with your OS preference' : 'Manually set — overrides OS preference'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Roles & Permissions tab (all roles, read-only) ────────────────────────────

function RolesTab({ roles }: { roles: Role[] }) {
  const ROLE_DESCRIPTIONS: Record<string, string> = {
    admin: 'Full system access. Manages users, teams, and roles. No team assignment.',
    head:  'Cross-team visibility. Oversees one or more teams assigned by admin.',
    lead:  'Leads a single team. Manages tasks and members within their team.',
    user:  'Standard team member. Personal task scope and own KPI metrics.',
  }
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {['admin', 'head', 'lead', 'user'].map(roleName => (
          <div key={roleName} className="bg-surface-1 rounded-xl border border-hairline p-5">
            <div className="mb-2"><RoleBadge role={roleName} /></div>
            <p className="text-xs text-ink-muted">{ROLE_DESCRIPTIONS[roleName]}</p>
            {!roles.find(r => r.name === roleName) && <p className="text-[10px] text-amber-500 mt-1.5">Not yet in database — run seed.</p>}
          </div>
        ))}
      </div>
      <div>
        <p className="text-[10px] font-semibold text-ink-subtle uppercase tracking-widest mb-3">Permission Matrix</p>
        <div className="bg-surface-1 rounded-xl border border-hairline overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-surface-2 border-b border-hairline">
              <tr>
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-ink-subtle uppercase tracking-widest">Feature</th>
                {(['user', 'lead', 'head', 'admin'] as const).map(r => (
                  <th key={r} className="px-3 py-3 text-center"><RoleBadge role={r} /></th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {PERMISSION_MATRIX.map((row, i) => (
                <tr key={i} className="hover:bg-surface-2 transition-colors">
                  <td className="px-4 py-2.5 text-ink-muted">{row.feature}</td>
                  {(['user', 'lead', 'head', 'admin'] as const).map(r => (
                    <td key={r} className="px-3 py-2.5 text-center">
                      {row[r] ? (
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-success/10 text-success"><Check size={10} /></span>
                      ) : (
                        <span className="inline-block w-3 h-0.5 bg-hairline rounded" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Access Requests tab (admin only) ──────────────────────────────────────────

const ACCESS_ROLE_OPTIONS = ['user', 'lead', 'head', 'admin']

function AccessRequestsTab() {
  const [requests, setRequests] = useState<MemberRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [approveModal, setApproveModal] = useState<MemberRequest | null>(null)
  const [rejectModal, setRejectModal] = useState<MemberRequest | null>(null)
  const [selectedRole, setSelectedRole] = useState('user')
  const [rejectReason, setRejectReason] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setRequests(await api.onboarding.listRequests('pending')) } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleApprove() {
    if (!approveModal) return
    setSaving(true)
    try {
      await api.onboarding.approveRequest(approveModal.id, selectedRole)
      setApproveModal(null)
      setSelectedRole('user')
      await load()
    } finally { setSaving(false) }
  }

  async function handleReject() {
    if (!rejectModal) return
    setSaving(true)
    try {
      await api.onboarding.rejectRequest(rejectModal.id, rejectReason || undefined)
      setRejectModal(null)
      setRejectReason('')
      await load()
    } finally { setSaving(false) }
  }

  if (loading) return <div className="text-xs text-ink-subtle py-8 text-center">Loading…</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-semibold text-ink">Access Requests</p>
          <p className="text-xs text-ink-subtle mt-0.5">{requests.length} pending</p>
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <CheckCircle size={28} className="text-ink-subtle mb-3" />
          <p className="text-sm font-medium text-ink">All caught up</p>
          <p className="text-xs text-ink-subtle mt-1">No pending access requests</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(r => (
            <div key={r.id} className="bg-surface-1 border border-hairline rounded-xl p-4 flex items-start gap-4">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary font-semibold text-sm">
                {r.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink">{r.name}</p>
                <p className="text-xs text-ink-subtle">{r.email}</p>
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-surface-3 text-ink-subtle border border-hairline">
                    {r.requestedTeamName ?? 'No team'}
                  </span>
                  <span className="text-[10px] text-ink-tertiary">
                    {new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
                {r.note && (
                  <p className="text-xs text-ink-muted mt-1.5 bg-surface-2 rounded-lg px-2.5 py-1.5 border border-hairline italic">"{r.note}"</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => { setRejectModal(r); setRejectReason('') }}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-red-400 bg-red-900/10 hover:bg-red-900/20 border border-red-900/30 rounded-lg transition-colors disabled:opacity-50"
                >
                  <XCircle size={12} />
                  Reject
                </button>
                <button
                  onClick={() => { setApproveModal(r); setSelectedRole('user') }}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50"
                >
                  <CheckCircle size={12} />
                  Approve
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Approve modal */}
      {approveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-surface-1 rounded-xl border border-hairline shadow-xl w-full max-w-sm mx-4 p-6">
            <p className="text-sm font-semibold text-ink mb-1">Approve request</p>
            <p className="text-xs text-ink-subtle mb-4">Assign a role to <span className="font-medium text-ink">{approveModal.name}</span> before approving.</p>
            <div className="relative mb-5">
              <select
                value={selectedRole}
                onChange={e => setSelectedRole(e.target.value)}
                className="w-full appearance-none text-xs px-3 py-2 pr-7 rounded-lg border border-hairline bg-surface-2 focus:outline-none focus:border-primary text-ink"
              >
                {ACCESS_ROLE_OPTIONS.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-subtle pointer-events-none" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setApproveModal(null)} className="flex-1 px-3 py-1.5 text-xs font-medium text-ink-muted bg-surface-2 hover:bg-surface-3 rounded-lg transition-colors">Cancel</button>
              <button onClick={handleApprove} disabled={saving} className="flex-1 px-3 py-1.5 text-xs font-semibold text-white bg-primary hover:bg-primary/90 disabled:opacity-50 rounded-lg transition-colors">
                {saving ? 'Approving…' : 'Approve'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-surface-1 rounded-xl border border-hairline shadow-xl w-full max-w-sm mx-4 p-6">
            <p className="text-sm font-semibold text-ink mb-1">Reject request</p>
            <p className="text-xs text-ink-subtle mb-3">Optionally provide a reason for <span className="font-medium text-ink">{rejectModal.name}</span>.</p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              rows={3}
              placeholder="Reason (optional)…"
              className="w-full text-xs px-3 py-2 rounded-lg border border-hairline bg-surface-2 focus:outline-none focus:border-primary text-ink placeholder-subtle resize-none mb-4"
            />
            <div className="flex gap-2">
              <button onClick={() => setRejectModal(null)} className="flex-1 px-3 py-1.5 text-xs font-medium text-ink-muted bg-surface-2 hover:bg-surface-3 rounded-lg transition-colors">Cancel</button>
              <button onClick={handleReject} disabled={saving} className="flex-1 px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg transition-colors">
                {saving ? 'Rejecting…' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Settings page ────────────────────────────────────────────────────────

type Tab = 'profile' | 'my-team' | 'my-teams' | 'users' | 'teams' | 'roles' | 'appearance' | 'access-requests'

interface TabDef { id: Tab; label: string; icon: React.ElementType; roles: string[]; badge?: () => React.ReactNode }

const ALL_TABS: TabDef[] = [
  { id: 'profile',         label: 'Profile',              icon: User,        roles: ['user', 'lead', 'head', 'admin'] },
  { id: 'my-team',         label: 'My Team',               icon: Building2,   roles: ['lead'] },
  { id: 'my-teams',        label: 'My Teams',              icon: Building2,   roles: ['head'] },
  { id: 'users',           label: 'Users',                 icon: Users,       roles: ['admin'] },
  { id: 'teams',           label: 'Teams',                 icon: Building2,   roles: ['admin'] },
  { id: 'access-requests', label: 'Access Requests',       icon: Clock,       roles: ['admin'] },
  { id: 'roles',           label: 'Roles & Permissions',   icon: ShieldCheck, roles: ['user', 'lead', 'head', 'admin'] },
  { id: 'appearance',      label: 'Appearance',             icon: Palette,     roles: ['user', 'lead', 'head', 'admin'] },
]

export default function Settings() {
  const { currentUser } = useAppContext()
  const role = currentUser?.role ?? 'user'

  const visibleTabs = ALL_TABS.filter(t => t.roles.includes(role))
  const [activeTab, setActiveTab] = useState<Tab>('profile')
  const [pendingCount, setPendingCount] = useState(0)

  // If the active tab isn't visible for this role, reset to first visible
  const effectiveTab = visibleTabs.find(t => t.id === activeTab) ? activeTab : visibleTabs[0]?.id ?? 'profile'

  const [teams, setTeams] = useState<TeamWithMembers[]>([])
  const [roles, setRoles] = useState<Role[]>([])

  const loadAdminData = useCallback(async () => {
    if (role !== 'admin') return
    const [teamsData, rolesData] = await Promise.all([
      api.settings.getTeams(),
      api.settings.getRoles(),
    ])
    setTeams(teamsData)
    setRoles(rolesData)
  }, [role])

  useEffect(() => {
    if (role === 'admin') {
      api.onboarding.pendingCount().then(setPendingCount).catch(() => {})
    }
  }, [role])

  const loadRoles = useCallback(async () => {
    if (role === 'admin') return // already loaded above
    try { const data = await api.settings.getRoles(); setRoles(data) } catch { /* non-admins: roles might be forbidden */ }
  }, [role])

  useEffect(() => { loadAdminData() }, [loadAdminData])
  useEffect(() => { loadRoles() }, [loadRoles])

  return (
    <div className="max-w-5xl mx-auto">
      {/* Page header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-lg font-bold text-ink">Settings</h1>
          {currentUser?.role && <RoleBadge role={currentUser.role} />}
        </div>
        <p className="text-xs text-ink-subtle">
          {role === 'admin' && 'Manage users, teams, and access permissions'}
          {role === 'head'  && 'View your assigned teams and access permissions'}
          {role === 'lead'  && 'View your team and access permissions'}
          {role === 'user'  && 'Your profile and access permissions'}
          {!role            && 'Account settings'}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-hairline mb-6 overflow-x-auto">
        {visibleTabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
              effectiveTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-ink-subtle hover:text-ink-muted'
            }`}>
            <tab.icon size={13} />
            {tab.label}
            {tab.id === 'access-requests' && pendingCount > 0 && (
              <span className="ml-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {effectiveTab === 'profile'         && <ProfileTab />}
      {effectiveTab === 'my-team'         && <MyTeamTab />}
      {effectiveTab === 'my-teams'        && <MyTeamsTab />}
      {effectiveTab === 'users'           && <UsersTab teams={teams} onRefresh={loadAdminData} />}
      {effectiveTab === 'teams'           && <TeamsTab teams={teams} onRefresh={loadAdminData} />}
      {effectiveTab === 'access-requests' && <AccessRequestsTab />}
      {effectiveTab === 'roles'           && <RolesTab roles={roles} />}
      {effectiveTab === 'appearance'      && <AppearanceTab />}
    </div>
  )
}
