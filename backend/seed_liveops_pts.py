"""
Seed LiveOps data from PTS (PowerApps) SharePoint exports.

Inserts all 96 PTS users into team_members, assigns their liveops roles,
populates WL/PL on existing approver config rows, and adds LMS configs.

Run from the project root:
    python -m backend.seed_liveops_pts
"""

import uuid

from backend.db.database import engine, Base
from backend.db import models  # noqa: F401
from backend.db.session import SessionLocal
from backend.db.models import (
    TeamMember,
    Role,
    LiveOpsMemberRole,
    LiveOpsBusinessUnit,
    LiveOpsTicketType,
    LiveOpsApproverConfig,
)

# ── PTS users ──────────────────────────────────────────────────────────────────
# Source: PTS-Users.csv (96 rows, RoleID meanings below)
# 10=Data Engineer, 11=Data Scientist, 12=Platform Engineer, 13=ML Engineer
# 15=LiveOps Team, 16=BI Engineer, 17=Delivery, 18=HR, 19=PMO, 20=LiveOps Manager
PTS_USERS = [
    {"name": "Chamila",          "email": "chamilasi@jkintranet.com"},
    {"name": "Dhananjaya",       "email": "dhananjayj@jkintranet.com"},
    {"name": "Leen",             "email": "shanend@jkintranet.com"},
    {"name": "Chandima",         "email": "chandimass@jkintranet.com"},
    {"name": "Hashan",           "email": "hashanp@jkintranet.com"},
    {"name": "Dinusha",          "email": "dinushad@jkintranet.com"},
    {"name": "Ruwan",            "email": "ruwanw@jkintranet.com"},
    {"name": "Hiruni",           "email": "hirunik@jkintranet.com"},
    {"name": "Yusuf",            "email": "yusufi@jkintranet.com"},
    {"name": "Poornika",         "email": "poornikaw@jkintranet.com"},
    {"name": "Imitiaz",          "email": "imtiazi@jkintranet.com"},
    {"name": "Chanaka",          "email": "chanakaba@jkintranet.com"},
    {"name": "Suchitha",         "email": "suchithad@jkintranet.com"},
    {"name": "Poornima",         "email": "poornimap@jkintranet.com"},
    {"name": "Gavissna",         "email": "gavissnar@jkintranet.com"},
    {"name": "Lalitha",          "email": "lalithaw@jkintranet.com"},
    {"name": "Anjalika",         "email": "anjalikaab@jkintranet.com"},
    {"name": "Sumani",           "email": "sumanir@jkintranet.com"},
    {"name": "Hirusha",          "email": "hirushau@jkintranet.com"},
    {"name": "Duminda",          "email": "dumindaja@jkintranet.com"},
    {"name": "Rakbo",            "email": "rakbop@jkintranet.com"},
    {"name": "Nethma",           "email": "nethmaa@jkintranet.com"},
    {"name": "Nishakya",         "email": "nishakyar@jkintranet.com"},
    {"name": "Chanuri",          "email": "chanuriab@jkintranet.com"},
    {"name": "Mohamed",          "email": "mohamedinm@jkintranet.com"},
    {"name": "Oshadha",          "email": "oshadhas@jkintranet.com"},
    {"name": "Rajitha N",        "email": "rajithan@jkintranet.com"},
    {"name": "Yolan",            "email": "yolans@jkintranet.com"},
    {"name": "Rohan",            "email": "rohanja@jkintranet.com"},
    {"name": "Adil",             "email": "muhammadai@jkintranet.com"},
    {"name": "Mathi",            "email": "mathithaym@jkintranet.com"},
    {"name": "Indeera",          "email": "indeeraw1@jkintranet.com"},
    {"name": "Nadani",           "email": "nadanim@jkintranet.com"},
    {"name": "Nivanka",          "email": "nivankaw@jkintranet.com"},
    {"name": "Thasneem",         "email": "thasneemmu@jkintranet.com"},
    {"name": "Kavin",            "email": "kavink@jkintranet.com"},
    {"name": "Amali",            "email": "amalipe@jkintranet.com"},
    {"name": "Admin",            "email": "octaveu.jkh@keells.com"},
    {"name": "Hiruni S",         "email": "hirunise@jkintranet.com"},
    {"name": "Sachanee",         "email": "sachaneem@jkintranet.com"},
    {"name": "Sahan",            "email": "sahanp@jkintranet.com"},
    {"name": "Varsha",           "email": "varshak@jkintranet.com"},
    {"name": "Thamayanthi",      "email": "thamayantm@jkintranet.com"},
    {"name": "Senura",           "email": "senuraf@jkintranet.com"},
    {"name": "Vishva",           "email": "vishvak@jkintranet.com"},
    {"name": "Chathurika",       "email": "chathurikay@jkintranet.com"},
    {"name": "Tharindu",         "email": "tharinduka@jkintranet.com"},
    {"name": "Sadeepa",          "email": "sadeepj@jkintranet.com"},
    {"name": "Sayuni",           "email": "sayunis@jkintranet.com"},
    {"name": "Sachanee M",       "email": "sachaneema@jkintranet.com"},
    {"name": "Devin",            "email": "devind@jkintranet.com"},
    {"name": "Maneesha",         "email": "maneeshal@jkintranet.com"},
    {"name": "Nethmini",         "email": "nethminia@jkintranet.com"},
    {"name": "Supuni",           "email": "supunide@jkintranet.com"},
    {"name": "Nisal",            "email": "nisalw@jkintranet.com"},
    {"name": "Hatim",            "email": "hatimr@jkintranet.com"},
    {"name": "Nethmi",           "email": "nethmide@jkintranet.com"},
    {"name": "Gimhani",          "email": "gimhanif@jkintranet.com"},
    {"name": "Pamith",           "email": "pamithsa@jkintranet.com"},
    {"name": "Darshi",           "email": "darshik1@jkintranet.com"},
    {"name": "Sithmini",         "email": "sithminir@jkintranet.com"},
    {"name": "Tienn",            "email": "tiennk@jkintranet.com"},
    {"name": "Kenodh",           "email": "kenodhp@jkintranet.com"},
    {"name": "Navindu",          "email": "navindugu@jkintranet.com"},
    {"name": "Yasiru",           "email": "yasiruw@jkintranet.com"},
    {"name": "Nadun",            "email": "nadunt@jkintranet.com"},
    {"name": "Amani",            "email": "amania@jkintranet.com"},
    {"name": "Maleesa",          "email": "maleesah@jkintranet.com"},
    {"name": "Isun",             "email": "isunk@jkintranet.com"},
    {"name": "Mansitha",         "email": "mansithae@jkintranet.com"},
    {"name": "Safia",            "email": "safial@jkintranet.com"},
    {"name": "Udith",            "email": "udithw@jkintranet.com"},
    {"name": "Shavinda",         "email": "shavindaf@jkintranet.com"},
    {"name": "Sanduni",          "email": "sanduniu@jkintranet.com"},
    {"name": "Ashvin",           "email": "ashvinp@jkintranet.com"},
    {"name": "Akila",            "email": "akilaga@jkintranet.com"},
    {"name": "Annatta",          "email": "annattad@jkintranet.com"},
    {"name": "Rachel",           "email": "rachelc@jkintranet.com"},
    {"name": "Amanda",           "email": "amandam@jkintranet.com"},
    {"name": "Asanga",           "email": "asangagu@jkintranet.com"},
    {"name": "Tirani",           "email": "tiranip@jkintranet.com"},
    {"name": "Yusara",           "email": "yusraa@jkintranet.com"},
    {"name": "Abinaya",          "email": "abinayas@jkintranet.com"},
    {"name": "Panduka Bandara",  "email": "pandukab@jkintranet.com"},
    {"name": "Tharushi",         "email": "tharushif@jkintranet.com"},
    {"name": "Chanuka",          "email": "chanukada@jkhintranet.com"},
    {"name": "Hasara",           "email": "hasaram@jkintranet.com"},
    {"name": "Kimaya",           "email": "kimayaka@jkintranet.com"},
    {"name": "Rachel C",         "email": "rachelco@jkintranet.com"},
    {"name": "Sahan Chandima",   "email": "sahanc1@jkintranet.com"},
    {"name": "Kasundie",         "email": "kasundieh@jkintranet.com"},
    {"name": "Sanila",           "email": "sanilaw@jkintranet.com"},
    {"name": "Thilini",          "email": "thilinima@jkintranet.com"},
    {"name": "Sundarbavan",      "email": "sundarbavt@jkintranet.com"},
    {"name": "Larissa",          "email": "larissav@jkintranet.com"},
    {"name": "Sithmi",           "email": "sithmiwi@jkintranet.com"},
    {"name": "Rasara",           "email": "rasarat@jkintranet.com"},
    {"name": "Kavindu",          "email": "kavinduha@jkintranet.com"},
    {"name": "Isuru",            "email": "isurup4@jkintranet.com"},
    {"name": "Janindu N",        "email": "janinduna@jkintranet.com"},
    {"name": "Rasmi",            "email": "rasmim@jkintranet.com"},
    {"name": "Chathuni",         "email": "chathunir@jkintranet.com"},
    {"name": "Kolitha",          "email": "kolithak@jkintranet.com"},
    {"name": "Kalana",           "email": "kalanae@jkintranet.com"},
    {"name": "Tihara",           "email": "tiharal@jkintranet.com"},
    {"name": "Yusuf Aziez",      "email": "yusufa@jkintranet.com"},
    {"name": "Senuthi",          "email": "senuthih@jkintranet.com"},
    {"name": "Yusra Azmi",       "email": "yusraaz@jkintranet.com"},
    {"name": "Dushan",           "email": "dushana@jkintranet.com"},
    {"name": "Dasumi",           "email": "dasumim@jkhintranet.com"},
    {"name": "Praveen",          "email": "praveend@jkintranet.com"},
    {"name": "Dhupika",          "email": "dhupikab@jkintranet.com"},
    {"name": "Sinalie",          "email": "sinaliep@jkintranet.com"},
    {"name": "Nimesh",           "email": "nimeshr@jkintranet.com"},
    {"name": "Ramla",            "email": "ramlana@jkintranet.com"},
    {"name": "Pradeesh",         "email": "pradeesht@jkintranet.com"},
    {"name": "Ramiru",           "email": "ramirug@jkintranet.com"},
    {"name": "Himakara",         "email": "himakaral@jkintranet.com"},
    {"name": "Aushat",           "email": "aushata@jkintranet.com"},
    {"name": "Senalka",          "email": "senalkaw@jkintranet.com"},
    {"name": "Farzan",           "email": "farzanr@jkintranet.com"},
    {"name": "Akindu",           "email": "akindul@jkintranet.com"},
    {"name": "Yaseer",           "email": "yaseern@jkintranet.com"},
    {"name": "Jovanna",          "email": "jovannaf@jkintranet.com"},
    {"name": "Binura",           "email": "binurad@jkintranet.com"},
    {"name": "Kaveeka",          "email": "kaveekak@jkintranet.com"},
    {"name": "Ransika",          "email": "ransikasi@jkintranet.com"},
]

