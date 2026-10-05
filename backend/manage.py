"""
TeamPulse management CLI.

Usage:
    python -m backend.manage fresh        # drop all tables, migrate, seed
    python -m backend.manage fresh --no-seed
    python -m backend.manage migrate      # run pending migrations
    python -m backend.manage seed         # seed data only
    python -m backend.manage status       # show current migration revision
"""

import argparse
import sys


def _get_alembic_cfg():
    from alembic.config import Config
    return Config("alembic.ini")


def cmd_migrate():
    from alembic import command
    print("Running migrations...")
    command.upgrade(_get_alembic_cfg(), "head")
    print("Done.")


def cmd_seed():
    print("Seeding database...")
    from backend.seed import run_seed
    run_seed()
    print("Done.")


def cmd_fresh(seed: bool):
    from sqlalchemy import text
    from alembic import command
    from backend.db.database import engine, Base
    from backend.db import models  # noqa: F401 — ensure all models registered

    print("Truncating all tables...")
    table_names = ', '.join(
        f'"{t.name}"' for t in reversed(Base.metadata.sorted_tables)
    )
    with engine.connect() as conn:
        conn.execute(text(f"TRUNCATE {table_names} CASCADE"))
        conn.commit()
    print("All data cleared.")

    # Stamp at baseline then apply any pending migrations so schema stays current
    print("Syncing schema...")
    cfg = _get_alembic_cfg()
    command.stamp(cfg, "0001")
    command.upgrade(cfg, "head")
    print("Schema up to date.")

    if seed:
        cmd_seed()


def cmd_status():
    from alembic import command
    command.current(_get_alembic_cfg(), verbose=True)


def main():
    parser = argparse.ArgumentParser(prog="backend.manage")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("migrate", help="Run pending migrations")
    sub.add_parser("seed",    help="Seed the database")
    sub.add_parser("status",  help="Show current migration revision")

    fresh_p = sub.add_parser("fresh", help="Drop all tables, migrate, and seed")
    fresh_p.add_argument("--no-seed", action="store_true", help="Skip seeding after migrate")

    args = parser.parse_args()

    if args.command == "migrate":
        cmd_migrate()
    elif args.command == "seed":
        cmd_seed()
    elif args.command == "status":
        cmd_status()
    elif args.command == "fresh":
        confirm = input("This will TRUNCATE all tables (delete all data). Type 'yes' to continue: ")
        if confirm.strip().lower() != "yes":
            print("Aborted.")
            sys.exit(0)
        cmd_fresh(seed=not args.no_seed)


if __name__ == "__main__":
    main()
