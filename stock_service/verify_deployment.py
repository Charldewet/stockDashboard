#!/usr/bin/env python3
"""
Deployment verification script for stock backend
"""
import os
import sys

def check_environment():
    """Check if all required environment variables are set"""
    required_vars = ['DATABASE_URL', 'SECRET_KEY']
    missing_vars = []
    
    for var in required_vars:
        if not os.getenv(var):
            missing_vars.append(var)
    
    if missing_vars:
        print(f"❌ Missing environment variables: {', '.join(missing_vars)}")
        return False
    
    print("✅ All required environment variables are set")
    return True

def check_dependencies():
    """Check if all required packages are available"""
    try:
        import flask
        import flask_cors
        import flask_sqlalchemy
        import psycopg2
        import sqlalchemy
        print("✅ All required packages are available")
        return True
    except ImportError as e:
        print(f"❌ Missing package: {e}")
        return False

def check_app_creation():
    """Check if the Flask app can be created"""
    try:
        from app import create_app
        app = create_app()
        print("✅ Flask app created successfully")
        return True
    except Exception as e:
        print(f"❌ App creation failed: {e}")
        return False

def main():
    """Run all deployment checks"""
    print("🔍 Running deployment verification...")
    
    checks = [
        ("Environment Variables", check_environment),
        ("Dependencies", check_dependencies),
        ("App Creation", check_app_creation),
    ]
    
    all_passed = True
    for name, check_func in checks:
        print(f"\n📋 Checking {name}...")
        if not check_func():
            all_passed = False
    
    if all_passed:
        print("\n🎉 All deployment checks passed!")
        print("✅ Stock backend is ready for deployment")
    else:
        print("\n❌ Some deployment checks failed")
        print("Please fix the issues above before deploying")
        sys.exit(1)

if __name__ == '__main__':
    main() 