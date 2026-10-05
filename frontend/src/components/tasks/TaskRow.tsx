import type { Task, TaskOccurrence, OccurrenceStatus } from '../../types'

type EffectiveStatus = OccurrenceStatus | 'missed'

interface StatusConfig {
  label: string
  borderCls: string
  badgeCls: string
}

const STATUS_CONFIG: Record<EffectiveStatus, StatusConfig> = {
  pending:     { label: 'Pending',     borderCls: 'border-l-hairline-strong', badgeCls: 'bg-surface-3 text-ink-subtle' },
  in_progress: { label: 'In Progress', borderCls: 'border-l-primary',         badgeCls: 'bg-primary/10 text-primary-hover' },
  done:        { label: 'Done',        borderCls: 'border-l-success',         badgeCls: 'bg-success/10 text-success' },
  skipped:     { label: 'Skipped',     borderCls: 'border-l-amber-500',       badgeCls: 'bg-amber-500/10 text-amber-400' },
  missed:      { label: 'Missed',      borderCls: 'border-l-red-500',         badgeCls: 'bg-red-500/10 text-red-400' },
}

interface Props {
  task: Task
  occurrence: TaskOccurrence
  isPast: boolean
  isSelected: boolean
  onClick: () => void
}

export default function TaskRow({ task, occurrence, isPast, isSelected, onClick }: Props) {
  const isMissed =
    isPast && (occurrence.status === 'pending' || occurrence.status === 'in_progress')

  const effectiveStatus: EffectiveStatus = isMissed ? 'missed' : occurrence.status
  const cfg = STATUS_CONFIG[effectiveStatus]
  const isDone = occurrence.status === 'done'

  return (
    <div
      onClick={onClick}
      className={`rounded-lg border border-hairline border-l-4 ${cfg.borderCls} bg-surface-1 cursor-pointer transition-all ${
        isSelected
          ? 'ring-1 ring-primary/30 bg-surface-2'
          : 'hover:bg-surface-2'
      }`}
    >
      <div className="px-4 py-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="inline-block text-[10px] font-mono text-ink-tertiary bg-surface-3 border border-hairline px-1.5 py-0.5 rounded mb-1.5">
              {task.id}
            </span>
            <p
              className={`text-sm font-medium leading-snug ${
                isDone
                  ? 'line-through text-ink-tertiary'
                  : isMissed
                  ? 'text-red-400'
                  : 'text-ink-muted'
              }`}
            >
              {task.title}
            </p>
          </div>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 mt-4 ${cfg.badgeCls}`}>
            {cfg.label}
          </span>
        </div>

        {task.description && !isDone && (
          <p className="text-xs text-ink-tertiary mt-1 truncate">{task.description}</p>
        )}

        {isDone && occurrence.completedBy && (
          <p className="text-xs text-ink-tertiary mt-1.5">Done by {occurrence.completedBy}</p>
        )}

        {isMissed && (
          <p className="text-xs text-red-400/80 mt-1.5">Not completed — period has passed</p>
        )}
      </div>
    </div>
  )
}
