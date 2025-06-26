import os
from dotenv import load_dotenv
import sys

# Load environment variables from .env file
load_dotenv()

IMAP_SERVER = "imap.gmail.com" # Default IMAP server

# Define MAILBOXES structure by loading credentials from environment variables
MAILBOXES = [
    {
        "code": "reitz",
        "name": "Reitz Pharmacy",
        "email_user": os.getenv("REITZ_GMAIL_USERNAME"),
        "email_password": os.getenv("REITZ_GMAIL_APP_PASSWORD"),
        "imap_server": IMAP_SERVER # Defaulting to global IMAP_SERVER
    },
    {
        "code": "roos",
        "name": "Roos Pharmacy",
        "email_user": os.getenv("ROOS_GMAIL_USERNAME"),
        "email_password": os.getenv("ROOS_GMAIL_APP_PASSWORD"),
        "imap_server": IMAP_SERVER
    },
    {
        "code": "tugela",
        "name": "Tugela Pharmacy",
        "email_user": os.getenv("TUGELA_GMAIL_USERNAME"),
        "email_password": os.getenv("TUGELA_GMAIL_APP_PASSWORD"),
        "imap_server": IMAP_SERVER
    },
    {
        "code": "villiers",
        "name": "Villiers Pharmacy",
        "email_user": os.getenv("VILLIERS_GMAIL_USERNAME"),
        "email_password": os.getenv("VILLIERS_GMAIL_APP_PASSWORD"),
        "imap_server": IMAP_SERVER
    },
    {
        "code": "winterton",
        "name": "Winterton Pharmacy",
        "email_user": os.getenv("WINTERTON_GMAIL_USERNAME"),
        "email_password": os.getenv("WINTERTON_GMAIL_APP_PASSWORD"),
        "imap_server": IMAP_SERVER
    }
]

# Global fallback credentials (not recommended for production if mailboxes are individually configured)
# These will be used by email_fetcher if a specific pharmacy_config doesn't have email_user/password
GMAIL_USER = os.getenv("FALLBACK_GMAIL_USERNAME") 
GMAIL_PASSWORD = os.getenv("FALLBACK_GMAIL_APP_PASSWORD")

# Database URI: use DATABASE_URL from .env if set, otherwise default to SQLite
DATABASE_URI = os.getenv("DATABASE_URL", "sqlite:///db/daily_reports.db")

# Verify that critical environment variables are loaded for each mailbox
missing_credentials = []
for mailbox in MAILBOXES:
    if not mailbox["email_user"] or not mailbox["email_password"]:
        missing_credentials.append(f"{mailbox['code']} (missing {'username' if not mailbox['email_user'] else 'password'})")
        print(f"Warning: Missing Gmail credentials for mailbox '{mailbox['code']}' ({mailbox['name']}). Please check your .env file.")

if missing_credentials:
    print(f"Warning: The following mailboxes have missing credentials: {', '.join(missing_credentials)}")
    print("These pharmacies will be skipped during email fetching.")

if not DATABASE_URI:
    print("Error: DATABASE_URI is not set. Please check your .env file or ensure the default is correct.")
    sys.exit(1)

# Check if we have any valid mailbox configurations
valid_mailboxes = [m for m in MAILBOXES if m["email_user"] and m["email_password"]]
if not valid_mailboxes and not (GMAIL_USER and GMAIL_PASSWORD):
    print("Error: No valid email credentials found. Please configure at least one mailbox or fallback credentials.")
    print("Required environment variables:")
    for mailbox in MAILBOXES:
        print(f"  - {mailbox['code'].upper()}_GMAIL_USERNAME")
        print(f"  - {mailbox['code'].upper()}_GMAIL_APP_PASSWORD")
    print("Or fallback credentials:")
    print("  - FALLBACK_GMAIL_USERNAME")
    print("  - FALLBACK_GMAIL_APP_PASSWORD")
else:
    print(f"Configuration loaded: {len(valid_mailboxes)} out of {len(MAILBOXES)} mailboxes have valid credentials.") 