# ── Team membership ────────────────────────────────────────────────────────────
# PE team members (RoleID=12 in PTS)
PE_EMAILS: set[str] = {
    "chamilasi@jkintranet.com",
    "dhananjayj@jkintranet.com",
    "yusufa@jkintranet.com",
    "nimeshr@jkintranet.com",
}

# LiveOps team members (RoleID=15 engineers + RoleID=20 managers)
LIVEOPS_EMAILS: set[str] = {
    "lalithaw@jkintranet.com",
    "octaveu.jkh@keells.com",
    "anjalikaab@jkintranet.com",
    "janinduna@jkintranet.com",
    "ramirug@jkintranet.com",
    "himakaral@jkintranet.com",
    "aushata@jkintranet.com",
}

# LO Managers (liveops team + lead role)
LO_MANAGER_EMAILS: set[str] = {
    "lalithaw@jkintranet.com",
    "octaveu.jkh@keells.com",
}

# ── LiveOps role assignments ───────────────────────────────────────────────────
# Only cross-team approval roles belong here; team identity is set via team_id
LIVEOPS_ROLES: dict[str, list[str]] = {
    # Workstream Leads (PLID in PTS-TicketApprovers)
    "mohamedinm@jkintranet.com": ["workstream_lead", "team_lead"],
    "rajithan@jkintranet.com":   ["workstream_lead", "team_lead"],
    "poornikaw@jkintranet.com":  ["workstream_lead"],
    "nethmaa@jkintranet.com":    ["workstream_lead"],
    "yusufi@jkintranet.com":     ["workstream_lead"],
    "sahanp@jkintranet.com":     ["workstream_lead"],
    "muhammadai@jkintranet.com": ["workstream_lead"],
    "chamilasi@jkintranet.com":  ["workstream_lead", "team_lead"],
    # Practice Leads (DLID in PTS-TicketApprovers) — not already added above
    "shanend@jkintranet.com":    ["team_lead"],
    "ruwanw@jkintranet.com":     ["team_lead"],
    "imtiazi@jkintranet.com":    ["team_lead"],
    "sumanir@jkintranet.com":    ["team_lead"],
}

