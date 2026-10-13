from datetime import date, datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from backend.db.session import get_db
from backend.db.models import (
    LiveOpsAssignment, LiveOpsTicket,
    TaskOccurrence, Task,
    SupervisorTaskAssignment, SupervisorTask,
    TrackerSubtask, TrackerTask, TrackerGroup, TrackerArea,
)
from backend.dependencies import get_current_member, CurrentMember
from backend.schemas import MyWorkItem, MyWorkResponse, MyWorkSummary

router = APIRouter(prefix="/api/v1/mywork", tags=["mywork"])


def _today() -> date:
    return datetime.now(timezone.utc).date()


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _bucket(due: Optional[date]) -> str:
    today = _today()
    if due is None:
        return "later"
    if due < today:
        return "overdue"
    if due == today:
        return "due_today"
    if due <= today + timedelta(days=7):
        return "this_week"
    return "later"


def _bucket_from_deadline(sla_deadline: Optional[datetime]) -> str:
    if sla_deadline is None:
        return "later"
    now = _now_utc()
    if sla_deadline.tzinfo is None:
        sla_deadline = sla_deadline.replace(tzinfo=timezone.utc)
    due_date = sla_deadline.date()
    today = _today()
    if sla_deadline < now:
        return "overdue"
    if due_date == today:
        return "due_today"
    if due_date <= today + timedelta(days=7):
        return "this_week"
    return "later"


