"""
Run from the project root:
    C:\Python313\python.exe -m backend.seed
"""

from backend.db.database import engine, Base
from backend.db import models  # noqa: F401
from backend.db.session import SessionLocal
from backend.db.models import (
    Team, Task, TaskOccurrence, TaskComment, TaskIdCounter,
    Role, TeamMember, KpiMetric, KpiEvaluation,
    Department, AiTool,
    TrackerArea, TrackerGroup, TrackerTask, TrackerSubtask,
    CostEntry, LiveOpsSlaConfig, LiveOpsBusinessUnit,
    LiveOpsTicketType, LiveOpsUseCase, LiveOpsApproverConfig,
    LiveOpsMemberRole,
)

TEAMS = [
    {"id": "pe", "name": "PE"},
    {"id": "so", "name": "SO"},
]

ROLES = ["user", "lead", "head", "admin"]

DEPARTMENTS = [
    "Delivery", "DS", "DE", "BI", "MLE", "PM"
]

AI_TOOLS = [
    {"name": "Claude",  "tier": None,          "monthly_cost": 1900},   # $19.00 in cents
    {"name": "Copilot", "tier": "Enterprise",  "monthly_cost": 2500},   # $25.00
    {"name": "Copilot", "tier": "Business",    "monthly_cost": 4000},   # $40.00
]

MEMBERS = [
    {"team_id": None,  "name": "Nimesh Rajapakse", "email": "nimeshraja18@gmail.com", "role_name": "admin"},
    {"team_id": "pe",  "name": "Bob Smith",         "email": "bob@example.com",        "role_name": "user"},
    {"team_id": "pe",  "name": "Carol White",       "email": "carol@example.com",      "role_name": "lead"},
    {"team_id": "so",  "name": "Chamila",           "email": "chamila.siriwardhana@gmail.com", "role_name": "lead"},
    {"team_id": "so",  "name": "David Brown",       "email": "david@example.com",      "role_name": "user"},
    {"team_id": "so",  "name": "Emma Davis",        "email": "emma@example.com",       "role_name": "head"},
    {"team_id": "so",  "name": "Frank Wilson",      "email": "frank@example.com",      "role_name": "user"},
]

# IDs follow the format: {TEAM}-{REC}-{YEAR}-{SEQ:03d}
TASKS = [
    # PE — Weekly
    {"id": "PE-W-2026-001", "title": "Send weekly status report",    "description": "Compile and send the weekly status report to all stakeholders.",       "recurrence": "weekly",    "team_id": "pe"},
    {"id": "PE-W-2026-002", "title": "Database backup verification", "description": "Verify that all scheduled database backups completed successfully.",    "recurrence": "weekly",    "team_id": "pe"},
    # SO — Weekly
    {"id": "SO-W-2026-001", "title": "Review open pull requests",    "description": "Review and provide feedback on all open PRs in the repo.",             "recurrence": "weekly",    "team_id": "so"},
    {"id": "SO-W-2026-002", "title": "Deploy to staging",            "description": "Run the deployment pipeline to push latest build to staging.",          "recurrence": "weekly",    "team_id": "so"},
    # PE — Monthly
    {"id": "PE-M-2026-001", "title": "Monthly security audit",       "description": "Review access logs and security alerts for the month.",                 "recurrence": "monthly",   "team_id": "pe"},
    {"id": "PE-M-2026-002", "title": "Update project documentation", "description": "Ensure all docs are up to date with the latest changes.",               "recurrence": "monthly",   "team_id": "pe"},
    # SO — Monthly
    {"id": "SO-M-2026-001", "title": "Monthly team retrospective",   "description": "Conduct the monthly retrospective meeting with the full team.",          "recurrence": "monthly",   "team_id": "so"},
    # PE — Quarterly
    {"id": "PE-Q-2026-001", "title": "Quarterly roadmap review",     "description": "Review and update the product roadmap for the next quarter.",           "recurrence": "quarterly", "team_id": "pe"},
    # SO — Quarterly
    {"id": "SO-Q-2026-001", "title": "Quarterly dependency updates", "description": "Update all project dependencies to latest stable versions.",            "recurrence": "quarterly", "team_id": "so"},
    # PE — Annually
    {"id": "PE-A-2026-001", "title": "Annual performance reviews",   "description": "Complete annual performance review documentation for all team members.", "recurrence": "annually",  "team_id": "pe"},
    # SO — Annually
    {"id": "SO-A-2026-001", "title": "Annual disaster recovery drill", "description": "Conduct the annual disaster recovery simulation and document findings.", "recurrence": "annually", "team_id": "so"},
]

# Counters to initialize after seeding — tracks highest seq per (team, recurrence, year)
COUNTERS = [
    {"team_id": "pe", "recurrence": "weekly",    "year": 2026, "counter": 2},
    {"team_id": "so", "recurrence": "weekly",    "year": 2026, "counter": 2},
    {"team_id": "pe", "recurrence": "monthly",   "year": 2026, "counter": 2},
    {"team_id": "so", "recurrence": "monthly",   "year": 2026, "counter": 1},
    {"team_id": "pe", "recurrence": "quarterly", "year": 2026, "counter": 1},
    {"team_id": "so", "recurrence": "quarterly", "year": 2026, "counter": 1},
    {"team_id": "pe", "recurrence": "annually",  "year": 2026, "counter": 1},
    {"team_id": "so", "recurrence": "annually",  "year": 2026, "counter": 1},
]


