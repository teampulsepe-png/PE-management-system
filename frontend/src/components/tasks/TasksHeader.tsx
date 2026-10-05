import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { RecurrenceType } from '../../types'
import {
  getPeriodLabel,
  addPeriod,
  isCurrentPeriod,
  getCurrentLabel,
} from '../../utils/period'

const TABS: { label: string; value: RecurrenceType }[] = [
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Quarterly', value: 'quarterly' },
  { label: 'Annually', value: 'annually' },
]

interface Props {
  recurrence: RecurrenceType
  anchorDate: Date
  onRecurrenceChange: (r: RecurrenceType) => void
  onAnchorChange: (d: Date) => void
}

export default function TasksHeader({ recurrence, anchorDate, onRecurrenceChange, onAnchorChange }: Props) {
  const periodLabel = getPeriodLabel(recurrence, anchorDate)
  const isCurrent = isCurrentPeriod(recurrence, anchorDate)

  return (
    <div className="border-b border-hairline">
      {/* Recurrence tabs */}
      <div className="flex">
        {TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => onRecurrenceChange(tab.value)}
            className={`flex-1 py-3.5 text-xs font-medium transition-colors border-b-2 ${
              recurrence === tab.value
                ? 'text-primary-hover border-primary-hover'
                : 'text-ink-tertiary border-transparent hover:text-ink-subtle'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Period navigator */}
      <div className="flex items-center justify-between px-5 py-3 bg-surface-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onAnchorChange(addPeriod(recurrence, anchorDate, -1))}
            className="p-1.5 text-ink-tertiary hover:text-ink-subtle hover:bg-surface-3 rounded-md transition-colors"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="text-sm font-semibold text-ink min-w-28 md:min-w-52 text-center" style={{ letterSpacing: '-0.2px' }}>
            {periodLabel}
          </span>
          <button
            onClick={() => onAnchorChange(addPeriod(recurrence, anchorDate, 1))}
            className="p-1.5 text-ink-tertiary hover:text-ink-subtle hover:bg-surface-3 rounded-md transition-colors"
          >
            <ChevronRight size={15} />
          </button>
        </div>

        {!isCurrent && (
          <button
            onClick={() => onAnchorChange(new Date())}
            className="text-xs text-primary-hover hover:text-ink font-medium px-2.5 py-1 bg-primary/10 hover:bg-primary/20 rounded-full transition-colors"
          >
            ← {getCurrentLabel(recurrence)}
          </button>
        )}
      </div>
    </div>
  )
}
