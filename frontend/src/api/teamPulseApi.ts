import type { Task, TaskOccurrence, TaskComment, TeamMember, CurrentUser, ActivityItem, AppNotification, RecurrenceType, OccurrenceStatus, KpiEntry, KpiEvaluation, KpiEvaluationEntry, KpiPdca, Department, AiTool, AiSubscription, AiSubscriptionAddon, Project, ProjectItem, UserAccessLog, TrackerArea, TrackerGroup, TrackerTask, TrackerSubtask, SupervisorTask, SupervisorTaskSize, SupervisorTaskStatus, Role, MemberDetail, TeamWithMembers, TeamPermissions, CostEntry, CostSummary, LiveOpsBusinessUnit, LiveOpsTicketType, LiveOpsUseCase, LiveOpsApproverConfig, LiveOpsMemberRoleRecord, LiveOpsSlaConfig, LiveOpsAssignment, LiveOpsComment, LiveOpsEvent, LiveOpsTicketListItem, LiveOpsTicketDetail, LiveOpsAssignableMember, LiveOpsAnalyticsSummary } from '../types'

const BASE = '/api/v1'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, options)
  if (!res.ok) throw new Error(`API error ${res.status}`)
  if (res.status === 204) return undefined as T
  return res.json()
}

// Raw shapes from FastAPI (snake_case)

interface ApiUser {
  email: string
  name: string | null
  team_id: string | null
  member_id: string | null
  role: string | null
  head_team_ids: string[]
  head_team_names: string[]
  has_admin_access: boolean
}

interface ApiTeamMember {
  id: string
  team_id: string
  name: string
  email: string | null
}

interface ApiTask {
  id: string
  title: string
  description: string | null
  recurrence: RecurrenceType
  team_id: string
  is_active: boolean
}

interface ApiOccurrence {
  id: string
  task_id: string
  period: string
  status: OccurrenceStatus
  completed_by: string | null
  completion_notes: string | null
  completed_at: string | null
}

interface ApiComment {
  id: string
  occurrence_id: string
  author: string
  body: string
  created_at: string
}

// Mappers

function mapTeamMember(m: ApiTeamMember): TeamMember {
  return { id: m.id, teamId: m.team_id, name: m.name, email: m.email ?? undefined }
}

function mapTask(t: ApiTask): Task {
  return {
    id: t.id,
    title: t.title,
    description: t.description ?? '',
    recurrence: t.recurrence,
    team: t.team_id as Task['team'],
  }
}

function mapOccurrence(o: ApiOccurrence): TaskOccurrence {
  return {
    id: o.id,
    taskId: o.task_id,
    period: o.period,
    status: o.status,
    completedBy: o.completed_by ?? '',
    completionNotes: o.completion_notes ?? '',
    completedAt: o.completed_at ?? undefined,
    comments: [],
  }
}

function mapComment(c: ApiComment): TaskComment {
  return {
    id: c.id,
    author: c.author,
    body: c.body,
    createdAt: c.created_at,
  }
}

// Project raw shapes

interface ApiProjectItem {
  id: string; project_id: string; phase: string; item_key: string; sort_order: number
  owner_id: string | null; owner_name: string; deadline: string | null
  deliverable: string | null; status: string; completed_at: string | null
}

interface ApiAccessLog {
  id: string; project_id: string; member_id: string; member_name: string
  action: string; actioned_by_id: string | null; actioned_by_name: string
  notes: string | null; actioned_at: string; created_at: string
}

interface ApiProject {
  id: string; name: string; description: string | null; status: string
  owner_id: string | null; owner_name: string; created_at: string
  items: ApiProjectItem[]; access_logs: ApiAccessLog[]; progress: number
}

function mapProjectItem(i: ApiProjectItem): ProjectItem {
  return {
    id: i.id, projectId: i.project_id, phase: i.phase, itemKey: i.item_key,
    sortOrder: i.sort_order, ownerId: i.owner_id, ownerName: i.owner_name,
    deadline: i.deadline, deliverable: i.deliverable,
    status: i.status as ProjectItem['status'], completedAt: i.completed_at,
  }
}

function mapAccessLog(l: ApiAccessLog): UserAccessLog {
  return {
    id: l.id, projectId: l.project_id, memberId: l.member_id, memberName: l.member_name,
    action: l.action as UserAccessLog['action'], actionedById: l.actioned_by_id,
    actionedByName: l.actioned_by_name, notes: l.notes, actionedAt: l.actioned_at,
    createdAt: l.created_at,
  }
}

function mapProject(p: ApiProject): Project {
  return {
    id: p.id, name: p.name, description: p.description,
    status: p.status as Project['status'], ownerId: p.owner_id, ownerName: p.owner_name,
    createdAt: p.created_at, items: p.items.map(mapProjectItem),
    accessLogs: p.access_logs.map(mapAccessLog), progress: p.progress,
  }
}

// Tracker raw shapes

interface ApiTrackerSubtask { id: string; task_id: string; title: string; date: string | null; remarks: string | null; is_done: boolean; sort_order: number }
interface ApiTrackerTask { id: string; group_id: string; title: string; owner: string | null; planned_end_date: string | null; sort_order: number; subtasks: ApiTrackerSubtask[] }
interface ApiTrackerGroup { id: string; area_id: string; name: string; sort_order: number; tasks: ApiTrackerTask[] }
interface ApiTrackerArea { id: string; name: string; sort_order: number; groups: ApiTrackerGroup[] }

function mapTrackerSubtask(s: ApiTrackerSubtask): TrackerSubtask {
  return { id: s.id, taskId: s.task_id, title: s.title, date: s.date, remarks: s.remarks, isDone: s.is_done, sortOrder: s.sort_order }
}
function mapTrackerTask(t: ApiTrackerTask): TrackerTask {
  return { id: t.id, groupId: t.group_id, title: t.title, owner: t.owner, plannedEndDate: t.planned_end_date, sortOrder: t.sort_order, subtasks: t.subtasks.map(mapTrackerSubtask) }
}
function mapTrackerGroup(g: ApiTrackerGroup): TrackerGroup {
  return { id: g.id, areaId: g.area_id, name: g.name, sortOrder: g.sort_order, tasks: g.tasks.map(mapTrackerTask) }
}
function mapTrackerArea(a: ApiTrackerArea): TrackerArea {
  return { id: a.id, name: a.name, sortOrder: a.sort_order, groups: a.groups.map(mapTrackerGroup) }
}

// Workload raw shapes