@router.get("", response_model=MyWorkResponse)
def get_my_work(
    db: Session = Depends(get_db),
    current_member: CurrentMember = Depends(get_current_member),
):
    items: list[MyWorkItem] = []

    # ── 1. LiveOps assignments ────────────────────────────────────────────────
    if current_member.id:
        lo_assignments = (
            db.query(LiveOpsAssignment)
            .options(joinedload(LiveOpsAssignment.ticket).joinedload(LiveOpsTicket.business_unit))
            .filter(
                LiveOpsAssignment.assignee_id == current_member.id,
                LiveOpsAssignment.status.in_(["pending", "active"]),
            )
            .all()
        )
        for a in lo_assignments:
            t = a.ticket
            if not t or t.status in ("cancelled", "completed", "rejected"):
                continue
            bu_name = t.business_unit.name if t.business_unit else ""
            subtitle = f"#{t.ticket_number} · {bu_name}" if bu_name else f"#{t.ticket_number}"
            sla_iso: Optional[str] = None
            if t.sla_deadline:
                dl = t.sla_deadline
                if dl.tzinfo is None:
                    dl = dl.replace(tzinfo=timezone.utc)
                sla_iso = dl.isoformat()
            bucket_key = _bucket_from_deadline(t.sla_deadline)
            due_date_str: Optional[str] = t.sla_deadline.date().isoformat() if t.sla_deadline else None
            items.append(MyWorkItem(
                id=a.id,
                source="liveops",
                title=t.description[:80] if t.description else f"Ticket #{t.ticket_number}",
                subtitle=subtitle,
                status=a.status,
                urgency=t.urgency,
                due_at=due_date_str,
                sla_deadline=sla_iso,
                ticket_number=t.ticket_number,
                ticket_id=t.id,
                assignment_id=a.id,
                occurrence_id=None,
                supervisor_task_id=None,
                size=None,
                is_overdue=bucket_key == "overdue",
            ))

    # ── 2. Task occurrences (in_progress for user's team) ─────────────────────
    if current_member.team_id:
        occurrences = (
            db.query(TaskOccurrence)
            .join(Task, Task.id == TaskOccurrence.task_id)
            .filter(
                Task.team_id == current_member.team_id,
                Task.is_active == True,
                TaskOccurrence.status == "in_progress",
            )
            .all()
        )
        task_map: dict[str, Task] = {}
        for occ in occurrences:
            if occ.task_id not in task_map:
                task_obj = db.query(Task).filter(Task.id == occ.task_id).first()
                if task_obj:
                    task_map[occ.task_id] = task_obj
            task_obj = task_map.get(occ.task_id)
            if not task_obj:
                continue
            items.append(MyWorkItem(
                id=occ.id,
                source="task",
                title=task_obj.title,
                subtitle=occ.period,
                status=occ.status,
                urgency=None,
                due_at=None,
                sla_deadline=None,
                ticket_number=None,
                ticket_id=None,
                assignment_id=None,
                occurrence_id=occ.id,
                supervisor_task_id=None,
                size=None,
                is_overdue=False,
            ))

    # ── 3. Supervisor tasks assigned to current member ────────────────────────
    if current_member.id:
        sup_assignments = (
            db.query(SupervisorTaskAssignment)
            .options(joinedload(SupervisorTaskAssignment.task))
            .filter(SupervisorTaskAssignment.member_id == current_member.id)
            .all()
        )
        for sa in sup_assignments:
            st = sa.task
            if not st or st.status in ("completed",):
                continue
            due_date: Optional[date] = None
            if st.due_date:
                try:
                    due_date = date.fromisoformat(st.due_date)
                except ValueError:
                    pass
            bucket_key = _bucket(due_date)
            items.append(MyWorkItem(
                id=sa.id,
                source="supervisor",
                title=st.title,
                subtitle=f"Size {st.size}",
                status=st.status,
                urgency=None,
                due_at=st.due_date,
                sla_deadline=None,
                ticket_number=None,
                ticket_id=None,
                assignment_id=None,
                occurrence_id=None,
                supervisor_task_id=st.id,
                size=st.size,
                is_overdue=bucket_key == "overdue",
            ))

    # ── 4. Tracker subtasks owned by current member ───────────────────────────
    if current_member.name:
        subtasks = (
            db.query(TrackerSubtask)
            .join(TrackerTask, TrackerTask.id == TrackerSubtask.task_id)
            .join(TrackerGroup, TrackerGroup.id == TrackerTask.group_id)
            .join(TrackerArea, TrackerArea.id == TrackerGroup.area_id)
            .options(
                joinedload(TrackerSubtask.task)
                .joinedload(TrackerTask.group)
                .joinedload(TrackerGroup.area)
            )
            .filter(
                TrackerTask.owner == current_member.name,
                TrackerSubtask.is_done == False,
            )
            .all()
        )
        for st in subtasks:
            task_obj = st.task
            group_obj = task_obj.group if task_obj else None
            area_obj = group_obj.area if group_obj else None
            subtitle = None
            if area_obj and group_obj:
                subtitle = f"{area_obj.name} › {group_obj.name}"
            elif group_obj:
                subtitle = group_obj.name
            due_date = None
            if st.date:
                try:
                    due_date = date.fromisoformat(st.date)
                except ValueError:
                    pass
            bucket_key = _bucket(due_date)
            items.append(MyWorkItem(
                id=st.id,
                source="tracker",
                title=task_obj.title if task_obj else st.title,
                subtitle=subtitle,
                status="done" if st.is_done else "pending",
                urgency=None,
                due_at=st.date,
                sla_deadline=None,
                ticket_number=None,
                ticket_id=None,
                assignment_id=None,
                occurrence_id=None,
                supervisor_task_id=None,
                size=None,
                is_overdue=bucket_key == "overdue",
            ))

    # ── Bucket items ──────────────────────────────────────────────────────────
    today = _today()
    now = _now_utc()

    def _get_bucket(item: MyWorkItem) -> str:
        if item.source == "liveops" and item.sla_deadline:
            dl = datetime.fromisoformat(item.sla_deadline)
            if dl.tzinfo is None:
                dl = dl.replace(tzinfo=timezone.utc)
            return _bucket_from_deadline(dl)
        if item.due_at:
            try:
                return _bucket(date.fromisoformat(item.due_at))
            except ValueError:
                pass
        return "later"

    overdue: list[MyWorkItem] = []
    due_today: list[MyWorkItem] = []
    this_week: list[MyWorkItem] = []
    later: list[MyWorkItem] = []

    for item in items:
        b = _get_bucket(item)
        if b == "overdue":
            overdue.append(item)
        elif b == "due_today":
            due_today.append(item)
        elif b == "this_week":
            this_week.append(item)
        else:
            later.append(item)

    in_progress_count = sum(
        1 for i in items if i.status in ("active", "in_progress")
    )

    return MyWorkResponse(
        overdue=overdue,
        due_today=due_today,
        this_week=this_week,
        later=later,
        summary=MyWorkSummary(
            total=len(items),
            overdue=len(overdue),
            due_today=len(due_today),
            in_progress=in_progress_count,
        ),
    )
