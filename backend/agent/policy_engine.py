from pathlib import Path
from typing import Any

import yaml

_POLICY_PATH = Path(__file__).parent.parent / "agent_policies.yaml"

# Hierarchy: higher number = broader access
_SECURABLE_LEVEL: dict[str, int] = {
    "TABLE":         1,
    "VOLUME":        1,
    "FUNCTION":      1,
    "SCHEMA":        2,
    "CATALOG":       3,
    "ALL PRIVILEGES": 4,
}


class PolicyViolation(Exception):
    def __init__(self, message: str) -> None:
        self.message = message
        super().__init__(message)


class PolicyEngine:
    def __init__(self) -> None:
        with open(_POLICY_PATH) as f:
            self._policy: dict[str, Any] = yaml.safe_load(f)

        guardrails = self._policy.get("guardrails", {})
        self._blocked: set[str] = set(guardrails.get("blocked_operations", []))
        self._confirm: set[str] = set(guardrails.get("require_confirmation", []))

    # ── guardrail checks ──────────────────────────────────────────────────────

    def is_blocked(self, tool_name: str) -> bool:
        return tool_name in self._blocked

    def requires_confirmation(self, tool_name: str) -> bool:
        return tool_name in self._confirm

    # ── permission policy check ───────────────────────────────────────────────

    def validate_permission_op(
        self,
        resource: str,
        securable_type: str,
        principal_groups: list[str],
    ) -> None:
        """Raise PolicyViolation if the op violates any permission policy rule.

        Args:
            resource: Full resource name, e.g. "aa_data_dev.gold.sales_table"
            securable_type: "CATALOG", "SCHEMA", "TABLE", etc.
            principal_groups: Display names of Databricks groups the principal belongs to.
        """
        resource_lower = resource.lower()
        req_level = _SECURABLE_LEVEL.get(securable_type.upper(), 0)

        for rule in self._policy.get("permission_policies", []):
            match = rule.get("match", {})

            # Resource match
            if "resource" in match:
                if match["resource"].lower() != resource_lower:
                    continue
            elif "resource_prefix" in match:
                if not resource_lower.startswith(match["resource_prefix"].lower()):
                    continue
            else:
                continue  # malformed rule — skip

            # Principal group match (if specified, at least one must match)
            if "principal_groups" in match:
                if not any(g in principal_groups for g in match["principal_groups"]):
                    continue

            # Rule applies — check block first
            if rule.get("block"):
                raise PolicyViolation(
                    rule.get("deny_message", f"Operation blocked by policy '{rule.get('name', 'unnamed')}'.")
                )

            # Check max_level
            if "allow" in rule and "max_level" in rule["allow"]:
                allowed_level = _SECURABLE_LEVEL.get(rule["allow"]["max_level"].upper(), 0)
                if req_level > allowed_level:
                    raise PolicyViolation(
                        rule.get(
                            "deny_message",
                            f"{securable_type}-level access exceeds the maximum permitted level "
                            f"({rule['allow']['max_level']}) for this resource.",
                        )
                    )
            return  # first matching rule passed — no need to check further

    # ── system prompt injection ───────────────────────────────────────────────

    def policy_summary_for_prompt(self) -> str:
        """Returns a compact, human-readable summary of all policies for Claude's system prompt."""
        lines = ["## Guardrails & Permission Policies", ""]

        lines.append("### Blocked operations (never execute, ever)")
        for op in sorted(self._blocked):
            lines.append(f"- {op}")

        lines.append("")
        lines.append("### Operations requiring user confirmation before execution")
        for op in sorted(self._confirm):
            lines.append(f"- {op}")

        rules = self._policy.get("permission_policies", [])
        if rules:
            lines.append("")
            lines.append("### Permission policies (enforced on every grant/revoke)")
            for rule in rules:
                lines.append(f"**{rule.get('name', 'Unnamed rule')}**")
                match = rule.get("match", {})
                if "resource" in match:
                    lines.append(f"  Resource: `{match['resource']}`")
                elif "resource_prefix" in match:
                    lines.append(f"  Resource prefix: `{match['resource_prefix']}*`")
                if "principal_groups" in match:
                    lines.append(f"  Applies to groups: {', '.join(match['principal_groups'])}")
                if rule.get("block"):
                    lines.append(f"  Action: **BLOCK** — {rule.get('deny_message', '').strip()}")
                elif "allow" in rule:
                    lines.append(f"  Max level: {rule['allow'].get('max_level', '?')}")
                    if "deny_message" in rule:
                        lines.append(f"  Reason: {rule['deny_message'].strip()}")
                lines.append("")

        return "\n".join(lines)
