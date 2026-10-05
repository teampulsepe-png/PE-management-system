import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Clock, Circle, AlertTriangle, ChevronRight, Activity, ExternalLink, TrendingUp } from 'lucide-react'
import { api } from '../api/teamPulseApi'
import { useAppContext } from '../context/AppContext'
import type { Task, TaskOccurrence, ActivityItem, RecurrenceType } from '../types'
import { getPeriodKey, getPeriodLabel, addPeriod } from '../utils/period'

function getDisplayName(email: string): string {
  return email
    .split('@')[0]
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'yesterday'
  return `${days}d ago`
}

const RECURRENCES: RecurrenceType[] = ['weekly', 'monthly', 'quarterly', 'annually']

const REC_LABELS: Record<RecurrenceType, string> = {
  weekly:    'Weekly',
  monthly:   'Monthly',
  quarterly: 'Quarterly',
  annually:  'Annual',
}

function calcPct(done: number, total: number): number {
  return total === 0 ? 0 : Math.round((done / total) * 100)
}

function occStatus(occs: TaskOccurrence[], taskId: string): string {
  return occs.find(o => o.taskId === taskId)?.status ?? 'pending'
}

const STATUS_DOT: Record<string, string> = {
  done:        'bg-success',
  in_progress: 'bg-primary',
  pending:     'bg-hairline-strong',
  skipped:     'bg-amber-500',
}

const STATUS_LABEL: Record<string, string> = {
  done:        'Done',
  in_progress: 'In Progress',
  pending:     'Pending',
  skipped:     'Skipped',
}

interface RingProps {
  done: number
  total: number
  stroke: string
  trackStroke: string
  label: string
  dotCls: string
}

function ProgressRing({ done, total, stroke, trackStroke, label, dotCls }: RingProps) {
  const p = calcPct(done, total)
  const r = 30
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - p / 100)

  return (
    <div className="flex flex-col items-center gap-2.5">
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={r} fill="none" stroke={trackStroke} strokeWidth="5" />
        <circle
          cx="40" cy="40" r={r}
          fill="none"
          stroke={stroke}
          strokeWidth="5"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 40 40)"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
        <text x="40" y="44" textAnchor="middle" fontSize="13" fontWeight="600" fill="#f7f8f8" fontFamily="Inter, sans-serif">
          {p}%
        </text>
      </svg>
      <div className="text-center">
        <div className="flex items-center justify-center gap-1.5 mb-0.5">
          <span className={`w-1.5 h-1.5 rounded-full ${dotCls}`} />
          <p className="text-[10px] font-semibold text-ink-tertiary uppercase" style={{ letterSpacing: '0.4px' }}>{label}</p>
        </div>
        <p className="text-[10px] text-ink-tertiary">{done} / {total} complete</p>
      </div>
    </div>
  )
}

