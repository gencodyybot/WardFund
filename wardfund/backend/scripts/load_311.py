import pandas as pd
import sqlite3 # or psycopg2 depending on your backend DB set up
import os

# Path to your CSV file
CSV_PATH = os.path.join(os.path.dirname(__file__), "../data/toronto_311_data.csv")

def load_data():
    if not os.path.exists(CSV_PATH):
        print(f"Error: CSV file not found at {CSV_PATH}")
        return

    print("Loading Toronto 311 CSV data...")
    df = pd.read_csv(CSV_PATH)
    
    # Perform field mapping and data ingestion logic here
    # e.g., df.to_sql('311_requests', con=engine, if_exists='append', index=False)
    
    print("Data loaded successfully!")

if __name__ == "__main__":
    load_data()