KPI_METRICS = [
    # ── Long category names (UI stress test) ──────────────────────────────────
    {
        "category": "Environmental Health, Safety and Regulatory Compliance Management",
        "year": 2026, "metric_name": "Safety Incident Reporting",
        "pdca": "check", "frequency": "quarterly",
        "kpi_owner_name": "David Brown", "responsible_party_name": "Frank Wilson",
        "planned": 3, "target": 100, "remarks": None,
        "evaluations": [
            {"period_label": "Q1", "period_order": 1, "actual": None},
            {"period_label": "Q2", "period_order": 2, "actual": None},
            {"period_label": "Q3", "period_order": 3, "actual": None},
            {"period_label": "Q4", "period_order": 4, "actual": None},
        ],
    },
    {
        "category": "Environmental Health, Safety and Regulatory Compliance Management",
        "year": 2026, "metric_name": "Regulatory Audit Completions",
        "pdca": "do", "frequency": "annually",
        "kpi_owner_name": "Emma Davis", "responsible_party_name": "Frank Wilson",
        "planned": 2, "target": 100, "remarks": None,
        "evaluations": [
            {"period_label": "Annual", "period_order": 1, "actual": None},
        ],
    },
    {
        "category": "Strategic Partnership Development and Stakeholder Engagement Initiatives Stakeholder Engagement Initiatives and Strategic Partnership Development",
        "year": 2026, "metric_name": "Partner Onboarding Sessions",
        "pdca": "plan", "frequency": "quarterly",
        "kpi_owner_name": "Chamila", "responsible_party_name": "Nimesh Rajapakse",
        "planned": 2, "target": 80, "remarks": None,
        "evaluations": [
            {"period_label": "Q1", "period_order": 1, "actual": None},
            {"period_label": "Q2", "period_order": 2, "actual": None},
            {"period_label": "Q3", "period_order": 3, "actual": None},
            {"period_label": "Q4", "period_order": 4, "actual": None},
        ],
    },
    # ── HR ────────────────────────────────────────────────────────────────────
    {
        "category": "HR", "year": 2026, "metric_name": "Awareness Sessions",
        "pdca": "do", "frequency": "quarterly",
        "kpi_owner_name": "Nimesh Rajapakse", "responsible_party_name": "Frank Wilson",
        "planned": 4, "target": 100, "remarks": None,
        "evaluations": [
            {"period_label": "Q1", "period_order": 1, "actual": 4},
            {"period_label": "Q2", "period_order": 2, "actual": 4},
            {"period_label": "Q3", "period_order": 3, "actual": 3},
            {"period_label": "Q4", "period_order": 4, "actual": None},
        ],
    },
    {
        "category": "HR", "year": 2026, "metric_name": "Risk Analysis Reviews",
        "pdca": "check", "frequency": "quarterly",
        "kpi_owner_name": "Nimesh Rajapakse", "responsible_party_name": "David Brown",
        "planned": 2, "target": 100, "remarks": "Q3 review rescheduled to September.",
        "evaluations": [
            {"period_label": "Q1", "period_order": 1, "actual": 2},
            {"period_label": "Q2", "period_order": 2, "actual": 1},
            {"period_label": "Q3", "period_order": 3, "actual": None},
            {"period_label": "Q4", "period_order": 4, "actual": None},
        ],
    },
    {
        "category": "HR", "year": 2026, "metric_name": "Training Completion",
        "pdca": "do", "frequency": "monthly",
        "kpi_owner_name": "David Brown", "responsible_party_name": "Carol White",
        "planned": 1, "target": 100, "remarks": None,
        "evaluations": [
            {"period_label": "Jan", "period_order": 1,  "actual": 1},
            {"period_label": "Feb", "period_order": 2,  "actual": 1},
            {"period_label": "Mar", "period_order": 3,  "actual": 1},
            {"period_label": "Apr", "period_order": 4,  "actual": 1},
            {"period_label": "May", "period_order": 5,  "actual": 1},
            {"period_label": "Jun", "period_order": 6,  "actual": 1},
            {"period_label": "Jul", "period_order": 7,  "actual": 1},
            {"period_label": "Aug", "period_order": 8,  "actual": None},
            {"period_label": "Sep", "period_order": 9,  "actual": None},
            {"period_label": "Oct", "period_order": 10, "actual": None},
            {"period_label": "Nov", "period_order": 11, "actual": None},
            {"period_label": "Dec", "period_order": 12, "actual": None},
        ],
    },
    # ── Operations ────────────────────────────────────────────────────────────
    {
        "category": "Operations", "year": 2026, "metric_name": "System Audits",
        "pdca": "check", "frequency": "quarterly",
        "kpi_owner_name": "Chamila", "responsible_party_name": "Carol White",
        "planned": 1, "target": 100, "remarks": None,
        "evaluations": [
            {"period_label": "Q1", "period_order": 1, "actual": 1},
            {"period_label": "Q2", "period_order": 2, "actual": 1},
            {"period_label": "Q3", "period_order": 3, "actual": None},
            {"period_label": "Q4", "period_order": 4, "actual": None},
        ],
    },
    {
        "category": "Operations", "year": 2026, "metric_name": "Incident Drills",
        "pdca": "do", "frequency": "monthly",
        "kpi_owner_name": "Nimesh Rajapakse", "responsible_party_name": "Bob Smith",
        "planned": 2, "target": 100, "remarks": None,
        "evaluations": [
            {"period_label": "Jan", "period_order": 1,  "actual": 2},
            {"period_label": "Feb", "period_order": 2,  "actual": 2},
            {"period_label": "Mar", "period_order": 3,  "actual": 2},
            {"period_label": "Apr", "period_order": 4,  "actual": 2},
            {"period_label": "May", "period_order": 5,  "actual": 2},
            {"period_label": "Jun", "period_order": 6,  "actual": 2},
            {"period_label": "Jul", "period_order": 7,  "actual": 1},
            {"period_label": "Aug", "period_order": 8,  "actual": None},
            {"period_label": "Sep", "period_order": 9,  "actual": None},
            {"period_label": "Oct", "period_order": 10, "actual": None},
            {"period_label": "Nov", "period_order": 11, "actual": None},
            {"period_label": "Dec", "period_order": 12, "actual": None},
        ],
    },
    # ── Sales ─────────────────────────────────────────────────────────────────
    {
        "category": "Sales", "year": 2026, "metric_name": "Pipeline Reviews",
        "pdca": "check", "frequency": "quarterly",
        "kpi_owner_name": "David Brown", "responsible_party_name": "Bob Smith",
        "planned": 4, "target": 100, "remarks": None,
        "evaluations": [
            {"period_label": "Q1", "period_order": 1, "actual": 4},
            {"period_label": "Q2", "period_order": 2, "actual": 3},
            {"period_label": "Q3", "period_order": 3, "actual": None},
            {"period_label": "Q4", "period_order": 4, "actual": None},
        ],
    },
    {
        "category": "Sales", "year": 2026, "metric_name": "Client Meetings",
        "pdca": "do", "frequency": "monthly",
        "kpi_owner_name": "Chamila", "responsible_party_name": "Bob Smith",
        "planned": 10, "target": 80, "remarks": None,
        "evaluations": [
            {"period_label": "Jan", "period_order": 1,  "actual": 10},
            {"period_label": "Feb", "period_order": 2,  "actual": 9},
            {"period_label": "Mar", "period_order": 3,  "actual": 10},
            {"period_label": "Apr", "period_order": 4,  "actual": 8},
            {"period_label": "May", "period_order": 5,  "actual": 10},
            {"period_label": "Jun", "period_order": 6,  "actual": 7},
            {"period_label": "Jul", "period_order": 7,  "actual": 9},
            {"period_label": "Aug", "period_order": 8,  "actual": None},
            {"period_label": "Sep", "period_order": 9,  "actual": None},
            {"period_label": "Oct", "period_order": 10, "actual": None},
            {"period_label": "Nov", "period_order": 11, "actual": None},
            {"period_label": "Dec", "period_order": 12, "actual": None},
        ],
    },
    # ── Finance ───────────────────────────────────────────────────────────────
    {
        "category": "Finance", "year": 2026, "metric_name": "Budget Reviews",
        "pdca": "check", "frequency": "quarterly",
        "kpi_owner_name": "Emma Davis", "responsible_party_name": "Chamila",
        "planned": 1, "target": 100, "remarks": None,
        "evaluations": [
            {"period_label": "Q1", "period_order": 1, "actual": 1},
            {"period_label": "Q2", "period_order": 2, "actual": 1},
            {"period_label": "Q3", "period_order": 3, "actual": None},
            {"period_label": "Q4", "period_order": 4, "actual": None},
        ],
    },
    {
        "category": "Finance", "year": 2026, "metric_name": "Cost Saving Initiatives",
        "pdca": "act", "frequency": "annually",
        "kpi_owner_name": "David Brown", "responsible_party_name": "Carol White",
        "planned": 3, "target": 100, "remarks": "Targeting 3 major initiatives for 2026.",
        "evaluations": [
            {"period_label": "Annual", "period_order": 1, "actual": None},
        ],
    },
]


