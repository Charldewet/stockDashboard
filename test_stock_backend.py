#!/usr/bin/env python3
"""
Test script to verify stock backend can start without errors
"""
import os
import sys

# Add stock_service to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'stock_service'))

def test_imports():
    """Test that all imports work correctly"""
    try:
        print("Testing imports...")
        from stock_service.app import create_app
        print("✅ App creation successful")
        
        app = create_app()
        print("✅ Flask app created successfully")
        
        # Test database connection
        with app.app_context():
            from stock_service.models import db
            db.session.execute('SELECT 1')
            print("✅ Database connection successful")
        
        return True
    except Exception as e:
        print(f"❌ Import/connection failed: {e}")
        return False

if __name__ == '__main__':
    success = test_imports()
    if success:
        print("\n🎉 All tests passed! Stock backend is ready for deployment.")
    else:
        print("\n❌ Tests failed. Please fix the issues above.")
        sys.exit(1) 