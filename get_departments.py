#!/usr/bin/env python3
"""
Script to get all departments from the stock management database
"""

import os
import sys
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Add the stock_service directory to the path
sys.path.append('./stock_service')

try:
    from models import Department
    from config import Config
    
    # Create database engine
    engine = create_engine(Config.SQLALCHEMY_DATABASE_URI)
    
    # Create session
    Session = sessionmaker(bind=engine)
    session = Session()
    
    # Query all departments
    departments = session.query(Department).order_by(Department.department_code).all()
    
    print(f"\n📋 All Departments in Database ({len(departments)} total):")
    print("=" * 80)
    print(f"{'Code':<12} {'Name':<50} {'Created At'}")
    print("-" * 80)
    
    for dept in departments:
        created_at = dept.created_at.strftime('%Y-%m-%d %H:%M') if dept.created_at else 'N/A'
        print(f"{dept.department_code:<12} {dept.department_name:<50} {created_at}")
    
    print("=" * 80)
    print(f"Total departments: {len(departments)}")
    
    # Group by department code length for analysis
    code_lengths = {}
    for dept in departments:
        length = len(dept.department_code)
        if length not in code_lengths:
            code_lengths[length] = []
        code_lengths[length].append(dept)
    
    print(f"\n📊 Department Code Length Analysis:")
    for length, depts in sorted(code_lengths.items()):
        print(f"  {length} characters: {len(depts)} departments")
    
    session.close()
    
except ImportError as e:
    print(f"❌ Import error: {e}")
    print("Make sure you're in the correct directory and the stock_service is properly set up.")
except Exception as e:
    print(f"❌ Error: {e}")
    print("Check your database connection and configuration.") 