# ── Cost seed data ────────────────────────────────────────────────────────────
# 6 months Apr–Sep 2026. Amounts in cents. Each month has line items per
# category so the summary endpoint shows realistic trends.

def _cost_entries():
    # base amounts (Sep 2026 = month index 5)
    # Proportions are fixed per service; totals grow month-over-month.
    db_totals     = [8840, 9120, 9360, 9580, 9720, 9840]
    cmp_totals    = [17200, 17850, 18230, 18510, 18680, 18720]
    agent_totals  = [4210, 4580, 4820, 5240, 5490, 5720]
    months        = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]

    db_props   = [0.6626, 0.1911, 0.1463]   # postgres, storage, backups
    cmp_props  = [0.6651, 0.0978, 0.1218, 0.1153]  # servers, lb, cdn, registry
    agent_props = [0.4965, 0.2203, 0.1958, 0.0874]  # sonnet, haiku, langchain, embed

    db_svc   = [("PostgreSQL instance", "db.t3.large"), ("Provisioned storage", "500 GB SSD"), ("Automated backups", "Daily snapshots")]
    cmp_svc  = [("App servers", "2× EC2 t3.medium"), ("Load balancer", "Application LB"), ("CDN", "CloudFront"), ("Container registry", "ECR storage & egress")]
    agent_svc = [("Claude Sonnet", "Input + output tokens"), ("Claude Haiku", "Lightweight tasks"), ("LangChain orchestrator", "Workflow executions"), ("Embeddings", "Vector generation")]

    entries = []
    for i, month in enumerate(months):
        # database
        db_remaining = db_totals[i]
        for j, (name, sub) in enumerate(db_svc):
            amount = db_remaining if j == len(db_svc) - 1 else round(db_totals[i] * db_props[j])
            db_remaining -= amount if j < len(db_svc) - 1 else 0
            entries.append({"category": "database", "service_name": name, "service_description": sub, "month": month, "amount_cents": round(db_totals[i] * db_props[j]) if j < len(db_svc) - 1 else db_totals[i] - sum(round(db_totals[i] * db_props[k]) for k in range(len(db_svc) - 1))})

        # compute
        for j, (name, sub) in enumerate(cmp_svc):
            entries.append({"category": "compute", "service_name": name, "service_description": sub, "month": month, "amount_cents": round(cmp_totals[i] * cmp_props[j]) if j < len(cmp_svc) - 1 else cmp_totals[i] - sum(round(cmp_totals[i] * cmp_props[k]) for k in range(len(cmp_svc) - 1))})

        # agent
        for j, (name, sub) in enumerate(agent_svc):
            entries.append({"category": "agent", "service_name": name, "service_description": sub, "month": month, "amount_cents": round(agent_totals[i] * agent_props[j]) if j < len(agent_svc) - 1 else agent_totals[i] - sum(round(agent_totals[i] * agent_props[k]) for k in range(len(agent_svc) - 1))})

    return entries

