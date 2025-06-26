import imaplib
import email
from email.header import decode_header
import os
import datetime
import tempfile
import socket
from config.settings import GMAIL_USER, GMAIL_PASSWORD, IMAP_SERVER

# Use a more reliable temp directory that works on all platforms
TEMP_DIR = os.path.join(tempfile.gettempdir(), "daily_html")

if not os.path.exists(TEMP_DIR):
    try:
        os.makedirs(TEMP_DIR, exist_ok=True)
    except OSError as e:
        print(f"Warning: Could not create temp directory {TEMP_DIR}: {e}")
        # Fallback to system temp directory
        TEMP_DIR = tempfile.gettempdir()

def _get_imap_connection(pharmacy_config):
    """Get IMAP connection with proper timeout and error handling."""
    user = pharmacy_config.get("email_user", GMAIL_USER)
    password = pharmacy_config.get("email_password", GMAIL_PASSWORD)
    server = pharmacy_config.get("imap_server", IMAP_SERVER)
    
    if not user or not password:
        raise ValueError(f"Missing email credentials for pharmacy {pharmacy_config.get('code', 'unknown')}")
    
    try:
        # Set socket timeout to prevent hanging connections
        socket.setdefaulttimeout(30)
        mail = imaplib.IMAP4_SSL(server)
        mail.login(user, password)
        return mail
    except imaplib.IMAP4.error as e:
        raise Exception(f"IMAP authentication failed for {user}: {e}")
    except socket.timeout:
        raise Exception(f"IMAP connection timed out for server {server}")
    except Exception as e:
        raise Exception(f"Failed to connect to IMAP server {server}: {e}")

def _save_report_content(msg, pharmacy_code, email_date_from_header):
    """Saves HTML part or .htm attachment to a temporary file. Returns filepath or None."""
    if isinstance(email_date_from_header, datetime.datetime):
        report_file_date_obj = email_date_from_header.date()
    elif isinstance(email_date_from_header, datetime.date):
        report_file_date_obj = email_date_from_header
    else:
        try:
            report_file_date_obj = datetime.datetime.strptime(str(email_date_from_header), '%Y-%m-%d').date()
        except ValueError:
            print(f"Warning: Could not parse email_date '{email_date_from_header}' for filename. Using email header date or today.")
            try:
                date_tuple = email.utils.parsedate_tz(msg['Date'])
                if date_tuple:
                    local_date = datetime.datetime.fromtimestamp(email.utils.mktime_tz(date_tuple))
                    report_file_date_obj = local_date.date()
                else:
                    report_file_date_obj = datetime.date.today()
            except Exception:
                report_file_date_obj = datetime.date.today()

    saved_body_path = None
    for part in msg.walk():
        content_type = part.get_content_type()
        content_disposition = str(part.get("Content-Disposition"))
        part_filename = part.get_filename()

        if part_filename and part_filename.lower().endswith(".htm") and "attachment" in content_disposition:
            try:
                clean_attachment_name = f"{pharmacy_code}_{report_file_date_obj.strftime('%Y%m%d')}_{os.path.basename(part_filename)}"
                filepath_attachment = os.path.join(TEMP_DIR, clean_attachment_name)
                with open(filepath_attachment, "wb") as f:
                    f.write(part.get_payload(decode=True))
                return filepath_attachment
            except Exception as e:
                print(f"Error saving attachment {part_filename} for {report_file_date_obj}: {e}")
        
        if content_type == "text/html" and "attachment" not in content_disposition and not saved_body_path:
            try:
                body = part.get_payload(decode=True).decode(errors='replace')
                filename_body = os.path.join(TEMP_DIR, f"{pharmacy_code}_{report_file_date_obj.strftime('%Y%m%d')}_body.htm")
                with open(filename_body, "w", encoding="utf-8") as f:
                    f.write(body)
                saved_body_path = filename_body
            except Exception as e:
                print(f"Error decoding/saving HTML body for {report_file_date_obj}: {e}")
    
    return saved_body_path

