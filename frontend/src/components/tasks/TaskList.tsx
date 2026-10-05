import type { RecurrenceType, Task, TaskOccurrence } from '../../types'
import { getPeriodKey, isPastPeriod } from '../../utils/period'
import TaskRow from './TaskRow'

interface Props {
  tasks: Task[]
  recurrence: RecurrenceType
  anchorDate: Date
  occurrenceMap: Record<string, TaskOccurrence>
  selectedTaskId: string | null
  onSelectTask: (taskId: string) => void
}

const TEAM_META: Record<string, { label: string; dot: string }> = {
  pe: { label: 'PE', dot: 'bg-primary' },
  so: { label: 'SO', dot: 'bg-purple-500' },
}

function getOcc(map: Record<string, TaskOccurrence>, taskId: string, period: string): TaskOccurrence {
  return map[`${taskId}-${period}`] ?? {
    id: '', taskId, period, status: 'pending', completedBy: '', completionNotes: '', comments: [],
  }
}

export default function TaskList({ tasks, recurrence, anchorDate, occurrenceMap, selectedTaskId, onSelectTask }: Props) {
  const periodKey = getPeriodKey(recurrence, anchorDate)
  const isPast = isPastPeriod(recurrence, anchorDate)

  const peTasks = tasks.filter(t => t.team === 'pe')
  const soTasks = tasks.filter(t => t.team === 'so')

  const doneCount = tasks.filter(t => getOcc(occurrenceMap, t.id, periodKey).status === 'done').length
  const total = tasks.length
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0

  if (total === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-ink-tertiary py-16">
        No tasks for this period
      </div>
    )
  }

  function renderGroup(groupTasks: Task[], teamKey: string) {
    const meta = TEAM_META[teamKey]
    const groupDone = groupTasks.filter(
      t => getOcc(occurrenceMap, t.id, periodKey).status === 'done'
    ).length

    return (
      <div key={teamKey} className="space-y-2">
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${meta.dot}`} />
          <span className="text-[10px] font-semibold text-ink-tertiary uppercase" style={{ letterSpacing: '0.4px' }}>
            {meta.label}
          </span>
          <div className="flex-1 h-px bg-hairline" />
          <span className="text-[10px] text-ink-tertiary">
            {groupDone} / {groupTasks.length}
          </span>
        </div>

        {groupTasks.map(task => (
          <TaskRow
            key={task.id}
            task={task}
            occurrence={getOcc(occurrenceMap, task.id, periodKey)}
            isPast={isPast}
            isSelected={selectedTaskId === task.id}
            onClick={() => onSelectTask(task.id)}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Progress bar */}
      <div className="px-5 py-3 border-b border-hairline flex-shrink-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-ink-subtle">
            <span className="font-semibold text-ink">{doneCount}</span> of {total} tasks done
          </span>
          <span className="text-xs font-medium text-ink-tertiary">{pct}%</span>
        </div>
        <div className="h-1 bg-hairline-strong rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Grouped task cards */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {peTasks.length > 0 && renderGroup(peTasks, 'pe')}
        {soTasks.length > 0 && renderGroup(soTasks, 'so')}
      </div>
    </div>
  )
}
