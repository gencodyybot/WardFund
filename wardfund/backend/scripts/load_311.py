"""Load Toronto 311 service requests into Tiger Data.

Usage (run from wardfund/backend):
  python3 scripts/load_311.py --dry-run
  python3 scripts/load_311.py
  python3 scripts/load_311.py --reset

The default CSV path is backend/data/SR2026.csv; a path can be supplied explicitly.
The loader streams rows with psycopg 3 COPY, handles common Toronto CSV date/column
formats, and refuses to append to a non-empty table unless --reset is supplied.
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

try:
    from zoneinfo import ZoneInfo
    TORONTO = ZoneInfo("America/Toronto")
except Exception:  # safe fallback if the system lacks a timezone database
    TORONTO = timezone.utc

BACKEND_DIR = Path(__file__).resolve().parents[1]
DEFAULT_CSV_PATH = BACKEND_DIR / "data" / "SR2026.csv"
DATE_FORMATS = (
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%dT%H:%M:%S",
    "%Y-%m-%d %H:%M:%S.%f",
    "%Y-%m-%dT%H:%M:%S.%f",
    "%m/%d/%Y %H:%M",
    "%Y-%m-%d",
)


def find_env() -> Path | None:
    """Find the nearest .env while walking from this script toward the repo root."""
    here = Path(__file__).resolve()
    for folder in here.parents:
        candidate = folder / ".env"
        if candidate.exists():
            return candidate
    return None


def pick(headers: list[str], *names: str) -> str | None:
    """Match a CSV column by exact name first, then by partial name, case-insensitively."""
    lowered = {h.strip().lower(): h for h in headers if h is not None}
    for name in names:
        if name.lower() in lowered:
            return lowered[name.lower()]
    for name in names:
        needle = name.lower()
        for low, original in lowered.items():
            if needle in low:
                return original
    return None



def parse_date(value: str | None) -> datetime | None:
    value = (value or "").strip()
    if not value:
        return None

    # Handle ISO timestamps, including 7+ fractional-second digits.
    # Python datetime supports microseconds (6 digits), so trim excess precision.
    normalized = value.replace("Z", "+00:00")

    match = re.match(
        r"^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})\.(\d+)(.*)$",
        normalized,
    )
    if match:
        fraction = match.group(2)[:6].ljust(6, "0")
        normalized = f"{match.group(1)}.{fraction}{match.group(3)}"

    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        parsed = None
        for fmt in DATE_FORMATS:
            try:
                parsed = datetime.strptime(value, fmt)
                break
            except ValueError:
                continue

        if parsed is None:
            return None

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=TORONTO)

    return parsed



def parse_ward(value: str | None) -> str | None:
    """Convert values such as 'Toronto-Danforth (14)' or 'Ward 14' to 'ward-14'."""
    value = (value or "").strip()
    match = re.search(r"\b(\d{1,2})\b", value)
    if not match:
        return None
    number = int(match.group(1))
    if not 1 <= number <= 25:
        return None
    return f"ward-{number}"


def new_stats() -> dict:
    return {
        "total": 0,
        "kept": 0,
        "skipped": 0,
        "wards": Counter(),
        "categories": Counter(),
        "min_date": None,
        "max_date": None,
        "headers": [],
        "cols": {},
        "error": None,
    }


def stream_rows(path: Path, stats: dict):
    """Yield rows in schema order: ward_id, category, status, requested_at, metadata."""
    with path.open("r", newline="", encoding="utf-8-sig", errors="replace") as file:
        reader = csv.DictReader(file)
        headers = reader.fieldnames or []
        cols = {
            "date": pick(headers, "creation date", "creation_date", "requested_at", "created date", "date"),
            "ward": pick(headers, "ward", "ward_name", "ward number", "ward #"),
            "category": pick(headers, "service request type", "service_request_type", "category", "request type", "type"),
            "status": pick(headers, "status"),
            "postal": pick(headers, "first 3 chars of postal code", "postal prefix", "postal"),
        }
        stats["headers"] = headers
        stats["cols"] = cols
        missing = [name for name in ("date", "ward", "category") if not cols[name]]
        if missing:
            stats["error"] = f"Could not find CSV column(s): {', '.join(missing)}"
            return

        for row in reader:
            stats["total"] += 1
            ward_id = parse_ward(row.get(cols["ward"]))
            requested_at = parse_date(row.get(cols["date"]))
            category = (row.get(cols["category"]) or "").strip()
            if not ward_id or requested_at is None or not category:
                stats["skipped"] += 1
                continue

            status = (row.get(cols["status"]) or "").strip() if cols["status"] else ""
            metadata = {}
            postal_value = row.get(cols["postal"]) if cols["postal"] else None
            if postal_value and postal_value.strip():
                metadata["postal_prefix"] = postal_value.strip()

            stats["kept"] += 1
            stats["wards"][ward_id] += 1
            stats["categories"][(ward_id, category)] += 1
            stats["min_date"] = (
                requested_at if stats["min_date"] is None or requested_at < stats["min_date"]
                else stats["min_date"]
            )
            stats["max_date"] = (
                requested_at if stats["max_date"] is None or requested_at > stats["max_date"]
                else stats["max_date"]
            )
            yield (ward_id, category[:100], status[:50], requested_at, json.dumps(metadata))


def report(stats: dict) -> bool:
    print("\nColumns found:", stats.get("headers"))
    print("Columns matched:", stats.get("cols"))
    if stats.get("error"):
        print("\nERROR:", stats["error"])
        return False
    print(
        f"\nRows read: {stats['total']:,} | usable: {stats['kept']:,} "
        f"| skipped (missing/invalid ward, date, or category): {stats['skipped']:,}"
    )
    print("Date range:", stats["min_date"], "to", stats["max_date"])
    print("Top wards:", ", ".join(f"{ward} ({count:,})" for ward, count in stats["wards"].most_common(5)))
    for ward in ("ward-14", "ward-4"):
        top = [(category, count) for (w, category), count in stats["categories"].most_common() if w == ward][:3]
        if top:
            print(f"Top categories in {ward}:", ", ".join(f"{category} ({count:,})" for category, count in top))
    return True


def load_env() -> None:
    env_file = find_env()
    if env_file:
        from dotenv import load_dotenv
        load_dotenv(env_file, override=False)


def ingest(csv_path: Path, reset: bool = False, dry_run: bool = False) -> None:
    if not csv_path.is_file():
        raise SystemExit(f"CSV not found: {csv_path}")

    # Validate the whole file before opening the database. This also ensures an
    # invalid header cannot truncate an existing table when --reset is supplied.
    validation_stats = new_stats()
    for _ in stream_rows(csv_path, validation_stats):
        pass
    valid = report(validation_stats)
    if not valid:
        raise SystemExit(1)
    if validation_stats["kept"] == 0:
        raise SystemExit("No valid 311 rows found; the database was not changed.")
    if dry_run:
        print("\nDry run complete; no database connection was opened and no data was changed.")
        return

    load_env()
    database_url = os.getenv("TIGER_DATA_URL") or os.getenv("DATABASE_URL")
    if not database_url:
        raise SystemExit("Set TIGER_DATA_URL or DATABASE_URL in the repository-root .env file.")

    try:
        import psycopg  # psycopg 3 is used for its efficient streaming COPY interface
    except ImportError as exc:
        raise SystemExit('Missing database driver. Install it with: python3 -m pip install "psycopg[binary]"') from exc

    print(f"\nConnecting to Tiger Data; CSV has {validation_stats['kept']:,} usable rows...")
    try:
        # The connection context makes TRUNCATE + COPY one transaction. If import
        # fails, --reset's TRUNCATE is rolled back instead of losing the old data.
        with psycopg.connect(database_url, connect_timeout=10) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) FROM service_requests_311")
                existing_count = cur.fetchone()[0]
                if existing_count and not reset:
                    raise SystemExit(
                        f"service_requests_311 already contains {existing_count:,} rows. "
                        "No rows were inserted. Use --reset only if you intend to replace them."
                    )
                if reset:
                    cur.execute("TRUNCATE TABLE service_requests_311 RESTART IDENTITY")
                    print("Existing service_requests_311 rows cleared inside the import transaction.")

                loaded_stats = new_stats()
                print("Streaming rows into service_requests_311...")
                with cur.copy(
                    "COPY service_requests_311 (ward_id, category, status, requested_at, metadata) FROM STDIN"
                ) as copy:
                    for row in stream_rows(csv_path, loaded_stats):
                        copy.write_row(row)

                if loaded_stats.get("error"):
                    raise RuntimeError(loaded_stats["error"])
                print(f"Inserted {loaded_stats['kept']:,} 311 rows.")

                # The supplied schema does not define requests_daily. Refresh it
                # only when it exists in the configured database.
                cur.execute("SELECT to_regclass('requests_daily')")
                aggregate = cur.fetchone()[0]
                if aggregate:
                    cur.execute("SAVEPOINT refresh_daily")
                    try:
                        cur.execute("CALL refresh_continuous_aggregate('requests_daily', NULL, NULL)")
                    except Exception as exc:
                        cur.execute("ROLLBACK TO SAVEPOINT refresh_daily")
                        cur.execute("RELEASE SAVEPOINT refresh_daily")
                        print(f"Warning: rows loaded, but requests_daily refresh failed: {type(exc).__name__}: {exc}")
                    else:
                        cur.execute("RELEASE SAVEPOINT refresh_daily")
                        print("Refreshed requests_daily continuous aggregate.")
                else:
                    print("No requests_daily aggregate found; skipped optional aggregate refresh.")
        print("\nTiger Data ingestion complete.")
    except SystemExit:
        raise
    except Exception as exc:
        raise SystemExit(f"Tiger Data ingestion failed; the transaction was rolled back: {type(exc).__name__}: {exc}") from exc


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "csv_path",
        nargs="?",
        type=Path,
        default=DEFAULT_CSV_PATH,
        help=f"CSV file path (default: {DEFAULT_CSV_PATH})",
    )
    parser.add_argument("--dry-run", action="store_true", help="parse and report without connecting to the database")
    parser.add_argument("--reset", action="store_true", help="delete existing 311 rows and reload this CSV")
    args = parser.parse_args()
    ingest(args.csv_path.expanduser().resolve(), reset=args.reset, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