interface ApiSupervisorTaskAssignee { member_id: string; member_name: string }
interface ApiSupervisorTask {
  id: string; title: string; description: string | null
  size: string; status: string; start_date: string; due_date: string
  created_by: string | null; created_at: string
  assignees: ApiSupervisorTaskAssignee[]; is_overdue: boolean
}

function mapSupervisorTask(t: ApiSupervisorTask): SupervisorTask {
  return {
    id: t.id, title: t.title, description: t.description,
    size: t.size as SupervisorTaskSize, status: t.status as SupervisorTaskStatus,
    startDate: t.start_date, dueDate: t.due_date,
    createdBy: t.created_by, createdAt: t.created_at,
    assignees: t.assignees.map(a => ({ memberId: a.member_id, memberName: a.member_name })),
    isOverdue: t.is_overdue,
  }
}

// API

export const api = {
  health: () => request<{ status: string }>('/health'),

  getUser: async (): Promise<CurrentUser> => {
    const data = await request<ApiUser>('/user')
    return {
      email: data.email,
      name: data.name,
      teamId: data.team_id,
      memberId: data.member_id,
      role: data.role,
      headTeamIds: data.head_team_ids ?? [],
      headTeamNames: data.head_team_names ?? [],
      hasAdminAccess: data.has_admin_access ?? false,
    }
  },

  getTasks: async (recurrence: RecurrenceType): Promise<Task[]> => {
    const data = await request<ApiTask[]>(`/tasks?recurrence=${recurrence}`)
    return data.map(mapTask)
  },

  getOccurrences: async (period: string, taskIds: string[]): Promise<TaskOccurrence[]> => {
    const ids = taskIds.join(',')
    const data = await request<ApiOccurrence[]>(
      `/occurrences?period=${encodeURIComponent(period)}&task_ids=${ids}`
    )
    return data.map(mapOccurrence)
  },

  getTaskHistory: async (taskId: string): Promise<TaskOccurrence[]> => {
    const data = await request<ApiOccurrence[]>(`/tasks/${taskId}/occurrences`)
    return data.map(mapOccurrence)
  },

  updateOccurrence: async (
    occurrenceId: string,
    patch: Partial<{
      status: string
      completed_by: string | null
      completion_notes: string | null
      completed_at: string | null
    }>
  ): Promise<TaskOccurrence> => {
    const data = await request<ApiOccurrence>(`/occurrences/${occurrenceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    return mapOccurrence(data)
  },

  getComments: async (occurrenceId: string): Promise<TaskComment[]> => {
    const data = await request<ApiComment[]>(`/occurrences/${occurrenceId}/comments`)
    return data.map(mapComment)
  },

  getAllMembers: async (): Promise<TeamMember[]> => {
    const data = await request<ApiTeamMember[]>('/members')
    return data.map(mapTeamMember)
  },

  getTeamMembers: async (teamId: string): Promise<TeamMember[]> => {
    const data = await request<ApiTeamMember[]>(`/teams/${teamId}/members`)
    return data.map(mapTeamMember)
  },

  getActivity: async (limit = 10): Promise<ActivityItem[]> => {
    interface ApiActivityItem {
      task_title: string
      task_team: string
      completed_by: string | null
      completed_at: string
      period: string
    }
    const data = await request<ApiActivityItem[]>(`/activity?limit=${limit}`)
    return data.map(a => ({
      taskTitle: a.task_title,
      taskTeam: a.task_team,
      completedBy: a.completed_by,
      completedAt: a.completed_at,
      period: a.period,
    }))
  },

  getNotifications: async (): Promise<AppNotification[]> => {
    interface ApiNotif {
      id: string; type: string; task_id: string | null; task_recurrence: string | null
      occurrence_id: string | null; triggered_by_name: string | null
      message: string; is_read: boolean; created_at: string
    }
    const data = await request<ApiNotif[]>('/notifications')
    return data.map(n => ({
      id: n.id, type: n.type, taskId: n.task_id, taskRecurrence: n.task_recurrence,
      occurrenceId: n.occurrence_id, triggeredByName: n.triggered_by_name,
      message: n.message, isRead: n.is_read, createdAt: n.created_at,
    }))
  },

  markNotificationsRead: async (): Promise<void> => {
    await request('/notifications/read', { method: 'PATCH' })
  },

  getKpiEntries: async (year?: number, category?: string): Promise<KpiEntry[]> => {
    const params = new URLSearchParams()
    if (year !== undefined) params.set('year', String(year))
    if (category) params.set('category', category)
    const qs = params.toString()
    interface ApiEntry { id: string; done_at: string }
    interface ApiKpiEvaluation { id: string; period_label: string; period_order: number; actual: number | null; completed_at: string | null; entries: ApiEntry[] }
    interface ApiKpi {
      id: string; category: string; year: number; metric_name: string
      pdca: string; frequency: string
      kpi_owner_id: string | null; kpi_owner: string
      responsible_party_id: string | null; responsible_party: string
      planned: number; target: number; remarks: string | null
      status: string; overall_percentage: number | null
      evaluations: ApiKpiEvaluation[]
    }
    const mapEval = (e: ApiKpiEvaluation): KpiEvaluation => ({
      id: e.id, periodLabel: e.period_label, periodOrder: e.period_order,
      actual: e.actual, completedAt: e.completed_at,
      entries: e.entries.map((x): KpiEvaluationEntry => ({ id: x.id, doneAt: x.done_at })),
    })
    const data = await request<ApiKpi[]>(`/kpi${qs ? `?${qs}` : ''}`)
    return data.map(k => ({
      id: k.id, category: k.category, year: k.year,
      metricName: k.metric_name, pdca: k.pdca as KpiPdca,
      frequency: k.frequency as KpiEntry['frequency'],
      kpiOwnerId: k.kpi_owner_id, kpiOwner: k.kpi_owner,
      responsiblePartyId: k.responsible_party_id, responsibleParty: k.responsible_party,
      planned: k.planned, target: k.target, remarks: k.remarks,
      status: k.status as KpiEntry['status'],
      overallPercentage: k.overall_percentage,
      evaluations: k.evaluations.map(mapEval),
    }))
  },

  updateKpiMetric: async (
    metricId: string,
    data: { responsible_party?: string; remarks?: string | null }
  ): Promise<KpiEntry> => {
    interface ApiEntry { id: string; done_at: string }
    interface ApiKpiEvaluation { id: string; period_label: string; period_order: number; actual: number | null; completed_at: string | null; entries: ApiEntry[] }
    interface ApiKpi {
      id: string; category: string; year: number; metric_name: string
      pdca: string; frequency: string
      kpi_owner_id: string | null; kpi_owner: string
      responsible_party_id: string | null; responsible_party: string
      planned: number; target: number; remarks: string | null
      status: string; overall_percentage: number | null
      evaluations: ApiKpiEvaluation[]
    }
    const k = await request<ApiKpi>(`/kpi/${metricId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    })
    return {
      id: k.id, category: k.category, year: k.year,
      metricName: k.metric_name, pdca: k.pdca as KpiPdca,
      frequency: k.frequency as KpiEntry['frequency'],
      kpiOwnerId: k.kpi_owner_id, kpiOwner: k.kpi_owner,
      responsiblePartyId: k.responsible_party_id, responsibleParty: k.responsible_party,
      planned: k.planned, target: k.target, remarks: k.remarks,
      status: k.status as KpiEntry['status'],
      overallPercentage: k.overall_percentage,
      evaluations: k.evaluations.map(e => ({
        id: e.id, periodLabel: e.period_label, periodOrder: e.period_order,
        actual: e.actual, completedAt: e.completed_at,
        entries: e.entries.map(x => ({ id: x.id, doneAt: x.done_at })),
      })),
    }
  },

  addKpiEvaluationEntry: async (evaluationId: string, doneAt: string): Promise<KpiEvaluation> => {
    interface ApiEntry { id: string; done_at: string }
    const e = await request<{ id: string; period_label: string; period_order: number; actual: number | null; completed_at: string | null; entries: ApiEntry[] }>(
      `/kpi/evaluations/${evaluationId}/entries`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ done_at: doneAt }) }
    )
    return {
      id: e.id, periodLabel: e.period_label, periodOrder: e.period_order,
      actual: e.actual, completedAt: e.completed_at,
      entries: e.entries.map(x => ({ id: x.id, doneAt: x.done_at })),
    }
  },

  getDepartments: async (): Promise<Department[]> => {
    const data = await request<{ id: string; name: string }[]>('/departments')
    return data.map(d => ({ id: d.id, name: d.name }))
  },

  getAiTools: async (): Promise<AiTool[]> => {
    const data = await request<{ id: string; name: string; tier: string | null; monthly_cost: number; display_name: string }[]>('/ai-tools')
    return data.map(t => ({ id: t.id, name: t.name, tier: t.tier, displayName: t.display_name, monthlyCost: t.monthly_cost }))
  },

  getAiSubscriptions: async (): Promise<AiSubscription[]> => {
    interface ApiAddon { id: string; credits: number; start_date: string; end_date: string; remarks: string | null; created_at: string }
    interface ApiSub {
      id: string; subscriber_name: string; email: string
      department_id: string; department_name: string
      tool_id: string; tool_display_name: string; monthly_cost: number
      start_date: string; end_date: string | null; remarks: string | null; created_at: string
      addons: ApiAddon[]; total_addon_credits: number; is_active: boolean
    }
    const data = await request<ApiSub[]>('/ai-subscriptions')
    const mapAddon = (a: ApiAddon): AiSubscriptionAddon => ({
      id: a.id, credits: a.credits, addonDate: a.addon_date,
      remarks: a.remarks, createdAt: a.created_at,
    })
    return data.map(s => ({
      id: s.id, subscriberName: s.subscriber_name, email: s.email,
      departmentId: s.department_id, departmentName: s.department_name,
      toolId: s.tool_id, toolDisplayName: s.tool_display_name, monthlyCost: s.monthly_cost,
      startDate: s.start_date, endDate: s.end_date, remarks: s.remarks, createdAt: s.created_at,
      addons: s.addons.map(mapAddon), totalAddonCredits: s.total_addon_credits, isActive: s.is_active,
    }))
  },

  createAiSubscription: async (body: {
    subscriber_name: string; email: string; department_id: string; tool_id: string
    start_date: string; end_date?: string | null; remarks?: string | null
  }): Promise<AiSubscription> => {
    interface ApiAddon { id: string; credits: number; start_date: string; end_date: string; remarks: string | null; created_at: string }
    interface ApiSub {
      id: string; subscriber_name: string; email: string
      department_id: string; department_name: string
      tool_id: string; tool_display_name: string; monthly_cost: number
      start_date: string; end_date: string | null; remarks: string | null; created_at: string
      addons: ApiAddon[]; total_addon_credits: number; is_active: boolean
    }
    const s = await request<ApiSub>('/ai-subscriptions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    return {
      id: s.id, subscriberName: s.subscriber_name, email: s.email,
      departmentId: s.department_id, departmentName: s.department_name,
      toolId: s.tool_id, toolDisplayName: s.tool_display_name, monthlyCost: s.monthly_cost,
      startDate: s.start_date, endDate: s.end_date, remarks: s.remarks, createdAt: s.created_at,
      addons: s.addons.map(a => ({ id: a.id, credits: a.credits, startDate: a.start_date, endDate: a.end_date, remarks: a.remarks, createdAt: a.created_at })),
      totalAddonCredits: s.total_addon_credits, isActive: s.is_active,
    }
  },

  updateAiSubscription: async (subId: string, body: Partial<{
    subscriber_name: string; email: string; department_id: string; tool_id: string
    start_date: string; end_date: string | null; remarks: string | null
  }>): Promise<AiSubscription> => {
    interface ApiAddon { id: string; credits: number; start_date: string; end_date: string; remarks: string | null; created_at: string }
    interface ApiSub {
      id: string; subscriber_name: string; email: string
      department_id: string; department_name: string
      tool_id: string; tool_display_name: string; monthly_cost: number
      start_date: string; end_date: string | null; remarks: string | null; created_at: string
      addons: ApiAddon[]; total_addon_credits: number; is_active: boolean
    }
    const s = await request<ApiSub>(`/ai-subscriptions/${subId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    return {
      id: s.id, subscriberName: s.subscriber_name, email: s.email,
      departmentId: s.department_id, departmentName: s.department_name,
      toolId: s.tool_id, toolDisplayName: s.tool_display_name, monthlyCost: s.monthly_cost,
      startDate: s.start_date, endDate: s.end_date, remarks: s.remarks, createdAt: s.created_at,
      addons: s.addons.map(a => ({ id: a.id, credits: a.credits, startDate: a.start_date, endDate: a.end_date, remarks: a.remarks, createdAt: a.created_at })),
      totalAddonCredits: s.total_addon_credits, isActive: s.is_active,
    }
  },

  deleteAiSubscription: async (subId: string): Promise<void> => {
    await request(`/ai-subscriptions/${subId}`, { method: 'DELETE' })
  },

  addAiSubscriptionAddon: async (subId: string, body: { credits: number; start_date: string; remarks?: string | null }): Promise<AiSubscription> => {
    interface ApiAddon { id: string; credits: number; start_date: string; end_date: string; remarks: string | null; created_at: string }
    interface ApiSub {
      id: string; subscriber_name: string; email: string
      department_id: string; department_name: string
      tool_id: string; tool_display_name: string; monthly_cost: number
      start_date: string; end_date: string | null; remarks: string | null; created_at: string
      addons: ApiAddon[]; total_addon_credits: number; is_active: boolean
    }
    const s = await request<ApiSub>(`/ai-subscriptions/${subId}/addons`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    return {
      id: s.id, subscriberName: s.subscriber_name, email: s.email,
      departmentId: s.department_id, departmentName: s.department_name,
      toolId: s.tool_id, toolDisplayName: s.tool_display_name, monthlyCost: s.monthly_cost,
      startDate: s.start_date, endDate: s.end_date, remarks: s.remarks, createdAt: s.created_at,
      addons: s.addons.map(a => ({ id: a.id, credits: a.credits, startDate: a.start_date, endDate: a.end_date, remarks: a.remarks, createdAt: a.created_at })),
      totalAddonCredits: s.total_addon_credits, isActive: s.is_active,
    }
  },

  deleteAiSubscriptionAddon: async (addonId: string): Promise<void> => {
    await request(`/ai-subscriptions/addons/${addonId}`, { method: 'DELETE' })
  },

  deleteKpiEvaluationEntry: async (entryId: string): Promise<void> => {
    await request(`/kpi/evaluations/entries/${entryId}`, { method: 'DELETE' })
  },

  // ── Projects ────────────────────────────────────────────────────────────────

  getProjects: async (): Promise<Project[]> => {
    const data = await request<ApiProject[]>('/projects')
    return data.map(mapProject)
  },

  createProject: async (body: { name: string; description?: string | null; owner_id?: string | null }): Promise<Project> => {
    const data = await request<ApiProject>('/projects', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    return mapProject(data)
  },

  updateProject: async (id: string, body: { name?: string; description?: string | null; status?: string; owner_id?: string | null }): Promise<Project> => {
    const data = await request<ApiProject>(`/projects/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    return mapProject(data)
  },

  deleteProject: async (id: string): Promise<void> => {
    await request(`/projects/${id}`, { method: 'DELETE' })
  },

  updateProjectItem: async (projectId: string, itemId: string, body: { owner_id?: string | null; deadline?: string | null; deliverable?: string | null; status?: string }): Promise<Project> => {
    const data = await request<ApiProject>(`/projects/${projectId}/items/${itemId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    return mapProject(data)
  },

  addAccessLog: async (projectId: string, body: { member_id: string; action: string; actioned_by_id?: string | null; notes?: string | null; actioned_at: string }): Promise<UserAccessLog> => {
    const data = await request<ApiAccessLog>(`/projects/${projectId}/access-logs`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    return mapAccessLog(data)
  },

  deleteAccessLog: async (projectId: string, logId: string): Promise<void> => {
    await request(`/projects/${projectId}/access-logs/${logId}`, { method: 'DELETE' })
  },

  addComment: async (occurrenceId: string, author: string, body: string): Promise<TaskComment> => {
    const data = await request<ApiComment>(`/occurrences/${occurrenceId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author, body }),
    })
    return mapComment(data)
  },

  // ── Tracker Board ────────────────────────────────────────────────────────────

  getTrackerAreas: async (): Promise<TrackerArea[]> => {
    const data = await request<ApiTrackerArea[]>('/tracker')
    return data.map(mapTrackerArea)
  },

  createTrackerArea: async (name: string): Promise<TrackerArea[]> => {
    const data = await request<ApiTrackerArea[]>('/tracker/areas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
    return data.map(mapTrackerArea)
  },

  deleteTrackerArea: async (id: string): Promise<void> => {
    await request(`/tracker/areas/${id}`, { method: 'DELETE' })
  },

  createTrackerGroup: async (areaId: string, name: string): Promise<TrackerArea[]> => {
    const data = await request<ApiTrackerArea[]>(`/tracker/areas/${areaId}/groups`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
    return data.map(mapTrackerArea)
  },

  deleteTrackerGroup: async (id: string): Promise<void> => {
    await request(`/tracker/groups/${id}`, { method: 'DELETE' })
  },

  createTrackerTask: async (groupId: string, body: { title: string; owner?: string | null; planned_end_date?: string | null }): Promise<TrackerArea[]> => {
    const data = await request<ApiTrackerArea[]>(`/tracker/groups/${groupId}/tasks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    return data.map(mapTrackerArea)
  },

  updateTrackerTask: async (taskId: string, body: { title?: string; owner?: string | null; planned_end_date?: string | null }): Promise<TrackerArea[]> => {
    const data = await request<ApiTrackerArea[]>(`/tracker/tasks/${taskId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    return data.map(mapTrackerArea)
  },

  deleteTrackerTask: async (id: string): Promise<void> => {
    await request(`/tracker/tasks/${id}`, { method: 'DELETE' })
  },

  createTrackerSubtask: async (taskId: string, body: { title: string; date?: string | null; remarks?: string | null }): Promise<TrackerArea[]> => {
    const data = await request<ApiTrackerArea[]>(`/tracker/tasks/${taskId}/subtasks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    return data.map(mapTrackerArea)
  },

  updateTrackerSubtask: async (subtaskId: string, body: { title?: string; date?: string | null; remarks?: string | null; is_done?: boolean }): Promise<TrackerArea[]> => {
    const data = await request<ApiTrackerArea[]>(`/tracker/subtasks/${subtaskId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    return data.map(mapTrackerArea)
  },

  deleteTrackerSubtask: async (id: string): Promise<void> => {
    await request(`/tracker/subtasks/${id}`, { method: 'DELETE' })
  },

  // ── Workload ─────────────────────────────────────────────────────────────────

  getWorkloadTasks: async (): Promise<SupervisorTask[]> => {
    const data = await request<ApiSupervisorTask[]>('/workload/tasks')
    return data.map(mapSupervisorTask)
  },

  createWorkloadTask: async (body: {
    title: string; description?: string | null; size: string
    start_date: string; due_date: string; assignee_ids: string[]; created_by?: string | null
  }): Promise<SupervisorTask> => {
    const data = await request<ApiSupervisorTask>('/workload/tasks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    return mapSupervisorTask(data)
  },

  updateWorkloadTaskStatus: async (id: string, status: string): Promise<SupervisorTask> => {
    const data = await request<ApiSupervisorTask>(`/workload/tasks/${id}/status`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    })
    return mapSupervisorTask(data)
  },

  updateWorkloadTask: async (id: string, body: Partial<{
    title: string; description: string | null; size: string
    due_date: string; status: string; assignee_ids: string[]
  }>): Promise<SupervisorTask> => {
    const data = await request<ApiSupervisorTask>(`/workload/tasks/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    return mapSupervisorTask(data)
  },

  deleteWorkloadTask: async (id: string): Promise<void> => {
    await request(`/workload/tasks/${id}`, { method: 'DELETE' })
  },

  // ── Settings (admin-only) ─────────────────────────────────────────────────

  settings: {
    getRoles: async (): Promise<Role[]> => {
      const data = await request<{ id: string; name: string }[]>('/settings/roles')
      return data.map(r => ({ id: r.id, name: r.name }))
    },

    getTeams: async (): Promise<TeamWithMembers[]> => {
      interface ApiMemberDetail {
        id: string; name: string; email: string | null
        team_id: string | null; team_name: string | null
        role_id: string | null; role_name: string | null
        head_team_ids: string[]; head_team_names: string[]
        has_admin_access: boolean
      }
      interface ApiTeamWithMembers {
        id: string; name: string; member_count: number; members: ApiMemberDetail[]
      }
      const data = await request<ApiTeamWithMembers[]>('/settings/teams')
      return data.map(t => ({
        id: t.id, name: t.name, memberCount: t.member_count,
        members: t.members.map(m => ({
          id: m.id, name: m.name, email: m.email,
          teamId: m.team_id, teamName: m.team_name,
          roleId: m.role_id, roleName: m.role_name,
          headTeamIds: m.head_team_ids, headTeamNames: m.head_team_names,
          hasAdminAccess: m.has_admin_access ?? false,
        })),
      }))
    },

    createTeam: async (name: string): Promise<{ id: string; name: string }> => {
      return request('/settings/teams', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
    },

    updateTeam: async (id: string, name: string): Promise<{ id: string; name: string }> => {
      return request(`/settings/teams/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
    },

    deleteTeam: async (id: string): Promise<void> => {
      await request(`/settings/teams/${id}`, { method: 'DELETE' })
    },

    getMembers: async (): Promise<MemberDetail[]> => {
      interface ApiMemberDetail {
        id: string; name: string; email: string | null
        team_id: string | null; team_name: string | null
        role_id: string | null; role_name: string | null
        head_team_ids: string[]; head_team_names: string[]
        has_admin_access: boolean
      }
      const data = await request<ApiMemberDetail[]>('/settings/members')
      return data.map(m => ({
        id: m.id, name: m.name, email: m.email,
        teamId: m.team_id, teamName: m.team_name,
        roleId: m.role_id, roleName: m.role_name,
        headTeamIds: m.head_team_ids, headTeamNames: m.head_team_names,
        hasAdminAccess: m.has_admin_access ?? false,
      }))
    },

    createMember: async (body: {
      name: string; email?: string | null; role_name: string
      team_id?: string | null; head_team_ids?: string[]
    }): Promise<MemberDetail> => {
      interface ApiMemberDetail {
        id: string; name: string; email: string | null
        team_id: string | null; team_name: string | null
        role_id: string | null; role_name: string | null
        head_team_ids: string[]; head_team_names: string[]
        has_admin_access: boolean
      }
      const m = await request<ApiMemberDetail>('/settings/members', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      return {
        id: m.id, name: m.name, email: m.email,
        teamId: m.team_id, teamName: m.team_name,
        roleId: m.role_id, roleName: m.role_name,
        headTeamIds: m.head_team_ids, headTeamNames: m.head_team_names,
        hasAdminAccess: m.has_admin_access ?? false,
      }
    },

    updateMember: async (id: string, body: {
      name?: string; email?: string | null; role_name?: string
      team_id?: string | null; head_team_ids?: string[]
      has_admin_access?: boolean; unassign_team?: boolean
    }): Promise<MemberDetail> => {
      interface ApiMemberDetail {
        id: string; name: string; email: string | null
        team_id: string | null; team_name: string | null
        role_id: string | null; role_name: string | null
        head_team_ids: string[]; head_team_names: string[]
        has_admin_access: boolean
      }
      const m = await request<ApiMemberDetail>(`/settings/members/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      return {
        id: m.id, name: m.name, email: m.email,
        teamId: m.team_id, teamName: m.team_name,
        roleId: m.role_id, roleName: m.role_name,
        headTeamIds: m.head_team_ids, headTeamNames: m.head_team_names,
        hasAdminAccess: m.has_admin_access ?? false,
      }
    },

    deleteMember: async (id: string): Promise<void> => {
      await request(`/settings/members/${id}`, { method: 'DELETE' })
    },

    getTeamPermissions: async (teamId: string): Promise<TeamPermissions> => {
      interface ApiPerms {
        team_id: string; tasks: boolean; kpi: boolean; workload: boolean; pipelines: boolean
        ai_subscriptions: boolean; project_lifecycle: boolean; tracker: boolean; cost: boolean
        liveops: boolean; devops: boolean; agent: boolean
      }
      const d = await request<ApiPerms>(`/settings/teams/${teamId}/permissions`)
      return {
        teamId: d.team_id, tasks: d.tasks, kpi: d.kpi, workload: d.workload,
        pipelines: d.pipelines, aiSubscriptions: d.ai_subscriptions,
        projectLifecycle: d.project_lifecycle, tracker: d.tracker, cost: d.cost,
        liveops: d.liveops, devops: d.devops, agent: d.agent,
      }
    },

    updateTeamPermission: async (teamId: string, feature: string, enabled: boolean): Promise<TeamPermissions> => {
      interface ApiPerms {
        team_id: string; tasks: boolean; kpi: boolean; workload: boolean; pipelines: boolean
        ai_subscriptions: boolean; project_lifecycle: boolean; tracker: boolean; cost: boolean
        liveops: boolean; devops: boolean; agent: boolean
      }
      const d = await request<ApiPerms>(`/settings/teams/${teamId}/permissions`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature, enabled }),
      })
      return {
        teamId: d.team_id, tasks: d.tasks, kpi: d.kpi, workload: d.workload,
        pipelines: d.pipelines, aiSubscriptions: d.ai_subscriptions,
        projectLifecycle: d.project_lifecycle, tracker: d.tracker, cost: d.cost,
        liveops: d.liveops, devops: d.devops, agent: d.agent,
      }
    },
  },

  // ── Cost ─────────────────────────────────────────────────────────────────────

  getCostSummary: async (months = 6): Promise<CostSummary> => {
    interface ApiEntry { id: string; category: string; service_name: string; service_description: string | null; month: string; amount_cents: number; created_at: string; updated_at: string }
    interface ApiTotal { database: number; compute: number; agent: number; total: number }
    interface ApiHistory { month: string; database: number; compute: number; agent: number }
    interface ApiSummary { current_month: string; current: ApiTotal; previous: ApiTotal | null; history: ApiHistory[]; entries: ApiEntry[] }
    const d = await request<ApiSummary>(`/cost/summary?months=${months}`)
    const mapEntry = (e: ApiEntry): CostEntry => ({
      id: e.id, category: e.category as CostEntry['category'],
      serviceName: e.service_name, serviceDescription: e.service_description,
      month: e.month, amountCents: e.amount_cents, createdAt: e.created_at, updatedAt: e.updated_at,
    })
    const mapTotal = (t: ApiTotal) => ({ database: t.database, compute: t.compute, agent: t.agent, total: t.total })
    return {
      currentMonth: d.current_month,
      current: mapTotal(d.current),
      previous: d.previous ? mapTotal(d.previous) : null,
      history: d.history.map(h => ({ month: h.month, database: h.database, compute: h.compute, agent: h.agent })),
      entries: d.entries.map(mapEntry),
    }
  },

  createCostEntry: async (body: { category: string; service_name: string; service_description?: string | null; month: string; amount_cents: number }): Promise<CostEntry> => {
    interface ApiEntry { id: string; category: string; service_name: string; service_description: string | null; month: string; amount_cents: number; created_at: string; updated_at: string }
    const e = await request<ApiEntry>('/cost/entries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    return { id: e.id, category: e.category as CostEntry['category'], serviceName: e.service_name, serviceDescription: e.service_description, month: e.month, amountCents: e.amount_cents, createdAt: e.created_at, updatedAt: e.updated_at }
  },

  deleteCostEntry: async (id: string): Promise<void> => {
    await request(`/cost/entries/${id}`, { method: 'DELETE' })
  },

  // ── LiveOps ───────────────────────────────────────────────────────────────────

  liveops: {
    // ── helpers ───────────────────────────────────────────────────────────────

    _mapTicket(t: Record<string, unknown>): LiveOpsTicketListItem {
      return {
        id: t.id as string, ticketNumber: t.ticket_number as number,
        ticketTypeId: (t.ticket_type_id as string) ?? '', ticketTypeName: (t.ticket_type_name as string) ?? '',
        useCaseId: (t.use_case_id as string) ?? '', useCaseName: (t.use_case_name as string) ?? '',
        businessUnitId: (t.business_unit_id as string) ?? '', businessUnitName: (t.business_unit_name as string) ?? '',
        urgency: t.urgency as LiveOpsTicketListItem['urgency'],
        submittedById: (t.submitted_by_id as string) ?? '', submittedByName: (t.submitted_by_name as string) ?? '',
        submittedAt: t.submitted_at as string | null, slaDeadline: t.sla_deadline as string | null,
        workstreamLeadId: t.workstream_lead_id as string | null, workstreamLeadName: (t.workstream_lead_name as string) ?? '',
        teamLeadId: t.team_lead_id as string | null, teamLeadName: (t.team_lead_name as string) ?? '',
        currentlyWithId: t.currently_with_id as string | null, currentlyWithName: (t.currently_with_name as string) ?? '',
        status: t.status as LiveOpsTicketListItem['status'],
        wlStatus: (t.wl_status as LiveOpsTicketListItem['wlStatus']) ?? 'pending',
        tlStatus: (t.tl_status as LiveOpsTicketListItem['tlStatus']) ?? 'pending',
        loStatus: (t.lo_status as LiveOpsTicketListItem['loStatus']) ?? 'pending',
        createdAt: t.created_at as string, updatedAt: (t.updated_at as string) ?? (t.created_at as string),
      }
    },

    _mapDetail(t: Record<string, unknown>): LiveOpsTicketDetail {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const base = (api.liveops as any)._mapTicket(t) as LiveOpsTicketListItem
      const mapAssignment = (a: Record<string, unknown>): LiveOpsAssignment => ({
        id: a.id as string, ticketId: a.ticket_id as string,
        assigneeId: a.assignee_id as string, assigneeName: a.assignee_name as string,
        assignedById: a.assigned_by_id as string | null, assignedByName: a.assigned_by_name as string | null,
        loMessage: a.lo_message as string | null, status: a.status as LiveOpsAssignment['status'],
        assignedAt: a.assigned_at as string, pickedUpAt: a.picked_up_at as string | null,
        completedAt: a.completed_at as string | null, rejectedAt: a.rejected_at as string | null,
        rejectionReason: a.rejection_reason as string | null,
      })
      const mapComment = (c: Record<string, unknown>): LiveOpsComment => ({
        id: c.id as string, ticketId: c.ticket_id as string,
        authorId: c.author_id as string | null, authorName: c.author_name as string | null,
        body: c.body as string, isSystem: c.is_system as boolean, createdAt: c.created_at as string,
      })
      const mapEvent = (e: Record<string, unknown>): LiveOpsEvent => ({
        id: e.id as string, ticketId: e.ticket_id as string,
        actorId: e.actor_id as string | null, actorName: e.actor_name as string | null,
        eventType: e.event_type as string, eventData: e.event_data as string | null, createdAt: e.created_at as string,
      })
      return {
        ...base, description: t.description as string,
        wlActorId: t.wl_actor_id as string | null, wlActorName: t.wl_actor_name as string | null,
        wlActedAt: t.wl_acted_at as string | null, wlReason: t.wl_reason as string | null,
        tlActorId: t.tl_actor_id as string | null, tlActorName: t.tl_actor_name as string | null,
        tlActedAt: t.tl_acted_at as string | null, tlReason: t.tl_reason as string | null,
        loActorId: t.lo_actor_id as string | null, loActorName: t.lo_actor_name as string | null,
        loActedAt: t.lo_acted_at as string | null, loReason: t.lo_reason as string | null,
        cancelledById: t.cancelled_by_id as string | null, cancelledByName: t.cancelled_by_name as string | null,
        cancelledAt: t.cancelled_at as string | null, cancelReason: t.cancel_reason as string | null,
        onHoldReason: t.on_hold_reason as string | null, putOnHoldAt: t.put_on_hold_at as string | null,
        completedAt: t.completed_at as string | null,
        assignments: ((t.assignments as unknown[]) ?? []).map(a => mapAssignment(a as Record<string, unknown>)),
        comments: ((t.comments as unknown[]) ?? []).map(c => mapComment(c as Record<string, unknown>)),
        events: ((t.events as unknown[]) ?? []).map(e => mapEvent(e as Record<string, unknown>)),
      }
    },

    // ── lookups ───────────────────────────────────────────────────────────────

    async getBusinessUnits(): Promise<LiveOpsBusinessUnit[]> {
      const d = await request<Array<Record<string, unknown>>>('/liveops/business-units')
      return d.map(b => ({ id: b.id as string, name: b.name as string, isActive: b.is_active as boolean }))
    },

    async getTicketTypes(): Promise<LiveOpsTicketType[]> {
      const d = await request<Array<Record<string, unknown>>>('/liveops/ticket-types')
      return d.map(t => ({ id: t.id as string, name: t.name as string, guideText: t.guide_text as string | null, isActive: t.is_active as boolean, sortOrder: t.sort_order as number }))
    },

    async getUseCases(businessUnitId?: string): Promise<LiveOpsUseCase[]> {
      const q = businessUnitId ? `?business_unit_id=${businessUnitId}` : ''
      const d = await request<Array<Record<string, unknown>>>(`/liveops/use-cases${q}`)
      return d.map(u => ({ id: u.id as string, businessUnitId: u.business_unit_id as string, businessUnitName: u.business_unit_name as string, name: u.name as string, isActive: u.is_active as boolean }))
    },

    async getAssignableMembers(): Promise<LiveOpsAssignableMember[]> {
      const d = await request<Array<Record<string, unknown>>>('/liveops/assignable-members')
      return d.map(m => ({ id: m.id as string, name: m.name as string, activeAssignmentCount: m.active_assignment_count as number }))
    },

    // ── tickets ───────────────────────────────────────────────────────────────

    async listTickets(filters?: { status?: string; submittedById?: string; assignedToId?: string; urgency?: string; businessUnitId?: string; slaBreached?: boolean }): Promise<LiveOpsTicketListItem[]> {
      const params = new URLSearchParams()
      if (filters?.status) params.set('status', filters.status)
      if (filters?.submittedById) params.set('submitted_by_id', filters.submittedById)
      if (filters?.assignedToId) params.set('assigned_to_id', filters.assignedToId)
      if (filters?.urgency) params.set('urgency', filters.urgency)
      if (filters?.businessUnitId) params.set('business_unit_id', filters.businessUnitId)
      if (filters?.slaBreached !== undefined) params.set('sla_breached', String(filters.slaBreached))
      const q = params.toString() ? `?${params.toString()}` : ''
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = await request<Array<Record<string, unknown>>>(`/liveops/tickets${q}`)
      return d.map(t => (api.liveops as any)._mapTicket(t))
    },

    async getTicket(id: string): Promise<LiveOpsTicketDetail> {
      const d = await request<Record<string, unknown>>(`/liveops/tickets/${id}`)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (api.liveops as any)._mapDetail(d)
    },

    async createTicket(body: { ticket_type_id: string; use_case_id: string; business_unit_id: string; urgency: string; description: string; submit: boolean }, memberEmail: string): Promise<LiveOpsTicketDetail> {
      const d = await request<Record<string, unknown>>(`/liveops/tickets?member_email=${encodeURIComponent(memberEmail)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (api.liveops as any)._mapDetail(d)
    },

    async submitTicket(id: string, memberEmail: string): Promise<LiveOpsTicketDetail> {
      const d = await request<Record<string, unknown>>(`/liveops/tickets/${id}/submit?member_email=${encodeURIComponent(memberEmail)}`, { method: 'POST' })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (api.liveops as any)._mapDetail(d)
    },

    async updateDraftTicket(id: string, body: { description?: string; urgency?: string }, memberEmail: string): Promise<LiveOpsTicketDetail> {
      const d = await request<Record<string, unknown>>(`/liveops/tickets/${id}?member_email=${encodeURIComponent(memberEmail)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (api.liveops as any)._mapDetail(d)
    },

    async overrideUrgency(id: string, urgency: string, reason: string | null, memberEmail: string): Promise<LiveOpsTicketDetail> {
      const d = await request<Record<string, unknown>>(`/liveops/tickets/${id}/override-urgency?member_email=${encodeURIComponent(memberEmail)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ urgency, reason }),
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (api.liveops as any)._mapDetail(d)
    },

    // ── state transitions ─────────────────────────────────────────────────────

    async approve(id: string, reason: string | null, memberEmail: string, assigneeId?: string | null, loMessage?: string | null): Promise<LiveOpsTicketDetail> {
      const d = await request<Record<string, unknown>>(`/liveops/tickets/${id}/approve?member_email=${encodeURIComponent(memberEmail)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, assignee_id: assigneeId ?? null, lo_message: loMessage ?? null }),
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (api.liveops as any)._mapDetail(d)
    },

    async pushBack(id: string, reason: string, memberEmail: string): Promise<LiveOpsTicketDetail> {
      const d = await request<Record<string, unknown>>(`/liveops/tickets/${id}/push-back?member_email=${encodeURIComponent(memberEmail)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }),
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (api.liveops as any)._mapDetail(d)
    },

    async reject(id: string, reason: string, memberEmail: string): Promise<LiveOpsTicketDetail> {
      const d = await request<Record<string, unknown>>(`/liveops/tickets/${id}/reject?member_email=${encodeURIComponent(memberEmail)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }),
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (api.liveops as any)._mapDetail(d)
    },

    async cancel(id: string, reason: string, memberEmail: string): Promise<LiveOpsTicketDetail> {
      const d = await request<Record<string, unknown>>(`/liveops/tickets/${id}/cancel?member_email=${encodeURIComponent(memberEmail)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }),
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (api.liveops as any)._mapDetail(d)
    },

    async hold(id: string, reason: string, memberEmail: string): Promise<LiveOpsTicketDetail> {
      const d = await request<Record<string, unknown>>(`/liveops/tickets/${id}/hold?member_email=${encodeURIComponent(memberEmail)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }),
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (api.liveops as any)._mapDetail(d)
    },

    async resume(id: string, memberEmail: string): Promise<LiveOpsTicketDetail> {
      const d = await request<Record<string, unknown>>(`/liveops/tickets/${id}/resume?member_email=${encodeURIComponent(memberEmail)}`, { method: 'POST' })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (api.liveops as any)._mapDetail(d)
    },

    async assign(id: string, assigneeId: string, loMessage: string | null, memberEmail: string): Promise<LiveOpsTicketDetail> {
      const d = await request<Record<string, unknown>>(`/liveops/tickets/${id}/assign?member_email=${encodeURIComponent(memberEmail)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assignee_id: assigneeId, lo_message: loMessage }),
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (api.liveops as any)._mapDetail(d)
    },

    async reassign(id: string, assigneeId: string, reason: string | null, loMessage: string | null, memberEmail: string): Promise<LiveOpsTicketDetail> {
      const d = await request<Record<string, unknown>>(`/liveops/tickets/${id}/reassign?member_email=${encodeURIComponent(memberEmail)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assignee_id: assigneeId, reason, lo_message: loMessage }),
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (api.liveops as any)._mapDetail(d)
    },

    async pickup(id: string, memberEmail: string): Promise<LiveOpsTicketDetail> {
      const d = await request<Record<string, unknown>>(`/liveops/tickets/${id}/pickup?member_email=${encodeURIComponent(memberEmail)}`, { method: 'POST' })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (api.liveops as any)._mapDetail(d)
    },

    async complete(id: string, note: string | null, memberEmail: string): Promise<LiveOpsTicketDetail> {
      const d = await request<Record<string, unknown>>(`/liveops/tickets/${id}/complete?member_email=${encodeURIComponent(memberEmail)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note }),
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (api.liveops as any)._mapDetail(d)
    },

    async rejectAssignment(id: string, reason: string, memberEmail: string): Promise<LiveOpsTicketDetail> {
      const d = await request<Record<string, unknown>>(`/liveops/tickets/${id}/reject-assignment?member_email=${encodeURIComponent(memberEmail)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }),
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (api.liveops as any)._mapDetail(d)
    },

    // ── comments ──────────────────────────────────────────────────────────────

    async addComment(id: string, body: string, memberEmail: string): Promise<LiveOpsComment> {
      const c = await request<Record<string, unknown>>(`/liveops/tickets/${id}/comments?member_email=${encodeURIComponent(memberEmail)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body }),
      })
      return { id: c.id as string, ticketId: c.ticket_id as string, authorId: c.author_id as string | null, authorName: c.author_name as string | null, body: c.body as string, isSystem: c.is_system as boolean, createdAt: c.created_at as string }
    },

    // ── analytics ─────────────────────────────────────────────────────────────

    async getAnalyticsSummary(): Promise<LiveOpsAnalyticsSummary> {
      const d = await request<Record<string, unknown>>('/liveops/analytics/summary')
      return {
        totalOpen: d.total_open as number, pendingApproval: d.pending_approval as number,
        inProgress: d.in_progress as number, slaBreaching: d.sla_breaching as number,
        completedThisMonth: d.completed_this_month as number, avgResolutionHours: d.avg_resolution_hours as number | null,
      }
    },

    // ── admin: member roles ───────────────────────────────────────────────────

    async getMemberRoles(): Promise<LiveOpsMemberRoleRecord[]> {
      const d = await request<Array<Record<string, unknown>>>('/liveops/admin/member-roles')
      return d.map(r => ({ id: r.id as string, memberId: r.member_id as string, memberName: r.member_name as string, role: r.role as LiveOpsMemberRoleRecord['role'] }))
    },

    async createMemberRole(memberId: string, role: string): Promise<LiveOpsMemberRoleRecord> {
      const r = await request<Record<string, unknown>>('/liveops/admin/member-roles', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ member_id: memberId, role }),
      })
      return { id: r.id as string, memberId: r.member_id as string, memberName: r.member_name as string, role: r.role as LiveOpsMemberRoleRecord['role'] }
    },

    async deleteMemberRole(id: string): Promise<void> {
      await request(`/liveops/admin/member-roles/${id}`, { method: 'DELETE' })
    },

    // ── admin: SLA config ─────────────────────────────────────────────────────

    async getSlaConfig(): Promise<LiveOpsSlaConfig[]> {
      const d = await request<Array<Record<string, unknown>>>('/liveops/admin/sla-config')
      return d.map(s => ({ id: s.id as string, urgency: s.urgency as LiveOpsSlaConfig['urgency'], responseHours: s.response_hours as number }))
    },

    async updateSlaConfig(urgency: string, responseHours: number): Promise<LiveOpsSlaConfig> {
      const s = await request<Record<string, unknown>>(`/liveops/admin/sla-config/${urgency}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ response_hours: responseHours }),
      })
      return { id: s.id as string, urgency: s.urgency as LiveOpsSlaConfig['urgency'], responseHours: s.response_hours as number }
    },

    // ── admin: approver config ────────────────────────────────────────────────

    async getApproverConfig(): Promise<LiveOpsApproverConfig[]> {
      const d = await request<Array<Record<string, unknown>>>('/liveops/admin/approver-config')
      return d.map(a => ({
        id: a.id as string,
        ticketTypeId: a.ticket_type_id as string, ticketTypeName: a.ticket_type_name as string,
        businessUnitId: a.business_unit_id as string, businessUnitName: a.business_unit_name as string,
        workstreamLeadId: a.workstream_lead_id as string | null, workstreamLeadName: a.workstream_lead_name as string | null,
        teamLeadId: a.team_lead_id as string | null, teamLeadName: a.team_lead_name as string | null,
      }))
    },

    async createApproverConfig(body: { ticket_type_id: string; business_unit_id: string; workstream_lead_id?: string | null; team_lead_id?: string | null }): Promise<LiveOpsApproverConfig> {
      const a = await request<Record<string, unknown>>('/liveops/admin/approver-config', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      return {
        id: a.id as string,
        ticketTypeId: a.ticket_type_id as string, ticketTypeName: a.ticket_type_name as string,
        businessUnitId: a.business_unit_id as string, businessUnitName: a.business_unit_name as string,
        workstreamLeadId: a.workstream_lead_id as string | null, workstreamLeadName: a.workstream_lead_name as string | null,
        teamLeadId: a.team_lead_id as string | null, teamLeadName: a.team_lead_name as string | null,
      }
    },

    async deleteApproverConfig(id: string): Promise<void> {
      await request(`/liveops/admin/approver-config/${id}`, { method: 'DELETE' })
    },
  },
}
