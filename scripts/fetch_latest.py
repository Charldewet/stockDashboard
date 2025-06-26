#!/usr/bin/env python3
import os
import sys
import datetime
import shutil
import argparse
import psutil
import pprint
import gc

# Add project root to Python path
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)
sys.path.append(project_root)

from app.db import create_session, cleanup_db_sessions
from app.models import DailyReport
from app.parser import parse_html_daily
from app.email_fetcher import fetch_emails_last_n_days, sync_all_emails
from config import settings

TEMP_HTML_DIR = "/tmp/daily_html/"

def main():
    print("=== fetch_latest.py started ===", flush=True)
    now = datetime.datetime.now()
    print(f"[DEBUG] Current time: {now} (local timezone)", flush=True)
    print(f"[DEBUG] Current UTC time: {datetime.datetime.utcnow()} (UTC)", flush=True)
    print(f"[DEBUG] sys.path: {sys.path}", flush=True)
    print(f"[DEBUG] Environment variables (partial):", flush=True)
    pprint.pprint(dict(list(os.environ.items())[:10]))  # Print first 10 env vars for brevity

    # Ensure temp directory exists
    if not os.path.exists(TEMP_HTML_DIR):
        print(f"[DEBUG] Creating temp directory: {TEMP_HTML_DIR}", flush=True)
        os.makedirs(TEMP_HTML_DIR, exist_ok=True)
    else:
        print(f"[DEBUG] Temp directory already exists: {TEMP_HTML_DIR}", flush=True)
    print(f"[DEBUG] Files in {TEMP_HTML_DIR} at start: {os.listdir(TEMP_HTML_DIR) if os.path.exists(TEMP_HTML_DIR) else 'Directory does not exist'}", flush=True)

    print(f"[Memory] At script start: {psutil.Process(os.getpid()).memory_info().rss / 1024 ** 2:.2f} MB", flush=True)
    parser = argparse.ArgumentParser(description="Fetch and parse latest pharmacy emails for all pharmacies.")
    parser.add_argument('--all', action='store_true', help='Fetch all emails (not just last 7 days)')
    args = parser.parse_args()

    session = create_session()
    print(f"Database: {settings.DATABASE_URI}")

    days_to_fetch = 7
    total_emails_processed = 0
    latest_date = None
    
    try:
        for pharmacy_config in settings.MAILBOXES:
            pharmacy_name = pharmacy_config.get("name", pharmacy_config["code"])
            print(f"Checking for new emails for {pharmacy_name}...", flush=True)
            print(f"[Memory] Before fetching {pharmacy_name}: {psutil.Process(os.getpid()).memory_info().rss / 1024 ** 2:.2f} MB", flush=True)
            processed_files_count = 0
            
            try:
                # Check if we have the required credentials for this pharmacy
                if not pharmacy_config.get("email_user") or not pharmacy_config.get("email_password"):
                    print(f"[SKIP] Missing email credentials for {pharmacy_name}, skipping...")
                    continue
                    
                if args.all:
                    email_iter = sync_all_emails(pharmacy_config)
                else:
                    email_iter = fetch_emails_last_n_days(pharmacy_config, days=days_to_fetch)
                
                # Process emails one by one to avoid memory issues
                for filepath, report_date_obj, subject in email_iter:
                    try:
                        print(f"  > 1 new email found with subject: '{subject}'", flush=True)
                        
                        # Skip forwarded emails that don't contain the report
                        if "fwd:" in subject.lower():
                            print(f"  > Skipping forwarded email: '{subject}'", flush=True)
                            continue

                        print(f"[DEBUG] About to process: filepath={filepath}, report_date_obj={report_date_obj}", flush=True)
                        if filepath and os.path.exists(filepath):
                            print(f"[Memory] Before parsing {filepath}: {psutil.Process(os.getpid()).memory_info().rss / 1024 ** 2:.2f} MB", flush=True)
                            print(f"Parsing report: {filepath} for date: {report_date_obj.strftime('%Y-%m-%d')}")
                            
                            try:
                                data = parse_html_daily(filepath)
                                print(f"[Memory] After parsing {filepath}: {psutil.Process(os.getpid()).memory_info().rss / 1024 ** 2:.2f} MB", flush=True)
                                data['pharmacy_code'] = pharmacy_config["code"]
                                data['report_date'] = report_date_obj
                                
                                # Delete existing report for this date if it exists
                                session.query(DailyReport).filter_by(
                                    pharmacy_code=pharmacy_config["code"],
                                    report_date=report_date_obj
                                ).delete(synchronize_session='fetch')
                                
                                new_report = DailyReport(**data)
                                session.add(new_report)
                                session.commit()
                                print(f"  > New data added for {pharmacy_name} for {report_date_obj.strftime('%Y-%m-%d')}", flush=True)
                                processed_files_count += 1
                                total_emails_processed += 1
                                if latest_date is None or report_date_obj > latest_date:
                                    latest_date = report_date_obj
                                    
                            except Exception as e:
                                session.rollback()
                                print(f"[ERROR] Failed to parse or save report {filepath}: {e}")
                            finally:
                                # Always try to clean up the temp file
                                try:
                                    if os.path.exists(filepath):
                                        os.remove(filepath)
                                        print(f"Removed temporary file: {filepath}")
                                except OSError as e_rm:
                                    print(f"[ERROR] Could not remove temp file {filepath}: {e_rm}")
                                
                                # Force garbage collection to free memory
                                gc.collect()
                                
                                # Check memory usage and break if getting too high
                                current_memory = psutil.Process(os.getpid()).memory_info().rss / 1024 ** 2
                                if current_memory > 150:  # Reduced from 300MB to 150MB for Render
                                    print(f"[WARNING] Memory usage high ({current_memory:.2f} MB), stopping processing for {pharmacy_name}")
                                    break
                        else:
                            print(f"[WARN] File {filepath} does not exist, skipping.")
                            
                    except Exception as e_process:
                        print(f"[ERROR] Error processing email for {pharmacy_name}: {e_process}")
                        continue
                        
                if processed_files_count == 0:
                    print(f"No new data found to be added for {pharmacy_name}.")
                    
            except Exception as e_fetch:
                print(f"[ERROR] Could not fetch emails for {pharmacy_name}: {e_fetch}")
                # Continue processing other pharmacies even if one fails
                continue
                
            print(f"[Memory] After processing {pharmacy_name}: {psutil.Process(os.getpid()).memory_info().rss / 1024 ** 2:.2f} MB", flush=True)
            print(f"Finished fetching emails for {pharmacy_name}.")
            
            # Force garbage collection between pharmacies
            gc.collect()
            
            # Clean up database sessions between pharmacies to free memory
            cleanup_db_sessions()
            
    finally:
        # Always clean up database resources
        try:
            session.close()
            cleanup_db_sessions()
        except Exception as e:
            print(f"[ERROR] Error closing database session: {e}")
    
    # Clean up temp directory if it exists and is empty
    temp_dir = "/tmp/daily_html"
    if os.path.exists(temp_dir):
        try:
            if not os.listdir(temp_dir):
                shutil.rmtree(temp_dir)
                print(f"Cleaned up empty temporary directory: {temp_dir}")
            else:
                print(f"Temporary directory {temp_dir} is not empty, leaving it")
        except OSError as e_rmdir:
            print(f"[ERROR] Could not remove temp directory {temp_dir}: {e_rmdir}")
    
    if total_emails_processed > 0:
        print(f"{total_emails_processed} emails processed, all pharmacies now up to date until {latest_date.strftime('%Y-%m-%d') if latest_date else 'N/A'}.")
    else:
        print("No emails processed. Database may already be up to date.")
    print(f"[Memory] At script end: {psutil.Process(os.getpid()).memory_info().rss / 1024 ** 2:.2f} MB", flush=True)

if __name__ == "__main__":
    main()