# ── Approver configs from PTS-TicketApprovers ─────────────────────────────────
# (ticket_type_name, bu_name, wl_email, pl_email)
# Same-person WL=PL is intentional and allowed.
# BU=All row (Resource Revoke + All) is excluded — that BU record gets no WL/PL.
APPROVER_CONFIGS: list[tuple[str, str, str, str]] = [
    ("Data Copy",                  "JMSL",    "mohamedinm@jkintranet.com", "shanend@jkintranet.com"),
    ("Data Copy",                  "CCS",     "rajithan@jkintranet.com",   "shanend@jkintranet.com"),
    ("Data Copy",                  "UAL",     "poornikaw@jkintranet.com",  "shanend@jkintranet.com"),
    ("DS - Defect / Enhancement",  "JMSL",    "nethmaa@jkintranet.com",    "mohamedinm@jkintranet.com"),
    ("DS - Defect / Enhancement",  "CCS",     "rajithan@jkintranet.com",   "rajithan@jkintranet.com"),
    ("DS - Defect / Enhancement",  "UAL",     "poornikaw@jkintranet.com",  "ruwanw@jkintranet.com"),
    ("Access Request - PowerBI",   "JMSL",    "nethmaa@jkintranet.com",    "chamilasi@jkintranet.com"),
    ("Access Request - PowerBI",   "CCS",     "yusufi@jkintranet.com",     "chamilasi@jkintranet.com"),
    ("Access Request - PowerBI",   "UAL",     "poornikaw@jkintranet.com",  "chamilasi@jkintranet.com"),
    ("Platform Request",           "JMSL",    "nethmaa@jkintranet.com",    "chamilasi@jkintranet.com"),
    ("Platform Request",           "CCS",     "yusufi@jkintranet.com",     "chamilasi@jkintranet.com"),
    ("Platform Request",           "UAL",     "poornikaw@jkintranet.com",  "chamilasi@jkintranet.com"),
    ("Dashboard Request",          "JMSL",    "nethmaa@jkintranet.com",    "imtiazi@jkintranet.com"),
    ("Dashboard Request",          "CCS",     "yusufi@jkintranet.com",     "imtiazi@jkintranet.com"),
    ("Dashboard Request",          "UAL",     "poornikaw@jkintranet.com",  "imtiazi@jkintranet.com"),
    ("Service Request",            "JMSL",    "nethmaa@jkintranet.com",    "mohamedinm@jkintranet.com"),
    ("Service Request",            "CCS",     "yusufi@jkintranet.com",     "rajithan@jkintranet.com"),
    ("Service Request",            "UAL",     "poornikaw@jkintranet.com",  "ruwanw@jkintranet.com"),
    ("DE Requests",                "JMSL",    "nethmaa@jkintranet.com",    "shanend@jkintranet.com"),
    ("DE Requests",                "CCS",     "yusufi@jkintranet.com",     "shanend@jkintranet.com"),
    ("DE Requests",                "UAL",     "poornikaw@jkintranet.com",  "shanend@jkintranet.com"),
    ("Access Request",             "CCS",     "yusufi@jkintranet.com",     "chamilasi@jkintranet.com"),
    ("Access Request",             "JMSL",    "nethmaa@jkintranet.com",    "chamilasi@jkintranet.com"),
    ("Access Request",             "UAL",     "poornikaw@jkintranet.com",  "chamilasi@jkintranet.com"),
    ("Resource Revoke Request",    "JMSL",    "nethmaa@jkintranet.com",    "chamilasi@jkintranet.com"),
    ("Resource Revoke Request",    "CCS",     "yusufi@jkintranet.com",     "chamilasi@jkintranet.com"),
    ("Resource Revoke Request",    "UAL",     "poornikaw@jkintranet.com",  "chamilasi@jkintranet.com"),
    ("Access Request",             "Central", "chamilasi@jkintranet.com",  "sumanir@jkintranet.com"),
    ("Resource Revoke Request",    "Central", "chamilasi@jkintranet.com",  "sumanir@jkintranet.com"),
    ("Access Request",             "CHML",    "muhammadai@jkintranet.com", "chamilasi@jkintranet.com"),
    ("Resource Revoke Request",    "CHML",    "muhammadai@jkintranet.com", "chamilasi@jkintranet.com"),
    ("Resource Revoke Request",    "HR",      "sahanp@jkintranet.com",     "chamilasi@jkintranet.com"),
    ("Platform Request",           "Central", "chamilasi@jkintranet.com",  "chamilasi@jkintranet.com"),
    ("Platform Request",           "CHML",    "muhammadai@jkintranet.com", "chamilasi@jkintranet.com"),
    ("DE - Defect / Enhancement",  "JMSL",    "nethmaa@jkintranet.com",    "shanend@jkintranet.com"),
    ("DE - Defect / Enhancement",  "CCS",     "yusufi@jkintranet.com",     "shanend@jkintranet.com"),
    ("DE - Defect / Enhancement",  "UAL",     "poornikaw@jkintranet.com",  "shanend@jkintranet.com"),
    ("BI - Defect / Enhancement",  "JMSL",    "nethmaa@jkintranet.com",    "imtiazi@jkintranet.com"),
    ("BI - Defect / Enhancement",  "CCS",     "yusufi@jkintranet.com",     "imtiazi@jkintranet.com"),
    ("BI - Defect / Enhancement",  "UAL",     "poornikaw@jkintranet.com",  "imtiazi@jkintranet.com"),
]

