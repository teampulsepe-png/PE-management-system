export type RecurrenceType = 'weekly' | 'monthly' | 'quarterly' | 'annually'
export type TeamType = 'pe' | 'so'
export type OccurrenceStatus = 'pending' | 'in_progress' | 'done' | 'skipped'

export interface Task {
  id: string
  title: string
  description: string
  recurrence: RecurrenceType
  team: TeamType
}

export interface TaskOccurrence {
  id: string
  taskId: string
  period: string
  status: OccurrenceStatus
  completedBy: string
  completionNotes: string
  completedAt?: string
  comments: TaskComment[]
}

export interface TaskComment {
  id: string
  author: string
  body: string
  createdAt: string
}

export interface CurrentUser {
  email: string
  name: string | null
  teamId: string | null
  memberId: string | null
  role: string | null  // 'user', 'lead', 'head', 'admin', or null
  headTeamIds: string[]
  headTeamNames: string[]
  hasAdminAccess: boolean
}

// ── Settings ──────────────────────────────────────────────────────────────────

export interface Role {
  id: string
  name: string
}

export interface MemberDetail {
  id: string
  name: string
  email: string | null
  teamId: string | null
  teamName: string | null
  roleId: string | null
  roleName: string | null
  headTeamIds: string[]
  headTeamNames: string[]
  hasAdminAccess: boolean
}

export interface TeamWithMembers {
  id: string
  name: string
  memberCount: number
  members: MemberDetail[]
}

export interface TeamPermissions {
  teamId: string
  tasks: boolean
  kpi: boolean
  workload: boolean
  pipelines: boolean
  aiSubscriptions: boolean
  projectLifecycle: boolean
  tracker: boolean
  cost: boolean
  liveops: boolean
  devops: boolean
  agent: boolean
}

export interface TeamMember {
  id: string
  teamId: string
  name: string
  email?: string
}

export interface Ticket {
  id: string
  title: string
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  priority: 'low' | 'medium' | 'high' | 'critical'
  assignee: string
  createdAt: string
}

export interface AppNotification {
  id: string
  type: string
  taskId: string | null
  taskRecurrence: string | null
  occurrenceId: string | null
  triggeredByName: string | null
  message: string
  isRead: boolean
  createdAt: string
}

export interface ActivityItem {
  taskTitle: string
  taskTeam: string
  completedBy: string | null
  completedAt: string
  period: string
}

export interface Department {
  id: string
  name: string
}

export interface AiTool {
  id: string
  name: string
  tier: string | null
  displayName: string
  monthlyCost: number  // cents
}

export interface AiSubscriptionAddon {
  id: string
  credits: number
  startDate: string
  endDate: string
  remarks: string | null
  createdAt: string
}

export interface AiSubscription {
  id: string
  subscriberName: string
  email: string
  departmentId: string
  departmentName: string
  toolId: string
  toolDisplayName: string
  monthlyCost: number  // cents
  startDate: string
  endDate: string | null
  remarks: string | null
  createdAt: string
  addons: AiSubscriptionAddon[]
  totalAddonCredits: number
  isActive: boolean
}

export type ProjectStatus = 'draft' | 'active' | 'complete'
export type ProjectItemStatus = 'pending' | 'in_progress' | 'done'
export type AccessAction = 'grant' | 'revoke'

export interface ProjectItem {
  id: string
  projectId: string
  phase: string
  itemKey: string
  sortOrder: number
  ownerId: string | null
  ownerName: string
  deadline: string | null
  deliverable: string | null
  status: ProjectItemStatus
  completedAt: string | null
}

export interface UserAccessLog {
  id: string
  projectId: string
  memberId: string
  memberName: string
  action: AccessAction
  actionedById: string | null
  actionedByName: string
  notes: string | null
  actionedAt: string
  createdAt: string
}

