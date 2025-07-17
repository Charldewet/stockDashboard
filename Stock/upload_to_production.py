#!/usr/bin/env python3
"""
Production Data Upload Script for TLC Dashboard
Uploads daily sales, department codes, and sales history to production database
"""

import requests
import os
from pathlib import Path

# Production API Configuration
PRODUCTION_API_BASE = "https://tlc-dashboard-backend.onrender.com/api/import"

def upload_file(endpoint, file_path, description):
    """Upload a single CSV file to the production API"""
    print(f"\n📤 Uploading {description}...")
    
    if not os.path.exists(file_path):
        print(f"❌ File not found: {file_path}")
        return False
    
    try:
        with open(file_path, 'rb') as file:
            files = {'file': (os.path.basename(file_path), file, 'text/csv')}
            
            response = requests.post(
                f"{PRODUCTION_API_BASE}/{endpoint}",
                files=files,
                timeout=300  # 5 minutes timeout for large files
            )
            
            if response.status_code == 200:
                result = response.json()
                print(f"✅ {description} uploaded successfully!")
                print(f"   Records processed: {result.get('records_processed', 'N/A')}")
                return True
            else:
                print(f"❌ Upload failed: {response.status_code}")
                print(f"   Error: {response.text}")
                return False
                
    except requests.exceptions.Timeout:
        print(f"⏰ Upload timed out - file may be too large")
        return False
    except Exception as e:
        print(f"❌ Upload error: {str(e)}")
        return False

def main():
    """Main upload process"""
    print("🚀 TLC Dashboard - Production Data Upload")
    print("=" * 50)
    
    # File paths (adjust these to your actual file locations)
    files_to_upload = [
        {
            'endpoint': 'departments',
            'file_path': 'Department_codes.csv',
            'description': 'Department Codes'
        },
        {
            'endpoint': 'daily-sales',
            'file_path': 'Daily_sales.csv', 
            'description': 'Daily Sales Data'
        },
        {
            'endpoint': 'sales-history',
            'file_path': 'Sales_history.csv',
            'description': 'Sales History Data'
        }
    ]
    
    # Test connection first
    try:
        print("🔗 Testing connection to production API...")
        response = requests.get(f"{PRODUCTION_API_BASE.replace('/import', '')}/health", timeout=10)
        if response.status_code == 200:
            print("✅ Connection successful!")
        else:
            print("❌ API connection failed")
            return
    except Exception as e:
        print(f"❌ Connection error: {str(e)}")
        return
    
    # Upload each file
    success_count = 0
    for file_config in files_to_upload:
        if upload_file(
            file_config['endpoint'],
            file_config['file_path'],
            file_config['description']
        ):
            success_count += 1
    
    # Summary
    print("\n" + "=" * 50)
    print(f"📊 Upload Summary: {success_count}/{len(files_to_upload)} files uploaded successfully")
    
    if success_count == len(files_to_upload):
        print("🎉 All data uploaded successfully!")
    else:
        print("⚠️  Some uploads failed. Check the logs above.")

if __name__ == "__main__":
    main() 