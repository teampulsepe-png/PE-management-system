import uuid
from sqlalchemy import (
    Column, String, Boolean, Text, TIMESTAMP, Integer,
    ForeignKey, UniqueConstraint, CheckConstraint, Enum as SAEnum,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base


class Team(Base):
    __tablename__ = "teams"

    id         = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name       = Column(String, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)


class Task(Base):
    __tablename__ = "tasks"

    id          = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title       = Column(String, nullable=False)
    description = Column(Text)
    recurrence  = Column(SAEnum('weekly', 'monthly', 'quarterly', 'annually', name='recurrence_type', create_type=False), nullable=False)
    team_id     = Column(String, ForeignKey("teams.id", ondelete="RESTRICT"), nullable=False)
    is_active   = Column(Boolean, nullable=False, default=True)
    created_at  = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint(
            "recurrence IN ('weekly','monthly','quarterly','annually')",
            name="tasks_recurrence_check",
        ),
    )


class TaskOccurrence(Base):
    __tablename__ = "task_occurrences"

    id               = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    task_id          = Column(String, ForeignKey("tasks.id", ondelete="RESTRICT"), nullable=False)
    period           = Column(String, nullable=False)
    status           = Column(SAEnum('pending', 'in_progress', 'done', 'skipped', name='occurrence_status', create_type=False), nullable=False, default="pending")
    completed_by     = Column(String)
    completion_notes = Column(Text)
    completed_at     = Column(TIMESTAMP(timezone=True))
    created_at       = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at       = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("task_id", "period", name="task_occurrences_unique"),
        CheckConstraint(
            "status IN ('pending','in_progress','done','skipped')",
            name="task_occurrences_status_check",
        ),
    )


class TaskComment(Base):
    __tablename__ = "task_comments"

    id            = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    occurrence_id = Column(String, ForeignKey("task_occurrences.id", ondelete="CASCADE"), nullable=False)
    author        = Column(String, nullable=False)
    body          = Column(Text, nullable=False)
    created_at    = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)


class TaskIdCounter(Base):
    __tablename__ = "task_id_counters"

    team_id    = Column(String, ForeignKey("teams.id", ondelete="RESTRICT"), nullable=False, primary_key=True)
    recurrence = Column(String, nullable=False, primary_key=True)
    year       = Column(Integer, nullable=False, primary_key=True)
    counter    = Column(Integer, nullable=False, default=0)


class Notification(Base):
    __tablename__ = "notifications"

    id                  = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    recipient_member_id = Column(String, ForeignKey("team_members.id", ondelete="CASCADE"), nullable=False)
    type                = Column(String, nullable=False)
    task_id             = Column(String, ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True)
    task_recurrence     = Column(String, nullable=True)
    occurrence_id       = Column(String, ForeignKey("task_occurrences.id", ondelete="SET NULL"), nullable=True)
    comment_id          = Column(String, ForeignKey("task_comments.id", ondelete="SET NULL"), nullable=True)
    triggered_by_name   = Column(String, nullable=True)
    message             = Column(String, nullable=False)
    is_read             = Column(Boolean, nullable=False, default=False)
    created_at          = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)


class KpiMetric(Base):
    __tablename__ = "kpi_metrics"

    id                      = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    category                = Column(String, nullable=False)
    year                    = Column(Integer, nullable=False)
    metric_name             = Column(String, nullable=False)
    pdca                    = Column(String, nullable=False, default='plan')
    frequency               = Column(SAEnum('monthly', 'quarterly', 'annually', name='kpi_frequency', create_type=False), nullable=False, default='monthly')
    kpi_owner_id            = Column(String, ForeignKey("team_members.id", ondelete="RESTRICT"), nullable=True)
    responsible_party_id    = Column(String, ForeignKey("team_members.id", ondelete="SET NULL"), nullable=True)
    planned                 = Column(Integer, nullable=False)
    target                  = Column(Integer, nullable=False, default=100)
    remarks                 = Column(Text, nullable=True)
    created_at              = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

    evaluations             = relationship("KpiEvaluation", back_populates="metric", cascade="all, delete-orphan", order_by="KpiEvaluation.period_order")
    kpi_owner_member        = relationship("TeamMember", foreign_keys=[kpi_owner_id])
    responsible_member      = relationship("TeamMember", foreign_keys=[responsible_party_id])


