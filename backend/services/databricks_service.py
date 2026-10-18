import json
import os
import time
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

_HOST          = os.getenv("DATABRICKS_HOST")
_TOKEN         = os.getenv("DATABRICKS_TOKEN")
_NOTEBOOK_PATH = os.getenv("DATABRICKS_NOTEBOOK_PATH")

_POLL_INTERVAL = 5    # seconds between status checks
_TIMEOUT       = 300  # max seconds to wait for the notebook to finish


class DatabricksError(Exception):
    pass


_ws_client = None


def get_workspace_client():
    """Return a cached WorkspaceClient for agent tool handlers."""
    global _ws_client
    if _ws_client is None:
        if not _HOST or not _TOKEN:
            raise DatabricksError(
                "DATABRICKS_HOST and DATABRICKS_TOKEN must be set in .env"
            )
        from databricks.sdk import WorkspaceClient as _WC
        _ws_client = _WC(host=_HOST, token=_TOKEN)
    return _ws_client


def run_cost_notebook() -> dict:
    """
    Submit the cost-calculation notebook as a one-time serverless run,
    poll until it completes, and return the parsed JSON from
    dbutils.notebook.exit().

    Expected notebook output:
        {"app_compute_cents": <int>, "lakebase_cents": <int>}
    Both values are month-to-date actuals in cents, queried from
    system.billing.usage inside the notebook.
    """
    if not all([_HOST, _TOKEN, _NOTEBOOK_PATH]):
        raise DatabricksError(
            "DATABRICKS_HOST, DATABRICKS_TOKEN, and DATABRICKS_NOTEBOOK_PATH "
            "must all be set in .env"
        )

    from databricks.sdk import WorkspaceClient
    from databricks.sdk.service.jobs import NotebookTask, SubmitTask, RunLifeCycleState, RunResultState

    ws = WorkspaceClient(host=_HOST, token=_TOKEN)

    # Submit a one-time run — no cluster spec means serverless on eligible workspaces
    submitted = ws.jobs.submit(
        run_name="pe-cost-sync",
        tasks=[
            SubmitTask(
                task_key="cost_calc",
                notebook_task=NotebookTask(notebook_path=_NOTEBOOK_PATH),
            )
        ],
    )
    parent_run_id = submitted.run_id

    # Poll until the run reaches a terminal state
    deadline = time.monotonic() + _TIMEOUT
    while time.monotonic() < deadline:
        run = ws.jobs.get_run(run_id=parent_run_id)
        lcs = run.state.life_cycle_state
        if lcs in (
            RunLifeCycleState.TERMINATED,
            RunLifeCycleState.SKIPPED,
            RunLifeCycleState.INTERNAL_ERROR,
        ):
            break
        time.sleep(_POLL_INTERVAL)
    else:
        raise DatabricksError(
            f"Notebook run {parent_run_id} did not finish within {_TIMEOUT}s"
        )

    if run.state.result_state != RunResultState.SUCCESS:
        raise DatabricksError(
            f"Notebook run {parent_run_id} failed: "
            f"{run.state.result_state} — {run.state.state_message}"
        )

    # Get the notebook exit value — requires the task-level run_id
    task_run_id = run.tasks[0].run_id if run.tasks else parent_run_id
    output = ws.jobs.get_run_output(run_id=task_run_id)

    raw = getattr(getattr(output, "notebook_output", None), "result", None)
    if not raw:
        raise DatabricksError(
            "Notebook did not produce any output. "
            "Make sure it ends with dbutils.notebook.exit(json.dumps({...}))."
        )

    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise DatabricksError(
            f"Could not parse notebook output as JSON: {raw!r}"
        ) from exc
