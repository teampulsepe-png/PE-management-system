import base64
import os

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/devops", tags=["devops"])

_ORG = "JKGroupAA"
_PROJECT = "OCTAVE_Platform"
_WIQL_URL = f"https://dev.azure.com/{_ORG}/{_PROJECT}/_apis/wit/wiql?api-version=7.1"
_ITEMS_URL = f"https://dev.azure.com/{_ORG}/{_PROJECT}/_apis/wit/workitems"
_WA_API = "https://graph.facebook.com/v19.0"
_QUERY = (
    f"SELECT [System.Id], [System.Title], [System.State], [System.WorkItemType], "
    f"[System.AssignedTo], [System.ChangedDate] "
    f"FROM WorkItems WHERE [System.TeamProject] = '{_PROJECT}' "
    f"ORDER BY [System.ChangedDate] DESC"
)


def _last_segment(path: str) -> str:
    if not path:
        return ""
    parts = [p for p in path.split("\\") if p]
    return parts[-1] if len(parts) > 1 else path


def _person_name(v: object) -> str:
    if isinstance(v, dict):
        return v.get("displayName") or ""
    return str(v or "")


def _mask_number(n: str) -> str:
    digits = n.lstrip("+")
    if len(digits) < 8:
        return n
    return "+" + digits[:3] + "×" * (len(digits) - 5) + digits[-2:]


# ── Models ────────────────────────────────────────────────────────────────────

class WorkItemOut(BaseModel):
    id: int
    title: str
    state: str
    board_column: str
    type: str
    assigned_to: str
    created_by: str
    changed_by: str
    changed_date: str
    created_date: str
    start_date: str
    description: str
    acceptance_criteria: str
    repro_steps: str
    tags: list[str]
    priority: int | None
    item_priority: str
    severity: str
    story_points: float | None
    reason: str
    sprint: str
    area: str
    use_case_name: str
    bu_project: str
    team: str
    comment_count: int
    url: str


class CommentOut(BaseModel):
    id: int
    text: str
    author: str
    date: str


class AssigneeCount(BaseModel):
    name: str
    count: int


class SprintSummaryOut(BaseModel):
    total: int
    by_type: dict[str, int]
    by_use_case: dict[str, int]
    by_assignee: list[AssigneeCount]
    unassigned: int
    message: str
    recipients: list[str]
    wa_configured: bool


class SendResult(BaseModel):
    sent_to: list[str]
    failed: list[str]


# ── Auth / config ─────────────────────────────────────────────────────────────

def _ado_auth_header() -> str:
    pat = os.getenv("AZURE_DEVOPS_PAT")
    if not pat:
        raise HTTPException(status_code=503, detail="Azure DevOps PAT not configured.")
    return "Basic " + base64.b64encode(f":{pat}".encode()).decode()


def _wa_config(require: bool = True) -> tuple[str | None, str | None, list[str]]:
    phone_number_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID")
    access_token = os.getenv("WHATSAPP_ACCESS_TOKEN")
    recipients_raw = os.getenv("WHATSAPP_RECIPIENTS", "")
    recipients = [r.strip() for r in recipients_raw.split(",") if r.strip()]
    if require and (not phone_number_id or not access_token):
        raise HTTPException(status_code=503, detail="WhatsApp not configured. Set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN.")
    if require and not recipients:
        raise HTTPException(status_code=503, detail="No recipients configured. Set WHATSAPP_RECIPIENTS.")
    return phone_number_id, access_token, recipients


# ── Shared ticket fetching ────────────────────────────────────────────────────

