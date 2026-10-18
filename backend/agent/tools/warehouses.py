"""SQL warehouse handlers."""

from __future__ import annotations

from typing import Any, Callable


def _ws():
    from backend.services.databricks_service import get_workspace_client
    return get_workspace_client()


def _warehouse_summary(w: Any) -> dict:
    return {
        "id": w.id,
        "name": w.name,
        "state": w.state.value if w.state else None,
        "cluster_size": w.cluster_size,
        "auto_stop_mins": w.auto_stop_mins,
        "min_num_clusters": w.min_num_clusters,
        "max_num_clusters": w.max_num_clusters,
        "warehouse_type": w.warehouse_type.value if w.warehouse_type else None,
        "num_clusters": w.num_clusters,
    }


# ── read handlers ─────────────────────────────────────────────────────────────

def list_sql_warehouses(_params: dict) -> dict:
    ws = _ws()
    warehouses = list(ws.warehouses.list())
    return {"warehouses": [_warehouse_summary(w) for w in warehouses]}


def get_sql_warehouse(params: dict) -> dict:
    ws = _ws()
    w = ws.warehouses.get(id=params["warehouse_id"])
    return _warehouse_summary(w)


# ── write handlers ────────────────────────────────────────────────────────────

def create_sql_warehouse(params: dict) -> dict:
    from databricks.sdk.service.sql import CreateWarehouseRequestWarehouseType

    ws = _ws()

    kwargs: dict[str, Any] = {
        "name": params["name"],
        "cluster_size": params["cluster_size"],
    }
    if "auto_stop_mins" in params:
        kwargs["auto_stop_mins"] = params["auto_stop_mins"]
    if "min_num_clusters" in params:
        kwargs["min_num_clusters"] = params["min_num_clusters"]
    if "max_num_clusters" in params:
        kwargs["max_num_clusters"] = params["max_num_clusters"]
    if "warehouse_type" in params:
        kwargs["warehouse_type"] = CreateWarehouseRequestWarehouseType(params["warehouse_type"])

    result = ws.warehouses.create(**kwargs)
    return {"warehouse_id": result.id, "name": params["name"], "status": "created"}


def edit_sql_warehouse(params: dict) -> dict:
    ws = _ws()
    warehouse_id = params["warehouse_id"]

    existing = ws.warehouses.get(id=warehouse_id)

    kwargs: dict[str, Any] = {
        "id": warehouse_id,
        "name": params.get("name", existing.name),
        "cluster_size": params.get("cluster_size", existing.cluster_size),
    }
    if "auto_stop_mins" in params:
        kwargs["auto_stop_mins"] = params["auto_stop_mins"]
    if "min_num_clusters" in params:
        kwargs["min_num_clusters"] = params["min_num_clusters"]
    if "max_num_clusters" in params:
        kwargs["max_num_clusters"] = params["max_num_clusters"]

    ws.warehouses.edit(**kwargs)
    return {"warehouse_id": warehouse_id, "status": "edit submitted"}


def stop_sql_warehouse(params: dict) -> dict:
    _ws().warehouses.stop(id=params["warehouse_id"])
    return {"warehouse_id": params["warehouse_id"], "status": "stop requested"}


HANDLERS: dict[str, Callable] = {
    "list_sql_warehouses": list_sql_warehouses,
    "get_sql_warehouse": get_sql_warehouse,
    "create_sql_warehouse": create_sql_warehouse,
    "edit_sql_warehouse": edit_sql_warehouse,
    "stop_sql_warehouse": stop_sql_warehouse,
}