COST_ENTRIES = _cost_entries()


# ── LiveOps lookup data (from SharePoint PTS lists) ───────────────────────────

LIVEOPS_BUSINESS_UNITS = [
    {"name": "Central"},
    {"name": "JMSL"},
    {"name": "CCS"},
    {"name": "UAL"},
    {"name": "CHML"},
    {"name": "LMS"},
    {"name": "HR"},
    {"name": "All"},
]

LIVEOPS_TICKET_TYPES = [
    {"name": "Data Copy",                "sort_order": 1,  "guide_text": "Specify the source and destination paths, the size of the data to be copied, and whether it is a full copy or a partitioned copy."},
    {"name": "DS - Defect / Enhancement","sort_order": 2,  "guide_text": "Specify the use case name along with a clear description, including what changes will occur, where they will be applied, and the expected outcomes."},
    {"name": "Access Request - PowerBI", "sort_order": 3,  "guide_text": "Provide a clear description of the type of access required (e.g., Dashboard access with relevant details), and a list of people who need access along with their email addresses."},
    {"name": "Platform Request",         "sort_order": 4,  "guide_text": "Provide a clear description of the requirement (e.g., if it's a job creation request mention the job name and other relevant details; if it's a resource provisioning request, list the required resources or mention the SharePoint location, etc.)"},
    {"name": "Dashboard Request",        "sort_order": 5,  "guide_text": "Provide a clear description of the type of Dashboard request (e.g., Dashboard refresh, Configuration change, Filter change, etc.)."},
    {"name": "Service Request",          "sort_order": 6,  "guide_text": "Issues related to pipeline rerun, SharePoint validation support. Provide all necessary details."},
    {"name": "DE Requests",              "sort_order": 7,  "guide_text": "Issues related to ADF pipeline run, Managed table creation etc. Provide all necessary details."},
    {"name": "Access Request",           "sort_order": 8,  "guide_text": "Please select the username from the dropdown. Add any other required detail in the request detail field."},
    {"name": "Resource Revoke Request",  "sort_order": 9,  "guide_text": "Please select the username from the dropdown. Add any other required detail in the request detail field."},
    {"name": "DE - Defect / Enhancement","sort_order": 10, "guide_text": "Specify the use case name along with a clear description, including what changes will occur, where they will be applied, and the expected outcomes."},
    {"name": "BI - Defect / Enhancement","sort_order": 11, "guide_text": "Specify the use case name along with a clear description, including what changes will occur, where they will be applied, and the expected outcomes."},
]

# BU name → list of use case names.
# BUID=0 entries in the source data are mapped to "All".
# "Introducing new usecase" placeholder entries are excluded.
LIVEOPS_USE_CASES: list[tuple[str, str]] = [
    # JMSL (BUID=2)
    ("JMSL", "Marketing Outreach"),
    ("JMSL", "Customer Churn"),
    ("JMSL", "Fresh Pricing Optimization"),
    ("JMSL", "Supply Chain Control Tower"),
    ("JMSL", "Fresh Promo Effectiveness"),
    ("JMSL", "SOL-Roster"),
    ("JMSL", "Fresh Procurement"),
    ("JMSL", "Premium Personalization"),
    ("JMSL", "Fresh Promo Optimization"),
    ("JMSL", "Promotion Effectiveness"),
    ("JMSL", "SOL-Replenishment"),
    ("JMSL", "Space & Assortment"),
    ("JMSL", "Dry Sales"),
    ("JMSL", "Customer Centricity"),
    ("JMSL", "Retail Media Network (RMN)"),
    ("JMSL", "Cybake"),
    ("JMSL", "Wooqer"),
    ("JMSL", "Stock Calculation"),
    # UAL (BUID=4)
    ("UAL",  "Lapse Prevention"),
    ("UAL",  "Agent Activity Management"),
    # CCS (BUID=3)
    ("CCS",  "Distributor Margins"),
    ("CCS",  "Factory Production Planning"),
    ("CCS",  "Discount Effectiveness"),
    ("CCS",  "Distribution Efficiency"),
    ("CCS",  "Distributor Margin Optimization"),
    ("CCS",  "Sales Force Effectiveness"),
    ("CCS",  "MT Promo Effectiveness"),
    ("CCS",  "Sales Forecasting"),
    ("CCS",  "Distributor Replenishment System"),
    # HR (BUID=7)
    ("HR",   "Octave HR"),
    # Central (BUID=1)
    ("Central", "MLE"),
    ("Central", "DS"),
    ("Central", "DE"),
    ("Central", "PE"),
    # CHML (BUID=5)
    ("CHML", "Management Dashboard"),
    ("CHML", "Customer Lifetime Value"),
    ("CHML", "Energy Reduction"),
    ("CHML", "Digital Incremental Selling"),
    ("CHML", "Brand .com"),
    ("CHML", "Cancellation"),
    ("CHML", "DE-Lakehouse"),
    ("CHML", "F&B"),
    # All / General (BUID=0 in source → mapped to "All")
    ("All",  "DevOps Permission"),
    ("All",  "Azure Permission"),
    ("All",  "Databricks Access"),
]

