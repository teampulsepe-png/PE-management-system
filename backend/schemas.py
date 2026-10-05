from pydantic import BaseModel, computed_field, model_validator
from typing import Optional, Any
from datetime import datetime


class TeamOut(BaseModel):
    id: str
    name: str

    model_config = {"from_attributes": True}


class TaskOut(BaseModel):
    id: str
    title: str
    description: Optional[str]
    recurrence: str
    team_id: str
    is_active: bool

    model_config = {"from_attributes": True}


class OccurrenceOut(BaseModel):
    id: str
    task_id: str
    period: str
    status: str
    completed_by: Optional[str]
    completion_notes: Optional[str]
    completed_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class OccurrenceUpdate(BaseModel):
    status: Optional[str] = None
    completed_by: Optional[str] = None
    completion_notes: Optional[str] = None
    completed_at: Optional[datetime] = None


class CommentOut(BaseModel):
    id: str
    occurrence_id: str
    author: str
    body: str
    created_at: datetime

    model_config = {"from_attributes": True}


class CommentCreate(BaseModel):
    author: str
    body: str


class UserOut(BaseModel):
    email: str
    name: Optional[str]
    team_id: Optional[str]
    member_id: Optional[str]
    role: Optional[str] = None
    head_team_ids: list[str] = []
    head_team_names: list[str] = []
    has_admin_access: bool = False


class TeamMemberOut(BaseModel):
    id: str
    team_id: Optional[str]
    name: str
    email: Optional[str]

    model_config = {"from_attributes": True}


class NotificationOut(BaseModel):
    id: str
    type: str
    task_id: Optional[str]
    task_recurrence: Optional[str]
    occurrence_id: Optional[str]
    triggered_by_name: Optional[str]
    message: str
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ActivityItem(BaseModel):
    task_title: str
    task_team: str
    completed_by: Optional[str]
    completed_at: datetime
    period: str


class DepartmentOut(BaseModel):
    id: str
    name: str

    model_config = {"from_attributes": True}


class AiToolOut(BaseModel):
    id: str
    name: str
    tier: Optional[str]
    monthly_cost: int  # cents

    model_config = {"from_attributes": True}

    @computed_field
    @property
    def display_name(self) -> str:
        return f"{self.name} – {self.tier}" if self.tier else self.name


class AiSubscriptionAddonOut(BaseModel):
    id: str
    credits: int
    start_date: str
    end_date: str
    remarks: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class AiSubscriptionAddonCreate(BaseModel):
    credits: int
    start_date: str   # "YYYY-MM-DD" — end_date auto-calculated as start + 1 month
    remarks: Optional[str] = None


class AiSubscriptionOut(BaseModel):
    id: str
    subscriber_name: str
    email: str
    department_id: str
    department_name: str
    tool_id: str
    tool_display_name: str
    monthly_cost: int   # cents
    start_date: str
    end_date: Optional[str]
    remarks: Optional[str]
    created_at: datetime
    addons: list[AiSubscriptionAddonOut] = []

    model_config = {"from_attributes": True}

    @model_validator(mode='before')
    @classmethod
    def resolve_sub_relationships(cls, obj: Any) -> Any:
        if not hasattr(obj, '__dict__'):
            return obj
        dept = getattr(obj, 'department', None)
        tool = getattr(obj, 'tool', None)
        obj.__dict__.setdefault('department_name', dept.name if dept else '')
        if tool:
            display = f"{tool.name} – {tool.tier}" if tool.tier else tool.name
            obj.__dict__.setdefault('tool_display_name', display)
            obj.__dict__.setdefault('monthly_cost', tool.monthly_cost)
        else:
            obj.__dict__.setdefault('tool_display_name', '')
            obj.__dict__.setdefault('monthly_cost', 0)
        return obj

    @computed_field
    @property
    def total_addon_credits(self) -> int:
        return sum(a.credits for a in self.addons)

    @computed_field
    @property
    def is_active(self) -> bool:
        from datetime import date
        if not self.end_date:
            return True
        return date.fromisoformat(self.end_date) >= date.today()


