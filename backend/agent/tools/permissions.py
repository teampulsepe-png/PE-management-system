"""Unity Catalog grant/revoke and catalog discovery handlers."""

from __future__ import annotations

from typing import Any, Callable


def _ws():
    from backend.services.databricks_service import get_workspace_client
    return get_workspace_client()


def _safe_dict(obj: Any) -> Any:
    if obj is None:
        return None
    if hasattr(obj, "as_dict"):
        return obj.as_dict()
    if isinstance(obj, list):
        return [_safe_dict(i) for i in obj]
    return obj


# ── read handlers ─────────────────────────────────────────────────────────────

def list_catalogs(_params: dict) -> dict:
    ws = _ws()
    catalogs = list(ws.catalogs.list())
    return {
        "catalogs": [
            {"name": c.name, "comment": c.comment, "owner": c.owner}
            for c in catalogs
        ]
    }


def list_schemas(params: dict) -> dict:
    ws = _ws()
    schemas = list(ws.schemas.list(catalog_name=params["catalog_name"]))
    return {
        "schemas": [
            {"full_name": s.full_name, "name": s.name, "owner": s.owner}
            for s in schemas
        ]
    }


def list_tables(params: dict) -> dict:
    ws = _ws()
    tables = list(ws.tables.list(
        catalog_name=params["catalog_name"],
        schema_name=params["schema_name"],
    ))
    return {
        "tables": [
            {
                "full_name": t.full_name,
                "name": t.name,
                "table_type": t.table_type.value if t.table_type else None,
                "owner": t.owner,
            }
            for t in tables
        ]
    }


def list_grants(params: dict) -> dict:
    from databricks.sdk.service.catalog import SecurableType

    ws = _ws()
    result = ws.grants.get(
        securable_type=SecurableType(params["securable_type"]),
        full_name=params["full_name"],
    )
    return _safe_dict(result) or {"privilege_assignments": []}


# ── write handlers ────────────────────────────────────────────────────────────

def grant_privilege(params: dict) -> dict:
    from databricks.sdk.service.catalog import (
        SecurableType, PermissionsChange, Privilege,
    )

    ws = _ws()
    ws.grants.update(
        securable_type=SecurableType(params["securable_type"]),
        full_name=params["full_name"],
        changes=[
            PermissionsChange(
                add=[Privilege(params["privilege"])],
                principal=params["principal"],
            )
        ],
    )
    return {
        "status": "granted",
        "securable_type": params["securable_type"],
        "full_name": params["full_name"],
        "principal": params["principal"],
        "privilege": params["privilege"],
    }


def revoke_privilege(params: dict) -> dict:
    from databricks.sdk.service.catalog import (
        SecurableType, PermissionsChange, Privilege,
    )

    ws = _ws()
    ws.grants.update(
        securable_type=SecurableType(params["securable_type"]),
        full_name=params["full_name"],
        changes=[
            PermissionsChange(
                remove=[Privilege(params["privilege"])],
                principal=params["principal"],
            )
        ],
    )
    return {
        "status": "revoked",
        "securable_type": params["securable_type"],
        "full_name": params["full_name"],
        "principal": params["principal"],
        "privilege": params["privilege"],
    }


HANDLERS: dict[str, Callable] = {
    "list_catalogs": list_catalogs,
    "list_schemas": list_schemas,
    "list_tables": list_tables,
    "list_grants": list_grants,
    "grant_privilege": grant_privilege,
    "revoke_privilege": revoke_privilege,
}
