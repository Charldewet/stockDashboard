from models import db, Department, Product, SalesHistory, DailySales
import os

def init_database(app):
    """Initialize database with the Flask app"""
    # Don't call db.init_app(app) here since it's already called in create_app()
    
    with app.app_context():
        # Create all tables
        db.create_all()
        print("✅ Database tables created successfully!")

def drop_all_tables(app):
    """Drop all tables (use with caution!)"""
    with app.app_context():
        db.drop_all()
        print("🗑️ All tables dropped!")

def reset_database(app):
    """Reset database by dropping and recreating all tables"""
    with app.app_context():
        db.drop_all()
        db.create_all()
        print("🔄 Database reset completed!")

def get_db_stats(app):
    """Get basic statistics about the database"""
    with app.app_context():
        # Count baseline records (special marker date)
        baseline_records = DailySales.query.filter(DailySales.sale_date == '1900-01-01').count()
        # Count regular daily sales records (excluding baseline)
        regular_daily_sales = DailySales.query.filter(DailySales.sale_date != '1900-01-01').count()
        
        stats = {
            'departments': Department.query.count(),
            'products': Product.query.count(),
            'sales_history_records': SalesHistory.query.count(),
            'daily_sales_records': regular_daily_sales,
            'baseline_records': baseline_records,
            'total_sales_records': DailySales.query.count()
        }
        return stats

def check_database_connection(app):
    """Check if database connection is working"""
    try:
        with app.app_context():
            # Try to execute a simple query
            result = db.session.execute(db.text('SELECT 1'))
            result.close()
            return True
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return False 