class AiSubscriptionCreate(BaseModel):
    subscriber_name: str
    email: str
    department_id: str
    tool_id: str
    start_date: str
    end_date: Optional[str] = None
    remarks: Optional[str] = None


class AiSubscriptionUpdate(BaseModel):
    subscriber_name: Optional[str] = None
    email: Optional[str] = None
    department_id: Optional[str] = None
    tool_id: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    remarks: Optional[str] = None


class KpiEvaluationEntryOut(BaseModel):
    id: str
    done_at: str
    created_at: datetime

    model_config = {"from_attributes": True}


class KpiEvaluationEntryCreate(BaseModel):
    done_at: str  # "YYYY-MM-DD"


class KpiEvaluationOut(BaseModel):
    id: str
    period_label: str
    period_order: int
    actual: Optional[int]
    completed_at: Optional[datetime]
    entries: list[KpiEvaluationEntryOut] = []

    model_config = {"from_attributes": True}


class KpiMetricUpdate(BaseModel):
    remarks: Optional[str] = None


class KpiMetricOut(BaseModel):
    id: str
    category: str
    year: int
    metric_name: str
    pdca: str
    frequency: str
    kpi_owner_id: Optional[str]
    kpi_owner: str
    responsible_party_id: Optional[str]
    responsible_party: str
    planned: int
    target: int
    remarks: Optional[str]
    evaluations: list[KpiEvaluationOut]
    created_at: datetime

    model_config = {"from_attributes": True}

    @model_validator(mode='before')
    @classmethod
    def resolve_member_names(cls, obj: Any) -> Any:
        if not hasattr(obj, '__class__') or not hasattr(obj, '__dict__'):
            return obj
        # Derive display names from FK relationships
        owner = getattr(obj, 'kpi_owner_member', None)
        responsible = getattr(obj, 'responsible_member', None)
        obj.__dict__.setdefault('kpi_owner', owner.name if owner else '')
        obj.__dict__.setdefault('responsible_party', responsible.name if responsible else '')
        return obj

    @computed_field
    @property
    def overall_percentage(self) -> Optional[float]:
        with_data = [e for e in self.evaluations if e.actual is not None]
        if not with_data:
            return None
        total_actual = sum(e.actual for e in with_data)
        total_planned = self.planned * len(with_data)
        return round((total_actual / total_planned) * 100, 1) if total_planned else None

    @computed_field
    @property
    def status(self) -> str:
        pct = self.overall_percentage
        if pct is None:
            return "pending"
        if pct >= self.target:
            return "achieved"
        if pct >= self.target * 0.8:
            return "at_risk"
        return "behind"


# ── Project Lifecycle ──────────────────────────────────────────────────────────

class ProjectItemOut(BaseModel):
    id:          str
    project_id:  str
    phase:       str
    item_key:    str
    sort_order:  int
    owner_id:    Optional[str]
    owner_name:  str
    deadline:    Optional[str]
    deliverable: Optional[str]
    status:      str
    completed_at: Optional[str]

    model_config = {"from_attributes": True}

    @model_validator(mode='before')
    @classmethod
    def resolve_owner(cls, obj: Any) -> Any:
        if not hasattr(obj, '__dict__'):
            return obj
        owner = getattr(obj, 'owner', None)
        obj.__dict__.setdefault('owner_name', owner.name if owner else '')
        return obj


class ProjectItemUpdate(BaseModel):
    owner_id:    Optional[str] = None
    deadline:    Optional[str] = None
    deliverable: Optional[str] = None
    status:      Optional[str] = None


