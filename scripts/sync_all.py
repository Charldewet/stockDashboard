#!/usr/bin/env python3
import os
import sys
import datetime
import shutil
import argparse

# Add project root to Python path
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)
sys.path.append(project_root)

from app.db import create_session
from app.models import DailyReport
from app.parser import parse_html_daily
from app.email_fetcher import sync_all_emails # Uses a large day count (3650) by default
from config import settings

TEMP_HTML_DIR = "/tmp/daily_html/"

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--pharmacy', help='Pharmacy code to sync (e.g., winterton)')
    args = parser.parse_args()

    session = create_session()
    print(f"Database: {settings.DATABASE_URI}")

    # sync_all_emails fetches for a very long period (e.g., 10 years)
    # by default to get all historical emails.

    for pharmacy_config in settings.MAILBOXES:
        if args.pharmacy and pharmacy_config["code"] != args.pharmacy:
            continue
        pharmacy_name = pharmacy_config.get("name", pharmacy_config["code"])
        print(f"Attempting to sync ALL emails for: {pharmacy_name} ({pharmacy_config.get('username')})")
        
        processed_files_count = 0
        try:
            # sync_all_emails internally calls fetch_emails_last_n_days with a large 'days' value
            for filepath, report_date_obj in sync_all_emails(pharmacy_config):
                if filepath:
                    print(f"Parsing report: {filepath} for date: {report_date_obj.strftime('%Y-%m-%d')}")
                    try:
                        data = parse_html_daily(filepath)
                        data['pharmacy_code'] = pharmacy_config["code"]
                        data['report_date'] = report_date_obj

                        # Delete existing record for this pharmacy and date, if any
                        session.query(DailyReport).filter_by(
                            pharmacy_code=pharmacy_config["code"],
                            report_date=report_date_obj
                        ).delete(synchronize_session='fetch')
                        
                        new_report = DailyReport(**data)
                        session.add(new_report)
                        session.commit()
                        print(f"[SUCCESS] Report data saved to database for {pharmacy_config['code']} - {report_date_obj.strftime('%Y-%m-%d')}")
                        processed_files_count += 1
                    except Exception as e:
                        session.rollback()
                        print(f"[ERROR] Failed to parse or save report {filepath}: {e}")
                    finally:
                        if os.path.exists(filepath):
                            try:
                                os.remove(filepath)
                                print(f"Removed temporary file: {filepath}")
                            except OSError as e_rm:
                                print(f"[ERROR] Could not remove temp file {filepath}: {e_rm}")
                else:
                    print(f"[WARN] sync_all_emails yielded None filepath for {report_date_obj}")
            
            if processed_files_count == 0:
                print(f"No new email reports found or processed during full sync for {pharmacy_name}.")

        except Exception as e_fetch:
            print(f"[ERROR] Could not sync emails for {pharmacy_name}: {e_fetch}")
        
        print(f"Finished syncing all emails for {pharmacy_name}.")

    if os.path.exists(TEMP_HTML_DIR) and not os.listdir(TEMP_HTML_DIR):
        try:
            shutil.rmtree(TEMP_HTML_DIR)
            print(f"Cleaned up empty temporary directory: {TEMP_HTML_DIR}")
        except OSError as e_rmdir:
            print(f"[ERROR] Could not remove temp directory {TEMP_HTML_DIR}: {e_rmdir}")

    session.close()

if __name__ == "__main__":
    main()
