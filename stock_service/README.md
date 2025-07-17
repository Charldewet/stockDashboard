# Stock Management Service

A separate microservice for managing stock data, analytics, and recommendations.

## 📋 Overview

This service provides:
- CSV import functionality for departments, sales history, and daily sales
- Stock analytics and recommendations
- Real-time stock alerts and top moving products
- Separate database for stock-specific data

## 🚀 Quick Setup

### 1. Install PostgreSQL
```bash
# macOS (using Homebrew)
brew install postgresql
brew services start postgresql

# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql

# Create database
createdb stock_management
```

### 2. Install Python Dependencies
```bash
cd stock_service
pip install -r requirements.txt
```

### 3. Configure Environment
```bash
# Copy environment template
cp env_example.txt .env

# Edit .env file with your database credentials
nano .env
```

### 4. Initialize Database
```bash
python app.py
# The database tables will be created automatically
```

### 5. Import Initial Data
1. Open http://localhost:5001/admin in your browser
2. Import departments CSV (Department_codes.csv)
3. Import sales history CSV (Sales_history.csv)
4. Import daily sales CSV (Daily_sales.csv)

## 📊 API Endpoints

### Import Endpoints (Admin)
- `POST /api/stock/import/departments` - Import department codes
- `POST /api/stock/import/history` - Import sales history
- `POST /api/stock/import/daily` - Import daily sales
- `GET /api/stock/import/status` - Get import status

### Analysis Endpoints (Frontend)
- `GET /api/stock/daily_summary/{pharmacy_id}/{date}` - Daily summary
- `GET /api/stock/top_moving/{pharmacy_id}/{date}` - Top moving products
- `GET /api/stock/low_stock_alerts/{pharmacy_id}/{date}` - Low stock alerts
- `GET /api/stock/movements/{pharmacy_id}/{start_date}/{end_date}` - Stock movements
- `GET /api/stock/recommendations/{pharmacy_id}` - Reorder recommendations

### Health Check
- `GET /health` - Service health status
- `GET /api/stock/health` - Detailed health with DB stats

## 🗂️ CSV File Formats

### Department Codes CSV
```csv
DepartmentCode,DepartmentName
000100,PHARMACY
000101,SCRIPTS
BAAA01,BEAUTY PRODUCTS
```

### Sales History CSV
```csv
DepartmentCode,StockCode,Description,QuantitySold
BAAA01,LP9001007,E ARDEN CERAMIDE PURIFYING CLNS 125ML,5.0
000101,0000000000000101,SCRIPT RX,120.0
```

### Daily Sales CSV
```csv
DepartmentCode,StockCode,Description,OnHand,SalesQty,SalesValue,SalesCost,GrossProfit,TurnoverPercent,GrossProfitPercent
BAAC05,LP9001646,CUTICURA OINTMENT 50G,0.0,1.0,57.09,41.88,15.21,0.078,26.642
BAAD08,LP9090103,ROOIBOS FACIAL WIPES 25 HYDRATING,0.0,1.0,40.83,33.11,7.72,0.04,18.908
```

## 🔧 Configuration

### Environment Variables (.env)
```bash
# Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=stock_management
POSTGRES_USER=postgres
POSTGRES_PASSWORD=password

# API
SECRET_KEY=your-secret-key
MAIN_API_URL=https://tlcwebdashboard2.onrender.com/api

# Stock Analysis
LOW_STOCK_THRESHOLD_DAYS=7
OVERSTOCK_THRESHOLD_MONTHS=6
```

## 🗄️ Database Schema

### Tables
- **departments** - Department codes and names
- **products** - Product master data with department links
- **sales_history** - Monthly aggregated sales history
- **daily_sales** - Daily sales transactions with detailed metrics

### Key Features
- Automatic product creation for new items in daily sales
- Duplicate prevention with unique constraints
- Optimized indexes for fast queries
- Cascading deletes for data integrity

## 📈 Analytics Features

### Daily Summary
- Total receipts, issues, adjustments
- Net movement calculation
- Sales value and gross profit totals

### Top Moving Products
- Ranked by sales quantity
- Includes department information
- Configurable result limit

### Low Stock Alerts
- Based on current stock vs. daily usage
- Configurable threshold (days remaining)
- Prioritized by urgency

### Reorder Recommendations
- Analyzes sales patterns over configurable period
- Suggests order quantities for optimal stock levels
- Considers sales frequency and current stock

## 🚀 Usage Workflow

### One-time Setup
1. Import department codes
2. Import historical sales data (12 months)

### Daily Operations
1. Export daily sales CSV from your POS system
2. Upload via admin interface at `/admin`
3. View analytics in the main dashboard

### Monitoring
- Check service health at `/health`
- Monitor database stats via admin interface
- Review import logs for any issues

## 🔍 Troubleshooting

### Database Connection Issues
```bash
# Check PostgreSQL status
brew services list | grep postgresql  # macOS
sudo systemctl status postgresql      # Linux

# Test connection
psql -h localhost -p 5432 -U postgres -d stock_management
```

### Import Errors
- Check CSV format matches expected structure
- Ensure no duplicate entries for same date
- Verify file encoding (UTF-8 recommended)

### API Errors
- Check service logs in terminal
- Verify frontend API URL points to correct port (5001)
- Ensure CORS is properly configured

## 🔒 Security Notes

- Change default SECRET_KEY in production
- Use environment variables for sensitive data
- Consider database user permissions
- Implement API authentication for production use

## 📝 Development

### Adding New Analytics
1. Add method to `AnalyticsService`
2. Create route in `stock_routes.py`
3. Update frontend API calls
4. Test with sample data

### Database Migrations
- Use Flask-Migrate for schema changes
- Always backup data before major changes
- Test migrations on development database first 