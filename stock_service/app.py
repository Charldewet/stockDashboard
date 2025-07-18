from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from config import Config
from models import db
from database import init_database
from datetime import datetime
import os

# Import route blueprints
from routes.stock_routes import stock_bp
from routes.import_routes import import_bp
from routes.smart_alerts_routes import smart_alerts_bp

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    
    # Initialize database
    db.init_app(app)
    
    # Configure CORS
    CORS(app, origins=app.config['CORS_ORIGINS'], supports_credentials=True)
    
    # Initialize database tables
    with app.app_context():
        try:
            init_database(app)
            print("✅ Database tables created successfully!")
        except Exception as e:
            print(f"❌ Database initialization error: {e}")
    
    # Register blueprints
    app.register_blueprint(stock_bp, url_prefix='/api/stock')
    app.register_blueprint(import_bp, url_prefix='/api/import')
    app.register_blueprint(smart_alerts_bp, url_prefix='/api/smart-alerts')
    
    # Health check endpoint (for Render)
    @app.route('/health')
    @app.route('/healthz')
    def health_check():
        try:
            # Test database connection
            db.session.execute('SELECT 1')
            db_status = 'connected'
        except Exception as e:
            db_status = f'disconnected: {str(e)}'
        
        return jsonify({
            'status': 'healthy',
            'environment': app.config.get('FLASK_ENV', 'development'),
            'database': db_status,
            'timestamp': datetime.utcnow().isoformat()
        })
    
    # Admin interface
    @app.route('/admin')
    def admin_interface():
        return render_template('admin.html')
    
    # API info endpoint
    @app.route('/api/info')
    def api_info():
        return jsonify({
            'name': 'TLC Dashboard Stock API',
            'version': '1.0.0',
            'endpoints': {
                'stock': '/api/stock',
                'import': '/api/import', 
                'smart_alerts': '/api/smart-alerts',
                'health': '/health',
                'admin': '/admin'
            },
            'documentation': 'Available endpoints for stock management and analytics'
        })
    
    return app

# Create the Flask app
app = create_app()

if __name__ == '__main__':
    print("🚀 Starting Stock Management Service...")
    print(f"📊 Environment: {app.config.get('FLASK_ENV', 'development')}")
    print(f"🔗 Database: {app.config['SQLALCHEMY_DATABASE_URI'][:50]}...")
    
    try:
        # Test database connection
        with app.app_context():
            db.engine.connect()
            print("✅ Database connection successful!")
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
    
    # Get port from environment variable (Render sets this)
    port = int(os.environ.get('PORT', 5002))
    
    app.run(
        host='0.0.0.0',  # Important for Render deployment
        port=port,
        debug=app.config['DEBUG']
    ) 