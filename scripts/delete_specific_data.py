import os
import sys
from datetime import datetime

# Add the project root to the Python path to allow for correct module imports
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(project_root)

from app.db import create_session, cleanup_db_sessions
from app.models import DailyReport

# --- Configuration ---
PHARMACY_CODE_TO_DELETE = "reitz"
DATE_TO_DELETE_STR = "2025-06-18"
# ---------------------

def delete_data_for_date():
    """
    Connects to the database and deletes all entries in the DailyReport table
    for a specific pharmacy on a specific date.
    """
    try:
        date_to_delete = datetime.strptime(DATE_TO_DELETE_STR, "%Y-%m-%d").date()
    except ValueError:
        print(f"Error: Invalid date format for '{DATE_TO_DELETE_STR}'. Please use YYYY-MM-DD.")
        return

    session = None
    try:
        print("Connecting to the database...")
        session = create_session()
        print("Connection successful.")

        # Find the records to be deleted
        print(f"Searching for records for pharmacy '{PHARMACY_CODE_TO_DELETE}' on {date_to_delete}...")
        
        records_to_delete = session.query(DailyReport).filter(
            DailyReport.pharmacy_code == PHARMACY_CODE_TO_DELETE,
            DailyReport.report_date == date_to_delete
        ).all()

        if not records_to_delete:
            print("No records found for the specified pharmacy and date. No action taken.")
            return

        print(f"Found {len(records_to_delete)} record(s) to delete.")
        
        # Ask for user confirmation
        confirm = input("Are you sure you want to permanently delete this data? (yes/no): ")
        if confirm.lower() != 'yes':
            print("Deletion cancelled by user.")
            return
            
        # Perform the deletion
        print("Deleting records...")
        for record in records_to_delete:
            session.delete(record)
        
        session.commit()
        print("Records successfully deleted and transaction committed.")

    except Exception as e:
        print(f"An error occurred: {e}")
        if session:
            print("Rolling back transaction.")
            session.rollback()
    finally:
        if session:
            print("Closing database session.")
            cleanup_db_sessions()

if __name__ == "__main__":
    print("--- WARNING: This script will permanently delete data from the database. ---")
    delete_data_for_date() 