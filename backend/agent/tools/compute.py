"""Cluster and library SDK handlers."""

from __future__ import annotations

from typing import Any, Callable


def _ws():
    from backend.services.databricks_service import get_workspace_client
    return get_workspace_client()


def _safe_dict(obj: Any) -> Any:
    """Convert SDK objects to plain dicts recursively."""
    if obj is None:
        return None
    if hasattr(obj, "as_dict"):
        return obj.as_dict()
    if isinstance(obj, list):
        return [_safe_dict(i) for i in obj]
    return obj


# ── read handlers ─────────────────────────────────────────────────────────────

def list_clusters(_params: dict) -> dict:
    ws = _ws()
    clusters = list(ws.clusters.list())
    return {
        "clusters": [
            {
                "cluster_id": c.cluster_id,
                "cluster_name": c.cluster_name,
                "state": c.state.value if c.state else None,
                "spark_version": c.spark_version,
                "node_type_id": c.node_type_id,
                "num_workers": c.num_workers,
                "autoscale": _safe_dict(c.autoscale),
                "auto_termination_minutes": c.autotermination_minutes,
                "policy_id": c.policy_id,
            }
            for c in clusters
        ]
    }


def get_cluster(params: dict) -> dict:
    ws = _ws()
    c = ws.clusters.get(cluster_id=params["cluster_id"])
    return _safe_dict(c)


def list_cluster_policies(_params: dict) -> dict:
    ws = _ws()
    policies = list(ws.cluster_policies.list())
    return {
        "policies": [
            {
                "policy_id": p.policy_id,
                "name": p.name,
                "definition": p.definition,
                "description": p.description,
            }
            for p in policies
        ]
    }


def get_cluster_policy(params: dict) -> dict:
    ws = _ws()
    p = ws.cluster_policies.get(policy_id=params["policy_id"])
    return _safe_dict(p)


# ── write handlers ────────────────────────────────────────────────────────────

def create_cluster(params: dict) -> dict:
    from databricks.sdk.service.compute import (
        AutoScale, ClusterSpec, DataSecurityMode, Library, PythonPyPiLibrary,
        MavenLibrary,
    )

    ws = _ws()

    kwargs: dict[str, Any] = {
        "cluster_name": params["cluster_name"],
        "spark_version": params["spark_version"],
    }

    if "node_type_id" in params:
        kwargs["node_type_id"] = params["node_type_id"]
    if "num_workers" in params:
        kwargs["num_workers"] = params["num_workers"]
    if "autoscale_min_workers" in params and "autoscale_max_workers" in params:
        kwargs["autoscale"] = AutoScale(
            min_workers=params["autoscale_min_workers"],
            max_workers=params["autoscale_max_workers"],
        )
    if "auto_termination_minutes" in params:
        kwargs["autotermination_minutes"] = params["auto_termination_minutes"]
    if "policy_id" in params:
        kwargs["policy_id"] = params["policy_id"]
    if "data_security_mode" in params:
        kwargs["data_security_mode"] = DataSecurityMode(params["data_security_mode"])
    if "single_user_name" in params:
        kwargs["single_user_name"] = params["single_user_name"]
    if "spark_conf" in params:
        kwargs["spark_conf"] = params["spark_conf"]
    if "custom_tags" in params:
        kwargs["custom_tags"] = params["custom_tags"]

    result = ws.clusters.create(**kwargs)
    cluster_id = result.cluster_id

    # Install libraries if provided
    if params.get("libraries"):
        libs = _build_libraries(params["libraries"])
        if libs:
            ws.libraries.install(cluster_id=cluster_id, libraries=libs)

    return {"cluster_id": cluster_id, "cluster_name": params["cluster_name"]}


def edit_cluster(params: dict) -> dict:
    from databricks.sdk.service.compute import AutoScale, DataSecurityMode

    ws = _ws()
    cluster_id = params["cluster_id"]

    # Fetch existing config to merge
    existing = ws.clusters.get(cluster_id=cluster_id)
    kwargs: dict[str, Any] = {"cluster_id": cluster_id}

    kwargs["cluster_name"] = params.get("cluster_name", existing.cluster_name)
    kwargs["spark_version"] = params.get("spark_version", existing.spark_version)
    kwargs["node_type_id"] = params.get("node_type_id", existing.node_type_id)

    if "num_workers" in params:
        kwargs["num_workers"] = params["num_workers"]
    elif "autoscale_min_workers" in params and "autoscale_max_workers" in params:
        kwargs["autoscale"] = AutoScale(
            min_workers=params["autoscale_min_workers"],
            max_workers=params["autoscale_max_workers"],
        )
    elif existing.autoscale:
        kwargs["autoscale"] = existing.autoscale
    else:
        kwargs["num_workers"] = existing.num_workers

    if "auto_termination_minutes" in params:
        kwargs["autotermination_minutes"] = params["auto_termination_minutes"]
    if "policy_id" in params:
        kwargs["policy_id"] = params["policy_id"]
    if "data_security_mode" in params:
        kwargs["data_security_mode"] = DataSecurityMode(params["data_security_mode"])
    if "spark_conf" in params:
        kwargs["spark_conf"] = params["spark_conf"]
    if "custom_tags" in params:
        kwargs["custom_tags"] = params["custom_tags"]

    ws.clusters.edit(**kwargs)
    return {"cluster_id": cluster_id, "status": "edit submitted"}


def start_cluster(params: dict) -> dict:
    _ws().clusters.start(cluster_id=params["cluster_id"])
    return {"cluster_id": params["cluster_id"], "status": "start requested"}


def restart_cluster(params: dict) -> dict:
    _ws().clusters.restart(cluster_id=params["cluster_id"])
    return {"cluster_id": params["cluster_id"], "status": "restart requested"}


def install_libraries(params: dict) -> dict:
    ws = _ws()
    libs = _build_libraries(params["libraries"])
    ws.libraries.install(cluster_id=params["cluster_id"], libraries=libs)
    return {"cluster_id": params["cluster_id"], "libraries_installed": len(libs)}


# ── helpers ───────────────────────────────────────────────────────────────────

def _build_libraries(raw: list[dict]) -> list:
    from databricks.sdk.service.compute import Library, PythonPyPiLibrary, MavenLibrary, CranLibrary

    libs = []
    for item in raw:
        if "pypi" in item:
            libs.append(Library(pypi=PythonPyPiLibrary(package=item["pypi"]["package"],
                                                         repo=item["pypi"].get("repo"))))
        elif "maven" in item:
            libs.append(Library(maven=MavenLibrary(coordinates=item["maven"]["coordinates"],
                                                    repo=item["maven"].get("repo"),
                                                    exclusions=item["maven"].get("exclusions"))))
        elif "cran" in item:
            libs.append(Library(cran=CranLibrary(package=item["cran"]["package"],
                                                  repo=item["cran"].get("repo"))))
        elif "whl" in item:
            libs.append(Library(whl=item["whl"]))
        elif "jar" in item:
            libs.append(Library(jar=item["jar"]))
    return libs


HANDLERS: dict[str, Callable] = {
    "list_clusters": list_clusters,
    "get_cluster": get_cluster,
    "list_cluster_policies": list_cluster_policies,
    "get_cluster_policy": get_cluster_policy,
    "create_cluster": create_cluster,
    "edit_cluster": edit_cluster,
    "start_cluster": start_cluster,
    "restart_cluster": restart_cluster,
    "install_libraries": install_libraries,
}
