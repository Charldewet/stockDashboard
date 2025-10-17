# TLC PharmaSight Web App - Deployment Guide

## 🚀 Deploying to Render

### Prerequisites
- GitHub account with your repository: `Charldewet/stockDashboard`
- Render account (free tier available)
- Backend API running at: `https://pharmacy-api-webservice.onrender.com`

### Step 1: Prepare Your Backend API

**IMPORTANT**: Your backend API must be configured to allow CORS requests from your web app domain.

Add these CORS headers to your backend (Python/Flask example):

```python
from flask_cors import CORS

# In your Flask app
CORS(app, resources={
    r"/*": {
        "origins": [
            "https://tlc-pharmasight-web.onrender.com",  # Your Render domain
            "http://localhost:8081",  # Local development
            "http://localhost:3000"   # Local CORS proxy
        ],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization", "X-Pharmacy"]
    }
})
```

Or add environment variable to your backend on Render:
- `CORS_ALLOWED_ORIGINS`: `https://tlc-pharmasight-web.onrender.com,http://localhost:8081`

### Step 2: Deploy to Render

1. **Login to Render**
   - Go to [https://render.com](https://render.com)
   - Sign in with your GitHub account

2. **Create New Web Service**
   - Click **"New +"** → **"Web Service"**
   - Connect your GitHub repository: `Charldewet/stockDashboard`
   - Authorize Render to access the repository

3. **Configure Service Settings**
   - **Name**: `tlc-pharmasight-web`
   - **Region**: Oregon (or closest to your users)
   - **Branch**: `main`
   - **Root Directory**: `TLCStockAppExpo` ⚠️ **CRITICAL**
   - **Environment**: Node
   - **Build Command**: `npm install && npm run render:build`
   - **Start Command**: `npm run render:start`

4. **Environment Variables** (Auto-configured via render.yaml)
   - `NODE_VERSION`: `18.20.5`
   - `NODE_ENV`: `production`

5. **Advanced Settings** (Optional)
   - Auto-Deploy: Yes (recommended)
   - Health Check Path: `/`

6. **Deploy**
   - Click **"Create Web Service"**
   - Wait 5-10 minutes for initial build
   - Monitor logs for any errors

### Step 3: Update Backend CORS

Once deployed, you'll get a URL like: `https://tlc-pharmasight-web.onrender.com`

**Add this URL to your backend's allowed CORS origins** in your backend deployment settings or environment variables.

### Step 4: Test Your Deployment

1. Visit your Render URL: `https://tlc-pharmasight-web.onrender.com`
2. Try logging in with valid credentials
3. Check that API calls work correctly
4. Test all major features (Dashboard, Daily, Monthly, etc.)

## 🔧 Configuration Details

### API Configuration

The app automatically detects the environment:

- **Development** (localhost): Uses CORS proxy at `http://localhost:3000/api`
- **Production**: Uses direct API at `https://pharmacy-api-webservice.onrender.com`

This is configured in: `src/config/api.web.ts`

### Custom Domain (Optional)

To add a custom domain:
1. Go to Render dashboard → Your service → Settings
2. Click "Custom Domain"
3. Add your domain (e.g., `app.tlcpharmacy.com`)
4. Configure DNS records as instructed
5. Update CORS on backend to include your custom domain

## 📊 Monitoring

### Render Dashboard
- **Logs**: View real-time application logs
- **Metrics**: CPU, memory, request metrics
- **Health**: Service health status

### Common Issues

**Build Fails:**
- Check Node version (should be 18.20.5)
- Verify root directory is set to `TLCStockAppExpo`
- Check build logs for dependency errors

**API Calls Fail (CORS):**
- Ensure backend has correct CORS configuration
- Check that your Render URL is in backend's allowed origins
- Verify API is accessible: `https://pharmacy-api-webservice.onrender.com`

**App Loads But Login Fails:**
- Check API_KEY in `src/config/api.web.ts` matches backend
- Verify authentication endpoints are correct
- Check network tab in browser DevTools for error details

## 🆓 Free Tier Limitations

Render free tier:
- Service spins down after 15 minutes of inactivity
- First request after spin-down takes 30-60 seconds
- 750 hours/month free (enough for 1 service)
- Automatic HTTPS included

## 🔄 Continuous Deployment

Auto-deployment is enabled:
- Push to `main` branch triggers automatic rebuild
- Build takes 5-10 minutes
- Zero-downtime deployments

## 📱 Local Development

To run locally with the same setup:

```bash
# Terminal 1: Start CORS proxy
npm run web:proxy

# Terminal 2: Start web app
npm run web
```

## 🔐 Security Notes

1. **API Key**: Stored in `api.web.ts` - consider moving to environment variables for production
2. **HTTPS**: Automatically enabled by Render
3. **Authentication**: Uses JWT tokens from backend
4. **AsyncStorage**: User credentials stored locally (browser localStorage)

## 📞 Support

- Render Docs: https://render.com/docs
- GitHub Issues: Use for bug reports
- Render Community: https://community.render.com

---

**Current Configuration:**
- Backend API: `https://pharmacy-api-webservice.onrender.com`
- Web App (after deployment): `https://tlc-pharmasight-web.onrender.com`
- GitHub Repo: `https://github.com/Charldewet/stockDashboard`