# Maps PTS-TicketApprovers.csv numeric IDs to our seeded names.
# PLID/DLID (practice/delivery lead user IDs) are omitted — no PTS-Users export
# available to resolve them to TeamPulse member IDs. Admin sets WL/TL via UI.
_PTS_BU = {
    1: "Central", 2: "JMSL", 3: "CCS", 4: "UAL",
    5: "CHML",    6: "LMS",  7: "HR",  100: "All",
}
_PTS_TT = {
    1: "Data Copy",               2: "DS - Defect / Enhancement",
    3: "Access Request - PowerBI", 4: "Platform Request",
    5: "Dashboard Request",        6: "Service Request",
    7: "DE Requests",              8: "Access Request",
    9: "Resource Revoke Request",  10: "DE - Defect / Enhancement",
    11: "BI - Defect / Enhancement",
}
# (TicketTypeID, BUID) pairs from PTS-TicketApprovers.csv
LIVEOPS_APPROVER_COMBOS = [
    (1,2),(1,3),(1,4),
    (2,2),(2,3),(2,4),
    (3,2),(3,3),(3,4),
    (4,2),(4,3),(4,4),(4,1),(4,5),
    (5,2),(5,3),(5,4),
    (6,2),(6,3),(6,4),
    (7,2),(7,3),(7,4),
    (8,3),(8,2),(8,4),(8,1),(8,5),
    (9,2),(9,3),(9,4),(9,100),(9,1),(9,5),(9,7),
    (10,2),(10,3),(10,4),
    (11,2),(11,3),(11,4),
]


