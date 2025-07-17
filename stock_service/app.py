from flask import Flask, render_template, jsonify
from flask_cors import CORS
from config import config
from database import init_database, check_database_connection
from routes.import_routes import import_bp
from routes.stock_routes import stock_bp
from routes.smart_alerts_routes import smart_alerts_bp
import os

def create_app(config_name=None):
    """Create and configure the Flask application"""
    app = Flask(__name__)
    
    # Load configuration
    config_name = config_name or os.getenv('FLASK_ENV', 'development')
    app.config.from_object(config[config_name])
    
    # Enable CORS for all routes
    CORS(app)
    
    # Create upload directory if it doesn't exist
    upload_dir = app.config.get('UPLOAD_FOLDER', 'uploads')
    if not os.path.exists(upload_dir):
        os.makedirs(upload_dir)
    
    # Initialize database
    init_database(app)
    
    # Register blueprints
    app.register_blueprint(import_bp)
    app.register_blueprint(stock_bp)
    app.register_blueprint(smart_alerts_bp)
    
    # Root route
    @app.route('/')
    def index():
        return jsonify({
            'service': 'Stock Management API',
            'version': '1.0.0',
            'status': 'operational',
            'endpoints': {
                'import': '/api/stock/import',
                'analysis': '/api/stock',
                'smart_alerts': '/api/stock/smart-alerts',
                'health': '/api/stock/health',
                'admin': '/admin'
            }
        })
    
    # Admin interface route
    @app.route('/admin')
    def admin():
        return render_template('admin.html')
    
    # Global error handlers
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({'error': 'Endpoint not found'}), 404
    
    @app.errorhandler(500)
    def internal_error(error):
        return jsonify({'error': 'Internal server error'}), 500
    
    @app.errorhandler(413)
    def file_too_large(error):
        return jsonify({'error': 'File size too large. Maximum allowed: 16MB'}), 413
    
    # Health check
    @app.route('/health')
    def health_check():
        db_connected = check_database_connection(app)
        status = 'healthy' if db_connected else 'unhealthy'
        status_code = 200 if db_connected else 503
        
        return jsonify({
            'status': status,
            'database': 'connected' if db_connected else 'disconnected',
            'service': 'Stock Management API'
        }), status_code
    
    return app

# Create the application instance
app = create_app()

if __name__ == '__main__':
    print("🚀 Starting Stock Management Service...")
    print(f"📊 Environment: {os.getenv('FLASK_ENV', 'development')}")
    print(f"🔗 Database: {app.config['SQLALCHEMY_DATABASE_URI']}")
    
    # Check database connection
    if check_database_connection(app):
        print("✅ Database connection successful!")
    else:
        print("❌ Database connection failed!")
        exit(1)
    
    # Run the application
    app.run(
        debug=app.config.get('DEBUG', True),
        host='0.0.0.0',
        port=int(os.getenv('PORT', 5001))
    ) 