def fetch_emails_last_n_days(pharmacy_config, days=7):
    """Fetches emails from the last N days and yields (filepath, report_date_obj, subject)."""
    mail = None
    try:
        pharmacy_name = pharmacy_config.get('name', pharmacy_config.get('code', 'unknown'))
        print(f"Connecting to email for {pharmacy_name}...")
        
        mail = _get_imap_connection(pharmacy_config)
        mail.select("inbox")
        
        # IMAP date format: DD-Mon-YYYY (e.g., 01-Jan-2023)
        date_since = (datetime.date.today() - datetime.timedelta(days=days-1))
        search_criteria_date_str = date_since.strftime("%d-%b-%Y")
        search_criteria = '(SINCE "' + search_criteria_date_str + '")'
        
        print(f"Searching for emails since {search_criteria_date_str} for {pharmacy_name}...")
        status, messages = mail.search(None, search_criteria)
        if status != "OK":
            print(f"IMAP search failed for {pharmacy_name}: {status}")
            return
            
        if not messages[0]:
            print(f"No emails found since {search_criteria_date_str} for {pharmacy_name}")
            return

        email_ids = messages[0].split()
        print(f"Found {len(email_ids)} email(s) since {search_criteria_date_str} for {pharmacy_name}")
        
        for i, email_id in enumerate(reversed(email_ids)): # Process newest first within the date range
            try:
                print(f"Processing email {i+1}/{len(email_ids)} for {pharmacy_name}...")
                status, msg_data = mail.fetch(email_id, "(RFC822)")
                if status != "OK":
                    print(f"Failed to fetch email {email_id} for {pharmacy_name}: {status}")
                    continue
                    
                for response_part in msg_data:
                    if isinstance(response_part, tuple):
                        try:
                            msg = email.message_from_bytes(response_part[1])
                            email_date_str_header = msg["Date"]
                            subject_header = msg["Subject"]
                            report_date_obj = None
                            
                            # Decode subject
                            subject = "No Subject"
                            try:
                                decoded_subject = decode_header(subject_header)
                                # The subject might be split into parts
                                subject_parts = []
                                for part, encoding in decoded_subject:
                                    if isinstance(part, bytes):
                                        subject_parts.append(part.decode(encoding or 'utf-8', 'ignore'))
                                    else:
                                        subject_parts.append(part)
                                subject = "".join(subject_parts)
                            except Exception as e:
                                print(f"Could not decode subject for email on {email_date_str_header}: {e}")

                            try:
                                email_dt_header = email.utils.parsedate_to_datetime(email_date_str_header)
                                report_date_obj = email_dt_header.date() # This is the date from email header
                            except Exception as e:
                                print(f"Could not parse date from email header: '{email_date_str_header}'. Error: {e}. Using today's date.")
                                report_date_obj = datetime.date.today() 
                            
                            filepath = _save_report_content(msg, pharmacy_config['code'], report_date_obj)
                            if filepath:
                                yield filepath, report_date_obj, subject
                        except Exception as e:
                            print(f"Error processing email content for {pharmacy_name}: {e}")
                            continue
            except Exception as e:
                print(f"Error processing email {email_id} for {pharmacy_name}: {e}")
                continue
                
    except Exception as e:
        print(f"Error fetching emails for {pharmacy_config.get('name', pharmacy_config.get('code', 'unknown'))}: {e}")
        raise e  # Re-raise to allow calling code to handle appropriately
    finally:
        if mail:
            try:
                mail.close()
                mail.logout()
            except Exception as e_logout:
                print(f"Error during IMAP logout: {e_logout}")

def sync_all_emails(pharmacy_config):
    """Approximates fetching all emails by fetching for a large number of days (e.g., 10 years = 3650 days)."""
    pharmacy_name = pharmacy_config.get('name', pharmacy_config.get('code', 'unknown'))
    print(f"Syncing all emails by fetching reports from the last ~10 years for {pharmacy_name}")
    try:
        yield from fetch_emails_last_n_days(pharmacy_config, days=3650) 
    except Exception as e:
        print(f"Error during sync_all_emails for {pharmacy_name}: {e}")
        raise e 