# Stock Service Deployment Checklist

## ✅ Pre-Deployment Setup (COMPLETED)

- [x] **CORS Origins Updated** - Added all frontend domains:
  - `https://www.pharmasight.co.za`
  - `https://www.tlcdashboard.co.za` 
  - `https://tlc-dashboard-frontend.onrender.com`
  - Local development ports (3000, 5173, 5174, 5175)

- [x] **Dependencies Ready** - `requirements.txt` includes all necessary packages
- [x] **App Configuration** - Listens on `0.0.0.0` and uses `PORT` env var
- [x] **Health Endpoints** - Available at `/health` and `/api/stock/health`
- [x] **Database Ready** - PostgreSQL configuration with environment variables

## 🚀 Deployment Steps

### Option 1: Using Render Dashboard (Recommended)

1. **Create New Web Service**
   - Go to Render Dashboard
   - Click "New" → "Web Service"
   - Connect your GitHub repository

2. **Configure Service**
   - **Name:** `tlc-stock-service`
   - **Root Directory:** `stock_service`
   - **Environment:** `Python 3`
   - **Region:** `Oregon` (or your preferred region)
   - **Plan:** `Starter` (can upgrade later)

3. **Build & Start Commands**
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn app:app`

4. **Environment Variables**
   - `FLASK_ENV` = `production`
   - `SECRET_KEY` = `[generate random string]`
   - `DATABASE_URL` = `[from PostgreSQL service]`

5. **Create PostgreSQL Database**
   - In Render Dashboard: "New" → "PostgreSQL"
   - **Name:** `tlc-stock-db`
   - **Plan:** `Starter`
   - Copy the `External Database URL` to use as `DATABASE_URL`

### Option 2: Using render.yaml (Alternative)

1. **Use the provided render-stock.yaml**
   - Rename `render-stock.yaml` to `render.yaml`
   - Push to your repository
   - Render will auto-detect and deploy

## 🧪 Post-Deployment Testing

### 1. Health Check
```bash
curl https://your-service-url.onrender.com/health
```
Expected response:
```json
{
  "status": "healthy",
  "environment": "production",
  "database": "connected",
  "timestamp": "2024-01-XX..."
}
```

### 2. Stock API Health
```bash
curl https://your-service-url.onrender.com/api/stock/health
```

### 3. Test from Frontend
- Ensure your frontend can connect to the new backend
- Check browser console for CORS errors
- Test a simple API call like daily summary

## 🔧 Environment Variables Reference

| Variable | Value | Description |
|----------|--------|-------------|
| `DATABASE_URL` | `postgresql://...` | PostgreSQL connection string from Render |
| `SECRET_KEY` | `[random-string]` | Flask secret key (generate unique) |
| `FLASK_ENV` | `production` | Set Flask to production mode |
| `PORT` | `[auto-set]` | Render sets this automatically |

## 🔍 Troubleshooting

### Common Issues:

1. **CORS Errors**
   - Verify frontend domain is in `CORS_ORIGINS`
   - Check browser console for specific domain

2. **Database Connection Errors**
   - Verify `DATABASE_URL` is correctly set
   - Check database service is running

3. **Import Errors (pandas/PyMuPDF)**
   - These are optional for basic functionality
   - Install `requirements-full.txt` if PDF imports needed

4. **Health Check Failures**
   - Check service logs in Render dashboard
   - Verify database connection

## 📊 Frontend Integration

After deployment, update your frontend API calls to point to:
```javascript
const STOCK_API_BASE_URL = 'https://your-stock-service.onrender.com/api/stock';
```

### Available Endpoints:
- `/api/stock/daily_summary/{pharmacy_id}/{date}`
- `/api/stock/top_moving/{pharmacy_id}/{date}`
- `/api/stock/low_stock_alerts/{pharmacy_id}/{date}`
- `/api/stock/movements/{pharmacy_id}/{start_date}/{end_date}`
- `/api/stock/recommendations/{pharmacy_id}`
- And many more...

## 🎯 Next Steps After Deployment

1. **Test Core Functionality**
   - Import sample data via `/admin` interface
   - Verify analytics endpoints work
   - Test frontend integration

2. **Security Enhancements** (Future)
   - Add authentication to import endpoints
   - Implement API rate limiting
   - Add request logging

3. **Performance Monitoring**
   - Monitor database performance
   - Set up alerts for health checks
   - Scale resources as needed

## 📞 Support

If you encounter issues:
1. Check Render service logs
2. Test health endpoints
3. Verify environment variables
4. Check database connectivity

---

**Ready for deployment!** ✅ All configuration is complete and deployment-ready. 