class UserAccessLogOut(BaseModel):
    id:             str
    project_id:     str
    member_id:      str
    member_name:    str
    action:         str
    actioned_by_id: Optional[str]
    actioned_by_name: str
    notes:          Optional[str]
    actioned_at:    str
    created_at:     datetime

    model_config = {"from_attributes": True}

    @model_validator(mode='before')
    @classmethod
    def resolve_names(cls, obj: Any) -> Any:
        if not hasattr(obj, '__dict__'):
            return obj
        member     = getattr(obj, 'member', None)
        actioned_by = getattr(obj, 'actioned_by', None)
        obj.__dict__.setdefault('member_name', member.name if member else '')
        obj.__dict__.setdefault('actioned_by_name', actioned_by.name if actioned_by else '')
        return obj


class UserAccessLogCreate(BaseModel):
    member_id:      str
    action:         str   # grant | revoke
    actioned_by_id: Optional[str] = None
    notes:          Optional[str] = None
    actioned_at:    str   # ISO "YYYY-MM-DD"


class ProjectOut(BaseModel):
    id:          str
    name:        str
    description: Optional[str]
    status:      str
    owner_id:    Optional[str]
    owner_name:  str
    created_at:  datetime
    items:       list[ProjectItemOut] = []
    access_logs: list[UserAccessLogOut] = []

    model_config = {"from_attributes": True}

    @model_validator(mode='before')
    @classmethod
    def resolve_owner(cls, obj: Any) -> Any:
        if not hasattr(obj, '__dict__'):
            return obj
        owner = getattr(obj, 'owner', None)
        obj.__dict__.setdefault('owner_name', owner.name if owner else '')
        return obj

    @computed_field
    @property
    def progress(self) -> int:
        if not self.items:
            return 0
        done = sum(1 for i in self.items if i.status == 'done')
        return round(done / len(self.items) * 100)


class ProjectCreate(BaseModel):
    name:        str
    description: Optional[str] = None
    owner_id:    Optional[str] = None


class ProjectUpdate(BaseModel):
    name:        Optional[str] = None
    description: Optional[str] = None
    status:      Optional[str] = None
    owner_id:    Optional[str] = None


# ── Tracker Board ──────────────────────────────────────────────────────────────

class TrackerSubtaskOut(BaseModel):
    id:         str
    task_id:    str
    title:      str
    date:       Optional[str]
    remarks:    Optional[str]
    is_done:    bool
    sort_order: int

    model_config = {"from_attributes": True}


class TrackerSubtaskCreate(BaseModel):
    title:   str
    date:    Optional[str] = None
    remarks: Optional[str] = None


class TrackerSubtaskUpdate(BaseModel):
    title:   Optional[str]  = None
    date:    Optional[str]  = None
    remarks: Optional[str]  = None
    is_done: Optional[bool] = None


class TrackerTaskOut(BaseModel):
    id:               str
    group_id:         str
    title:            str
    owner:            Optional[str]
    planned_end_date: Optional[str]
    sort_order:       int
    subtasks:         list[TrackerSubtaskOut] = []

    model_config = {"from_attributes": True}


class TrackerTaskCreate(BaseModel):
    title:            str
    owner:            Optional[str] = None
    planned_end_date: Optional[str] = None


class TrackerTaskUpdate(BaseModel):
    title:            Optional[str] = None
    owner:            Optional[str] = None
    planned_end_date: Optional[str] = None


class TrackerGroupOut(BaseModel):
    id:         str
    area_id:    str
    name:       str
    sort_order: int
    tasks:      list[TrackerTaskOut] = []

    model_config = {"from_attributes": True}


class TrackerGroupCreate(BaseModel):
    name: str


class TrackerAreaOut(BaseModel):
    id:         str
    name:       str
    sort_order: int
    groups:     list[TrackerGroupOut] = []

    model_config = {"from_attributes": True}


class TrackerAreaCreate(BaseModel):
    name: str


# ── Workload ───────────────────────────────────────────────────────────────────

class SupervisorTaskAssigneeOut(BaseModel):
    member_id:   str
    member_name: str

    model_config = {"from_attributes": True}

    @model_validator(mode='before')
    @classmethod
    def resolve_member(cls, obj: Any) -> Any:
        if not hasattr(obj, '__dict__'):
            return obj
        member = getattr(obj, 'member', None)
        obj.__dict__.setdefault('member_name', member.name if member else '')
        return obj