def _map_work_item(w: dict) -> WorkItemOut:
    f = w.get("fields", {})
    raw_tags = f.get("System.Tags") or ""
    tags = [t.strip() for t in raw_tags.split(";") if t.strip()]
    return WorkItemOut(
        id=w["id"],
        title=f.get("System.Title") or "(no title)",
        state=f.get("System.State") or "New",
        board_column=f.get("System.BoardColumn") or f.get("System.State") or "New",
        type=f.get("System.WorkItemType") or "Task",
        assigned_to=_person_name(f.get("System.AssignedTo")) or "Unassigned",
        created_by=_person_name(f.get("System.CreatedBy")) or "Unknown",
        changed_by=_person_name(f.get("System.ChangedBy")),
        changed_date=f.get("System.ChangedDate") or "",
        created_date=f.get("System.CreatedDate") or "",
        start_date=f.get("Microsoft.VSTS.Scheduling.StartDate") or "",
        description=f.get("System.Description") or "",
        acceptance_criteria=f.get("Microsoft.VSTS.Common.AcceptanceCriteria") or "",
        repro_steps=f.get("Microsoft.VSTS.Common.ReproSteps") or "",
        tags=tags,
        priority=f.get("Microsoft.VSTS.Common.Priority"),
        item_priority=f.get("Custom.ItemPriority") or "",
        severity=f.get("Microsoft.VSTS.Common.Severity") or "",
        story_points=f.get("Microsoft.VSTS.Scheduling.StoryPoints"),
        reason=f.get("System.Reason") or "",
        sprint=_last_segment(f.get("System.IterationPath") or ""),
        area=_last_segment(f.get("System.AreaPath") or ""),
        use_case_name=f.get("Custom.Usecasename") or "",
        bu_project=f.get("Custom.BUorProjectname") or "",
        team=f.get("Custom.Team") or "",
        comment_count=f.get("System.CommentCount") or 0,
        url=f"https://dev.azure.com/{_ORG}/{_PROJECT}/_workitems/edit/{w['id']}",
    )


async def _fetch_all_tickets(client: httpx.AsyncClient) -> list[WorkItemOut]:
    auth = _ado_auth_header()
    hdrs = {"Authorization": auth, "Content-Type": "application/json"}

    wiql_res = await client.post(_WIQL_URL, headers=hdrs, json={"query": _QUERY})
    if wiql_res.status_code == 401:
        raise HTTPException(status_code=401, detail="Invalid Azure DevOps PAT.")
    if not wiql_res.is_success:
        raise HTTPException(status_code=502, detail=f"Azure DevOps error: {wiql_res.status_code}")

    refs = wiql_res.json().get("workItems", [])
    if not refs:
        return []

    ids = ",".join(str(w["id"]) for w in refs[:200])
    detail_res = await client.get(
        _ITEMS_URL,
        headers=hdrs,
        params={"ids": ids, "$expand": "Fields", "api-version": "7.1"},
    )
    if not detail_res.is_success:
        raise HTTPException(status_code=502, detail=f"Azure DevOps workitems error: {detail_res.status_code}")

    return [_map_work_item(w) for w in detail_res.json().get("value", [])]


# ── WhatsApp message builder ──────────────────────────────────────────────────

_TYPE_EMOJI: dict[str, str] = {
    "Bug": "🐛",
    "User Story": "📖",
    "Task": "✅",
    "Feature": "✨",
    "Epic": "🚀",
}

_CATEGORY_RULES: list[tuple[str, list[str]]] = [
    ("Access & Identity",               ["access", "identity", "permission", "role", "auth", "sso", "rbac"]),
    ("Cluster creation/Update",         ["cluster", "node", "aks", "eks", "kubernetes", "k8s", "provision"]),
    ("Governance & Compliance",         ["governance", "compliance", "policy", "audit", "regulation"]),
    ("Dashboards & Reporting",          ["dashboard", "report", "analytics", "metric", "kpi", "chart"]),
    ("Liveops",                         ["liveops", "live ops", "incident", "on-call", "oncall", "alert", "monitoring"]),
    ("Github/Claude",                   ["github", "claude", "ai", "llm", "copilot", "automation"]),
    ("Cloud Platform & Infrastructure", ["infrastructure", "infra", "cloud", "azure", "aws", "gcp", "network", "storage", "pipeline"]),
]


def _categorise(ticket: WorkItemOut) -> str:
    haystack = f"{ticket.use_case_name} {ticket.title}".lower()
    for category, keywords in _CATEGORY_RULES:
        if any(kw in haystack for kw in keywords):
            return category
    return "Other"


