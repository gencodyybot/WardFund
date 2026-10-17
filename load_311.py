import os
import re
import pandas as pd
from typing import Optional

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# 1. Search common project paths for SR2026.csv
POSSIBLE_PATHS = [
    os.path.join(BASE_DIR, "SR2026.csv"),                   # backend/SR2026.csv
    os.path.join(BASE_DIR, "..", "SR2026.csv"),             # root/SR2026.csv
    os.path.join(BASE_DIR, "data", "SR2026.csv"),          # backend/data/SR2026.csv
    os.path.join(BASE_DIR, "..", "data", "SR2026.csv"),     # root/data/SR2026.csv
    os.path.join(BASE_DIR, "toronto_311_data.csv"),        # fallback name
]

def find_csv_path() -> Optional[str]:
    # Check if a custom environment variable is set
    env_path = os.getenv("CSV_PATH")
    if env_path and os.path.exists(env_path):
        return env_path

    for path in POSSIBLE_PATHS:
        normalized = os.path.normpath(path)
        if os.path.exists(normalized):
            return normalized
    return None

def normalize_ward_id(ward_value) -> Optional[str]:
    """
    Normalizes Toronto 311 Ward entries (e.g., 'Ward 14 - Toronto-Danforth' or 14) to 'ward-14'.
    """
    if pd.isna(ward_value):
        return None
    match = re.search(r'\b(?:Ward\s*)?(\d{1,2})\b', str(ward_value), re.IGNORECASE)
    if match:
        ward_num = match.group(1)
        return f"ward-{ward_num}"
    return None

def load_data():
    csv_file = find_csv_path()
    
    if not csv_file:
        print("Could not find 'SR2026.csv' in backend/ or root directory.")
        print("Searched locations:")
        for p in POSSIBLE_PATHS:
            print(f"  - {os.path.normpath(p)}")
        print("\nUsing default seeded ward indicators in main.py.")
        return

    print(f"Reading Toronto 311 records from: {csv_file}")
    
    try:
        # Load CSV (low_memory=False handles large 311 files without dtype warnings)
        df = pd.read_csv(csv_file, low_memory=False)
        print(f"Loaded {len(df):,} rows from SR2026.csv")
        print(f"Detected columns: {list(df.columns[:8])}...")

        # Detect relevant column names (Toronto Open Data can vary between releases)
        cols = {col.lower().strip(): col for col in df.columns}
        ward_col = cols.get("ward") or cols.get("ward_number") or cols.get("ward_name")
        type_col = cols.get("service request type") or cols.get("service_code") or cols.get("category") or cols.get("division")
        date_col = cols.get("creation date") or cols.get("created_date") or cols.get("date")

        if not ward_col or not type_col:
            print(f"⚠️ Warning: Expected 'Ward' and 'Service Request Type' columns in SR2026.csv. Available: {list(df.columns)}")
            return

        # Normalize ward IDs
        df["ward_id"] = df[ward_col].apply(normalize_ward_id)
        valid_records = df.dropna(subset=["ward_id"])

        print(f"Valid records with identified wards: {len(valid_records):,}")

        # Summary of top categories for Ward 14 & Ward 4
        for ward_id in ["ward-14", "ward-10", "ward-4"]:
            ward_subset = valid_records[valid_records["ward_id"] == ward_id]
            if not ward_subset.empty:
                top_cats = ward_subset[type_col].value_counts().head(3)
                print(f"\n--- {ward_id.upper()} Top 311 Issues ({len(ward_subset):,} total) ---")
                for cat, count in top_cats.items():
                    pct = (count / len(ward_subset)) * 100
                    print(f"  • {cat}: {count:,} ({pct:.1f}%)")

        print("\nData processing complete! You can now pipe this into schema.sql or use it in main.py.")

    except Exception as e:
        print(f"Error loading SR2026.csv: {e}")

if __name__ == "__main__":
    load_data()