export interface Project {
  id: string
  name: string
  description: string | null
  status: ProjectStatus
  ownerId: string | null
  ownerName: string
  createdAt: string
  items: ProjectItem[]
  accessLogs: UserAccessLog[]
  progress: number
}

export type KpiStatus = 'pending' | 'achieved' | 'at_risk' | 'behind'
export type KpiFrequency = 'monthly' | 'quarterly' | 'annually'
export type KpiPdca = 'plan' | 'do' | 'check' | 'act'

export interface KpiEvaluationEntry {
  id: string
  doneAt: string  // "YYYY-MM-DD"
}

export interface KpiEvaluation {
  id: string
  periodLabel: string
  periodOrder: number
  actual: number | null
  completedAt: string | null
  entries: KpiEvaluationEntry[]
}

export interface KpiEntry {
  id: string
  category: string
  year: number
  metricName: string
  pdca: KpiPdca
  frequency: KpiFrequency
  kpiOwnerId: string | null
  kpiOwner: string
  responsiblePartyId: string | null
  responsibleParty: string
  planned: number
  target: number
  remarks: string | null
  evaluations: KpiEvaluation[]
  status: KpiStatus
  overallPercentage: number | null
}

// ── Tracker Board ──────────────────────────────────────────────────────────────

export interface TrackerSubtask {
  id: string
  taskId: string
  title: string
  date: string | null
  remarks: string | null
  isDone: boolean
  sortOrder: number
}

export interface TrackerTask {
  id: string
  groupId: string
  title: string
  owner: string | null
  plannedEndDate: string | null
  sortOrder: number
  subtasks: TrackerSubtask[]
}

export interface TrackerGroup {
  id: string
  areaId: string
  name: string
  sortOrder: number
  tasks: TrackerTask[]
}

export interface TrackerArea {
  id: string
  name: string
  sortOrder: number
  groups: TrackerGroup[]
}

// ── Workload ──────────────────────────────────────────────────────────────────

export type SupervisorTaskSize = 'S' | 'M' | 'L'
export type SupervisorTaskStatus = 'pending' | 'in_progress' | 'completed' | 'extended'

export interface SupervisorTaskAssignee {
  memberId: string
  memberName: string
}

export interface SupervisorTask {
  id: string
  title: string
  description: string | null
  size: SupervisorTaskSize
  status: SupervisorTaskStatus
  startDate: string
  dueDate: string
  createdBy: string | null
  createdAt: string
  assignees: SupervisorTaskAssignee[]
  isOverdue: boolean
}

export interface OpsTicket {
  id: string
  title: string
  type: 'liveops' | 'devops'
  priority: 'critical' | 'high' | 'medium' | 'low'
  status: 'open' | 'in_progress'
}

// ── Cost ──────────────────────────────────────────────────────────────────────

export type MemberRequestStatus = 'pending' | 'approved' | 'rejected'

export interface MemberRequest {
  id: string
  email: string
  name: string
  requestedTeamId: string | null
  requestedTeamName: string | null
  note: string | null
  status: MemberRequestStatus
  rejectionReason: string | null
  reviewedByName: string | null
  reviewedAt: string | null
  createdAt: string
}

export type CostCategory = 'database' | 'compute' | 'agent'

export interface CostEntry {
  id: string
  category: CostCategory
  serviceName: string
  serviceDescription: string | null
  month: string       // "YYYY-MM"
  amountCents: number
  createdAt: string
  updatedAt: string
}

export interface CostMonthTotal {
  database: number    // cents
  compute: number
  agent: number
  total: number
}

export interface CostHistoryPoint {
  month: string
  database: number
  compute: number
  agent: number
}

export interface CostSummary {
  currentMonth: string
  current: CostMonthTotal
  previous: CostMonthTotal | null
  history: CostHistoryPoint[]
  entries: CostEntry[]
}

// ── LiveOps Ticketing ─────────────────────────────────────────────────────────

