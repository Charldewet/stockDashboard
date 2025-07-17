import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # Database Configuration
    POSTGRES_HOST = os.getenv('POSTGRES_HOST', 'localhost')
    POSTGRES_PORT = os.getenv('POSTGRES_PORT', '5432')
    POSTGRES_DB = os.getenv('POSTGRES_DB', 'stock_management')
    POSTGRES_USER = os.getenv('POSTGRES_USER', 'charldewet')
    POSTGRES_PASSWORD = os.getenv('POSTGRES_PASSWORD', '')
    
    SQLALCHEMY_DATABASE_URI = f"postgresql://{POSTGRES_USER}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # API Configuration
    SECRET_KEY = os.getenv('SECRET_KEY', 'your-secret-key-change-this-in-production')
    MAIN_API_URL = os.getenv('MAIN_API_URL', 'https://tlcwebdashboard2.onrender.com/api')
    
    # File Upload Configuration
    UPLOAD_FOLDER = os.getenv('UPLOAD_FOLDER', 'uploads')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max file size
    
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