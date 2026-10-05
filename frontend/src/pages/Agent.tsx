import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BotMessageSquare, Send, CheckCircle, XCircle, ChevronDown, Zap, Shield, RotateCcw, ListFilter, TriangleAlert, FlaskConical } from 'lucide-react'
import { useAppContext } from '../context/AppContext'
import ActionCard, { type ActionProposal, type ActionStatus } from '../components/agent/ActionCard'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AgentMessage {
  id: string
  role: 'user' | 'agent'
  text: string
  action?: ActionProposal
  actionStatus?: ActionStatus
  timestamp: Date
}

type RequestStatus = 'pending' | 'approved' | 'rejected'

interface OperationRequest {
  id: string
  requesterEmail: string
  requesterName: string
  operationType: ActionProposal['type']
  summary: string
  payload: ActionProposal
  status: RequestStatus
  submittedAt: Date
  reviewedAt?: Date
  reviewedBy?: string
  rejectionReason?: string
}

// ── Mock request queue data ───────────────────────────────────────────────────

const INITIAL_REQUESTS: OperationRequest[] = [
  {
    id: 'req-001',
    requesterEmail: 'sarah.chen@company.com',
    requesterName: 'Sarah Chen',
    operationType: 'grant_permission',
    summary: 'Grant SELECT on prod.analytics to data-team',
    payload: {
      type: 'grant_permission',
      objectType: 'SCHEMA',
      objectName: 'prod.analytics',
      principal: 'data-team',
      principalType: 'GROUP',
      privilege: 'SELECT',
    },
    status: 'pending',
    submittedAt: new Date(Date.now() - 2 * 3600000),
  },
  {
    id: 'req-002',
    requesterEmail: 'james.wilson@company.com',
    requesterName: 'James Wilson',
    operationType: 'create_cluster',
    summary: 'Create ml-team-02 based on ml-dev-01 for data-science group',
    payload: {
      type: 'create_cluster',
      clusterName: 'ml-team-02',
      sourceCluster: 'ml-dev-01',
      runtime: 'DBR 14.3 LTS ML',
      nodeType: 'i3.xlarge',
      workers: '2–8',
      autoTerminationMinutes: 60,
      accessGroups: [{ group: 'data-science', permission: 'CAN_ATTACH_TO' }],
    },
    status: 'pending',
    submittedAt: new Date(Date.now() - 5 * 3600000),
  },
  {
    id: 'req-003',
    requesterEmail: 'priya.patel@company.com',
    requesterName: 'Priya Patel',
    operationType: 'grant_permission',
    summary: 'Grant USE SCHEMA on staging.raw to analysts group',
    payload: {
      type: 'grant_permission',
      objectType: 'SCHEMA',
      objectName: 'staging.raw',
      principal: 'analysts',
      principalType: 'GROUP',
      privilege: 'USE SCHEMA',
    },
    status: 'approved',
    submittedAt: new Date(Date.now() - 26 * 3600000),
    reviewedAt: new Date(Date.now() - 24 * 3600000),
    reviewedBy: 'admin@company.com',
  },
  {
    id: 'req-004',
    requesterEmail: 'tom.baker@company.com',
    requesterName: 'Tom Baker',
    operationType: 'clone_cluster',
    summary: 'Clone analytics-prod for ETL workloads',
    payload: {
      type: 'clone_cluster',
      clusterName: 'etl-batch-v2',
      sourceCluster: 'analytics-prod',
      runtime: 'DBR 13.3 LTS',
      nodeType: 'm5.xlarge',
      workers: '1–4',
      autoTerminationMinutes: 30,
      accessGroups: [{ group: 'engineering', permission: 'CAN_RESTART' }],
    },
    status: 'rejected',
    submittedAt: new Date(Date.now() - 48 * 3600000),
    reviewedAt: new Date(Date.now() - 46 * 3600000),
    reviewedBy: 'admin@company.com',
    rejectionReason: 'Please use existing etl-batch cluster — check with the platform team first.',
  },
]

// ── Initial greeting ──────────────────────────────────────────────────────────

