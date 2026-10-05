import type { Task, TaskOccurrence } from '../../types'
import {
  getPastPeriods,
  getPeriodKey,
  getPeriodLabel,
  isCurrentPeriod,
  isPastPeriod,
  getHistoryCount,
} from '../../utils/period'

type SquareStatus = 'done' | 'partial' | 'missed' | 'pending'

const SQUARE_BG: Record<SquareStatus, string> = {
  done:    'bg-success hover:bg-success/80',
  partial: 'bg-amber-500 hover:bg-amber-400',
  missed:  'bg-red-500 hover:bg-red-400',
  pending: 'bg-hairline-strong hover:bg-hairline-tertiary',
}

const SQUARE_LABEL: Record<SquareStatus, string> = {
  done:    'All done',
  partial: 'Partial',
  missed:  'Missed',
  pending: 'Pending',
}

interface Props {
  task: Task
  historyOccurrences: TaskOccurrence[]
  activePeriodKey: string
  onNavigateToPeriod: (anchor: Date) => void
}

export default function TaskHistory({ task, historyOccurrences, activePeriodKey, onNavigateToPeriod }: Props) {
  const count = getHistoryCount(task.recurrence)
  const periods = getPastPeriods(task.recurrence, count)

  const periodMap: Record<string, TaskOccurrence[]> = {}
  for (const o of historyOccurrences) {
    if (!periodMap[o.period]) periodMap[o.period] = []
    periodMap[o.period].push(o)
  }

  function getSquareStatus(anchor: Date): SquareStatus {
    const key = getPeriodKey(task.recurrence, anchor)
    const occs = periodMap[key] ?? []
    const isCurrent = isCurrentPeriod(task.recurrence, anchor)
    const isPast = isPastPeriod(task.recurrence, anchor)

    if (occs.length === 0) return isCurrent ? 'pending' : isPast ? 'missed' : 'pending'

    const doneCount = occs.filter(o => o.status === 'done').length
    if (doneCount === occs.length) return 'done'
    if (doneCount > 0) return 'partial'
    return isPast ? 'missed' : 'pending'
  }

  return (
    <div className="space-y-2.5">
      <p className="text-xs font-medium text-ink-muted">History</p>

      <div className="flex flex-wrap gap-1">
        {periods.map(anchor => {
          const key = getPeriodKey(task.recurrence, anchor)
          const occs = periodMap[key] ?? []
          const doneCount = occs.filter(o => o.status === 'done').length
          const label = getPeriodLabel(task.recurrence, anchor)
          const status = getSquareStatus(anchor)
          const isCurrent = isCurrentPeriod(task.recurrence, anchor)
          const isActive = key === activePeriodKey

          return (
            <button
              key={key}
              title={`${label} · ${SQUARE_LABEL[status]} (${doneCount}/${occs.length})`}
              onClick={() => onNavigateToPeriod(anchor)}
              className={`w-4 h-4 rounded-sm transition-colors ${SQUARE_BG[status]} ${
                isActive
                  ? 'ring-2 ring-offset-1 ring-ink ring-offset-surface-1'
                  : isCurrent
                  ? 'ring-2 ring-offset-1 ring-primary ring-offset-surface-1'
                  : ''
              }`}
            />
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {(
          [
            { color: 'bg-success', label: 'All done' },
            { color: 'bg-amber-500', label: 'Partial' },
            { color: 'bg-red-500', label: 'Missed' },
            { color: 'bg-hairline-strong', label: 'Pending' },
          ] as const
        ).map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1">
            <span className={`w-2.5 h-2.5 rounded-sm flex-shrink-0 ${color}`} />
            <span className="text-[10px] text-ink-tertiary">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
