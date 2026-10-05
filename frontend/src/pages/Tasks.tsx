import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { RecurrenceType, Task, TaskOccurrence, TaskComment, TeamMember } from '../types'
import { getPeriodKey } from '../utils/period'
import { api } from '../api/teamPulseApi'
import TasksHeader from '../components/tasks/TasksHeader'
import TaskList from '../components/tasks/TaskList'
import TaskDetailPanel from '../components/tasks/TaskDetailPanel'

function defaultOccurrence(taskId: string, period: string): TaskOccurrence {
  return { id: '', taskId, period, status: 'pending', completedBy: '', completionNotes: '', comments: [] }
}

const VALID_RECURRENCES = new Set<RecurrenceType>(['weekly', 'monthly', 'quarterly', 'annually'])

export default function Tasks() {
  const [searchParams] = useSearchParams()
  const [recurrence, setRecurrence] = useState<RecurrenceType>(() => {
    const r = searchParams.get('recurrence') as RecurrenceType
    return VALID_RECURRENCES.has(r) ? r : 'weekly'
  })
  const pendingTaskId = searchParams.get('taskId')
  const [anchorDate, setAnchorDate] = useState<Date>(new Date())
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  const [tasks, setTasks] = useState<Task[]>([])
  const [occurrenceMap, setOccurrenceMap] = useState<Record<string, TaskOccurrence>>({})
  const [historyOccurrences, setHistoryOccurrences] = useState<TaskOccurrence[]>([])
  const [comments, setComments] = useState<TaskComment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(false)

  const periodKey = getPeriodKey(recurrence, anchorDate)
  const selectedTask = tasks.find(t => t.id === selectedTaskId) ?? null
  const selectedOccurrence = selectedTask
    ? (occurrenceMap[`${selectedTask.id}-${periodKey}`] ?? defaultOccurrence(selectedTask.id, periodKey))
    : null

  useEffect(() => {
    setLoading(true)
    setSelectedTaskId(null)
    api.getTasks(recurrence)
      .then(fetched => {
        setTasks(fetched)
        if (pendingTaskId && fetched.some(t => t.id === pendingTaskId)) {
          setSelectedTaskId(pendingTaskId)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [recurrence]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tasks.length === 0) return
    api.getOccurrences(periodKey, tasks.map(t => t.id))
      .then(occs => {
        const map: Record<string, TaskOccurrence> = {}
        for (const o of occs) map[`${o.taskId}-${o.period}`] = o
        setOccurrenceMap(map)
      })
      .catch(console.error)
  }, [tasks, periodKey])

  useEffect(() => {
    api.getAllMembers().then(setMembers).catch(console.error)
  }, [])

  useEffect(() => {
    if (!selectedTaskId || tasks.length === 0) {
      setHistoryOccurrences([])
      return
    }
    Promise.all(tasks.map(t => api.getTaskHistory(t.id)))
      .then(results => setHistoryOccurrences(results.flat()))
      .catch(console.error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTaskId])

  useEffect(() => {
    setComments([])
    if (!selectedOccurrence?.id) {
      setCommentsLoading(false)
      return
    }
    setCommentsLoading(true)
    api.getComments(selectedOccurrence.id)
      .then(setComments)
      .catch(console.error)
      .finally(() => setCommentsLoading(false))
  }, [selectedOccurrence?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function upsertOccurrence(updated: TaskOccurrence) {
    setOccurrenceMap(prev => ({ ...prev, [`${updated.taskId}-${updated.period}`]: updated }))
    setHistoryOccurrences(prev => {
      const exists = prev.some(o => o.id === updated.id)
      if (exists) return prev.map(o => (o.id === updated.id ? updated : o))
      return [...prev, updated]
    })
  }

  async function handleMarkDone(completedBy: string, completionNotes: string) {
    if (!selectedOccurrence?.id) return
    const updated = await api.updateOccurrence(selectedOccurrence.id, {
      status: 'done',
      completed_by: completedBy,
      completion_notes: completionNotes,
      completed_at: new Date().toISOString(),
    })
    upsertOccurrence(updated)
  }

  async function handleChangeStatus(status: 'pending' | 'in_progress' | 'skipped') {
    if (!selectedOccurrence?.id) return
    const updated = await api.updateOccurrence(selectedOccurrence.id, {
      status,
      completed_by: null,
      completion_notes: null,
      completed_at: null,
    })
    upsertOccurrence(updated)
  }

  async function handleAddComment(author: string, body: string) {
    if (!selectedOccurrence?.id) return
    const comment = await api.addComment(selectedOccurrence.id, author, body)
    setComments(prev => [...prev, comment])
  }

  function handleSelectTask(taskId: string) {
    setSelectedTaskId(prev => (prev === taskId ? null : taskId))
  }

  function handleRecurrenceChange(r: RecurrenceType) {
    setRecurrence(r)
    setSelectedTaskId(null)
  }

  return (
    <div className="flex gap-4 h-full min-h-0">
      {/* Left: list */}
      <div className="flex flex-col flex-1 min-w-0 bg-surface-1 rounded-xl overflow-hidden border border-hairline">
        <TasksHeader
          recurrence={recurrence}
          anchorDate={anchorDate}
          onRecurrenceChange={handleRecurrenceChange}
          onAnchorChange={setAnchorDate}
        />
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-sm text-ink-tertiary">
            Loading…
          </div>
        ) : (
          <TaskList
            tasks={tasks}
            recurrence={recurrence}
            anchorDate={anchorDate}
            occurrenceMap={occurrenceMap}
            selectedTaskId={selectedTaskId}
            onSelectTask={handleSelectTask}
          />
        )}
      </div>

      {/* Right: detail panel */}
      {selectedTask && selectedOccurrence && (
        <>
          <div
            className="fixed inset-0 bg-canvas/60 z-40 md:hidden"
            onClick={() => setSelectedTaskId(null)}
          />
          <div className="fixed inset-x-0 bottom-0 z-50 md:static md:z-auto md:flex-shrink-0">
            <TaskDetailPanel
              key={selectedTaskId}
              task={selectedTask}
              occurrence={selectedOccurrence}
              comments={comments}
              commentsLoading={commentsLoading}
              members={members}
              historyOccurrences={historyOccurrences}
              onClose={() => setSelectedTaskId(null)}
              onMarkDone={handleMarkDone}
              onChangeStatus={handleChangeStatus}
              onAddComment={handleAddComment}
              onNavigateToPeriod={setAnchorDate}
            />
          </div>
        </>
      )}
    </div>
  )
}