TRACKER_AREAS = [
    {
        "name": "Governance & Compliance", "sort_order": 0,
        "groups": [
            {
                "name": "ISO Programme", "sort_order": 0,
                "tasks": [
                    {
                        "title": "ISO 27001 Recertification", "owner": "Chamila Perera",
                        "planned_end_date": "2026-12-31", "sort_order": 0,
                        "subtasks": [
                            {"title": "Gap analysis & scoping",        "date": "2026-08-15", "remarks": "Completed by internal team", "is_done": True,  "sort_order": 0},
                            {"title": "Internal audit preparation",     "date": "2026-10-30", "remarks": None,                        "is_done": False, "sort_order": 1},
                            {"title": "Corrective action plan",         "date": "2026-11-15", "remarks": None,                        "is_done": False, "sort_order": 2},
                            {"title": "Certification audit",            "date": "2026-12-20", "remarks": None,                        "is_done": False, "sort_order": 3},
                        ],
                    },
                    {
                        "title": "External Compliance Review", "owner": "Nimal Fernando",
                        "planned_end_date": "2026-10-15", "sort_order": 1,
                        "subtasks": [
                            {"title": "Vendor questionnaire dispatch",  "date": "2026-09-30", "remarks": "Pending legal sign-off", "is_done": False, "sort_order": 0},
                            {"title": "Document submission to auditor", "date": "2026-10-05", "remarks": None,                    "is_done": False, "sort_order": 1},
                            {"title": "Review sign-off",                "date": "2026-10-15", "remarks": None,                    "is_done": False, "sort_order": 2},
                        ],
                    },
                ],
            },
            {
                "name": "Risk Management", "sort_order": 1,
                "tasks": [
                    {
                        "title": "Annual Risk Register Update", "owner": "Ruwan Silva",
                        "planned_end_date": None, "sort_order": 0,
                        "subtasks": [
                            {"title": "IT risk assessment",      "date": None, "remarks": "Done — no new critical risks", "is_done": True,  "sort_order": 0},
                            {"title": "Operational risk review", "date": None, "remarks": None,                          "is_done": False, "sort_order": 1},
                            {"title": "Board presentation",      "date": None, "remarks": None,                          "is_done": False, "sort_order": 2},
                        ],
                    },
                ],
            },
        ],
    },
    {
        "name": "Digital Transformation", "sort_order": 1,
        "groups": [
            {
                "name": "Cloud Migration", "sort_order": 0,
                "tasks": [
                    {
                        "title": "Phase 1 — Core Infrastructure", "owner": "Kasun Jayawardena",
                        "planned_end_date": "2027-03-31", "sort_order": 0,
                        "subtasks": [
                            {"title": "Architecture design",        "date": None, "remarks": "Approved by CTO", "is_done": True,  "sort_order": 0},
                            {"title": "Dev environment setup",       "date": None, "remarks": None,             "is_done": True,  "sort_order": 1},
                            {"title": "Staging environment setup",   "date": None, "remarks": None,             "is_done": True,  "sort_order": 2},
                            {"title": "Data migration (non-prod)",   "date": None, "remarks": None,             "is_done": False, "sort_order": 3},
                            {"title": "Production deployment",        "date": None, "remarks": None,             "is_done": False, "sort_order": 4},
                            {"title": "UAT & sign-off",              "date": None, "remarks": None,             "is_done": False, "sort_order": 5},
                        ],
                    },
                    {
                        "title": "Legacy System Decommission", "owner": "Priya Mendis",
                        "planned_end_date": "2026-08-31", "sort_order": 1,
                        "subtasks": [
                            {"title": "Identify dependent services", "date": None, "remarks": None,                            "is_done": True,  "sort_order": 0},
                            {"title": "Migrate all data",            "date": None, "remarks": "Blocked — DB schema conflict",  "is_done": False, "sort_order": 1},
                            {"title": "Decommission approval",        "date": None, "remarks": None,                            "is_done": False, "sort_order": 2},
                            {"title": "System shutdown",              "date": None, "remarks": None,                            "is_done": False, "sort_order": 3},
                        ],
                    },
                ],
            },
            {
                "name": "Automation", "sort_order": 1,
                "tasks": [
                    {
                        "title": "Incident Response Automation", "owner": "Dilshan Ratnayake",
                        "planned_end_date": "2026-10-05", "sort_order": 0,
                        "subtasks": [
                            {"title": "Playbook design",              "date": None, "remarks": "Reviewed and signed off", "is_done": True,  "sort_order": 0},
                            {"title": "Tool integration (PagerDuty)", "date": None, "remarks": None,                      "is_done": False, "sort_order": 1},
                            {"title": "Test scenarios",               "date": None, "remarks": None,                      "is_done": False, "sort_order": 2},
                            {"title": "Pilot run",                   "date": None, "remarks": None,                      "is_done": False, "sort_order": 3},
                            {"title": "Full rollout",                 "date": None, "remarks": None,                      "is_done": False, "sort_order": 4},
                        ],
                    },
                ],
            },
        ],
    },
    {
        "name": "Capability Development", "sort_order": 2,
        "groups": [
            {
                "name": "Team Training", "sort_order": 0,
                "tasks": [
                    {
                        "title": "Security Awareness Programme", "owner": "Nilufar Srinivasan",
                        "planned_end_date": None, "sort_order": 0,
                        "subtasks": [
                            {"title": "Q1 training sessions (Mar)", "date": None, "remarks": "62 staff completed", "is_done": True,  "sort_order": 0},
                            {"title": "Q2 training sessions (Jun)", "date": None, "remarks": "58 staff completed", "is_done": True,  "sort_order": 1},
                            {"title": "Q3 training sessions (Sep)", "date": None, "remarks": "In progress",        "is_done": True,  "sort_order": 2},
                            {"title": "Q4 training sessions (Dec)", "date": None, "remarks": None,                 "is_done": False, "sort_order": 3},
                        ],
                    },
                    {
                        "title": "Agile Transformation Rollout", "owner": "Marcus Lee",
                        "planned_end_date": "2026-11-30", "sort_order": 1,
                        "subtasks": [
                            {"title": "Scrum master training",    "date": None, "remarks": "All leads certified",  "is_done": True, "sort_order": 0},
                            {"title": "Team coaching sessions",   "date": None, "remarks": "8 sprints completed",  "is_done": True, "sort_order": 1},
                            {"title": "Process documentation",    "date": None, "remarks": None,                   "is_done": True, "sort_order": 2},
                            {"title": "Retrospective framework",  "date": None, "remarks": None,                   "is_done": True, "sort_order": 3},
                        ],
                    },
                ],
            },
        ],
    },
]


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # --- Teams ---
        existing_team_ids = {t.id for t in db.query(Team.id).all()}
        teams_added = 0
        for t in TEAMS:
            if t["id"] not in existing_team_ids:
                db.add(Team(**t))
                teams_added += 1
        db.commit()
        print(f"Teams: {teams_added} inserted, {len(TEAMS) - teams_added} already existed")

        # --- Departments ---
        existing_depts = {d.name for d in db.query(Department.name).all()}
        depts_added = 0
        for name in DEPARTMENTS:
            if name not in existing_depts:
                import uuid as _uuid
                db.add(Department(id=str(_uuid.uuid4()), name=name))
                depts_added += 1
        db.commit()
        print(f"Departments: {depts_added} inserted, {len(DEPARTMENTS) - depts_added} already existed")

        # --- AI Tools ---
        existing_tools = {(t.name, t.tier) for t in db.query(AiTool.name, AiTool.tier).all()}
        tools_added = 0
        for t in AI_TOOLS:
            if (t["name"], t["tier"]) not in existing_tools:
                import uuid as _uuid
                db.add(AiTool(id=str(_uuid.uuid4()), **t))
                tools_added += 1
        db.commit()
        print(f"AI Tools: {tools_added} inserted, {len(AI_TOOLS) - tools_added} already existed")

        # --- Roles ---
        import uuid as _uuid
        # Rename legacy 'dev' role to 'user' if it still exists
        old_dev = db.query(Role).filter_by(name='dev').first()
        if old_dev:
            old_dev.name = 'user'
            db.commit()
            print("Roles: renamed 'dev' → 'user'")

        existing_role_names = {r.name for r in db.query(Role.name).all()}
        roles_added = 0
        for name in ROLES:
            if name not in existing_role_names:
                db.add(Role(id=str(_uuid.uuid4()), name=name))
                roles_added += 1
        db.commit()
        print(f"Roles: {roles_added} inserted, {len(ROLES) - roles_added} already existed")

        # Build role_name -> role_id lookup
        role_map = {r.name: r.id for r in db.query(Role).all()}

        # --- Tasks ---
        existing_ids    = {t.id    for t in db.query(Task.id).all()}
        existing_titles = {t.title: t.id for t in db.query(Task.title, Task.id).all()}
        tasks_added = tasks_skipped = 0

        for t in TASKS:
            if t["id"] in existing_ids:
                tasks_skipped += 1
                continue

            old_id = existing_titles.get(t["title"])
            if old_id:
                for occ in db.query(TaskOccurrence).filter(TaskOccurrence.task_id == old_id).all():
                    db.query(TaskComment).filter(TaskComment.occurrence_id == occ.id).delete()
                db.query(TaskOccurrence).filter(TaskOccurrence.task_id == old_id).delete()
                db.query(Task).filter(Task.id == old_id).delete()
                db.flush()

            db.add(Task(**t))
            tasks_added += 1

        db.commit()
        print(f"Tasks: {tasks_added} inserted/replaced, {tasks_skipped} already existed")

        # --- Task ID Counters ---
        counters_added = counters_skipped = 0
        for c in COUNTERS:
            existing = db.query(TaskIdCounter).filter_by(
                team_id=c["team_id"], recurrence=c["recurrence"], year=c["year"]
            ).first()
            if existing:
                counters_skipped += 1
            else:
                db.add(TaskIdCounter(**c))
                counters_added += 1
        db.commit()
        print(f"Counters: {counters_added} inserted, {counters_skipped} already existed")

        # --- Team Members ---
        members_added = 0
        for m in MEMBERS:
            role_id = role_map.get(m["role_name"])
            # Look up by email (globally unique identity) or by (team_id, name)
            existing = db.query(TeamMember).filter_by(email=m["email"]).first()
            if not existing and m["team_id"]:
                existing = db.query(TeamMember).filter_by(team_id=m["team_id"], name=m["name"]).first()
            if not existing:
                db.add(TeamMember(
                    id=str(_uuid.uuid4()),
                    team_id=m["team_id"],
                    name=m["name"],
                    email=m["email"],
                    role_id=role_id,
                ))
                members_added += 1
            else:
                # Backfill role and team updates
                if role_id:
                    existing.role_id = role_id
                existing.team_id = m["team_id"]
        db.commit()
        print(f"Members: {members_added} inserted, {len(MEMBERS) - members_added} already existed (roles backfilled)")

        # Build member_name -> member_id lookup (all members)
        member_map = {m.name: m.id for m in db.query(TeamMember).all()}

        # --- KPI Metrics + Evaluations ---
        kpi_added = 0
        for m in KPI_METRICS:
            evaluations = m.pop("evaluations")
            kpi_owner_name = m.pop("kpi_owner_name", None)
            responsible_party_name = m.pop("responsible_party_name", None)
            kpi_owner_id = member_map.get(kpi_owner_name) if kpi_owner_name else None
            responsible_party_id = member_map.get(responsible_party_name) if responsible_party_name else None

            exists = db.query(KpiMetric).filter_by(
                category=m["category"], year=m["year"], metric_name=m["metric_name"],
            ).first()
            if not exists:
                metric = KpiMetric(
                    id=str(_uuid.uuid4()),
                    kpi_owner_id=kpi_owner_id,
                    responsible_party_id=responsible_party_id,
                    **m,
                )
                db.add(metric)
                db.flush()
                for ev in evaluations:
                    db.add(KpiEvaluation(id=str(_uuid.uuid4()), kpi_metric_id=metric.id, **ev))
                kpi_added += 1
            else:
                # Always overwrite FKs to keep seed data authoritative
                all_matches = db.query(KpiMetric).filter_by(
                    category=m["category"], year=m["year"], metric_name=m["metric_name"],
                ).all()
                for row in all_matches:
                    if kpi_owner_id:
                        row.kpi_owner_id = kpi_owner_id
                    if responsible_party_id:
                        row.responsible_party_id = responsible_party_id

            m["evaluations"] = evaluations
            if kpi_owner_name:
                m["kpi_owner_name"] = kpi_owner_name
            if responsible_party_name:
                m["responsible_party_name"] = responsible_party_name

        db.commit()
        print(f"KPI metrics: {kpi_added} inserted, {len(KPI_METRICS) - kpi_added} already existed (FK backfilled)")

        # --- Tracker Areas / Groups / Tasks / Subtasks ---
        import uuid as _uuid2
        areas_added = groups_added = tasks_added = subtasks_added = 0
        existing_area_names = {a.name for a in db.query(TrackerArea.name).all()}

        for a in TRACKER_AREAS:
            if a["name"] in existing_area_names:
                continue
            area = TrackerArea(id=str(_uuid2.uuid4()), name=a["name"], sort_order=a["sort_order"])
            db.add(area)
            db.flush()
            areas_added += 1

            for g in a["groups"]:
                group = TrackerGroup(id=str(_uuid2.uuid4()), area_id=area.id, name=g["name"], sort_order=g["sort_order"])
                db.add(group)
                db.flush()
                groups_added += 1

                for t in g["tasks"]:
                    task = TrackerTask(
                        id=str(_uuid2.uuid4()), group_id=group.id,
                        title=t["title"], owner=t["owner"],
                        planned_end_date=t["planned_end_date"], sort_order=t["sort_order"],
                    )
                    db.add(task)
                    db.flush()
                    tasks_added += 1

                    for s in t["subtasks"]:
                        db.add(TrackerSubtask(
                            id=str(_uuid2.uuid4()), task_id=task.id,
                            title=s["title"], date=s["date"], remarks=s["remarks"],
                            is_done=s["is_done"], sort_order=s["sort_order"],
                        ))
                        subtasks_added += 1

        db.commit()
        print(f"Tracker: {areas_added} areas, {groups_added} groups, {tasks_added} tasks, {subtasks_added} subtasks inserted")

        # --- Cost Entries ---
        existing_cost = db.query(CostEntry.month).distinct().all()
        existing_months = {r[0] for r in existing_cost}
        cost_added = 0
        for e in COST_ENTRIES:
            if e["month"] not in existing_months:
                db.add(CostEntry(id=str(_uuid.uuid4()), **e))
                cost_added += 1
        db.commit()
        print(f"Cost entries: {cost_added} inserted ({len(existing_cost)} months already existed)")

        # --- LiveOps SLA Configs ---
        sla_defaults = [
            {"urgency": "high",   "response_hours": 4},
            {"urgency": "medium", "response_hours": 24},
            {"urgency": "low",    "response_hours": 72},
        ]
        sla_added = 0
        existing_urgencies = {r.urgency for r in db.query(LiveOpsSlaConfig).all()}
        for s in sla_defaults:
            if s["urgency"] not in existing_urgencies:
                db.add(LiveOpsSlaConfig(id=str(_uuid.uuid4()), **s))
                sla_added += 1
        db.commit()
        print(f"LiveOps SLA configs: {sla_added} inserted ({len(existing_urgencies)} already existed)")

        # --- LiveOps Business Units ---
        existing_bu_names = {b.name for b in db.query(LiveOpsBusinessUnit).all()}
        bu_added = 0
        for b in LIVEOPS_BUSINESS_UNITS:
            if b["name"] not in existing_bu_names:
                db.add(LiveOpsBusinessUnit(id=str(_uuid.uuid4()), name=b["name"], is_active=True))
                bu_added += 1
        db.commit()
        print(f"LiveOps BUs: {bu_added} inserted, {len(LIVEOPS_BUSINESS_UNITS) - bu_added} already existed")

        # Build BU name → id map (needed for use cases)
        bu_map = {b.name: b.id for b in db.query(LiveOpsBusinessUnit).all()}

        # --- LiveOps Ticket Types ---
        existing_tt_names = {t.name for t in db.query(LiveOpsTicketType).all()}
        tt_added = 0
        for t in LIVEOPS_TICKET_TYPES:
            if t["name"] not in existing_tt_names:
                db.add(LiveOpsTicketType(id=str(_uuid.uuid4()), is_active=True, **t))
                tt_added += 1
        db.commit()
        print(f"LiveOps ticket types: {tt_added} inserted, {len(LIVEOPS_TICKET_TYPES) - tt_added} already existed")

        # --- LiveOps Use Cases ---
        existing_uc = {
            (u.business_unit_id, u.name)
            for u in db.query(LiveOpsUseCase.business_unit_id, LiveOpsUseCase.name).all()
        }
        uc_added = uc_skipped = 0
        for bu_name, uc_name in LIVEOPS_USE_CASES:
            bu_id = bu_map.get(bu_name)
            if not bu_id:
                print(f"  WARNING: BU '{bu_name}' not found — skipping use case '{uc_name}'")
                uc_skipped += 1
                continue
            if (bu_id, uc_name) not in existing_uc:
                db.add(LiveOpsUseCase(id=str(_uuid.uuid4()), business_unit_id=bu_id, name=uc_name, is_active=True))
                uc_added += 1
        db.commit()
        print(f"LiveOps use cases: {uc_added} inserted, {len(LIVEOPS_USE_CASES) - uc_added - uc_skipped} already existed, {uc_skipped} skipped")

        # --- LiveOps Approver Config (routing structure, WL/TL to be assigned via Admin UI) ---
        tt_id_map = {t.name: t.id for t in db.query(LiveOpsTicketType).all()}
        existing_cfg = {
            (c.ticket_type_id, c.business_unit_id)
            for c in db.query(LiveOpsApproverConfig).all()
        }
        cfg_added = cfg_skipped = 0
        for tt_pts_id, bu_pts_id in LIVEOPS_APPROVER_COMBOS:
            tt_name = _PTS_TT.get(tt_pts_id)
            bu_name = _PTS_BU.get(bu_pts_id)
            tt_id = tt_id_map.get(tt_name) if tt_name else None
            bu_id = bu_map.get(bu_name) if bu_name else None
            if not tt_id or not bu_id:
                cfg_skipped += 1
                continue
            if (tt_id, bu_id) not in existing_cfg:
                db.add(LiveOpsApproverConfig(
                    id=str(_uuid.uuid4()),
                    ticket_type_id=tt_id,
                    business_unit_id=bu_id,
                    workstream_lead_id=None,
                    team_lead_id=None,
                ))
                cfg_added += 1
        db.commit()
        print(f"LiveOps approver configs: {cfg_added} inserted ({len(existing_cfg)} already existed, {cfg_skipped} skipped) — assign WL/TL via Admin tab")

        # --- LiveOps Member Roles ---
        # Map name → member id from what was just seeded
        member_name_map = {m.name: m.id for m in db.query(TeamMember).all()}

        LIVEOPS_MEMBER_ROLES = [
            # LO Manager
            {"name": "Chamila",      "role": "lo_manager"},
            # Platform Engineers
            {"name": "Bob Smith",    "role": "platform_engineer"},
            {"name": "Carol White",  "role": "platform_engineer"},
            # LiveOps Engineers
            {"name": "David Brown",  "role": "liveops_engineer"},
            {"name": "Frank Wilson", "role": "liveops_engineer"},
        ]

        existing_lo_roles = {
            (r.member_id, r.role)
            for r in db.query(LiveOpsMemberRole).all()
        }
        lo_added = 0
        for entry in LIVEOPS_MEMBER_ROLES:
            mid = member_name_map.get(entry["name"])
            if not mid:
                print(f"  WARNING: member '{entry['name']}' not found — skipping liveops role")
                continue
            if (mid, entry["role"]) not in existing_lo_roles:
                db.add(LiveOpsMemberRole(id=str(_uuid.uuid4()), member_id=mid, role=entry["role"]))
                lo_added += 1
        db.commit()
        print(f"LiveOps member roles: {lo_added} inserted ({len(existing_lo_roles)} already existed)")

        print("Seed complete.")

    except Exception as e:
        db.rollback()
        print(f"Seed failed: {e}")
        raise
    finally:
        db.close()


run_seed = seed  # alias for manage.py

if __name__ == "__main__":
    seed()
