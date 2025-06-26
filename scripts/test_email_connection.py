#!/usr/bin/env python3
"""
Test script to check email connections for all configured pharmacies.
This helps diagnose connection issues before running the full fetch process.
"""
import os
import sys

# Add project root to Python path
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)
sys.path.append(project_root)

from app.email_fetcher import _get_imap_connection
from config import settings
import socket

def test_email_connection(pharmacy_config):
    """Test email connection for a single pharmacy."""
    pharmacy_name = pharmacy_config.get("name", pharmacy_config["code"])
    print(f"\nTesting connection for {pharmacy_name}...")
    
    try:
        # Check if credentials are available
        if not pharmacy_config.get("email_user") or not pharmacy_config.get("email_password"):
            print(f"❌ {pharmacy_name}: Missing email credentials")
            return False
            
        print(f"📧 Username: {pharmacy_config['email_user']}")
        print(f"🔐 Password: {'*' * len(pharmacy_config['email_password'])}")
        print(f"📡 Server: {pharmacy_config['imap_server']}")
        
        # Test connection
        mail = _get_imap_connection(pharmacy_config)
        
        # Test basic operations
        mail.select("inbox")
        status, messages = mail.search(None, 'ALL')
        
        if status == "OK":
            email_count = len(messages[0].split()) if messages[0] else 0
            print(f"✅ {pharmacy_name}: Connection successful! Found {email_count} emails in inbox")
        else:
            print(f"⚠️ {pharmacy_name}: Connected but search failed: {status}")
            
        mail.close()
        mail.logout()
        return True
        
    except socket.timeout:
        print(f"❌ {pharmacy_name}: Connection timed out")
        return False
    except Exception as e:
        print(f"❌ {pharmacy_name}: Connection failed - {str(e)}")
        return False

def main():
    print("=== Email Connection Test ===")
    print(f"Testing connections for {len(settings.MAILBOXES)} pharmacies...\n")
    
    successful_connections = 0
    total_pharmacies = len(settings.MAILBOXES)
    
    for pharmacy_config in settings.MAILBOXES:
        if test_email_connection(pharmacy_config):
            successful_connections += 1
    
    print(f"\n=== Test Results ===")
    print(f"✅ Successful: {successful_connections}/{total_pharmacies}")
    print(f"❌ Failed: {total_pharmacies - successful_connections}/{total_pharmacies}")
    
    if successful_connections == 0:
        print("\n⚠️ No email connections were successful!")
        print("Please check your .env file and ensure you have valid credentials.")
        print("\nRequired environment variables:")
        for mailbox in settings.MAILBOXES:
            print(f"  - {mailbox['code'].upper()}_GMAIL_USERNAME")
            print(f"  - {mailbox['code'].upper()}_GMAIL_APP_PASSWORD")
    elif successful_connections < total_pharmacies:
        print(f"\n⚠️ {total_pharmacies - successful_connections} pharmacies have connection issues.")
        print("Check the error messages above and verify credentials.")
    else:
        print("\n🎉 All email connections are working!")

if __name__ == "__main__":
    main() 