class KpiEvaluation(Base):
    __tablename__ = "kpi_evaluations"

    id             = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    kpi_metric_id  = Column(String, ForeignKey("kpi_metrics.id", ondelete="CASCADE"), nullable=False)
    period_label   = Column(String, nullable=False)
    period_order   = Column(Integer, nullable=False)
    actual         = Column(Integer, nullable=True)
    completed_at   = Column(TIMESTAMP(timezone=True), nullable=True)
    created_at     = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

    metric         = relationship("KpiMetric", back_populates="evaluations")
    entries        = relationship("KpiEvaluationEntry", back_populates="evaluation", cascade="all, delete-orphan", order_by="KpiEvaluationEntry.done_at")


class KpiEvaluationEntry(Base):
    __tablename__ = "kpi_evaluation_entries"

    id                = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    kpi_evaluation_id = Column(String, ForeignKey("kpi_evaluations.id", ondelete="CASCADE"), nullable=False)
    done_at           = Column(String, nullable=False)  # ISO date "YYYY-MM-DD"
    created_at        = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

    evaluation = relationship("KpiEvaluation", back_populates="entries")


class Department(Base):
    __tablename__ = "departments"

    id         = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name       = Column(String, nullable=False, unique=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

    subscriptions = relationship("AiSubscription", back_populates="department")


class AiTool(Base):
    __tablename__ = "ai_tools"

    id           = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name         = Column(String, nullable=False)           # "Claude", "Copilot"
    tier         = Column(String, nullable=True)            # None, "Enterprise", "Business"
    monthly_cost = Column(Integer, nullable=False)          # stored as cents to avoid float issues
    created_at   = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

    subscriptions = relationship("AiSubscription", back_populates="tool")


class AiSubscription(Base):
    __tablename__ = "ai_subscriptions"

    id              = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    subscriber_name = Column(String, nullable=False)
    email           = Column(String, nullable=False)
    department_id   = Column(String, ForeignKey("departments.id", ondelete="RESTRICT"), nullable=False)
    tool_id         = Column(String, ForeignKey("ai_tools.id", ondelete="RESTRICT"), nullable=False)
    start_date      = Column(String, nullable=False)        # ISO "YYYY-MM-DD"
    end_date        = Column(String, nullable=True)         # null = ongoing
    remarks         = Column(Text, nullable=True)
    created_at      = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

    department = relationship("Department", back_populates="subscriptions")
    tool       = relationship("AiTool", back_populates="subscriptions")
    addons     = relationship("AiSubscriptionAddon", back_populates="subscription",
                              cascade="all, delete-orphan", order_by="AiSubscriptionAddon.start_date")


class AiSubscriptionAddon(Base):
    __tablename__ = "ai_subscription_addons"

    id              = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    subscription_id = Column(String, ForeignKey("ai_subscriptions.id", ondelete="CASCADE"), nullable=False)
    credits         = Column(Integer, nullable=False)
    start_date      = Column(String, nullable=False)        # ISO "YYYY-MM-DD"
    end_date        = Column(String, nullable=False)        # auto-set to start + 1 month
    remarks         = Column(Text, nullable=True)
    created_at      = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

    subscription = relationship("AiSubscription", back_populates="addons")


class Project(Base):
    __tablename__ = "projects"

    id          = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name        = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    status      = Column(String, nullable=False, default="active")  # draft, active, complete
    owner_id    = Column(String, ForeignKey("team_members.id", ondelete="SET NULL"), nullable=True)
    created_at  = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

    owner       = relationship("TeamMember", foreign_keys="[Project.owner_id]")
    items       = relationship("ProjectItem", back_populates="project", cascade="all, delete-orphan",
                               order_by="ProjectItem.sort_order")
    access_logs = relationship("UserAccessLog", back_populates="project", cascade="all, delete-orphan")


class ProjectItem(Base):
    __tablename__ = "project_items"

    id           = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id   = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    phase        = Column(String, nullable=False)   # initiation, governance, dynamics
    item_key     = Column(String, nullable=False)
    sort_order   = Column(Integer, nullable=False, default=0)
    owner_id     = Column(String, ForeignKey("team_members.id", ondelete="SET NULL"), nullable=True)
    deadline     = Column(String, nullable=True)    # ISO "YYYY-MM-DD"
    deliverable  = Column(Text, nullable=True)
    status       = Column(String, nullable=False, default="pending")  # pending, in_progress, done
    completed_at = Column(String, nullable=True)
    created_at   = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

    project = relationship("Project", back_populates="items")
    owner   = relationship("TeamMember", foreign_keys="[ProjectItem.owner_id]")


class UserAccessLog(Base):
    __tablename__ = "user_access_logs"

    id             = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id     = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    member_id      = Column(String, ForeignKey("team_members.id", ondelete="RESTRICT"), nullable=False)
    action         = Column(String, nullable=False)   # grant, revoke
    actioned_by_id = Column(String, ForeignKey("team_members.id", ondelete="SET NULL"), nullable=True)
    notes          = Column(Text, nullable=True)
    actioned_at    = Column(String, nullable=False)   # ISO "YYYY-MM-DD"
    created_at     = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

    project      = relationship("Project", back_populates="access_logs")
    member       = relationship("TeamMember", foreign_keys="[UserAccessLog.member_id]")
    actioned_by  = relationship("TeamMember", foreign_keys="[UserAccessLog.actioned_by_id]")


class PushSubscription(Base):
    __tablename__ = "push_subscriptions"

    id         = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_email = Column(String, nullable=False, index=True)
    endpoint   = Column(Text, nullable=False, unique=True)
    p256dh     = Column(Text, nullable=False)
    auth       = Column(Text, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)


class Role(Base):
    __tablename__ = "roles"

    id         = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name       = Column(String, nullable=False, unique=True)  # 'dev', 'lead', 'head'
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

    members    = relationship("TeamMember", back_populates="role")


class TeamMember(Base):
    __tablename__ = "team_members"

    id               = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    team_id          = Column(String, ForeignKey("teams.id", ondelete="CASCADE"), nullable=True)
    name             = Column(String, nullable=False)
    email            = Column(String)
    role_id          = Column(String, ForeignKey("roles.id", ondelete="RESTRICT"), nullable=True)
    has_admin_access = Column(Boolean, nullable=False, default=False, server_default='false')
    created_at       = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

    role             = relationship("Role", back_populates="members")
    head_assignments = relationship("HeadTeamAssignment", back_populates="member", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("team_id", "name", name="team_members_unique_name"),
    )


class HeadTeamAssignment(Base):
    __tablename__ = "head_team_assignments"

    id          = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    member_id   = Column(String, ForeignKey("team_members.id", ondelete="CASCADE"), nullable=False)
    team_id     = Column(String, ForeignKey("teams.id", ondelete="CASCADE"), nullable=False)
    assigned_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

    member = relationship("TeamMember", back_populates="head_assignments")
    team   = relationship("Team")

    __table_args__ = (
        UniqueConstraint("member_id", "team_id", name="head_team_assignments_unique"),
    )


class TeamFeatureFlag(Base):
    __tablename__ = "team_feature_flags"

    id         = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    team_id    = Column(String, ForeignKey("teams.id", ondelete="CASCADE"), nullable=False)
    feature    = Column(String, nullable=False)
    enabled    = Column(Boolean, nullable=False, default=True, server_default='true')
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("team_id", "feature", name="team_feature_flags_unique"),
    )


