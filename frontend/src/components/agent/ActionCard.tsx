import { Shield, Zap, RotateCcw, XCircle, Send, CheckCircle, Clock } from 'lucide-react'

export type OperationType = 'grant_permission' | 'revoke_permission' | 'create_cluster' | 'clone_cluster'
export type ActionStatus = 'idle' | 'submitted' | 'executed' | 'rejected'

export interface ActionProposal {
  type: OperationType
  objectType?: 'CATALOG' | 'SCHEMA' | 'TABLE'
  objectName?: string
  principal?: string
  principalType?: 'USER' | 'GROUP'
  privilege?: string
  clusterName?: string
  sourceCluster?: string
  runtime?: string
  nodeType?: string
  workers?: string
  autoTerminationMinutes?: number
  accessGroups?: { group: string; permission: string }[]
}

const TYPE_CONFIG: Record<OperationType, {
  label: string
  Icon: React.ElementType
  accent: string
  bg: string
  border: string
}> = {
  grant_permission: {
    label: 'GRANT PERMISSION',
    Icon: Shield,
    accent: 'text-primary',
    bg: 'bg-surface-2',
    border: 'border-hairline',
  },
  revoke_permission: {
    label: 'REVOKE PERMISSION',
    Icon: XCircle,
    accent: 'text-amber-400',
    bg: 'bg-surface-2',
    border: 'border-hairline',
  },
  create_cluster: {
    label: 'CREATE CLUSTER',
    Icon: Zap,
    accent: 'text-primary',
    bg: 'bg-surface-2',
    border: 'border-hairline',
  },
  clone_cluster: {
    label: 'CLONE CLUSTER',
    Icon: RotateCcw,
    accent: 'text-violet-400',
    bg: 'bg-surface-2',
    border: 'border-hairline',
  },
}

interface Props {
  proposal: ActionProposal
  status: ActionStatus
  isAdmin: boolean
  onExecute: () => void
  onSubmit: () => void
}

export default function ActionCard({ proposal, status, isAdmin, onExecute, onSubmit }: Props) {
  const cfg = TYPE_CONFIG[proposal.type]
  const { Icon } = cfg

  const rows: { label: string; value: string }[] = []

  if (proposal.type === 'grant_permission' || proposal.type === 'revoke_permission') {
    if (proposal.objectType) rows.push({ label: 'Object Type', value: proposal.objectType })
    if (proposal.objectName) rows.push({ label: 'Object Name', value: proposal.objectName })
    if (proposal.principal)
      rows.push({
        label: 'Principal',
        value: `${proposal.principal}${proposal.principalType ? ` (${proposal.principalType})` : ''}`,
      })
    if (proposal.privilege) rows.push({ label: 'Privilege', value: proposal.privilege })
  } else {
    if (proposal.clusterName) rows.push({ label: 'Cluster Name', value: proposal.clusterName })
    if (proposal.sourceCluster) rows.push({ label: 'Based On', value: proposal.sourceCluster })
    if (proposal.runtime) rows.push({ label: 'Runtime', value: proposal.runtime })
    if (proposal.nodeType) rows.push({ label: 'Node Type', value: proposal.nodeType })
    if (proposal.workers) rows.push({ label: 'Workers', value: `${proposal.workers} (autoscale)` })
    if (proposal.autoTerminationMinutes)
      rows.push({ label: 'Auto-terminate', value: `${proposal.autoTerminationMinutes} min` })
  }

  return (
    <div className={`mt-2.5 rounded-xl border ${cfg.border} ${cfg.bg} overflow-hidden text-left`}>
      {/* Header */}
      <div className={`flex items-center gap-2 px-3.5 py-2.5 border-b ${cfg.border}`}>
        <Icon size={13} className={cfg.accent} />
        <span className={`text-[10px] font-bold tracking-widest ${cfg.accent}`}>{cfg.label}</span>
      </div>

      {/* Detail rows */}
      <div className="px-3.5 py-3 space-y-2">
        {rows.map(row => (
          <div key={row.label} className="flex items-baseline justify-between gap-6">
            <span className="text-[11px] text-ink-muted shrink-0">{row.label}</span>
            <span className="text-[11px] font-semibold font-mono text-ink text-right">
              {row.value}
            </span>
          </div>
        ))}

        {proposal.accessGroups && proposal.accessGroups.length > 0 && (
          <div>
            <span className="text-[11px] text-ink-muted block mb-1.5">Access Control</span>
            {proposal.accessGroups.map((ag, i) => (
              <div key={i} className="flex items-center gap-2 pl-1 mb-1">
                <div className="w-1 h-1 rounded-full bg-ink-subtle shrink-0" />
                <span className="text-[11px] font-mono text-ink">
                  <span className="font-semibold">{ag.group}</span>
                  <span className="text-ink-muted"> — </span>
                  {ag.permission}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer actions / status */}
      <div className={`px-3.5 py-2.5 border-t ${cfg.border} bg-surface-1`}>
        {status === 'idle' && (
          <div className="flex items-center gap-2 flex-wrap">
            {isAdmin && (
              <button
                onClick={onExecute}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs font-semibold transition-colors shadow-sm"
              >
                <Zap size={11} />
                Execute Now
              </button>
            )}
            <button
              onClick={onSubmit}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-hairline hover:bg-surface-2 text-ink text-xs font-medium transition-colors"
            >
              <Send size={11} />
              {isAdmin ? 'Submit Request' : 'Submit for Approval'}
            </button>
          </div>
        )}

        {status === 'submitted' && (
          <div className="flex items-center gap-1.5 text-amber-400">
            <Clock size={12} />
            <span className="text-xs font-medium">Pending admin approval</span>
          </div>
        )}

        {status === 'executed' && (
          <div className="flex items-center gap-1.5 text-primary">
            <CheckCircle size={12} />
            <span className="text-xs font-medium">Executed successfully</span>
          </div>
        )}

        {status === 'rejected' && (
          <div className="flex items-center gap-1.5 text-red-400">
            <XCircle size={12} />
            <span className="text-xs font-medium">Request rejected</span>
          </div>
        )}
      </div>
    </div>
  )
}