def _build_sprint_message(tickets: list[WorkItemOut]) -> str:
    by_type: dict[str, int] = {}
    by_category: dict[str, int] = {}
    by_assignee: dict[str, int] = {}
    unassigned = 0

    for t in tickets:
        by_type[t.type] = by_type.get(t.type, 0) + 1
        cat = _categorise(t)
        by_category[cat] = by_category.get(cat, 0) + 1
        if t.assigned_to == "Unassigned":
            unassigned += 1
        else:
            by_assignee[t.assigned_to] = by_assignee.get(t.assigned_to, 0) + 1

    lines = [
        "📋 *Current Sprint – OCTAVE Platform*",
        "━━━━━━━━━━━━━━━━━",
        f"*Total:* {len(tickets)} ticket{'s' if len(tickets) != 1 else ''}",
        "",
        "*By Category*",
    ]
    for cat, count in sorted(by_category.items(), key=lambda x: (-x[1], x[0])):
        lines.append(f"• {cat}: {count}")

    lines += ["", "*By Type*"]
    for type_name, count in sorted(by_type.items(), key=lambda x: -x[1]):
        emoji = _TYPE_EMOJI.get(type_name, "•")
        lines.append(f"{emoji} {type_name}: {count}")

    lines += ["", "*Workload*"]
    for name, count in sorted(by_assignee.items(), key=lambda x: -x[1]):
        lines.append(f"• {name} – {count}")
    if unassigned:
        lines.append(f"• Unassigned – {unassigned}")

    lines += [
        "",
        "━━━━━━━━━━━━━━━━━",
        "Sent from Teampulse PE Management",
    ]
    return "\n".join(lines)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/tickets", response_model=list[WorkItemOut])
async def get_devops_tickets():
    async with httpx.AsyncClient(timeout=15.0) as client:
        return await _fetch_all_tickets(client)


@router.get("/sprint-summary", response_model=SprintSummaryOut)
async def get_sprint_summary():
    async with httpx.AsyncClient(timeout=15.0) as client:
        all_tickets = await _fetch_all_tickets(client)

    sprint_tickets = [t for t in all_tickets if t.board_column == "Current Sprint"]

    by_type: dict[str, int] = {}
    by_use_case: dict[str, int] = {}
    by_assignee_raw: dict[str, int] = {}
    unassigned = 0

    for t in sprint_tickets:
        by_type[t.type] = by_type.get(t.type, 0) + 1
        cat = _categorise(t)
        by_use_case[cat] = by_use_case.get(cat, 0) + 1
        if t.assigned_to == "Unassigned":
            unassigned += 1
        else:
            by_assignee_raw[t.assigned_to] = by_assignee_raw.get(t.assigned_to, 0) + 1

    by_assignee = [
        AssigneeCount(name=k, count=v)
        for k, v in sorted(by_assignee_raw.items(), key=lambda x: -x[1])
    ]

    _, _, recipients = _wa_config(require=False)
    wa_configured = bool(os.getenv("WHATSAPP_PHONE_NUMBER_ID") and os.getenv("WHATSAPP_ACCESS_TOKEN"))

    return SprintSummaryOut(
        total=len(sprint_tickets),
        by_type=by_type,
        by_use_case=by_use_case,
        by_assignee=by_assignee,
        unassigned=unassigned,
        message=_build_sprint_message(sprint_tickets),
        recipients=[_mask_number(r) for r in recipients],
        wa_configured=wa_configured,
    )


@router.post("/send-sprint-summary", response_model=SendResult)
async def send_sprint_summary():
    phone_number_id, access_token, recipients = _wa_config(require=True)

    async with httpx.AsyncClient(timeout=15.0) as client:
        all_tickets = await _fetch_all_tickets(client)
        sprint_tickets = [t for t in all_tickets if t.board_column == "Current Sprint"]
        message = _build_sprint_message(sprint_tickets)

        sent_to: list[str] = []
        failed: list[str] = []

        for to in recipients:
            payload = {
                "messaging_product": "whatsapp",
                "to": to.lstrip("+"),
                "type": "text",
                "text": {"body": message, "preview_url": False},
            }
            res = await client.post(
                f"{_WA_API}/{phone_number_id}/messages",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            (sent_to if res.is_success else failed).append(_mask_number(to))

    return SendResult(sent_to=sent_to, failed=failed)


@router.get("/tickets/{item_id}/comments", response_model=list[CommentOut])
async def get_ticket_comments(item_id: int):
    auth = _ado_auth_header()
    hdrs = {"Authorization": auth}
    url = f"https://dev.azure.com/{_ORG}/{_PROJECT}/_apis/wit/workItems/{item_id}/comments"

    async with httpx.AsyncClient(timeout=10.0) as client:
        res = await client.get(url, headers=hdrs, params={"api-version": "7.1-preview.3"})
        if res.status_code == 401:
            raise HTTPException(status_code=401, detail="Invalid Azure DevOps PAT.")
        if not res.is_success:
            raise HTTPException(status_code=502, detail=f"Comments error: {res.status_code}")

        comments: list[CommentOut] = []
        for c in res.json().get("value", []):
            comments.append(CommentOut(
                id=c.get("id", 0),
                text=c.get("text") or "",
                author=_person_name(c.get("createdBy")),
                date=c.get("createdDate") or "",
            ))

        return comments