class TrackerArea(Base):
    __tablename__ = "tracker_areas"

    id         = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name       = Column(String, nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

    groups     = relationship("TrackerGroup", back_populates="area", cascade="all, delete-orphan",
                              order_by="TrackerGroup.sort_order")


class TrackerGroup(Base):
    __tablename__ = "tracker_groups"

    id         = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    area_id    = Column(String, ForeignKey("tracker_areas.id", ondelete="CASCADE"), nullable=False)
    name       = Column(String, nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

    area       = relationship("TrackerArea", back_populates="groups")
    tasks      = relationship("TrackerTask", back_populates="group", cascade="all, delete-orphan",
                              order_by="TrackerTask.sort_order")


class TrackerTask(Base):
    __tablename__ = "tracker_tasks"

    id               = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    group_id         = Column(String, ForeignKey("tracker_groups.id", ondelete="CASCADE"), nullable=False)
    title            = Column(String, nullable=False)
    owner            = Column(String, nullable=True)
    planned_end_date = Column(String, nullable=True)  # ISO "YYYY-MM-DD"; null = ongoing
    sort_order       = Column(Integer, nullable=False, default=0)
    created_at       = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

    group            = relationship("TrackerGroup", back_populates="tasks")
    subtasks         = relationship("TrackerSubtask", back_populates="task", cascade="all, delete-orphan",
                                    order_by="TrackerSubtask.sort_order")


class TrackerSubtask(Base):
    __tablename__ = "tracker_subtasks"

    id         = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    task_id    = Column(String, ForeignKey("tracker_tasks.id", ondelete="CASCADE"), nullable=False)
    title      = Column(String, nullable=False)
    date       = Column(String, nullable=True)    # ISO "YYYY-MM-DD"
    remarks    = Column(Text, nullable=True)
    is_done    = Column(Boolean, nullable=False, default=False)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

    task       = relationship("TrackerTask", back_populates="subtasks")


class SupervisorTask(Base):
    __tablename__ = "supervisor_tasks"

    id          = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title       = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    size        = Column(String, nullable=False)                           # S, M, L
    status      = Column(String, nullable=False, default='pending')        # pending, in_progress, completed, extended
    start_date  = Column(String, nullable=False)                           # ISO "YYYY-MM-DD"
    due_date    = Column(String, nullable=False)                           # ISO "YYYY-MM-DD"
    created_by  = Column(String, nullable=True)
    created_at  = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at  = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

    assignments = relationship("SupervisorTaskAssignment", back_populates="task", cascade="all, delete-orphan")


class SupervisorTaskAssignment(Base):
    __tablename__ = "supervisor_task_assignments"

    id        = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    task_id   = Column(String, ForeignKey("supervisor_tasks.id", ondelete="CASCADE"), nullable=False)
    member_id = Column(String, ForeignKey("team_members.id", ondelete="CASCADE"), nullable=False)

    task   = relationship("SupervisorTask", back_populates="assignments")
    member = relationship("TeamMember")

    __table_args__ = (
        UniqueConstraint("task_id", "member_id", name="supervisor_task_assignments_unique"),
    )


class CostEntry(Base):
    __tablename__ = "cost_entries"

    id                  = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    category            = Column(String, nullable=False)   # 'database' | 'compute' | 'agent'
    service_name        = Column(String, nullable=False)
    service_description = Column(String, nullable=True)
    month               = Column(String, nullable=False)   # "YYYY-MM"
    amount_cents        = Column(Integer, nullable=False)
    created_at          = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at          = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


# ── LiveOps Ticketing ─────────────────────────────────────────────────────────

class LiveOpsBusinessUnit(Base):
    __tablename__ = "liveops_business_units"

    id         = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name       = Column(String, nullable=False, unique=True)
    is_active  = Column(Boolean, nullable=False, default=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

    use_cases       = relationship("LiveOpsUseCase", back_populates="business_unit")
    approver_configs = relationship("LiveOpsApproverConfig", back_populates="business_unit")


class LiveOpsTicketType(Base):
    __tablename__ = "liveops_ticket_types"

    id         = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name       = Column(String, nullable=False, unique=True)
    guide_text = Column(Text, nullable=True)
    is_active  = Column(Boolean, nullable=False, default=True)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

    approver_configs = relationship("LiveOpsApproverConfig", back_populates="ticket_type")


class LiveOpsUseCase(Base):
    __tablename__ = "liveops_use_cases"

    id               = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    business_unit_id = Column(String, ForeignKey("liveops_business_units.id", ondelete="RESTRICT"), nullable=False)
    name             = Column(String, nullable=False)
    is_active        = Column(Boolean, nullable=False, default=True)
    created_at       = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

    business_unit = relationship("LiveOpsBusinessUnit", back_populates="use_cases")

    __table_args__ = (
        UniqueConstraint("business_unit_id", "name", name="liveops_use_cases_unique"),
    )


class LiveOpsApproverConfig(Base):
    """Routing table: ticket_type + BU → which WL and TL approves."""
    __tablename__ = "liveops_approver_configs"

    id                  = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    ticket_type_id      = Column(String, ForeignKey("liveops_ticket_types.id", ondelete="CASCADE"), nullable=False)
    business_unit_id    = Column(String, ForeignKey("liveops_business_units.id", ondelete="CASCADE"), nullable=False)
    workstream_lead_id  = Column(String, ForeignKey("team_members.id", ondelete="SET NULL"), nullable=True)
    team_lead_id        = Column(String, ForeignKey("team_members.id", ondelete="SET NULL"), nullable=True)
    created_at          = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

    ticket_type     = relationship("LiveOpsTicketType", back_populates="approver_configs")
    business_unit   = relationship("LiveOpsBusinessUnit", back_populates="approver_configs")
    workstream_lead = relationship("TeamMember", foreign_keys=[workstream_lead_id])
    team_lead       = relationship("TeamMember", foreign_keys=[team_lead_id])

    __table_args__ = (
        UniqueConstraint("ticket_type_id", "business_unit_id", name="liveops_approver_configs_unique"),
    )


class LiveOpsMemberRole(Base):
    """Assigns liveops-specific roles to members (separate from the main RBAC)."""
    __tablename__ = "liveops_member_roles"

    id        = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    member_id = Column(String, ForeignKey("team_members.id", ondelete="CASCADE"), nullable=False)
    # workstream_lead | team_lead | lo_manager | platform_engineer
    role      = Column(String, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

    member = relationship("TeamMember")

    __table_args__ = (
        UniqueConstraint("member_id", "role", name="liveops_member_roles_unique"),
        CheckConstraint(
            "role IN ('workstream_lead','team_lead','lo_manager','platform_engineer')",
            name="liveops_member_roles_role_check",
        ),
    )


class LiveOpsSlaConfig(Base):
    """SLA response hours per urgency level. Seeded; admin-editable."""
    __tablename__ = "liveops_sla_configs"

    id             = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    urgency        = Column(String, nullable=False, unique=True)  # low | medium | high
    response_hours = Column(Integer, nullable=False)
    created_at     = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at     = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint("urgency IN ('low','medium','high')", name="liveops_sla_configs_urgency_check"),
    )


class LiveOpsTicket(Base):
    __tablename__ = "liveops_tickets"

    id            = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    ticket_number = Column(Integer, nullable=False, unique=True)

    # Classification
    ticket_type_id   = Column(String, ForeignKey("liveops_ticket_types.id", ondelete="RESTRICT"), nullable=False)
    use_case_id      = Column(String, ForeignKey("liveops_use_cases.id", ondelete="RESTRICT"), nullable=False)
    business_unit_id = Column(String, ForeignKey("liveops_business_units.id", ondelete="RESTRICT"), nullable=False)
    urgency          = Column(String, nullable=False)   # low | medium | high
    description      = Column(Text, nullable=False)

    # Submitter
    submitted_by_id = Column(String, ForeignKey("team_members.id", ondelete="RESTRICT"), nullable=False)
    submitted_at    = Column(TIMESTAMP(timezone=True), nullable=True)   # null while draft
    sla_deadline    = Column(TIMESTAMP(timezone=True), nullable=True)   # set at submit

    # Approval chain — copied from LiveOpsApproverConfig at submit time
    workstream_lead_id = Column(String, ForeignKey("team_members.id", ondelete="SET NULL"), nullable=True)
    team_lead_id       = Column(String, ForeignKey("team_members.id", ondelete="SET NULL"), nullable=True)

    # Per-stage audit
    wl_status   = Column(String, nullable=False, default="pending")   # pending|approved|rejected|pushed_back
    wl_actor_id = Column(String, ForeignKey("team_members.id", ondelete="SET NULL"), nullable=True)
    wl_acted_at = Column(TIMESTAMP(timezone=True), nullable=True)
    wl_reason   = Column(Text, nullable=True)

    tl_status   = Column(String, nullable=False, default="pending")   # pending|approved|rejected|pushed_back|na
    tl_actor_id = Column(String, ForeignKey("team_members.id", ondelete="SET NULL"), nullable=True)
    tl_acted_at = Column(TIMESTAMP(timezone=True), nullable=True)
    tl_reason   = Column(Text, nullable=True)

    lo_status   = Column(String, nullable=False, default="pending")   # pending|approved|rejected
    lo_actor_id = Column(String, ForeignKey("team_members.id", ondelete="SET NULL"), nullable=True)
    lo_acted_at = Column(TIMESTAMP(timezone=True), nullable=True)
    lo_reason   = Column(Text, nullable=True)

    # Overall status
    # draft|pending_wl|pending_tl|pending_lo|open|in_progress|completed|rejected|cancelled|on_hold
    status = Column(String, nullable=False, default="draft")

    currently_with_id = Column(String, ForeignKey("team_members.id", ondelete="SET NULL"), nullable=True)

    # Terminal / hold states
    cancelled_by_id = Column(String, ForeignKey("team_members.id", ondelete="SET NULL"), nullable=True)
    cancelled_at    = Column(TIMESTAMP(timezone=True), nullable=True)
    cancel_reason   = Column(Text, nullable=True)

    on_hold_reason  = Column(Text, nullable=True)
    put_on_hold_at  = Column(TIMESTAMP(timezone=True), nullable=True)
    completed_at    = Column(TIMESTAMP(timezone=True), nullable=True)

    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    ticket_type     = relationship("LiveOpsTicketType")
    use_case        = relationship("LiveOpsUseCase")
    business_unit   = relationship("LiveOpsBusinessUnit")
    submitted_by    = relationship("TeamMember", foreign_keys=[submitted_by_id])
    workstream_lead = relationship("TeamMember", foreign_keys=[workstream_lead_id])
    team_lead       = relationship("TeamMember", foreign_keys=[team_lead_id])
    wl_actor        = relationship("TeamMember", foreign_keys=[wl_actor_id])
    tl_actor        = relationship("TeamMember", foreign_keys=[tl_actor_id])
    lo_actor        = relationship("TeamMember", foreign_keys=[lo_actor_id])
    currently_with  = relationship("TeamMember", foreign_keys=[currently_with_id])
    cancelled_by    = relationship("TeamMember", foreign_keys=[cancelled_by_id])

    assignments = relationship("LiveOpsAssignment", back_populates="ticket",
                               cascade="all, delete-orphan", order_by="LiveOpsAssignment.assigned_at")
    comments    = relationship("LiveOpsComment", back_populates="ticket",
                               cascade="all, delete-orphan", order_by="LiveOpsComment.created_at")
    events      = relationship("LiveOpsTicketEvent", back_populates="ticket",
                               cascade="all, delete-orphan", order_by="LiveOpsTicketEvent.created_at")

    __table_args__ = (
        CheckConstraint("urgency IN ('low','medium','high')", name="liveops_tickets_urgency_check"),
        CheckConstraint(
            "status IN ('draft','pending_wl','pending_tl','pending_lo','open','in_progress','completed','rejected','cancelled','on_hold')",
            name="liveops_tickets_status_check",
        ),
    )


class LiveOpsAssignment(Base):
    __tablename__ = "liveops_assignments"

    id             = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    ticket_id      = Column(String, ForeignKey("liveops_tickets.id", ondelete="CASCADE"), nullable=False)
    assignee_id    = Column(String, ForeignKey("team_members.id", ondelete="RESTRICT"), nullable=False)
    assigned_by_id = Column(String, ForeignKey("team_members.id", ondelete="SET NULL"), nullable=True)
    lo_message     = Column(Text, nullable=True)
    # pending | active | completed | rejected
    status         = Column(String, nullable=False, default="pending")
    assigned_at    = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    picked_up_at   = Column(TIMESTAMP(timezone=True), nullable=True)
    completed_at   = Column(TIMESTAMP(timezone=True), nullable=True)
    rejected_at    = Column(TIMESTAMP(timezone=True), nullable=True)
    rejection_reason = Column(Text, nullable=True)

    ticket      = relationship("LiveOpsTicket", back_populates="assignments")
    assignee    = relationship("TeamMember", foreign_keys=[assignee_id])
    assigned_by = relationship("TeamMember", foreign_keys=[assigned_by_id])

    __table_args__ = (
        CheckConstraint(
            "status IN ('pending','active','completed','rejected')",
            name="liveops_assignments_status_check",
        ),
    )


class LiveOpsComment(Base):
    __tablename__ = "liveops_comments"

    id        = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    ticket_id = Column(String, ForeignKey("liveops_tickets.id", ondelete="CASCADE"), nullable=False)
    author_id = Column(String, ForeignKey("team_members.id", ondelete="SET NULL"), nullable=True)
    body      = Column(Text, nullable=False)
    is_system = Column(Boolean, nullable=False, default=False)  # True = auto-generated on state change
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

    ticket = relationship("LiveOpsTicket", back_populates="comments")
    author = relationship("TeamMember", foreign_keys=[author_id])


class LiveOpsTicketEvent(Base):
    """Immutable audit log — one row per state transition or significant action."""
    __tablename__ = "liveops_ticket_events"

    id         = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    ticket_id  = Column(String, ForeignKey("liveops_tickets.id", ondelete="CASCADE"), nullable=False)
    actor_id   = Column(String, ForeignKey("team_members.id", ondelete="SET NULL"), nullable=True)
    event_type = Column(String, nullable=False)
    # submitted|pl_approved|pl_rejected|dl_approved|dl_rejected|lo_approved|lo_rejected|
    # assigned|reassigned|picked_up|completed|assignment_rejected|cancelled|put_on_hold|
    # resumed|comment_added|urgency_changed
    event_data = Column(Text, nullable=True)   # JSON string payload
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

    ticket = relationship("LiveOpsTicket", back_populates="events")
    actor  = relationship("TeamMember", foreign_keys=[actor_id])