function SkeletonDashboard() {
  return (
    <div className="space-y-5 max-w-5xl">
      <div className="bg-surface-1 rounded-xl border border-hairline px-5 py-4">
        <div className="skeleton h-3 w-40 mb-2" />
        <div className="skeleton h-5 w-56 mb-1.5" />
        <div className="skeleton h-3 w-24" />
      </div>
      <div>
        <div className="skeleton h-3 w-20 mb-3 rounded" />
        <div className="grid grid-cols-3 gap-3 md:gap-4">
          {[0, 1, 2].map(i => (
            <div key={i} className="bg-surface-1 rounded-xl border border-hairline px-4 py-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="skeleton w-7 h-7 rounded-lg" />
                <div className="skeleton h-3 w-16" />
              </div>
              <div className="skeleton h-7 w-10 mb-1" />
              <div className="skeleton h-2.5 w-20" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
        {[0, 1].map(i => (
          <div key={i} className="bg-surface-1 rounded-xl border border-hairline px-5 py-5">
            <div className="skeleton h-3 w-32 mb-4" />
            <div className="flex justify-around">
              <div className="skeleton w-20 h-20 rounded-full" />
              <div className="skeleton w-20 h-20 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { currentUser } = useAppContext()
  const navigate = useNavigate()
  const now = new Date()

  const name = currentUser
    ? (currentUser.name ?? getDisplayName(currentUser.email))
    : null

  const [loading, setLoading] = useState(true)
  const [tasksByRec, setTasksByRec] = useState<Record<RecurrenceType, Task[]>>({
    weekly: [], monthly: [], quarterly: [], annually: [],
  })
  const [occsByRec, setOccsByRec] = useState<Record<RecurrenceType, TaskOccurrence[]>>({
    weekly: [], monthly: [], quarterly: [], annually: [],
  })
  const [prevWeekOccs, setPrevWeekOccs] = useState<TaskOccurrence[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>([])

  useEffect(() => {
    const loadDate = new Date()
    async function load() {
      setLoading(true)
      try {
        const [wTasks, mTasks, qTasks, aTasks] = await Promise.all(
          RECURRENCES.map(r => api.getTasks(r))
        )
        setTasksByRec({ weekly: wTasks, monthly: mTasks, quarterly: qTasks, annually: aTasks })

        const prevWeek = addPeriod('weekly', loadDate, -1)

        const [wOccs, mOccs, qOccs, aOccs, prevWOccs, activityItems] = await Promise.all([
          wTasks.length ? api.getOccurrences(getPeriodKey('weekly',    loadDate), wTasks.map(t => t.id)) : Promise.resolve([]),
          mTasks.length ? api.getOccurrences(getPeriodKey('monthly',   loadDate), mTasks.map(t => t.id)) : Promise.resolve([]),
          qTasks.length ? api.getOccurrences(getPeriodKey('quarterly', loadDate), qTasks.map(t => t.id)) : Promise.resolve([]),
          aTasks.length ? api.getOccurrences(getPeriodKey('annually',  loadDate), aTasks.map(t => t.id)) : Promise.resolve([]),
          wTasks.length ? api.getOccurrences(getPeriodKey('weekly', prevWeek),    wTasks.map(t => t.id)) : Promise.resolve([]),
          api.getActivity(10),
        ])

        setOccsByRec({ weekly: wOccs, monthly: mOccs, quarterly: qOccs, annually: aOccs })
        setPrevWeekOccs(prevWOccs)
        setActivity(activityItems)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const wTasks = tasksByRec.weekly
  const wOccs  = occsByRec.weekly

  const doneCount       = wTasks.filter(t => occStatus(wOccs, t.id) === 'done').length
  const inProgressCount = wTasks.filter(t => occStatus(wOccs, t.id) === 'in_progress').length
  const pendingCount    = wTasks.filter(t => occStatus(wOccs, t.id) === 'pending').length

  const peTasks = wTasks.filter(t => t.team === 'pe')
  const soTasks = wTasks.filter(t => t.team === 'so')
  const peDone  = peTasks.filter(t => occStatus(wOccs, t.id) === 'done').length
  const soDone  = soTasks.filter(t => occStatus(wOccs, t.id) === 'done').length

  const overdueItems = wTasks.filter(t => {
    const s = occStatus(prevWeekOccs, t.id)
    return s !== 'done' && s !== 'skipped'
  })

  const myTasks = currentUser?.teamId
    ? wTasks.filter(t => t.team === currentUser.teamId)
    : []

  if (loading) return <SkeletonDashboard />

  const totalWeeklyPct = calcPct(doneCount, wTasks.length)

  return (
    <div className="space-y-5 max-w-5xl">

      {/* Welcome bar */}
      <div className="bg-surface-1 rounded-xl border border-hairline px-5 py-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] text-ink-tertiary mb-0.5">
            {now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
          <h2 className="text-sm font-semibold text-ink" style={{ letterSpacing: '-0.2px' }}>
            {name ? `Welcome back, ${name}` : 'Welcome back'}
          </h2>
          {currentUser?.teamId && (
            <p className="text-[11px] text-ink-tertiary mt-0.5">
              Team{' '}
              <span className="font-semibold text-primary-hover">{currentUser.teamId.toUpperCase()}</span>
            </p>
          )}
        </div>
        <div className="hidden sm:flex items-center gap-3 flex-shrink-0">
          <div className="text-right">
            <p className="text-[10px] text-ink-tertiary uppercase" style={{ letterSpacing: '0.4px' }}>Weekly</p>
            <p className="text-xl font-bold text-ink leading-none">{totalWeeklyPct}%</p>
          </div>
          <div className="w-px h-8 bg-hairline" />
          <div className="flex flex-col gap-1">
            <div className="w-24 h-1 bg-hairline-strong rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-700"
                style={{ width: `${totalWeeklyPct}%` }}
              />
            </div>
            <p className="text-[10px] text-ink-tertiary">{doneCount} of {wTasks.length} tasks</p>
          </div>
        </div>
      </div>

      {/* Quick link */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <a
          href="https://azure.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-3 bg-surface-1 rounded-xl border border-hairline px-4 py-3.5 hover:border-hairline-strong hover:bg-surface-2 transition-all"
        >
          <div className="w-8 h-8 rounded-lg bg-[#0078D4]/10 flex items-center justify-center flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" width="16" height="16">
              <defs>
                <linearGradient id="ado-grad" x1="9" y1="16.97" x2="9" y2="1.03" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#0078d4"/>
                  <stop offset="0.16" stopColor="#1380da"/>
                  <stop offset="0.53" stopColor="#3c91e5"/>
                  <stop offset="0.82" stopColor="#559cec"/>
                  <stop offset="1" stopColor="#5ea0ef"/>
                </linearGradient>
              </defs>
              <path d="M17,4v9.74l-4,3.28-6.2-2.26V17L3.29,12.41l10.23.8V4.44Zm-3.41.49L7.85,1V3.29L2.58,4.84,1,6.87v4.61l2.26,1V6.57Z" fill="url(#ado-grad)"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-ink-muted group-hover:text-ink transition-colors leading-tight">Azure DevOps</p>
            <p className="text-[10px] text-ink-tertiary truncate mt-0.5">Open team portal</p>
          </div>
          <ExternalLink size={12} className="text-ink-tertiary group-hover:text-ink-subtle transition-colors flex-shrink-0" />
        </a>
      </div>

      {/* This-week stat tiles */}
      <div>
        <p className="text-[10px] font-semibold text-ink-tertiary uppercase mb-2.5" style={{ letterSpacing: '0.4px' }}>This Week</p>
        <div className="grid grid-cols-3 gap-3 md:gap-4">

          <div className="bg-surface-1 rounded-xl border border-hairline px-4 py-4 hover:border-hairline-strong hover:bg-surface-2 transition-all">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-success/10 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 size={14} className="text-success" />
              </div>
              <p className="text-[10px] font-semibold text-ink-tertiary uppercase truncate" style={{ letterSpacing: '0.4px' }}>Done</p>
            </div>
            <p className="text-xl md:text-2xl font-bold text-ink leading-none mb-1">{doneCount}</p>
            <p className="text-[10px] text-ink-tertiary truncate">of {wTasks.length} tasks</p>
          </div>

          <div className="bg-surface-1 rounded-xl border border-hairline px-4 py-4 hover:border-hairline-strong hover:bg-surface-2 transition-all">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Clock size={14} className="text-primary-hover" />
              </div>
              <p className="text-[10px] font-semibold text-ink-tertiary uppercase truncate" style={{ letterSpacing: '0.4px' }}>In Progress</p>
            </div>
            <p className="text-xl md:text-2xl font-bold text-ink leading-none mb-1">{inProgressCount}</p>
            <p className="text-[10px] text-ink-tertiary truncate">tasks started</p>
          </div>

          <div className="bg-surface-1 rounded-xl border border-hairline px-4 py-4 hover:border-hairline-strong hover:bg-surface-2 transition-all">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-hairline-strong flex items-center justify-center flex-shrink-0">
                <Circle size={14} className="text-ink-tertiary" />
              </div>
              <p className="text-[10px] font-semibold text-ink-tertiary uppercase truncate" style={{ letterSpacing: '0.4px' }}>Pending</p>
            </div>
            <p className="text-xl md:text-2xl font-bold text-ink leading-none mb-1">{pendingCount}</p>
            <p className="text-[10px] text-ink-tertiary truncate">not started</p>
          </div>

        </div>
      </div>

      {/* Team rings + Overdue + My Tasks */}
      <div className={`grid gap-4 grid-cols-1 sm:grid-cols-2 ${myTasks.length > 0 ? 'lg:grid-cols-3' : ''}`}>

        {/* Team breakdown */}
        <div className="bg-surface-1 rounded-xl border border-hairline px-5 py-5">
          <p className="text-[10px] font-semibold text-ink-tertiary uppercase mb-5" style={{ letterSpacing: '0.4px' }}>
            Weekly Team Breakdown
          </p>
          <div className="flex items-center justify-around">
            <ProgressRing
              done={peDone} total={peTasks.length}
              stroke="#5e6ad2" trackStroke="#23252a"
              dotCls="bg-primary" label="PE"
            />
            <div className="w-px h-16 bg-hairline" />
            <ProgressRing
              done={soDone} total={soTasks.length}
              stroke="#a78bfa" trackStroke="#23252a"
              dotCls="bg-purple-500" label="SO"
            />
          </div>
        </div>

        {/* Last week unfinished */}
        <div className={`rounded-xl border px-5 py-5 ${
          overdueItems.length > 0
            ? 'bg-red-900/10 border-red-900/30'
            : 'bg-surface-1 border-hairline'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle
                size={13}
                className={overdueItems.length > 0 ? 'text-red-400' : 'text-ink-tertiary'}
              />
              <p className="text-[10px] font-semibold text-ink-tertiary uppercase" style={{ letterSpacing: '0.4px' }}>
                Last Week's Unfinished
              </p>
            </div>
            {overdueItems.length > 0 && (
              <span className="text-[10px] font-semibold bg-red-900/30 text-red-400 px-2 py-0.5 rounded-full">
                {overdueItems.length}
              </span>
            )}
          </div>
          {overdueItems.length === 0 ? (
            <p className="text-xs text-ink-tertiary">All tasks were completed last week.</p>
          ) : (
            <>
              <div className="flex gap-2 mb-3">
                {['pe', 'so'].map(team => {
                  const count = overdueItems.filter(t => t.team === team).length
                  if (count === 0) return null
                  return (
                    <span key={team} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      team === 'pe' ? 'bg-primary/10 text-primary-hover' : 'bg-purple-500/10 text-purple-400'
                    }`}>
                      {count} {team.toUpperCase()}
                    </span>
                  )
                })}
              </div>
              <ul className="space-y-2">
                {overdueItems.slice(0, 4).map(t => (
                  <li key={t.id} className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${t.team === 'pe' ? 'bg-primary' : 'bg-purple-500'}`} />
                    <span className="text-xs text-ink-subtle truncate">{t.title}</span>
                  </li>
                ))}
                {overdueItems.length > 4 && (
                  <li className="text-[10px] text-ink-tertiary pl-3.5">+{overdueItems.length - 4} more</li>
                )}
              </ul>
            </>
          )}
        </div>

        {/* My team tasks */}
        {myTasks.length > 0 && currentUser?.teamId && (
          <div className="bg-surface-1 rounded-xl border border-hairline px-5 py-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold text-ink-tertiary uppercase" style={{ letterSpacing: '0.4px' }}>
                {currentUser.teamId.toUpperCase()} Team · This Week
              </p>
              <span className="text-[10px] font-bold text-ink-muted bg-surface-3 px-2 py-0.5 rounded-full">
                {myTasks.filter(t => occStatus(wOccs, t.id) === 'done').length}/{myTasks.length}
              </span>
            </div>
            <div className="h-1 bg-hairline-strong rounded-full overflow-hidden mb-4">
              <div
                className="h-full bg-primary rounded-full transition-all duration-700"
                style={{ width: `${calcPct(myTasks.filter(t => occStatus(wOccs, t.id) === 'done').length, myTasks.length)}%` }}
              />
            </div>
            <ul className="space-y-2">
              {myTasks.slice(0, 5).map(t => {
                const s = occStatus(wOccs, t.id)
                return (
                  <li key={t.id} className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[s]}`} />
                    <span className="text-xs text-ink-subtle flex-1 truncate">{t.title}</span>
                    <span className="text-[10px] text-ink-tertiary flex-shrink-0">{STATUS_LABEL[s]}</span>
                  </li>
                )
              })}
            </ul>
            {myTasks.length > 5 && (
              <p className="text-[10px] text-ink-tertiary mt-2 pl-3.5">+{myTasks.length - 5} more</p>
            )}
          </div>
        )}
      </div>

      {/* Recent activity */}
      {activity.length > 0 && (
        <div className="bg-surface-1 rounded-xl border border-hairline px-5 py-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={13} className="text-primary" />
            <p className="text-[10px] font-semibold text-ink-tertiary uppercase" style={{ letterSpacing: '0.4px' }}>
              Recent Activity
            </p>
          </div>
          <ul className="space-y-3">
            {activity.map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <div className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 text-white text-[9px] font-bold ${
                  item.taskTeam === 'pe' ? 'bg-primary' : 'bg-purple-500'
                }`}>
                  {item.taskTeam.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-ink-subtle leading-snug">
                    <span className="font-medium text-ink-muted">{item.completedBy ?? 'Someone'}</span>
                    {' completed '}
                    <span className="font-medium text-ink-muted">{item.taskTitle}</span>
                  </p>
                  <p className="text-[10px] text-ink-tertiary mt-0.5">
                    {item.period} · {formatRelativeTime(item.completedAt)}
                  </p>
                </div>
                <span className="text-[10px] bg-success/10 text-success border border-success/20 px-1.5 py-0.5 rounded-md font-semibold flex-shrink-0">
                  Done
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Quick access */}
      <div>
        <p className="text-[10px] font-semibold text-ink-tertiary uppercase mb-2.5" style={{ letterSpacing: '0.4px' }}>Quick Access</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {RECURRENCES.map(r => {
            const rTasks = tasksByRec[r]
            const rOccs  = occsByRec[r]
            const rDone  = rTasks.filter(t => occStatus(rOccs, t.id) === 'done').length
            const rPct   = calcPct(rDone, rTasks.length)

            return (
              <button
                key={r}
                onClick={() => navigate(`/tasks?recurrence=${r}`)}
                className="bg-surface-1 rounded-xl border border-hairline px-4 py-4 text-left hover:border-hairline-strong hover:bg-surface-2 transition-all group"
              >
                <div className="flex items-center justify-between mb-2.5">
                  <p className="text-xs font-semibold text-ink-muted">{REC_LABELS[r]}</p>
                  <ChevronRight size={12} className="text-ink-tertiary group-hover:text-primary-hover transition-colors" />
                </div>
                <p className="text-[10px] text-ink-tertiary mb-3 truncate">{getPeriodLabel(r, now)}</p>
                <div className="h-1 bg-hairline-strong rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-700"
                    style={{ width: `${rPct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-ink-tertiary">
                    <span className="font-bold text-ink-muted">{rDone}</span> / {rTasks.length}
                  </p>
                  {rPct === 100 && (
                    <TrendingUp size={10} className="text-success" />
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
