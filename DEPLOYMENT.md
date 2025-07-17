# 🚀 TLC Dashboard Deployment Guide

## Overview

This guide will help you deploy the TLC Dashboard to Render with:
- **Frontend**: React app (Static Site)
- **Backend**: Flask API (Web Service) 
- **Database**: PostgreSQL (Managed Database)

## Prerequisites

- GitHub repository with your code
- Render account ([render.com](https://render.com))

## 1. Deploy to Render

### Option A: One-Click Deployment (Recommended)

1. **Go to Render Dashboard** → Click **"New +"** → Select **"Blueprint"**
2. **Connect GitHub repository**: `Dashboard_rev3`
3. **Render will automatically detect `render.yaml`** and show:
   - ✅ Frontend: `tlc-dashboard-frontend`
   - ✅ Backend: `tlc-dashboard-backend` 
   - ✅ Database: `tlc-dashboard-db`
4. **Click "Apply"** to deploy all services

### Option B: Manual Deployment

If Blueprint fails, deploy services individually:

#### Database First:
- **New** → **PostgreSQL** 
- Name: `tlc-dashboard-db`
- Database: `stock_management`

#### Backend:
- **New** → **Web Service**
- Connect repository → `stock_service` folder
- Name: `tlc-dashboard-backend`
- Build Command: `pip install -r requirements.txt`
- Start Command: `python app.py`
- Add Environment Variable: `DATABASE_URL` → Link to database

#### Frontend:
- **New** → **Static Site**
- Build Command: `npm run build`
- Publish Directory: `dist`

## 2. Get Your URLs

After deployment, you'll receive:
- **Frontend**: `https://tlc-dashboard-frontend.onrender.com`
- **Backend**: `https://tlc-dashboard-backend.onrender.com`
- **Database**: Internal connection string

## 3. Upload Data to Production Database

### Method 1: Web Interface (Easiest)

1. Visit: `https://tlc-dashboard-backend.onrender.com/admin`
2. Upload your CSV files:
   - `Department_codes.csv`
   - `Daily_sales.csv`
   - `Sales_history.csv`

### Method 2: Python Script

1. **Navigate to Stock folder**: `cd Stock`
2. **Run upload script**: `python upload_to_production.py`

The script will:
- Test connection to production API
- Upload all CSV files automatically
- Show progress and results

### Method 3: Manual API Calls

```bash
# Upload Department Codes
curl -X POST https://tlc-dashboard-backend.onrender.com/api/import/departments \
  -F "file=@Department_codes.csv"

# Upload Daily Sales
curl -X POST https://tlc-dashboard-backend.onrender.com/api/import/daily-sales \
  -F "file=@Daily_sales.csv"

# Upload Sales History  
curl -X POST https://tlc-dashboard-backend.onrender.com/api/import/sales-history \
  -F "file=@Sales_history.csv"
```

## 4. Verify Deployment

### Check API Health
Visit: `https://tlc-dashboard-backend.onrender.com/health`

Should return:
```json
{
  "status": "healthy",
  "environment": "production", 
  "database": "connected"
}
```

### Check Frontend
Visit: `https://tlc-dashboard-frontend.onrender.com`

The Smart Alerts should load with your uploaded data!

## 5. Regular Data Updates

For ongoing daily sales updates:

### Option A: Daily Upload Script
Run the upload script daily with new CSV files:
```bash
cd Stock
python upload_to_production.py
```

### Option B: API Integration
Integrate your existing data pipeline to POST directly to:
- `POST /api/import/daily-sales` - For daily sales updates
- `POST /api/import/departments` - For new departments
- `POST /api/import/sales-history` - For historical data

## 6. Monitoring & Maintenance

### View Logs
- **Render Dashboard** → Select your service → **Logs** tab

### Database Access
- **Render Dashboard** → `tlc-dashboard-db` → **Info** tab
- Use provided connection string with any PostgreSQL client

### Scaling
- **Render Dashboard** → Service → **Settings** → Change plan if needed

## 7. Troubleshooting

### Common Issues:

**Build Fails:**
- Check logs in Render dashboard
- Ensure all dependencies are in `requirements.txt`

**Database Connection Fails:**
- Verify `DATABASE_URL` environment variable
- Check database service is running

**Frontend Can't Connect to Backend:**
- Verify backend URL in `src/services/api.js`
- Check CORS configuration in `stock_service/config.py`

**Smart Alerts Show No Data:**
- Verify data was uploaded successfully
- Check API endpoints: `/api/stock/smart-alerts/all/{pharmacy}/{date}`

### Support
- Check Render documentation: [docs.render.com](https://docs.render.com)
- Review application logs for specific error messages

---

## 🎉 Success!

Once deployed, you'll have a fully functional pharmacy analytics dashboard with:

- 📊 **Real-time analytics** on daily sales performance
- 🧠 **Smart Alerts** for pricing optimization
- 📈 **Interactive charts** for trend analysis
- 💰 **Profit margin insights** with actionable recommendations
- 🔍 **Department performance** tracking

Your production dashboard will be accessible worldwide and automatically scale based on usage! 