# LMS configs: all 11 ticket types → WL=Sahan, PL=Chamila (option B expansion)
_ALL_TICKET_TYPES = [
    "Data Copy",               "DS - Defect / Enhancement",  "Access Request - PowerBI",
    "Platform Request",        "Dashboard Request",           "Service Request",
    "DE Requests",             "Access Request",              "Resource Revoke Request",
    "DE - Defect / Enhancement", "BI - Defect / Enhancement",
]
LMS_CONFIGS: list[tuple[str, str, str, str]] = [
    (tt, "LMS", "sahanp@jkintranet.com", "chamilasi@jkintranet.com")
    for tt in _ALL_TICKET_TYPES
]


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # ── 1. Insert PTS users ────────────────────────────────────────────────
        existing_emails = {
            m.email.strip().lower()
            for m in db.query(TeamMember).all()
            if m.email
        }
        members_added = members_skipped = 0
        for u in PTS_USERS:
            email = u["email"].strip().lower()
            if email in existing_emails:
                members_skipped += 1
                continue
            if email in PE_EMAILS:
                team_id = "pe"
            elif email in LIVEOPS_EMAILS:
                team_id = "liveops"
            else:
                team_id = None
            db.add(TeamMember(
                id=str(uuid.uuid4()),
                team_id=team_id,
                name=u["name"].strip(),
                email=email,
                role_id=None,
            ))
            existing_emails.add(email)
            members_added += 1
        db.commit()
        print(f"Members: {members_added} inserted, {members_skipped} already existed")

        # ── 2. Build email → member id lookup ─────────────────────────────────
        email_to_id: dict[str, str] = {
            m.email.strip().lower(): m.id
            for m in db.query(TeamMember).all()
            if m.email
        }

        # ── 3. Set lead role_id for LO Managers ───────────────────────────────
        lead_role = db.query(Role).filter_by(name="lead").first()
        if lead_role:
            lo_role_set = 0
            for email in LO_MANAGER_EMAILS:
                mid = email_to_id.get(email.lower())
                if mid:
                    m = db.query(TeamMember).filter_by(id=mid).first()
                    if m and m.role_id != lead_role.id:
                        m.role_id = lead_role.id
                        lo_role_set += 1
            db.commit()
            print(f"LO Manager role_id set: {lo_role_set}")
        else:
            print("  WARNING: 'lead' role not found in roles table — skipping LO Manager role_id assignment")

        # ── 4. Assign liveops member roles ────────────────────────────────────
        existing_lo_roles = {
            (r.member_id, r.role)
            for r in db.query(LiveOpsMemberRole).all()
        }
        roles_added = roles_skipped = 0
        for email, roles in LIVEOPS_ROLES.items():
            member_id = email_to_id.get(email.lower())
            if not member_id:
                print(f"  WARNING: member not found for {email} — skipping roles")
                continue
            for role in roles:
                if (member_id, role) in existing_lo_roles:
                    roles_skipped += 1
                else:
                    db.add(LiveOpsMemberRole(
                        id=str(uuid.uuid4()),
                        member_id=member_id,
                        role=role,
                    ))
                    existing_lo_roles.add((member_id, role))
                    roles_added += 1
        db.commit()
        print(f"LiveOps member roles: {roles_added} inserted, {roles_skipped} already existed")

        # ── 5. Build lookup maps for BU and ticket type ────────────────────────
        bu_map: dict[str, str] = {b.name: b.id for b in db.query(LiveOpsBusinessUnit).all()}
        tt_map: dict[str, str] = {t.name: t.id for t in db.query(LiveOpsTicketType).all()}

        # ── 6. Update existing approver configs with real WL/PL ────────────────
        cfg_updated = cfg_missing = 0
        for tt_name, bu_name, wl_email, pl_email in APPROVER_CONFIGS:
            tt_id = tt_map.get(tt_name)
            bu_id = bu_map.get(bu_name)
            wl_id = email_to_id.get(wl_email.lower())
            pl_id = email_to_id.get(pl_email.lower())

            if not tt_id or not bu_id:
                print(f"  WARNING: ticket type or BU not found ({tt_name!r}, {bu_name!r}) — skipping")
                cfg_missing += 1
                continue
            if not wl_id:
                print(f"  WARNING: WL member not found for {wl_email} — skipping ({tt_name}, {bu_name})")
                cfg_missing += 1
                continue
            if not pl_id:
                print(f"  WARNING: PL member not found for {pl_email} — skipping ({tt_name}, {bu_name})")
                cfg_missing += 1
                continue

            cfg = db.query(LiveOpsApproverConfig).filter_by(
                ticket_type_id=tt_id, business_unit_id=bu_id,
            ).first()

            if cfg:
                cfg.workstream_lead_id = wl_id
                cfg.team_lead_id       = pl_id
                cfg_updated += 1
            else:
                db.add(LiveOpsApproverConfig(
                    id=str(uuid.uuid4()),
                    ticket_type_id=tt_id,
                    business_unit_id=bu_id,
                    workstream_lead_id=wl_id,
                    team_lead_id=pl_id,
                ))
                cfg_updated += 1

        db.commit()
        print(f"Approver configs updated/inserted: {cfg_updated}, skipped: {cfg_missing}")

        # ── 7. Insert LMS configs (option B: all ticket types → Sahan/Chamila) ─
        lms_added = lms_skipped = 0
        for tt_name, bu_name, wl_email, pl_email in LMS_CONFIGS:
            tt_id = tt_map.get(tt_name)
            bu_id = bu_map.get(bu_name)
            wl_id = email_to_id.get(wl_email.lower())
            pl_id = email_to_id.get(pl_email.lower())

            if not tt_id or not bu_id or not wl_id or not pl_id:
                print(f"  WARNING: LMS config lookup failed ({tt_name!r}) — skipping")
                lms_skipped += 1
                continue

            exists = db.query(LiveOpsApproverConfig).filter_by(
                ticket_type_id=tt_id, business_unit_id=bu_id,
            ).first()
            if exists:
                exists.workstream_lead_id = wl_id
                exists.team_lead_id       = pl_id
                lms_added += 1
            else:
                db.add(LiveOpsApproverConfig(
                    id=str(uuid.uuid4()),
                    ticket_type_id=tt_id,
                    business_unit_id=bu_id,
                    workstream_lead_id=wl_id,
                    team_lead_id=pl_id,
                ))
                lms_added += 1

        db.commit()
        print(f"LMS approver configs: {lms_added} inserted/updated, {lms_skipped} skipped")

    finally:
        db.close()


if __name__ == "__main__":
    seed()
