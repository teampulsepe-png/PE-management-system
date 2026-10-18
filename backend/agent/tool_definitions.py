"""
Claude tool schemas for the Databricks agent.

READ_TOOLS  — execute silently, no user confirmation required
WRITE_TOOLS — require user confirmation before execution
ALL_TOOLS   — combined list passed to Claude in the /chat endpoint

Blocked operations are intentionally absent from both lists so Claude
never generates tool calls for them.
"""

from typing import Any

_str = {"type": "string"}
_int = {"type": "integer"}
_bool = {"type": "boolean"}


def _obj(props: dict[str, Any], required: list[str] | None = None) -> dict[str, Any]:
    schema: dict[str, Any] = {"type": "object", "properties": props}
    if required:
        schema["required"] = required
    return schema


# ── Read tools ────────────────────────────────────────────────────────────────

READ_TOOLS: list[dict[str, Any]] = [
    {
        "name": "list_clusters",
        "description": (
            "List all interactive clusters in the Databricks workspace. "
            "Returns cluster name, state, runtime version, node type, and cluster ID. "
            "Use this to discover clusters or find the ID of a named cluster."
        ),
        "input_schema": _obj({}),
    },
    {
        "name": "get_cluster",
        "description": (
            "Get the full configuration of a specific cluster by ID. "
            "Returns spark version, node type, autoscale settings, policy, tags, "
            "init scripts, Spark conf, and all other config. "
            "Use this before cloning a cluster or checking its exact setup."
        ),
        "input_schema": _obj({"cluster_id": _str}, required=["cluster_id"]),
    },
    {
        "name": "list_cluster_policies",
        "description": (
            "List all cluster policies defined in the workspace. "
            "Returns policy ID, name, and definition. "
            "Use this to find the correct policy_id when creating or cloning clusters."
        ),
        "input_schema": _obj({}),
    },
    {
        "name": "get_cluster_policy",
        "description": "Get the full definition of a cluster policy by ID.",
        "input_schema": _obj({"policy_id": _str}, required=["policy_id"]),
    },
    {
        "name": "list_catalogs",
        "description": (
            "List all Unity Catalog catalogs in the workspace the service principal has access to."
        ),
        "input_schema": _obj({}),
    },
    {
        "name": "list_schemas",
        "description": "List all schemas (databases) inside a Unity Catalog catalog.",
        "input_schema": _obj(
            {"catalog_name": {**_str, "description": "Name of the catalog, e.g. aa_data_dev"}},
            required=["catalog_name"],
        ),
    },
    {
        "name": "list_tables",
        "description": "List all tables and views inside a Unity Catalog schema.",
        "input_schema": _obj(
            {
                "catalog_name": _str,
                "schema_name": _str,
            },
            required=["catalog_name", "schema_name"],
        ),
    },
    {
        "name": "list_grants",
        "description": (
            "List all privilege grants on a Unity Catalog securable "
            "(catalog, schema, table, volume, or function). "
            "Use this to check current access before granting or revoking."
        ),
        "input_schema": _obj(
            {
                "securable_type": {
                    **_str,
                    "description": "One of: CATALOG, SCHEMA, TABLE, VOLUME, FUNCTION",
                    "enum": ["CATALOG", "SCHEMA", "TABLE", "VOLUME", "FUNCTION"],
                },
                "full_name": {
                    **_str,
                    "description": "Full name of the securable, e.g. aa_data_dev.gold.sales_table",
                },
            },
            required=["securable_type", "full_name"],
        ),
    },
    {
        "name": "list_users",
        "description": (
            "List users in the Databricks workspace via SCIM. "
            "Optionally filter by display name or email. "
            "Returns user ID, display name, email, and group memberships."
        ),
        "input_schema": _obj(
            {
                "filter": {
                    **_str,
                    "description": "Optional SCIM filter, e.g. 'displayName co \"john\"' or 'emails.value eq \"john@example.com\"'",
                }
            }
        ),
    },
    {
        "name": "get_user",
        "description": "Get a specific user's full profile including group memberships by user ID.",
        "input_schema": _obj({"user_id": _str}, required=["user_id"]),
    },
    {
        "name": "list_groups",
        "description": (
            "List all groups in the Databricks workspace via SCIM. "
            "Optionally filter by display name."
        ),
        "input_schema": _obj(
            {
                "filter": {
                    **_str,
                    "description": "Optional SCIM filter, e.g. 'displayName co \"data_eng\"'",
                }
            }
        ),
    },
    {
        "name": "get_group",
        "description": "Get a specific group's full details including member list by group ID.",
        "input_schema": _obj({"group_id": _str}, required=["group_id"]),
    },
    {
        "name": "list_sql_warehouses",
        "description": "List all SQL warehouses (compute for SQL Analytics) in the workspace.",
        "input_schema": _obj({}),
    },
    {
        "name": "get_sql_warehouse",
        "description": "Get the full configuration of a specific SQL warehouse by ID.",
        "input_schema": _obj({"warehouse_id": _str}, required=["warehouse_id"]),
    },
]

