"""SCIM user and group handlers."""

from __future__ import annotations

from typing import Any, Callable


def _ws():
    from backend.services.databricks_service import get_workspace_client
    return get_workspace_client()


def _user_summary(u: Any) -> dict:
    emails = [e.value for e in (u.emails or []) if e.value] if u.emails else []
    groups = [g.display for g in (u.groups or [])] if u.groups else []
    return {
        "id": u.id,
        "display_name": u.display_name,
        "user_name": u.user_name,
        "emails": emails,
        "groups": groups,
        "active": u.active,
    }


def _group_summary(g: Any) -> dict:
    members = [
        {"id": m.value, "display": m.display, "type": m.ref}
        for m in (g.members or [])
    ] if g.members else []
    return {
        "id": g.id,
        "display_name": g.display_name,
        "member_count": len(members),
        "members": members,
    }


# ── read handlers ─────────────────────────────────────────────────────────────

def list_users(params: dict) -> dict:
    ws = _ws()
    kwargs: dict[str, Any] = {}
    if params.get("filter"):
        kwargs["filter"] = params["filter"]
    users = list(ws.users.list(**kwargs))
    return {"users": [_user_summary(u) for u in users]}


def get_user(params: dict) -> dict:
    ws = _ws()
    u = ws.users.get(id=params["user_id"])
    return _user_summary(u)


def list_groups(params: dict) -> dict:
    ws = _ws()
    kwargs: dict[str, Any] = {}
    if params.get("filter"):
        kwargs["filter"] = params["filter"]
    groups = list(ws.groups.list(**kwargs))
    return {
        "groups": [
            {"id": g.id, "display_name": g.display_name}
            for g in groups
        ]
    }


def get_group(params: dict) -> dict:
    ws = _ws()
    g = ws.groups.get(id=params["group_id"])
    return _group_summary(g)


# ── write handlers ────────────────────────────────────────────────────────────

def add_user_to_group(params: dict) -> dict:
    from databricks.sdk.service.iam import ComplexValue, PatchOp, PatchSchema

    ws = _ws()
    ws.groups.patch(
        id=params["group_id"],
        schemas=[PatchSchema.URN_IETF_PARAMS_SCIM_API_MESSAGES_2_0_PATCH_OP],
        operations=[
            PatchOp(
                op=PatchOp.Op.ADD,  # type: ignore[attr-defined]
                path="members",
                value=[ComplexValue(value=params["user_id"])],
            )
        ],
    )
    return {
        "status": "added",
        "user_id": params["user_id"],
        "group_id": params["group_id"],
    }


def remove_user_from_group(params: dict) -> dict:
    from databricks.sdk.service.iam import PatchOp, PatchSchema

    ws = _ws()
    ws.groups.patch(
        id=params["group_id"],
        schemas=[PatchSchema.URN_IETF_PARAMS_SCIM_API_MESSAGES_2_0_PATCH_OP],
        operations=[
            PatchOp(
                op=PatchOp.Op.REMOVE,  # type: ignore[attr-defined]
                path=f'members[value eq "{params["user_id"]}"]',
            )
        ],
    )
    return {
        "status": "removed",
        "user_id": params["user_id"],
        "group_id": params["group_id"],
    }


def create_group(params: dict) -> dict:
    ws = _ws()
    g = ws.groups.create(display_name=params["display_name"])
    return {"status": "created", "group_id": g.id, "display_name": g.display_name}


HANDLERS: dict[str, Callable] = {
    "list_users": list_users,
    "get_user": get_user,
    "list_groups": list_groups,
    "get_group": get_group,
    "add_user_to_group": add_user_to_group,
    "remove_user_from_group": remove_user_from_group,
    "create_group": create_group,
}
