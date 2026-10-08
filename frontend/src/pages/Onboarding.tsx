import { useState, useEffect, useCallback } from 'react'
import { ChevronDown, Clock, XCircle, CheckCircle } from 'lucide-react'
import type { MemberRequest } from '../types'
import { api } from '../api/teamPulseApi'

interface Team { id: string; name: string }

// ── Setup form ────────────────────────────────────────────────────────────────

function SetupForm({ email, onSubmitted }: { email: string; onSubmitted: (r: MemberRequest) => void }) {
  const [teams, setTeams] = useState<Team[]>([])
  const [name, setName] = useState('')
  const [teamId, setTeamId] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/v1/onboarding/teams')
      .then(r => r.json())
      .then(setTeams)
      .catch(() => {})
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !teamId) return
    setSubmitting(true)
    setError(null)
    try {
      const r = await api.onboarding.submitRequest({ name: name.trim(), requestedTeamId: teamId, note: note.trim() || undefined })
      onSubmitted(r)
    } catch {
      setError('Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-canvas px-6">
      <div className="w-full max-w-sm">
        <div className="mb-7">
          <h1 className="text-base font-semibold text-ink">Request access</h1>
          <p className="text-xs text-ink-subtle mt-1">Fill in your details and an admin will review your request.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-900/20 border border-red-900/40 rounded-lg px-3 py-2 text-xs text-red-400">{error}</div>
          )}

          {/* Email — read-only */}
          <div>
            <label className="block text-[10px] font-semibold text-ink-subtle uppercase tracking-widest mb-1.5">Email</label>
            <input
              type="text"
              value={email}
              readOnly
              className="w-full text-xs px-3 py-2 rounded-lg border border-hairline bg-surface-2 text-ink-tertiary cursor-not-allowed select-none"
            />
            <p className="text-[10px] text-ink-subtle mt-1">Your Databricks login — cannot be changed</p>
          </div>

          {/* Full name */}
          <div>
            <label className="block text-[10px] font-semibold text-ink-subtle uppercase tracking-widest mb-1.5">Full name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Jane Smith"
              className="w-full text-xs px-3 py-2 rounded-lg border border-hairline bg-surface-2 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 text-ink placeholder-subtle"
            />
          </div>

          {/* Team */}
          <div>
            <label className="block text-[10px] font-semibold text-ink-subtle uppercase tracking-widest mb-1.5">Team *</label>
            <div className="relative">
              <select
                required
                value={teamId}
                onChange={e => setTeamId(e.target.value)}
                className="w-full appearance-none text-xs px-3 py-2 pr-7 rounded-lg border border-hairline bg-surface-2 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 text-ink"
              >
                <option value="">Select your team…</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-subtle pointer-events-none" />
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-[10px] font-semibold text-ink-subtle uppercase tracking-widest mb-1.5">Note <span className="normal-case font-normal">(optional)</span></label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              placeholder="e.g. Joining as a new PE engineer in October"
              className="w-full text-xs px-3 py-2 rounded-lg border border-hairline bg-surface-2 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 text-ink placeholder-subtle resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !name.trim() || !teamId}
            className="w-full py-2 text-xs font-semibold text-white bg-primary hover:bg-primary/90 disabled:opacity-50 rounded-lg transition-colors"
          >
            {submitting ? 'Submitting…' : 'Submit request'}
          </button>
        </form>

        <p className="text-[10px] text-ink-subtle text-center mt-5">
          Wrong account?{' '}
          <button
            onClick={() => { localStorage.clear(); sessionStorage.clear(); window.location.href = '/_logout' }}
            className="underline underline-offset-2 hover:text-ink-muted transition-colors"
          >
            Sign out
          </button>
        </p>
      </div>
    </div>
  )
}

// ── Pending screen ─────────────────────────────────────────────────────────────

function PendingScreen({ request }: { request: MemberRequest }) {
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const r = await api.onboarding.getMyRequest()
        if (r?.status === 'approved') window.location.reload()
      } catch { /* ignore */ }
    }, 30_000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex h-screen items-center justify-center bg-canvas px-6">
      <div className="max-w-sm w-full text-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
          <Clock size={20} className="text-primary" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-ink">Request pending</h1>
          <p className="text-xs text-ink-subtle mt-1">
            Your request to join the <span className="font-medium text-ink">{request.requestedTeamName ?? 'system'}</span> has been submitted.
            An admin will review it shortly.
          </p>
        </div>
        <div className="bg-surface-1 border border-hairline rounded-xl px-4 py-3 text-left space-y-1.5">
          <Row label="Name" value={request.name} />
          <Row label="Email" value={request.email} />
          <Row label="Team" value={request.requestedTeamName ?? '—'} />
          {request.note && <Row label="Note" value={request.note} />}
        </div>
        <p className="text-[10px] text-ink-subtle">This page will refresh automatically when approved.</p>
        <button
          onClick={() => { localStorage.clear(); sessionStorage.clear(); window.location.href = '/_logout' }}
          className="text-[10px] text-ink-tertiary hover:text-ink-subtle underline underline-offset-2 transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}

// ── Rejected screen ────────────────────────────────────────────────────────────

function RejectedScreen({ request, onResubmit }: { request: MemberRequest; onResubmit: () => void }) {
  return (
    <div className="flex h-screen items-center justify-center bg-canvas px-6">
      <div className="max-w-sm w-full text-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-red-900/20 border border-red-900/30 flex items-center justify-center mx-auto">
          <XCircle size={20} className="text-red-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-ink">Request not approved</h1>
          <p className="text-xs text-ink-subtle mt-1">
            Your access request was reviewed and could not be approved at this time.
          </p>
        </div>
        {request.rejectionReason && (
          <div className="bg-red-900/10 border border-red-900/30 rounded-xl px-4 py-3 text-left">
            <p className="text-[10px] font-semibold text-ink-subtle uppercase tracking-widest mb-1">Reason</p>
            <p className="text-xs text-red-400">{request.rejectionReason}</p>
          </div>
        )}
        <div className="flex flex-col gap-2">
          <button
            onClick={onResubmit}
            className="w-full py-2 text-xs font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors"
          >
            Submit a new request
          </button>
          <button
            onClick={() => { localStorage.clear(); sessionStorage.clear(); window.location.href = '/_logout' }}
            className="text-[10px] text-ink-tertiary hover:text-ink-subtle underline underline-offset-2 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-[10px] font-semibold text-ink-subtle w-10 shrink-0 mt-0.5">{label}</span>
      <span className="text-xs text-ink">{value}</span>
    </div>
  )
}

// ── Root ───────────────────────────────────────────────────────────────────────

export default function Onboarding({ email }: { email: string }) {
  const [request, setRequest] = useState<MemberRequest | null | 'loading'>('loading')
  const [showForm, setShowForm] = useState(false)

  const loadRequest = useCallback(async () => {
    try {
      const r = await api.onboarding.getMyRequest()
      setRequest(r)
    } catch {
      setRequest(null)
    }
  }, [])

  useEffect(() => { loadRequest() }, [loadRequest])

  if (request === 'loading') return null

  if (showForm || request === null) {
    return <SetupForm email={email} onSubmitted={r => { setRequest(r); setShowForm(false) }} />
  }

  if (request.status === 'pending') return <PendingScreen request={request} />

  if (request.status === 'rejected') return <RejectedScreen request={request} onResubmit={() => setShowForm(true)} />

  // status === 'approved' but memberId still null — edge case, just reload
  window.location.reload()
  return null
}