class SupervisorTaskOut(BaseModel):
    id:          str
    title:       str
    description: Optional[str]
    size:        str
    status:      str
    start_date:  str
    due_date:    str
    created_by:  Optional[str]
    created_at:  datetime
    assignees:   list[SupervisorTaskAssigneeOut] = []

    model_config = {"from_attributes": True}

    @model_validator(mode='before')
    @classmethod
    def resolve_assignees(cls, obj: Any) -> Any:
        if not hasattr(obj, '__dict__'):
            return obj
        assignments = getattr(obj, 'assignments', [])
        obj.__dict__.setdefault('assignees', assignments)
        return obj

    @computed_field
    @property
    def is_overdue(self) -> bool:
        from datetime import date
        if self.status == 'completed':
            return False
        return date.fromisoformat(self.due_date) < date.today()


class SupervisorTaskCreate(BaseModel):
    title:        str
    description:  Optional[str] = None
    size:         str
    start_date:   str
    due_date:     str
    assignee_ids: list[str]
    created_by:   Optional[str] = None


class SupervisorTaskStatusUpdate(BaseModel):
    status: str


class SupervisorTaskUpdate(BaseModel):
    title:        Optional[str] = None
    description:  Optional[str] = None
    size:         Optional[str] = None
    due_date:     Optional[str] = None
    status:       Optional[str] = None
    assignee_ids: Optional[list[str]] = None


# ── Settings (admin-only) ──────────────────────────────────────────────────────

class RoleOut(BaseModel):
    id: str
    name: str

    model_config = {"from_attributes": True}


class MemberDetailOut(BaseModel):
    id: str
    name: str
    email: Optional[str]
    team_id: Optional[str]
    team_name: Optional[str]
    role_id: Optional[str]
    role_name: Optional[str]
    head_team_ids: list[str] = []
    head_team_names: list[str] = []
    has_admin_access: bool = False

    model_config = {"from_attributes": True}

    @model_validator(mode='before')
    @classmethod
    def resolve_member_detail(cls, obj: Any) -> Any:
        if not hasattr(obj, '__dict__'):
            return obj
        role = getattr(obj, 'role', None)
        obj.__dict__.setdefault('role_name', role.name if role else None)
        # Team name from the direct team FK (not head assignments)
        # We'll resolve this in the router via joinedload
        obj.__dict__.setdefault('team_name', None)
        head_assignments = getattr(obj, 'head_assignments', [])
        obj.__dict__.setdefault('head_team_ids', [a.team_id for a in head_assignments])
        obj.__dict__.setdefault('head_team_names', [a.team.name for a in head_assignments if a.team])
        return obj


class TeamWithMembersOut(BaseModel):
    id: str
    name: str
    member_count: int
    members: list[MemberDetailOut] = []

    model_config = {"from_attributes": True}


class TeamCreate(BaseModel):
    name: str


class TeamUpdate(BaseModel):
    name: str


class TeamPermissionsOut(BaseModel):
    team_id: str
    tasks: bool
    kpi: bool
    workload: bool
    pipelines: bool
    ai_subscriptions: bool
    project_lifecycle: bool
    tracker: bool
    cost: bool
    liveops: bool
    devops: bool
    agent: bool


class TeamPermissionUpdate(BaseModel):
    feature: str
    enabled: bool


class MemberCreate(BaseModel):
    name: str
    email: Optional[str] = None
    role_name: str
    team_id: Optional[str] = None
    head_team_ids: Optional[list[str]] = None


class MemberUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    role_name: Optional[str] = None
    team_id: Optional[str] = None
    head_team_ids: Optional[list[str]] = None
    has_admin_access: Optional[bool] = None
    unassign_team: bool = False


# ── Cost ──────────────────────────────────────────────────────────────────────

class CostEntryOut(BaseModel):
    id: str
    category: str
    service_name: str
    service_description: Optional[str]
    month: str
    amount_cents: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CostEntryCreate(BaseModel):
    category: str
    service_name: str
    service_description: Optional[str] = None
    month: str
    amount_cents: int


