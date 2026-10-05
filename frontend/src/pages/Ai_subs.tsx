import { useEffect, useState } from 'react'
import { X, Plus, ChevronRight, Trash2, Bot, Search } from 'lucide-react'
import { api } from '../api/teamPulseApi'
import type { AiSubscription, AiTool, Department } from '../types'

// ── helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatCost(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

// ── sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md border ${
      active
        ? 'bg-teal-900/20 border-teal-900/40 text-teal-400'
        : 'bg-red-900/20 border-red-900/40 text-red-400'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-teal-500' : 'bg-red-300'}`} />
      {active ? 'Active' : 'Expired'}
    </span>
  )
}

function ToolBadge({ name }: { name: string }) {
  const isClaude = name.toLowerCase().startsWith('claude')
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-md border ${
      isClaude
        ? 'bg-orange-900/20 border-orange-900/40 text-orange-400'
        : 'bg-primary/10 border-primary/20 text-primary-hover'
    }`}>
      <Bot size={10} />
      {name}
    </span>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────

type PanelMode = 'add' | 'detail'

interface FormState {
  subscriber_name: string
  email: string
  department_id: string
  tool_id: string
  start_date: string
  open_ended: boolean
  end_date: string
  remarks: string
}

const EMPTY_FORM: FormState = {
  subscriber_name: '', email: '', department_id: '', tool_id: '',
  start_date: today(), open_ended: true, end_date: '', remarks: '',
}

export default function AiSubs() {
  const [subs, setSubs] = useState<AiSubscription[]>([])
  const [tools, setTools] = useState<AiTool[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)

  // panel state
  const [panelMode, setPanelMode] = useState<PanelMode | null>(null)
  const [selected, setSelected] = useState<AiSubscription | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // addon form
  const [addonCredits, setAddonCredits] = useState('')
  const [addonDate, setAddonDate] = useState(today())
  const [addonRemarks, setAddonRemarks] = useState('')
  const [addingAddon, setAddingAddon] = useState(false)

  // set end date
  const [endDateInput, setEndDateInput] = useState('')
  const [savingEndDate, setSavingEndDate] = useState(false)

  // filter
  const [search, setSearch] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'expired'>('all')

  useEffect(() => {
    Promise.all([api.getAiSubscriptions(), api.getAiTools(), api.getDepartments()])
      .then(([s, t, d]) => { setSubs(s); setTools(t); setDepartments(d) })
      .finally(() => setLoading(false))
  }, [])

  const selectedTool = tools.find(t => t.id === form.tool_id)

  const visible = subs.filter(s => {
    if (search) {
      const q = search.toLowerCase()
      if (!s.subscriberName.toLowerCase().includes(q) && !s.email.toLowerCase().includes(q)) return false
    }
    if (filterDept && s.departmentId !== filterDept) return false
    if (filterStatus === 'active' && !s.isActive) return false
    if (filterStatus === 'expired' && s.isActive) return false
    return true
  })

  function openAdd() {
    setForm(EMPTY_FORM)
    setSelected(null)
    setPanelMode('add')
  }

  function openDetail(sub: AiSubscription) {
    setSelected(sub)
    setPanelMode('detail')
    setAddonCredits('')
    setAddonDate(today())
    setAddonRemarks('')
    setEndDateInput('')
  }

  function closePanel() {
    setPanelMode(null)
    setSelected(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const body = {
        subscriber_name: form.subscriber_name.trim(),
        email: form.email.trim(),
        department_id: form.department_id,
        tool_id: form.tool_id,
        start_date: form.start_date,
        end_date: form.open_ended ? null : (form.end_date || null),
        remarks: form.remarks.trim() || null,
      }
      const created = await api.createAiSubscription(body)
      setSubs(prev => [created, ...prev])
      closePanel()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(subId: string) {
    if (!confirm('Delete this subscription?')) return
    await api.deleteAiSubscription(subId)
    setSubs(prev => prev.filter(s => s.id !== subId))
    closePanel()
  }

  async function handleAddAddon(e: React.FormEvent) {
    e.preventDefault()
    if (!selected || !addonCredits) return
    setAddingAddon(true)
    try {
      const updated = await api.addAiSubscriptionAddon(selected.id, {
        credits: parseInt(addonCredits),
        start_date: addonDate,
        remarks: addonRemarks.trim() || null,
      })
      setSubs(prev => prev.map(s => s.id === updated.id ? updated : s))
      setSelected(updated)
      setAddonCredits('')
      setAddonDate(today())
      setAddonRemarks('')
    } finally {
      setAddingAddon(false)
    }
  }

  async function handleDeleteAddon(addonId: string) {
    if (!selected) return
    await api.deleteAiSubscriptionAddon(addonId)
    const updated = await api.getAiSubscriptions()
    const refreshed = updated.find(s => s.id === selected.id)
    setSubs(updated)
    if (refreshed) setSelected(refreshed)
  }

  async function handleSetEndDate(e: React.FormEvent) {
    e.preventDefault()
    if (!selected || !endDateInput) return
    setSavingEndDate(true)
    try {
      const updated = await api.updateAiSubscription(selected.id, { end_date: endDateInput })
      setSubs(prev => prev.map(s => s.id === updated.id ? updated : s))
      setSelected(updated)
      setEndDateInput('')
    } finally {
      setSavingEndDate(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-ink-subtle text-sm">Loading…</div>
  }

  return (
    <div className="flex h-full gap-0 min-h-0">
      {/* ── main content ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 md:px-6 md:pt-6 md:pb-4 flex-shrink-0">
          <div>
            <h1 className="text-lg md:text-xl font-bold text-ink">AI Subscriptions</h1>
            <p className="text-sm text-ink-subtle mt-0.5">{subs.length} subscription{subs.length !== 1 ? 's' : ''} total</p>
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white text-sm font-semibold px-3 md:px-4 py-2 rounded-lg transition-colors flex-shrink-0"
          >
            <Plus size={15} />
            <span className="hidden sm:inline">Add Subscription</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>

        {/* filter bar */}
        <div className="flex flex-wrap items-center gap-2 px-4 pb-3 md:px-6 md:pb-4 flex-shrink-0">
          <div className="relative flex-1 sm:flex-none">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name or email…"
              className="text-sm border border-hairline rounded-lg pl-8 pr-3 py-1.5 text-ink bg-surface-1 focus:outline-none focus:ring-2 focus:ring-primary/30 w-full sm:w-48 placeholder:text-ink-subtle"
            />
          </div>
          <select
            value={filterDept}
            onChange={e => setFilterDept(e.target.value)}
            className="text-sm border border-hairline rounded-lg px-3 py-1.5 text-ink bg-surface-1 focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">All departments</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>

          <div className="flex items-center gap-0.5 bg-surface-3 rounded-lg p-0.5">
            {(['all', 'active', 'expired'] as const).map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`text-xs font-semibold px-3 py-1 rounded-md transition-all capitalize ${
                  filterStatus === s
                    ? 'bg-surface-1 text-primary shadow-sm'
                    : 'text-ink-subtle hover:text-ink-muted'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* table */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 md:px-6 md:pb-6">
          {visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-ink-subtle">
              <Bot size={32} className="mb-2 opacity-30" />
              <p className="text-sm">No subscriptions found</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="text-left text-xs font-semibold text-ink-subtle border-b border-hairline">
                  <th className="pb-2 pr-4 font-semibold">Name</th>
                  <th className="pb-2 pr-4 font-semibold">Department</th>
                  <th className="pb-2 pr-4 font-semibold">Tool</th>
                  <th className="pb-2 pr-4 font-semibold">Cost / mo</th>
                  <th className="pb-2 pr-4 font-semibold">Start</th>
                  <th className="pb-2 pr-4 font-semibold">End</th>
                  <th className="pb-2 pr-4 font-semibold">Add-ons</th>
                  <th className="pb-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {visible.map(sub => (
                  <tr
                    key={sub.id}
                    onClick={() => openDetail(sub)}
                    className={`cursor-pointer hover:bg-surface-2 transition-colors group ${
                      selected?.id === sub.id ? 'bg-primary/10' : ''
                    }`}
                  >
                    <td className="py-3 pr-4">
                      <p className="font-medium text-ink">{sub.subscriberName}</p>
                      <p className="text-xs text-ink-subtle">{sub.email}</p>
                    </td>
                    <td className="py-3 pr-4 text-ink-muted">{sub.departmentName}</td>
                    <td className="py-3 pr-4"><ToolBadge name={sub.toolDisplayName} /></td>
                    <td className="py-3 pr-4 text-ink font-medium">{formatCost(sub.monthlyCost)}</td>
                    <td className="py-3 pr-4 text-ink-subtle">{formatDate(sub.startDate)}</td>
                    <td className="py-3 pr-4 text-ink-subtle">
                      {sub.endDate ? formatDate(sub.endDate) : <span className="text-ink-subtle italic">Ongoing</span>}
                    </td>
                    <td className="py-3 pr-4 text-ink-subtle">
                      {sub.totalAddonCredits > 0
                        ? <span className="text-primary font-medium">+{sub.totalAddonCredits} cr</span>
                        : <span className="text-ink-subtle">—</span>
                      }
                    </td>
                    <td className="py-3">
                      <div className="flex items-center justify-between">
                        <StatusBadge active={sub.isActive} />
                        <ChevronRight size={14} className="text-ink-subtle group-hover:text-ink-muted ml-2 transition-colors" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </div>

      {/* ── side panel ── */}
      {panelMode && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={closePanel} />
          <div className="fixed inset-x-0 bottom-0 z-50 md:static md:z-auto md:flex-shrink-0">
          <div className="w-full md:w-96 border-t border-hairline md:border-t-0 md:border-l border-hairline bg-surface-1 flex flex-col overflow-hidden rounded-t-2xl md:rounded-none max-h-[88vh] md:max-h-none">
          {panelMode === 'add' ? (
            /* ── ADD FORM ── */
            <>
              <div className="flex items-center justify-between px-5 py-4 border-b border-hairline">
                <h2 className="text-sm font-bold text-ink">New Subscription</h2>
                <button onClick={closePanel} className="text-ink-subtle hover:text-ink-muted"><X size={16} /></button>
              </div>
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">Name</label>
                  <input
                    required
                    value={form.subscriber_name}
                    onChange={e => setForm(f => ({ ...f, subscriber_name: e.target.value }))}
                    className="w-full border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-surface-2 text-ink"
                    placeholder="Full name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">Email</label>
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-surface-2 text-ink"
                    placeholder="email@company.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">Department</label>
                  <select
                    required
                    value={form.department_id}
                    onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))}
                    className="w-full border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-surface-2 text-ink"
                  >
                    <option value="">Select department</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">Tool</label>
                  <select
                    required
                    value={form.tool_id}
                    onChange={e => setForm(f => ({ ...f, tool_id: e.target.value }))}
                    className="w-full border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-surface-2 text-ink"
                  >
                    <option value="">Select tool</option>
                    {tools.map(t => <option key={t.id} value={t.id}>{t.displayName}</option>)}
                  </select>
                </div>
                {selectedTool && (
                  <div className="bg-surface-2 rounded-lg px-3 py-2 flex items-center justify-between">
                    <span className="text-xs text-ink-muted">Monthly cost</span>
                    <span className="text-sm font-bold text-ink">{formatCost(selectedTool.monthlyCost)}</span>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">Start date</label>
                  <input
                    required
                    type="date"
                    value={form.start_date}
                    onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                    className="w-full border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-surface-2 text-ink"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="open-ended"
                    type="checkbox"
                    checked={form.open_ended}
                    onChange={e => setForm(f => ({ ...f, open_ended: e.target.checked, end_date: '' }))}
                    className="rounded border-hairline text-primary focus:ring-primary/30"
                  />
                  <label htmlFor="open-ended" className="text-sm text-ink-muted select-none">Open-ended subscription</label>
                </div>
                {!form.open_ended && (
                  <div>
                    <label className="block text-xs font-semibold text-ink-muted mb-1">End date</label>
                    <input
                      required
                      type="date"
                      value={form.end_date}
                      min={form.start_date}
                      onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                      className="w-full border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-surface-2 text-ink"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-ink-muted mb-1">Remarks</label>
                  <textarea
                    value={form.remarks}
                    onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
                    rows={3}
                    className="w-full border border-hairline rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none bg-surface-2 text-ink"
                    placeholder="Optional notes…"
                  />
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
                >
                  {saving ? 'Saving…' : 'Save Subscription'}
                </button>
              </form>
            </>
          ) : selected ? (
            /* ── DETAIL VIEW ── */
            <>
              <div className="flex items-center justify-between px-5 py-4 border-b border-hairline">
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-ink truncate">{selected.subscriberName}</h2>
                  <p className="text-xs text-ink-subtle truncate">{selected.email}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  <button
                    onClick={() => handleDelete(selected.id)}
                    className="text-ink-subtle hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                  <button onClick={closePanel} className="text-ink-subtle hover:text-ink-muted"><X size={16} /></button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                {/* details grid */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Department', value: selected.departmentName },
                    { label: 'Status', value: <StatusBadge active={selected.isActive} /> },
                    { label: 'Tool', value: <ToolBadge name={selected.toolDisplayName} /> },
                    { label: 'Monthly Cost', value: <span className="font-bold text-ink">{formatCost(selected.monthlyCost)}</span> },
                    { label: 'Start Date', value: formatDate(selected.startDate) },
                    { label: 'End Date', value: selected.endDate ? formatDate(selected.endDate) : <span className="text-ink-subtle italic text-xs">Ongoing</span> },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-surface-2 rounded-lg px-3 py-2">
                      <p className="text-[10px] font-semibold text-ink-subtle uppercase tracking-wide mb-0.5">{label}</p>
                      <div className="text-sm text-ink-muted">{value}</div>
                    </div>
                  ))}
                </div>

                {/* set end date — only shown for open-ended subscriptions */}
                {!selected.endDate && (
                  <form onSubmit={handleSetEndDate} className="border border-amber-500/20 bg-amber-900/20 rounded-lg p-3 space-y-2">
                    <p className="text-xs font-semibold text-amber-400">Set end date</p>
                    <p className="text-xs text-amber-400">This subscription is open-ended. You can lock in an end date below.</p>
                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <label className="text-[10px] text-amber-400 block mb-0.5">End date</label>
                        <input
                          type="date"
                          required
                          value={endDateInput}
                          min={selected.startDate}
                          onChange={e => setEndDateInput(e.target.value)}
                          className="w-full border border-amber-500/30 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-surface-2 text-ink"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={savingEndDate || !endDateInput}
                        className="bg-amber-900/200 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-md transition-colors whitespace-nowrap"
                      >
                        {savingEndDate ? 'Saving…' : 'Confirm'}
                      </button>
                    </div>
                  </form>
                )}

                {selected.remarks && (
                  <div>
                    <p className="text-xs font-semibold text-ink-subtle uppercase tracking-wide mb-1">Remarks</p>
                    <p className="text-sm text-ink-muted">{selected.remarks}</p>
                  </div>
                )}

                {/* add-ons section */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">
                      Add-ons
                      {selected.totalAddonCredits > 0 && (
                        <span className="ml-2 normal-case font-normal text-primary">+{selected.totalAddonCredits} credits total</span>
                      )}
                    </p>
                  </div>

                  {selected.addons.length === 0 ? (
                    <p className="text-xs text-ink-subtle italic mb-3">No add-ons recorded</p>
                  ) : (
                    <div className="space-y-1.5 mb-3">
                      {selected.addons.map((addon, i) => (
                        <div key={addon.id} className="flex items-start justify-between bg-surface-2 rounded-lg px-3 py-2 group">
                          <div>
                            <span className="text-xs text-ink-subtle mr-2">#{i + 1}</span>
                            <span className="text-sm font-semibold text-primary">+{addon.credits} credits</span>
                            <span className="text-xs text-ink-subtle ml-2">{formatDate(addon.startDate)} – {formatDate(addon.endDate)}</span>
                            {addon.remarks && <p className="text-xs text-ink-muted mt-0.5">{addon.remarks}</p>}
                          </div>
                          <button
                            onClick={() => handleDeleteAddon(addon.id)}
                            className="text-ink-subtle hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0 ml-2"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* add addon form */}
                  <form onSubmit={handleAddAddon} className="border border-hairline rounded-lg p-3 space-y-2 bg-surface-2">
                    <p className="text-xs font-semibold text-ink-muted">Add new add-on</p>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-[10px] text-ink-subtle block mb-0.5">Credits</label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={addonCredits}
                          onChange={e => setAddonCredits(e.target.value)}
                          placeholder="e.g. 10"
                          className="w-full border border-hairline rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-surface-1 text-ink"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] text-ink-subtle block mb-0.5">Start Date</label>
                        <input
                          type="date"
                          required
                          value={addonDate}
                          onChange={e => setAddonDate(e.target.value)}
                          className="w-full border border-hairline rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-surface-1 text-ink"
                        />
                      </div>
                    </div>
                    <input
                      value={addonRemarks}
                      onChange={e => setAddonRemarks(e.target.value)}
                      placeholder="Remarks (optional)"
                      className="w-full border border-hairline rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-surface-1 text-ink"
                    />
                    <button
                      type="submit"
                      disabled={addingAddon}
                      className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-white text-xs font-semibold py-1.5 rounded-md transition-colors flex items-center justify-center gap-1"
                    >
                      <Plus size={12} />
                      {addingAddon ? 'Adding…' : 'Add Credits'}
                    </button>
                  </form>
                </div>
              </div>
            </>
          ) : null}
          </div>
          </div>
        </>
      )}
    </div>
  )
}