# ── Write tools ───────────────────────────────────────────────────────────────

WRITE_TOOLS: list[dict[str, Any]] = [
    {
        "name": "create_cluster",
        "description": (
            "Create a new interactive cluster. "
            "Use get_cluster on an existing cluster first if cloning. "
            "All params except cluster_name and spark_version are optional if a policy_id is provided."
        ),
        "input_schema": _obj(
            {
                "cluster_name": _str,
                "spark_version": {**_str, "description": "Runtime version string, e.g. 14.3.x-scala2.12"},
                "node_type_id": {**_str, "description": "Node type, e.g. Standard_DS3_v2"},
                "num_workers": {**_int, "description": "Fixed worker count. Omit if using autoscale."},
                "autoscale_min_workers": {**_int, "description": "Min workers for autoscale."},
                "autoscale_max_workers": {**_int, "description": "Max workers for autoscale."},
                "auto_termination_minutes": {
                    **_int,
                    "description": "Auto-terminate after N minutes of inactivity. 0 = never.",
                },
                "policy_id": {**_str, "description": "Cluster policy ID to attach."},
                "data_security_mode": {
                    **_str,
                    "description": "Unity Catalog access mode. Typically SINGLE_USER or USER_ISOLATION.",
                    "enum": ["SINGLE_USER", "USER_ISOLATION", "LEGACY_TABLE_ACL", "LEGACY_PASSTHROUGH", "LEGACY_SINGLE_USER", "NO_ISOLATION"],
                },
                "single_user_name": {**_str, "description": "Email of user for SINGLE_USER mode."},
                "spark_conf": {"type": "object", "description": "Key-value Spark config overrides."},
                "custom_tags": {"type": "object", "description": "Key-value custom tags."},
                "libraries": {
                    "type": "array",
                    "description": "Libraries to install on creation. Each item: {pypi: {package: '...'}} or {maven: {coordinates: '...'}}",
                    "items": {"type": "object"},
                },
            },
            required=["cluster_name", "spark_version"],
        ),
    },
    {
        "name": "edit_cluster",
        "description": (
            "Edit the configuration of an existing cluster. "
            "The cluster must be in a stopped or running state. "
            "Provide only the fields you want to change alongside cluster_id."
        ),
        "input_schema": _obj(
            {
                "cluster_id": _str,
                "cluster_name": _str,
                "spark_version": _str,
                "node_type_id": _str,
                "num_workers": _int,
                "autoscale_min_workers": _int,
                "autoscale_max_workers": _int,
                "auto_termination_minutes": _int,
                "policy_id": _str,
                "data_security_mode": _str,
                "spark_conf": {"type": "object"},
                "custom_tags": {"type": "object"},
            },
            required=["cluster_id"],
        ),
    },
    {
        "name": "start_cluster",
        "description": "Start a terminated cluster.",
        "input_schema": _obj({"cluster_id": _str}, required=["cluster_id"]),
    },
    {
        "name": "restart_cluster",
        "description": "Restart a running cluster. Useful after config changes.",
        "input_schema": _obj({"cluster_id": _str}, required=["cluster_id"]),
    },
    {
        "name": "install_libraries",
        "description": (
            "Install one or more libraries on a running cluster. "
            "Supports PyPI, Maven, CRAN, and wheel/jar paths. "
            "Example library: {\"pypi\": {\"package\": \"pandas==2.1.0\"}}"
        ),
        "input_schema": _obj(
            {
                "cluster_id": _str,
                "libraries": {
                    "type": "array",
                    "items": {"type": "object"},
                    "description": "List of library specs. Each: {pypi: {package: '...'}}, {maven: {coordinates: '...'}}, or {whl: 'dbfs:/...'}",
                },
            },
            required=["cluster_id", "libraries"],
        ),
    },
    {
        "name": "grant_privilege",
        "description": (
            "Grant a privilege on a Unity Catalog securable to a user or group. "
            "Always call list_grants first to check what's already granted. "
            "Permission policies are enforced — blocked grants will fail."
        ),
        "input_schema": _obj(
            {
                "securable_type": {
                    **_str,
                    "enum": ["CATALOG", "SCHEMA", "TABLE", "VOLUME", "FUNCTION"],
                },
                "full_name": {**_str, "description": "e.g. aa_data_dev.gold.sales_table"},
                "principal": {**_str, "description": "User email or group display name."},
                "privilege": {
                    **_str,
                    "description": "e.g. SELECT, MODIFY, READ_VOLUME, USE_SCHEMA, USE_CATALOG, ALL_PRIVILEGES",
                },
            },
            required=["securable_type", "full_name", "principal", "privilege"],
        ),
    },
    {
        "name": "revoke_privilege",
        "description": "Revoke a privilege on a Unity Catalog securable from a user or group.",
        "input_schema": _obj(
            {
                "securable_type": {
                    **_str,
                    "enum": ["CATALOG", "SCHEMA", "TABLE", "VOLUME", "FUNCTION"],
                },
                "full_name": _str,
                "principal": _str,
                "privilege": _str,
            },
            required=["securable_type", "full_name", "principal", "privilege"],
        ),
    },
    {
        "name": "add_user_to_group",
        "description": "Add a user to a Databricks group (SCIM). Use list_groups and list_users to find IDs first.",
        "input_schema": _obj(
            {"user_id": _str, "group_id": _str},
            required=["user_id", "group_id"],
        ),
    },
    {
        "name": "remove_user_from_group",
        "description": "Remove a user from a Databricks group (SCIM).",
        "input_schema": _obj(
            {"user_id": _str, "group_id": _str},
            required=["user_id", "group_id"],
        ),
    },
    {
        "name": "create_group",
        "description": "Create a new Databricks group (SCIM).",
        "input_schema": _obj(
            {"display_name": {**_str, "description": "Group display name, e.g. data_engineers_gold"}},
            required=["display_name"],
        ),
    },
    {
        "name": "create_sql_warehouse",
        "description": "Create a new SQL warehouse.",
        "input_schema": _obj(
            {
                "name": _str,
                "cluster_size": {
                    **_str,
                    "description": "2X-Small, X-Small, Small, Medium, Large, X-Large, 2X-Large, 3X-Large, 4X-Large",
                },
                "auto_stop_mins": {**_int, "description": "Auto-stop after N idle minutes."},
                "min_num_clusters": _int,
                "max_num_clusters": _int,
                "warehouse_type": {
                    **_str,
                    "enum": ["CLASSIC", "PRO", "SERVERLESS"],
                },
            },
            required=["name", "cluster_size"],
        ),
    },
    {
        "name": "edit_sql_warehouse",
        "description": "Edit the configuration of an existing SQL warehouse.",
        "input_schema": _obj(
            {
                "warehouse_id": _str,
                "name": _str,
                "cluster_size": _str,
                "auto_stop_mins": _int,
                "min_num_clusters": _int,
                "max_num_clusters": _int,
            },
            required=["warehouse_id"],
        ),
    },
    {
        "name": "stop_sql_warehouse",
        "description": "Stop a running SQL warehouse.",
        "input_schema": _obj({"warehouse_id": _str}, required=["warehouse_id"]),
    },
]

ALL_TOOLS: list[dict[str, Any]] = READ_TOOLS + WRITE_TOOLS

READ_TOOL_NAMES: set[str] = {t["name"] for t in READ_TOOLS}
WRITE_TOOL_NAMES: set[str] = {t["name"] for t in WRITE_TOOLS}
