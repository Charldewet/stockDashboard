import os
from urllib.parse import urlparse

class Config:
    # Database Configuration
    DATABASE_URL = os.getenv('DATABASE_URL')
    
    if DATABASE_URL:
        # Production: Use DATABASE_URL from Render
        # Handle both postgres:// and postgresql:// schemes
        if DATABASE_URL.startswith('postgres://'):
            DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql://', 1)
        SQLALCHEMY_DATABASE_URI = DATABASE_URL
    else:
        # Development: Use local PostgreSQL
        SQLALCHEMY_DATABASE_URI = 'postgresql://charldewet@localhost:5432/stock_management'
    
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_pre_ping': True,
        'pool_recycle': 300,
        'connect_args': {
            'connect_timeout': 10,
            'application_name': 'TLC_Dashboard'
        }
    }
    
    # Flask Configuration
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
    DEBUG = os.getenv('FLASK_ENV', 'development') != 'production'
    
    # CORS Configuration
    CORS_ORIGINS = [
        'http://localhost:3000',  # Local development
        'http://localhost:5173',  # Vite dev server
        'https://tlc-dashboard-frontend.onrender.com',  # Production frontend (static site)
        # Add your actual frontend domain here when deployed
    ]
    
    # File Upload Configuration
    MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50MB max file size
    UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
    
    # Ensure upload folder exists
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    
    # API Configuration
    MAIN_API_URL = os.getenv('MAIN_API_URL', 'https://tlcwebdashboard2.onrender.com/api')
    
    # Stock Analysis Configuration
    LOW_STOCK_THRESHOLD_DAYS = int(os.getenv('LOW_STOCK_THRESHOLD_DAYS', '7'))  # Days of inventory
    OVERSTOCK_THRESHOLD_MONTHS = int(os.getenv('OVERSTOCK_THRESHOLD_MONTHS', '6'))  # Months of inventory

class DevelopmentConfig(Config):
    DEBUG = True
    POSTGRES_DB = 'stock_management_dev'

class ProductionConfig(Config):
    DEBUG = False

config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
} 