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
_FIELDS = (
    "System.Id,System.Title,System.State,System.BoardColumn,System.WorkItemType,"
    "System.AssignedTo,System.ChangedDate,System.CreatedDate,"
    "System.CreatedBy,System.Description,System.Tags,"
    "Microsoft.VSTS.Common.Priority"
)
_QUERY = (
    f"SELECT [System.Id], [System.Title], [System.State], [System.WorkItemType], "
    f"[System.AssignedTo], [System.ChangedDate] "
    f"FROM WorkItems WHERE [System.TeamProject] = '{_PROJECT}' "
    f"ORDER BY [System.ChangedDate] DESC"
)


class WorkItemOut(BaseModel):
    id: int
    title: str
    state: str
    board_column: str
    type: str
    assigned_to: str
    created_by: str
    changed_date: str
    created_date: str
    description: str
    tags: list[str]
    priority: int | None
    url: str


@router.get("/tickets", response_model=list[WorkItemOut])
async def get_devops_tickets():
    pat = os.getenv("AZURE_DEVOPS_PAT")
    if not pat:
        raise HTTPException(status_code=503, detail="Azure DevOps PAT not configured.")

    auth = "Basic " + base64.b64encode(f":{pat}".encode()).decode()
    hdrs = {"Authorization": auth, "Content-Type": "application/json"}

    async with httpx.AsyncClient(timeout=15.0) as client:
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
            params={"ids": ids, "fields": _FIELDS, "api-version": "7.1"},
        )
        if not detail_res.is_success:
            raise HTTPException(status_code=502, detail=f"Azure DevOps workitems error: {detail_res.status_code}")

        items: list[WorkItemOut] = []
        for w in detail_res.json().get("value", []):
            f = w.get("fields", {})

            def _person(field: str) -> str:
                v = f.get(field) or {}
                return v.get("displayName") if isinstance(v, dict) else str(v or "")

            raw_tags = f.get("System.Tags") or ""
            tags = [t.strip() for t in raw_tags.split(";") if t.strip()]

            items.append(WorkItemOut(
                id=w["id"],
                title=f.get("System.Title") or "(no title)",
                state=f.get("System.State") or "New",
                board_column=f.get("System.BoardColumn") or f.get("System.State") or "New",
                type=f.get("System.WorkItemType") or "Task",
                assigned_to=_person("System.AssignedTo") or "Unassigned",
                created_by=_person("System.CreatedBy") or "Unknown",
                changed_date=f.get("System.ChangedDate") or "",
                created_date=f.get("System.CreatedDate") or "",
                description=f.get("System.Description") or "",
                tags=tags,
                priority=f.get("Microsoft.VSTS.Common.Priority"),
                url=f"https://dev.azure.com/{_ORG}/{_PROJECT}/_workitems/edit/{w['id']}",
            ))

        return items