class CostEntryUpdate(BaseModel):
    category: Optional[str] = None
    service_name: Optional[str] = None
    service_description: Optional[str] = None
    month: Optional[str] = None
    amount_cents: Optional[int] = None


class CostMonthTotal(BaseModel):
    database: int = 0
    compute: int = 0
    agent: int = 0

    @computed_field
    @property
    def total(self) -> int:
        return self.database + self.compute + self.agent


class CostHistoryPoint(BaseModel):
    month: str
    database: int = 0
    compute: int = 0
    agent: int = 0


class CostSummaryOut(BaseModel):
    current_month: str
    current: CostMonthTotal
    previous: Optional[CostMonthTotal]
    history: list[CostHistoryPoint]
    entries: list[CostEntryOut]


# ── LiveOps Ticketing ─────────────────────────────────────────────────────────

class LiveOpsBusinessUnitOut(BaseModel):
    id: str
    name: str
    is_active: bool
    model_config = {"from_attributes": True}


class LiveOpsTicketTypeOut(BaseModel):
    id: str
    name: str
    guide_text: Optional[str]
    is_active: bool
    sort_order: int
    model_config = {"from_attributes": True}


class LiveOpsUseCaseOut(BaseModel):
    id: str
    business_unit_id: str
    business_unit_name: str = ""
    name: str
    is_active: bool

    @model_validator(mode="before")
    @classmethod
    def resolve(cls, obj: Any) -> Any:
        if hasattr(obj, "__dict__"):
            bu = getattr(obj, "business_unit", None)
            obj.__dict__.setdefault("business_unit_name", bu.name if bu else "")
        return obj

    model_config = {"from_attributes": True}


class LiveOpsApproverConfigOut(BaseModel):
    id: str
    ticket_type_id: str
    ticket_type_name: str = ""
    business_unit_id: str
    business_unit_name: str = ""
    workstream_lead_id: Optional[str]
    workstream_lead_name: str = ""
    team_lead_id: Optional[str]
    team_lead_name: str = ""

    @model_validator(mode="before")
    @classmethod
    def resolve(cls, obj: Any) -> Any:
        if hasattr(obj, "__dict__"):
            tt  = getattr(obj, "ticket_type",     None)
            bu  = getattr(obj, "business_unit",   None)
            wl  = getattr(obj, "workstream_lead", None)
            tl  = getattr(obj, "team_lead",       None)
            obj.__dict__.setdefault("ticket_type_name",     tt.name if tt else "")
            obj.__dict__.setdefault("business_unit_name",   bu.name if bu else "")
            obj.__dict__.setdefault("workstream_lead_name", wl.name if wl else "")
            obj.__dict__.setdefault("team_lead_name",       tl.name if tl else "")
        return obj

    model_config = {"from_attributes": True}


class LiveOpsApproverConfigCreate(BaseModel):
    ticket_type_id: str
    business_unit_id: str
    workstream_lead_id: Optional[str] = None
    team_lead_id: Optional[str] = None


class LiveOpsMemberRoleOut(BaseModel):
    id: str
    member_id: str
    member_name: str = ""
    role: str

    @model_validator(mode="before")
    @classmethod
    def resolve(cls, obj: Any) -> Any:
        if hasattr(obj, "__dict__"):
            m = getattr(obj, "member", None)
            obj.__dict__.setdefault("member_name", m.name if m else "")
        return obj

    model_config = {"from_attributes": True}


class LiveOpsMemberRoleCreate(BaseModel):
    member_id: str
    role: str


class LiveOpsSlaConfigOut(BaseModel):
    id: str
    urgency: str
    response_hours: int
    model_config = {"from_attributes": True}


class LiveOpsSlaConfigUpdate(BaseModel):
    response_hours: int


# ── Ticket schemas ────────────────────────────────────────────────────────────

