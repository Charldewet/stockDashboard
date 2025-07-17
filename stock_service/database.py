from models import db, Department, Product, SalesHistory, DailySales
import os

def init_database(app):
    """Initialize database with the Flask app"""
    db.init_app(app)
    
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
        stats = {
            'departments': Department.query.count(),
            'products': Product.query.count(),
            'sales_history_records': SalesHistory.query.count(),
            'daily_sales_records': DailySales.query.count()
        }
        return stats

def check_database_connection(app):
    """Check if database connection is working"""
    try:
        with app.app_context():
            # Try to execute a simple query
            db.session.execute(db.text('SELECT 1'))
            return True
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        return False 