const GREETING: AgentMessage = {
  id: 'greeting',
  role: 'agent',
  text: "Hi! I'm your Databricks Operations Agent. I can help you automate common platform tasks:\n\n**Catalog permissions** — grant or revoke access to catalogs, schemas, and tables\n**Cluster management** — create new clusters or clone existing configurations\n**Access control** — manage group permissions on clusters and SQL warehouses\n\nDescribe what you need in plain language and I'll generate the operation for you.",
  timestamp: new Date(),
}

// ── Mock response logic ───────────────────────────────────────────────────────

function buildMockResponse(input: string): { text: string; action?: ActionProposal } {
  const q = input.toLowerCase()

  if (/grant|give.*access|need.*access|permission|select|read.*from/.test(q)) {
    const objectMatch = q.match(/(?:catalog|schema|table)\s+[`'"]?([\w.-]+)[`'"]?/)?.[1]
    const groupMatch  = q.match(/(?:group|team)\s+[`'"]?([\w-]+)[`'"]?/)?.[1]
    const isSchema    = /schema/.test(q)
    const isTable     = /table/.test(q)

    return {
      text: "I'll prepare the permission grant. Review the details below — you can execute immediately (admin) or submit for approval:",
      action: {
        type: 'grant_permission',
        objectType: isTable ? 'TABLE' : isSchema ? 'SCHEMA' : 'CATALOG',
        objectName: objectMatch ?? 'prod',
        principal: groupMatch ?? 'my-team',
        principalType: 'GROUP',
        privilege: /write|modify|insert/.test(q) ? 'MODIFY' : 'SELECT',
      },
    }
  }

  if (/revoke|remove.*access|take.*away|remove.*permission/.test(q)) {
    const objectMatch = q.match(/(?:catalog|schema|table)\s+[`'"]?([\w.-]+)[`'"]?/)?.[1]
    const groupMatch  = q.match(/(?:group|team)\s+[`'"]?([\w-]+)[`'"]?/)?.[1]

    return {
      text: "This will remove access. Please review carefully before proceeding:",
      action: {
        type: 'revoke_permission',
        objectType: 'CATALOG',
        objectName: objectMatch ?? 'prod',
        principal: groupMatch ?? 'old-team',
        principalType: 'GROUP',
        privilege: 'SELECT',
      },
    }
  }

  if (/clone|copy.*cluster/.test(q)) {
    const sourceMatch = q.match(/(?:clone|copy)\s+[`'"]?([\w-]+)[`'"]?/)?.[1] ??
                        q.match(/(?:like|based on|similar to)\s+[`'"]?([\w-]+)[`'"]?/)?.[1]
    const groupMatch  = q.match(/(?:group|team)\s+[`'"]?([\w-]+)[`'"]?/)?.[1]

    return {
      text: "I'll clone the cluster configuration. Here's the proposed setup:",
      action: {
        type: 'clone_cluster',
        clusterName: `${sourceMatch ?? 'source'}-copy`,
        sourceCluster: sourceMatch ?? 'ml-dev-01',
        runtime: 'DBR 14.3 LTS ML',
        nodeType: 'i3.xlarge',
        workers: '2–4',
        autoTerminationMinutes: 30,
        accessGroups: [{ group: groupMatch ?? 'my-team', permission: 'CAN_ATTACH_TO' }],
      },
    }
  }

  if (/create.*cluster|new cluster|spin up/.test(q)) {
    const sourceMatch = q.match(/(?:like|similar to|based on)\s+[`'"]?([\w-]+)[`'"]?/)?.[1]
    const groupMatch  = q.match(/(?:group|team)\s+[`'"]?([\w-]+)[`'"]?/)?.[1]

    return {
      text: "I'll prepare the cluster configuration. Here's what will be provisioned:",
      action: {
        type: 'create_cluster',
        clusterName: 'new-cluster-01',
        ...(sourceMatch ? { sourceCluster: sourceMatch } : {}),
        runtime: 'DBR 14.3 LTS ML',
        nodeType: 'i3.xlarge',
        workers: '2–8',
        autoTerminationMinutes: 60,
        accessGroups: [{ group: groupMatch ?? 'my-team', permission: 'CAN_ATTACH_TO' }],
      },
    }
  }

  if (/who has|what permissions|check.*access|list.*permissions|current.*access/.test(q)) {
    return {
      text: "Here are the current permissions I found:\n\n**prod** (CATALOG)\n`data-team` (GROUP) — SELECT, USE CATALOG\n`analytics` (GROUP) — SELECT\n`admin` (GROUP) — ALL PRIVILEGES\n\n**staging** (CATALOG)\n`engineers` (GROUP) — SELECT, MODIFY, CREATE TABLE\n`analysts` (GROUP) — SELECT\n\nWould you like to make any changes?",
    }
  }

  if (/list.*cluster|show.*cluster|what cluster|available cluster/.test(q)) {
    return {
      text: "Here are the clusters currently in your workspace:\n\n**ml-dev-01** — DBR 14.3 LTS ML · i3.xlarge · 2–8 workers · Running\n**analytics-prod** — DBR 13.3 LTS · m5.xlarge · 4–12 workers · Running\n**etl-batch** — DBR 14.2 · r4.2xlarge · 1–4 workers · Terminated\n**dev-sandbox** — DBR 14.3 LTS ML · m5.large · 0–4 workers · Running\n\nWould you like to create a new cluster or modify access on any of these?",
    }
  }

  return {
    text: "I can help with that. To generate the right operation, please tell me:\n\n1. **What resource?** (catalog name, schema path, or cluster name)\n2. **Who needs access?** (user email or group name)\n3. **What level?** (SELECT / MODIFY / CREATE TABLE / Can Attach To / etc.)\n\nExample: *\"Grant SELECT on prod.analytics schema to the data-team group\"*",
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRelative(date: Date): string {
  const diff = Date.now() - date.getTime()
  const mins  = Math.floor(diff / 60000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return days === 1 ? 'yesterday' : `${days}d ago`
}

function parseInline(text: string): React.ReactNode[] {
  const result: React.ReactNode[] = []
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g
  let last = 0, m: RegExpExecArray | null

  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) result.push(text.slice(last, m.index))
    const tok = m[0]
    if (tok.startsWith('**'))
      result.push(<strong key={m.index} className="font-semibold">{tok.slice(2, -2)}</strong>)
    else
      result.push(
        <code key={m.index} className="bg-surface-3 rounded px-1 text-[11px] font-mono">
          {tok.slice(1, -1)}
        </code>
      )
    last = m.index + tok.length
  }

  if (last < text.length) result.push(text.slice(last))
  return result
}

function MessageText({ text }: { text: string }) {
  return (
    <div className="leading-relaxed space-y-0.5">
      {text.split('\n').map((line, i) => (
        <div key={i} className={line === '' ? 'h-1.5' : ''}>
          {parseInline(line)}
        </div>
      ))}
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2.5">
      <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
        <BotMessageSquare size={14} className="text-white" />
      </div>
      <div className="bg-surface-3 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1.5 items-center">
        {[0, 150, 300].map(delay => (
          <div
            key={delay}
            className="w-1.5 h-1.5 rounded-full bg-ink-subtle animate-bounce"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </div>
  )
}

const OP_ICON: Record<ActionProposal['type'], React.ElementType> = {
  grant_permission:  Shield,
  revoke_permission: XCircle,
  create_cluster:    Zap,
  clone_cluster:     RotateCcw,
}

const OP_LABEL: Record<ActionProposal['type'], string> = {
  grant_permission:  'Grant Permission',
  revoke_permission: 'Revoke Permission',
  create_cluster:    'Create Cluster',
  clone_cluster:     'Clone Cluster',
}

const STATUS_CONFIG: Record<RequestStatus, { label: string; className: string }> = {
  pending:  { label: 'Pending',  className: 'bg-amber-900/30 text-amber-400' },
  approved: { label: 'Approved', className: 'bg-primary/20 text-primary' },
  rejected: { label: 'Rejected', className: 'bg-red-900/30 text-red-400' },
}

const QUICK_CHIPS = [
  { label: 'Grant catalog access',        prompt: 'Grant SELECT on prod catalog to my-team group' },
  { label: 'Create a cluster',            prompt: 'Create a new cluster similar to ml-dev-01 for data-science group' },
  { label: 'Clone cluster config',        prompt: 'Clone the analytics-prod cluster config' },
  { label: 'Check catalog permissions',   prompt: 'Who currently has access to the prod catalog?' },
  { label: 'List available clusters',     prompt: 'List all available clusters in the workspace' },
]

// ── Request Queue sub-component ───────────────────────────────────────────────

function RequestQueue({
  isAdmin,
  userEmail,
}: {
  isAdmin: boolean
  userEmail: string
}) {
  const [requests, setRequests] = useState<OperationRequest[]>(INITIAL_REQUESTS)
  const [filter, setFilter] = useState<'all' | RequestStatus>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  function approve(id: string) {
    setRequests(prev =>
      prev.map(r => r.id === id
        ? { ...r, status: 'approved', reviewedAt: new Date(), reviewedBy: userEmail }
        : r
      )
    )
  }

  function reject(id: string) {
    setRequests(prev =>
      prev.map(r => r.id === id
        ? { ...r, status: 'rejected', reviewedAt: new Date(), reviewedBy: userEmail, rejectionReason: 'Rejected by admin.' }
        : r
      )
    )
  }

  const visible = requests.filter(r => {
    if (!isAdmin && r.requesterEmail !== userEmail) return false
    if (filter === 'all') return true
    return r.status === filter
  })

  const pendingCount = requests.filter(r => r.status === 'pending').length

  return (
    <div className="flex flex-col gap-4">
      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <ListFilter size={14} className="text-ink-subtle" />
        {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-colors ${
              filter === f
                ? 'bg-ink text-surface-1'
                : 'bg-surface-3 text-ink-subtle hover:bg-surface-3'
            }`}
          >
            {f === 'all' ? `All (${requests.filter(r => !isAdmin ? r.requesterEmail === userEmail : true).length})` :
             f === 'pending' ? `Pending${pendingCount > 0 ? ` (${pendingCount})` : ''}` :
             f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* List */}
      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-10 h-10 rounded-xl bg-surface-3 flex items-center justify-center">
            <CheckCircle size={18} className="text-ink-subtle" />
          </div>
          <p className="text-sm text-ink-subtle">
            {filter === 'all' ? 'No requests yet' : `No ${filter} requests`}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {visible.map(req => {
            const OpIcon = OP_ICON[req.operationType]
            const statusCfg = STATUS_CONFIG[req.status]
            const isExpanded = expandedId === req.id

            return (
              <div
                key={req.id}
                className="bg-surface-1 border border-hairline rounded-xl overflow-hidden"
              >
                {/* Row summary */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-surface-2 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : req.id)}
                >
                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                    {req.requesterName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-ink truncate">
                        {req.requesterName}
                      </span>
                      <div className="flex items-center gap-1 text-ink-muted">
                        <OpIcon size={11} />
                        <span className="text-[11px]">{OP_LABEL[req.operationType]}</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-ink-muted truncate mt-0.5">
                      {req.summary}
                    </p>
                  </div>

                  {/* Right side */}
                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusCfg.className}`}>
                      {statusCfg.label}
                    </span>
                    <span className="text-[11px] text-ink-subtle hidden sm:block">
                      {formatRelative(req.submittedAt)}
                    </span>
                    <ChevronDown
                      size={14}
                      className={`text-ink-subtle transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-hairline px-4 py-3 space-y-3">
                    <ActionCard
                      proposal={req.payload}
                      status={req.status === 'pending' ? 'idle' : req.status === 'approved' ? 'executed' : 'rejected'}
                      isAdmin={false}
                      onExecute={() => {}}
                      onSubmit={() => {}}
                    />

                    {req.rejectionReason && (
                      <div className="flex gap-2 text-xs text-red-400 bg-red-900/20 border border-red-100 rounded-lg px-3 py-2.5">
                        <XCircle size={13} className="shrink-0 mt-px" />
                        <span>{req.rejectionReason}</span>
                      </div>
                    )}

                    {req.reviewedBy && (
                      <p className="text-[11px] text-ink-subtle">
                        {req.status === 'approved' ? 'Approved' : 'Rejected'} by {req.reviewedBy}{' '}
                        {req.reviewedAt ? formatRelative(req.reviewedAt) : ''}
                      </p>
                    )}

                    {/* Admin approve/reject */}
                    {isAdmin && req.status === 'pending' && (
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => approve(req.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs font-semibold transition-colors"
                        >
                          <CheckCircle size={12} />
                          Approve & Execute
                        </button>
                        <button
                          onClick={() => reject(req.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-900/40 text-red-400 hover:bg-red-900/20 text-xs font-medium transition-colors"
                        >
                          <XCircle size={12} />
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Main Agent page ───────────────────────────────────────────────────────────

export default function Agent() {
  const { currentUser } = useAppContext()
  const navigate = useNavigate()
  const isAdmin = Boolean(currentUser?.hasAdminAccess || currentUser?.role === 'admin' || currentUser?.role === 'head')

  const [betaAcknowledged, setBetaAcknowledged] = useState(false)
  const [activeTab, setActiveTab] = useState<'chat' | 'queue'>('chat')
  const [messages, setMessages] = useState<AgentMessage[]>([GREETING])
  const [input, setInput] = useState('')
  const [isThinking, setIsThinking] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef       = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isThinking])

  const pendingCount = INITIAL_REQUESTS.filter(r => r.status === 'pending').length

  function updateActionStatus(msgId: string, status: ActionStatus) {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, actionStatus: status } : m))
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed || isThinking) return

    const userMsg: AgentMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text: trimmed,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsThinking(true)

    await new Promise(res => setTimeout(res, 900 + Math.random() * 600))

    const { text: responseText, action } = buildMockResponse(trimmed)

    const agentMsg: AgentMessage = {
      id: crypto.randomUUID(),
      role: 'agent',
      text: responseText,
      action,
      actionStatus: action ? 'idle' : undefined,
      timestamp: new Date(),
    }

    setIsThinking(false)
    setMessages(prev => [...prev, agentMsg])
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  function getInitials() {
    if (!currentUser) return '?'
    if (currentUser.name)
      return currentUser.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    return currentUser.email[0].toUpperCase()
  }

  return (
    <>
    {/* ── Beta disclaimer modal ── */}
    {!betaAcknowledged && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
        <div className="w-full max-w-md bg-surface-1 rounded-2xl border border-red-900/40 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-red-900/20 px-6 py-5 border-b border-red-900/40">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-100 border border-red-900/40 flex items-center justify-center flex-shrink-0">
                <TriangleAlert size={18} className="text-red-400" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <h2 className="text-sm font-bold text-ink">
                    Operations Agent
                  </h2>
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 border border-red-900/40 text-red-400 text-[10px] font-bold">
                    <FlaskConical size={9} />
                    BETA
                  </span>
                </div>
                <p className="text-xs text-red-400 font-medium">
                  This feature is experimental and not production-ready
                </p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-4">
            <p className="text-sm text-ink-muted leading-relaxed">
              The Operations Agent can execute changes directly on your Databricks workspace. Before continuing, be aware of the following risks:
            </p>

            <ul className="space-y-2.5">
              {[
                { text: 'No automated guardrails — the agent may propose and execute operations without fully validating their impact.' },
                { text: 'Destructive operations are possible — granting broad permissions or creating misconfigured clusters can affect production workloads.' },
                { text: 'Actions are not automatically reversible — some changes (e.g. permission grants) require manual intervention to undo.' },
                { text: 'This interface is under active development — behaviour may change without notice.' },
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-900/200 mt-1.5 shrink-0" />
                  <span className="text-xs text-ink-muted leading-relaxed">{item.text}</span>
                </li>
              ))}
            </ul>

            <p className="text-xs text-ink-muted bg-surface-2 rounded-lg px-3 py-2.5 leading-relaxed">
              All executed operations are logged. If you are unsure about an action, use <span className="font-semibold text-ink">"Submit for Approval"</span> instead of executing directly.
            </p>
          </div>

          {/* Actions */}
          <div className="px-6 pb-5 flex items-center gap-3 justify-end">
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 rounded-xl border border-hairline text-sm font-medium text-ink-muted hover:bg-surface-2 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => setBetaAcknowledged(true)}
              className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors shadow-sm"
            >
              I Understand, Continue
            </button>
          </div>
        </div>
      </div>
    )}

    <div className="h-full flex flex-col gap-4">
      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-hairline -mt-1 pb-0">
        {(
          [
            { key: 'chat'  as const, label: 'Chat',          badge: null as number | null },
            { key: 'queue' as const, label: 'Request Queue', badge: isAdmin && pendingCount > 0 ? pendingCount : null },
          ]
        ).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-ink-subtle hover:text-ink-muted'
            }`}
          >
            {tab.label}
            {tab.badge != null && (
              <span className="flex items-center justify-center w-4 h-4 rounded-full bg-amber-900/200 text-white text-[9px] font-bold leading-none">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Chat tab ── */}
      {activeTab === 'chat' && (
        <div className="flex-1 min-h-0 flex flex-col bg-surface-1 rounded-xl border border-hairline overflow-hidden">

          {/* Messages */}
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5 space-y-5">
            {messages.map(msg => (
              <div key={msg.id} className={`flex items-end gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                {/* Avatar */}
                {msg.role === 'agent' ? (
                  <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center flex-shrink-0 mb-px">
                    <BotMessageSquare size={14} className="text-white" />
                  </div>
                ) : (
                  <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-white text-[10px] font-semibold flex-shrink-0 mb-px">
                    {getInitials()}
                  </div>
                )}

                {/* Bubble */}
                <div className={`max-w-[72%] flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`px-4 py-3 text-sm rounded-2xl ${
                    msg.role === 'user'
                      ? 'bg-primary text-white rounded-br-sm'
                      : 'bg-surface-3 text-ink rounded-bl-sm'
                  }`}>
                    <MessageText text={msg.text} />
                  </div>

                  {/* Action card (agent messages only) */}
                  {msg.action && msg.actionStatus !== undefined && (
                    <div className="w-full max-w-sm">
                      <ActionCard
                        proposal={msg.action}
                        status={msg.actionStatus}
                        isAdmin={isAdmin}
                        onExecute={() => updateActionStatus(msg.id, 'executed')}
                        onSubmit={() => updateActionStatus(msg.id, 'submitted')}
                      />
                    </div>
                  )}

                  <span className="text-[10px] text-ink-subtle px-1">
                    {formatRelative(msg.timestamp)}
                  </span>
                </div>
              </div>
            ))}

            {isThinking && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick chips */}
          <div className="px-4 pt-3 pb-1 flex gap-2 overflow-x-auto scrollbar-none shrink-0">
            {QUICK_CHIPS.map(chip => (
              <button
                key={chip.label}
                onClick={() => setInput(chip.prompt)}
                disabled={isThinking}
                className="flex items-center gap-1.5 whitespace-nowrap text-[11px] font-medium px-2.5 py-1 rounded-lg border border-hairline bg-surface-2 text-ink-muted hover:border-primary hover:text-primary transition-colors disabled:opacity-40 disabled:pointer-events-none shrink-0"
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Input bar */}
          <div className="px-4 pt-2 pb-4 shrink-0 border-t border-hairline mt-2">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isThinking}
                placeholder='Ask the agent… e.g. "Give analytics group SELECT access to prod catalog"'
                rows={1}
                className="flex-1 resize-none rounded-xl border border-hairline bg-surface-2 text-sm text-ink placeholder-subtle px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-transparent disabled:opacity-50 transition-colors leading-relaxed"
                style={{ maxHeight: '120px' }}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isThinking}
                className="w-10 h-10 rounded-xl bg-primary hover:bg-primary/90 disabled:bg-surface-3 text-white disabled:text-ink-subtle flex items-center justify-center transition-colors flex-shrink-0"
              >
                <Send size={16} />
              </button>
            </div>
            <p className="text-[10px] text-ink-subtle mt-1.5 px-1">
              Powered by Databricks AI · Write operations require confirmation · Press ⏎ to send
            </p>
          </div>
        </div>
      )}

      {/* ── Request Queue tab ── */}
      {activeTab === 'queue' && (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-ink">
              {isAdmin ? 'Operations Request Queue' : 'My Submitted Requests'}
            </h2>
            <p className="text-xs text-ink-subtle mt-0.5">
              {isAdmin
                ? 'Review and approve Databricks operations submitted by team members.'
                : 'Track the status of operations you have submitted for approval.'}
            </p>
          </div>
          <RequestQueue
            isAdmin={isAdmin}
            userEmail={currentUser?.email ?? ''}
          />
        </div>
      )}
    </div>
    </>
  )
}