class LiveOpsTicketCreate(BaseModel):
    ticket_type_id: str
    use_case_id: str
    business_unit_id: str
    urgency: str          # low | medium | high
    description: str
    submit: bool = False  # True = create and immediately submit (skip draft)


class LiveOpsAssignmentOut(BaseModel):
    id: str
    ticket_id: str
    assignee_id: str
    assignee_name: str = ""
    assigned_by_id: Optional[str]
    assigned_by_name: str = ""
    lo_message: Optional[str]
    status: str
    assigned_at: datetime
    picked_up_at: Optional[datetime]
    completed_at: Optional[datetime]
    rejected_at: Optional[datetime]
    rejection_reason: Optional[str]

    @model_validator(mode="before")
    @classmethod
    def resolve(cls, obj: Any) -> Any:
        if hasattr(obj, "__dict__"):
            a  = getattr(obj, "assignee",    None)
            ab = getattr(obj, "assigned_by", None)
            obj.__dict__.setdefault("assignee_name",    a.name  if a  else "")
            obj.__dict__.setdefault("assigned_by_name", ab.name if ab else "")
        return obj

    model_config = {"from_attributes": True}


class LiveOpsCommentOut(BaseModel):
    id: str
    ticket_id: str
    author_id: Optional[str]
    author_name: str = ""
    body: str
    is_system: bool
    created_at: datetime

    @model_validator(mode="before")
    @classmethod
    def resolve(cls, obj: Any) -> Any:
        if hasattr(obj, "__dict__"):
            a = getattr(obj, "author", None)
            obj.__dict__.setdefault("author_name", a.name if a else "System")
        return obj

    model_config = {"from_attributes": True}


class LiveOpsCommentCreate(BaseModel):
    body: str


class LiveOpsEventOut(BaseModel):
    id: str
    ticket_id: str
    actor_id: Optional[str]
    actor_name: str = ""
    event_type: str
    event_data: Optional[str]
    created_at: datetime

    @model_validator(mode="before")
    @classmethod
    def resolve(cls, obj: Any) -> Any:
        if hasattr(obj, "__dict__"):
            a = getattr(obj, "actor", None)
            obj.__dict__.setdefault("actor_name", a.name if a else "System")
        return obj

    model_config = {"from_attributes": True}


class LiveOpsTicketListItem(BaseModel):
    id: str
    ticket_number: int
    ticket_type_id: str = ""
    ticket_type_name: str = ""
    use_case_id: str = ""
    use_case_name: str = ""
    business_unit_id: str = ""
    business_unit_name: str = ""
    urgency: str
    status: str
    submitted_by_id: str = ""
    submitted_by_name: str = ""
    workstream_lead_id: Optional[str] = None
    workstream_lead_name: str = ""
    team_lead_id: Optional[str] = None
    team_lead_name: str = ""
    currently_with_id: Optional[str] = None
    currently_with_name: str = ""
    wl_status: str = "pending"
    tl_status: str = "pending"
    lo_status: str = "pending"
    submitted_at: Optional[datetime]
    sla_deadline: Optional[datetime]
    created_at: datetime

    @model_validator(mode="before")
    @classmethod
    def resolve(cls, obj: Any) -> Any:
        if hasattr(obj, "__dict__"):
            tt  = getattr(obj, "ticket_type",     None)
            uc  = getattr(obj, "use_case",        None)
            bu  = getattr(obj, "business_unit",   None)
            sb  = getattr(obj, "submitted_by",    None)
            cw  = getattr(obj, "currently_with",  None)
            wl  = getattr(obj, "workstream_lead", None)
            tl  = getattr(obj, "team_lead",       None)
            obj.__dict__.setdefault("ticket_type_id",   tt.id   if tt else "")
            obj.__dict__.setdefault("ticket_type_name", tt.name if tt else "")
            obj.__dict__.setdefault("use_case_id",        uc.id   if uc else "")
            obj.__dict__.setdefault("use_case_name",      uc.name if uc else "")
            obj.__dict__.setdefault("business_unit_id",   bu.id   if bu else "")
            obj.__dict__.setdefault("business_unit_name", bu.name if bu else "")
            obj.__dict__.setdefault("submitted_by_id",    sb.id   if sb else "")
            obj.__dict__.setdefault("submitted_by_name",  sb.name if sb else "")
            obj.__dict__.setdefault("workstream_lead_name", wl.name if wl else "")
            obj.__dict__.setdefault("team_lead_name",     tl.name if tl else "")
            obj.__dict__.setdefault("currently_with_name", cw.name if cw else "")
        return obj

    model_config = {"from_attributes": True}