export type LiveOpsUrgency = 'high' | 'medium' | 'low'
export type LiveOpsTicketStatus =
  | 'draft' | 'pending_wl' | 'pending_tl' | 'pending_lo'
  | 'open' | 'in_progress' | 'completed' | 'rejected' | 'cancelled' | 'on_hold'
export type LiveOpsApprovalStatus = 'pending' | 'approved' | 'rejected' | 'pushed_back' | 'na'
export type LiveOpsMemberRoleType = 'workstream_lead' | 'team_lead' | 'lo_manager' | 'platform_engineer' | 'liveops_engineer'
export type LiveOpsAssignmentStatus = 'pending' | 'active' | 'completed' | 'rejected'

export interface LiveOpsBusinessUnit { id: string; name: string; isActive: boolean }
export interface LiveOpsTicketType  { id: string; name: string; guideText: string | null; isActive: boolean; sortOrder: number }
export interface LiveOpsUseCase     { id: string; businessUnitId: string; businessUnitName: string; name: string; isActive: boolean }

export interface LiveOpsApproverConfig {
  id: string
  ticketTypeId: string; ticketTypeName: string
  businessUnitId: string; businessUnitName: string
  workstreamLeadId: string | null; workstreamLeadName: string | null
  teamLeadId: string | null; teamLeadName: string | null
}

export interface LiveOpsMemberRoleRecord { id: string; memberId: string; memberName: string; role: LiveOpsMemberRoleType }
export interface LiveOpsSlaConfig { id: string; urgency: LiveOpsUrgency; responseHours: number }

export interface LiveOpsAssignment {
  id: string; ticketId: string
  assigneeId: string; assigneeName: string
  assignedById: string | null; assignedByName: string | null
  loMessage: string | null; status: LiveOpsAssignmentStatus
  assignedAt: string; pickedUpAt: string | null
  completedAt: string | null; rejectedAt: string | null; rejectionReason: string | null
}

export interface LiveOpsComment {
  id: string; ticketId: string
  authorId: string | null; authorName: string | null
  body: string; isSystem: boolean; createdAt: string
}

export interface LiveOpsEvent {
  id: string; ticketId: string
  actorId: string | null; actorName: string | null
  eventType: string; eventData: string | null; createdAt: string
}

export interface LiveOpsTicketListItem {
  id: string; ticketNumber: number
  ticketTypeId: string; ticketTypeName: string
  useCaseId: string; useCaseName: string
  businessUnitId: string; businessUnitName: string
  urgency: LiveOpsUrgency
  submittedById: string; submittedByName: string
  submittedAt: string | null; slaDeadline: string | null
  workstreamLeadId: string | null; workstreamLeadName: string | null
  teamLeadId: string | null; teamLeadName: string | null
  currentlyWithId: string | null; currentlyWithName: string | null
  status: LiveOpsTicketStatus
  wlStatus: LiveOpsApprovalStatus
  tlStatus: LiveOpsApprovalStatus
  loStatus: LiveOpsApprovalStatus
  createdAt: string; updatedAt: string
}

export interface LiveOpsTicketDetail extends LiveOpsTicketListItem {
  description: string
  wlActorId: string | null; wlActorName: string | null; wlActedAt: string | null; wlReason: string | null
  tlActorId: string | null; tlActorName: string | null; tlActedAt: string | null; tlReason: string | null
  loActorId: string | null; loActorName: string | null; loActedAt: string | null; loReason: string | null
  cancelledById: string | null; cancelledByName: string | null; cancelledAt: string | null; cancelReason: string | null
  onHoldReason: string | null; putOnHoldAt: string | null; completedAt: string | null
  assignments: LiveOpsAssignment[]
  comments: LiveOpsComment[]
  events: LiveOpsEvent[]
}

export interface LiveOpsAssignableMember { id: string; name: string; activeAssignmentCount: number }

export interface LiveOpsAnalyticsSummary {
  totalOpen: number; pendingApproval: number; inProgress: number
  slaBreaching: number; completedThisMonth: number; avgResolutionHours: number | null
}
