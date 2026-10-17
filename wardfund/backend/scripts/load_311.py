import os
import re
import pandas as pd
import psycopg2
from psycopg2.extras import execute_batch
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
CSV_PATH = os.path.join(os.path.dirname(__file__), "../data/SR2026.csv")

def normalize_ward(val):
    if pd.isna(val): return None
    match = re.search(r'\b(?:Ward\s*)?(\d{1,2})\b', str(val), re.IGNORECASE)
    return f"ward-{match.group(1)}" if match else None

def ingest():
    if not DATABASE_URL:
        print("Please set DATABASE_URL in .env to use Tiger Data.")
        return

    print("Connecting to Tiger Data...")
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    print(f"Reading {CSV_PATH}...")
    df = pd.read_csv(CSV_PATH, low_memory=False, on_bad_lines='skip', encoding='latin1')

    # Normalize column names
    cols = {c.lower().strip(): c for c in df.columns}
    ward_col = cols.get("ward") or cols.get("ward_name")
    cat_col = cols.get("service request type") or cols.get("category")
    date_col = cols.get("creation date") or cols.get("created_date")

    df["ward_id"] = df[ward_col].apply(normalize_ward)
    df["requested_at"] = pd.to_datetime(df[date_col], errors="coerce")
    df["category"] = df[cat_col].fillna("General Request")

    clean_df = df.dropna(subset=["ward_id", "requested_at"]).head(10000) # upload 10k rows for fast demo

    records = [
        (row["ward_id"], row["category"][:99], "Closed", row["requested_at"])
        for _, row in clean_df.iterrows()
    ]

    print(f"Inserting {len(records)} records into Tiger Data...")
    insert_sql = """
    INSERT INTO service_requests_311 (ward_id, category, status, requested_at)
    VALUES (%s, %s, %s, %s);
    """
    execute_batch(cur, insert_sql, records, page_size=1000)
    conn.commit()
    cur.close()
    conn.close()
    print("✅ Ingestion to Tiger Data complete!")

if __name__ == "__main__":
    ingest()