class LiveOpsTicketDetail(LiveOpsTicketListItem):
    description: str
    wl_status: str = "pending"
    wl_actor_name: str = ""
    wl_acted_at: Optional[datetime]
    wl_reason: Optional[str]
    tl_status: str = "pending"
    tl_actor_name: str = ""
    tl_acted_at: Optional[datetime]
    tl_reason: Optional[str]
    lo_status: str = "pending"
    lo_actor_name: str = ""
    lo_acted_at: Optional[datetime]
    lo_reason: Optional[str]
    cancelled_by_name: str = ""
    cancelled_at: Optional[datetime]
    cancel_reason: Optional[str]
    on_hold_reason: Optional[str]
    put_on_hold_at: Optional[datetime]
    completed_at: Optional[datetime]
    updated_at: datetime
    assignments: list[LiveOpsAssignmentOut] = []
    comments: list[LiveOpsCommentOut] = []
    events: list[LiveOpsEventOut] = []

    @model_validator(mode="before")
    @classmethod
    def resolve(cls, obj: Any) -> Any:
        if hasattr(obj, "__dict__"):
            LiveOpsTicketListItem.resolve(obj)
            wla = getattr(obj, "wl_actor",     None)
            tla = getattr(obj, "tl_actor",     None)
            loa = getattr(obj, "lo_actor",     None)
            cb  = getattr(obj, "cancelled_by", None)
            obj.__dict__.setdefault("wl_actor_name",     wla.name if wla else "")
            obj.__dict__.setdefault("tl_actor_name",     tla.name if tla else "")
            obj.__dict__.setdefault("lo_actor_name",     loa.name if loa else "")
            obj.__dict__.setdefault("cancelled_by_name", cb.name  if cb  else "")
        return obj

    model_config = {"from_attributes": True}


# ── Action body schemas ───────────────────────────────────────────────────────

class LiveOpsApproveBody(BaseModel):
    reason: Optional[str] = None
    assignee_id: Optional[str] = None   # required when approving at pending_lo stage
    lo_message: Optional[str] = None    # message for the assignee


class LiveOpsPushBackBody(BaseModel):
    reason: str


class LiveOpsRejectBody(BaseModel):
    reason: str


class LiveOpsAssignBody(BaseModel):
    assignee_id: str
    lo_message: Optional[str] = None


class LiveOpsReassignBody(BaseModel):
    assignee_id: str
    lo_message: Optional[str] = None
    reason: Optional[str] = None


class LiveOpsHoldBody(BaseModel):
    reason: str


class LiveOpsCancelBody(BaseModel):
    reason: str


class LiveOpsCompleteBody(BaseModel):
    note: Optional[str] = None


class LiveOpsTicketPatch(BaseModel):
    description: Optional[str] = None
    urgency: Optional[str] = None


class LiveOpsRejectAssignmentBody(BaseModel):
    reason: str


class LiveOpsOverrideUrgencyBody(BaseModel):
    urgency: str
    reason: Optional[str] = None


# ── Assignable member (for assignment UI) ─────────────────────────────────────

class LiveOpsAssignableMember(BaseModel):
    id: str
    name: str
    active_assignment_count: int = 0
    model_config = {"from_attributes": True}


# ── Analytics ─────────────────────────────────────────────────────────────────

class LiveOpsAnalyticsSummary(BaseModel):
    total_open: int
    pending_approval: int
    in_progress: int
    sla_breaching: int
    completed_this_month: int
    avg_resolution_hours: Optional[float]
