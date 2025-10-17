# 🌐 Web CORS Fix - Development Setup

## Problem
The web app encounters CORS (Cross-Origin Resource Sharing) errors when accessing the backend API at `https://pharmacy-api-webservice.onrender.com` from `http://localhost:8081`.

**Error Example:**
```
Access to XMLHttpRequest at 'https://pharmacy-api-webservice.onrender.com/pharmacies/4/days...' 
from origin 'http://localhost:8081' has been blocked by CORS policy
```

## Why This Happens
- **Browsers enforce CORS** to prevent malicious websites from accessing APIs
- **Mobile apps don't have this restriction** (native HTTP requests bypass CORS)
- The backend needs to explicitly allow web requests from your origin

---

## ✅ Solution: Development CORS Proxy

I've set up a local proxy server that forwards requests to the backend and adds proper CORS headers.

### How It Works
```
Web App (localhost:8081) 
  ↓
CORS Proxy (localhost:3000) ← adds CORS headers
  ↓
Backend API (pharmacy-api-webservice.onrender.com)
```

---

## 🚀 Setup Instructions

### 1. Start the CORS Proxy Server
Open a **new terminal** and run:
```bash
cd /Users/charldewet/Python/WebStockApp/TLCStockAppExpo
npm run web:proxy
```

You should see:
```
🚀 CORS Proxy Server running on http://localhost:3000
📡 Proxying requests to: https://pharmacy-api-webservice.onrender.com
```

### 2. Start the Web App
In **another terminal**, run:
```bash
npm run web
```

### 3. Access the Web App
Open your browser to: `http://localhost:8081`

---

## 📁 Files Created

### `web-server.js`
- Express server that proxies API requests
- Adds CORS headers to all responses
- Routes `/api/*` requests to the backend

### `src/config/api.web.ts`
- Web-specific API configuration
- Points to `http://localhost:3000/api` instead of the direct backend URL
- Automatically used by the web build (thanks to `.web.ts` extension)

---

## 🔧 How It Works Technically

1. **Platform-specific config**: React Native Web loads `api.web.ts` instead of `api.ts` for web builds
2. **Proxy routing**: All API calls go to `http://localhost:3000/api` which proxies to the real backend
3. **CORS headers**: The proxy adds:
   - `Access-Control-Allow-Origin: *`
   - `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS`
   - `Access-Control-Allow-Headers: Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Pharmacy`

---

## ⚠️ Important Notes

### For Development Only
- **DO NOT use this proxy in production**
- The proxy is for local development only
- Production web apps need proper CORS configuration on the backend

### Backend CORS Fix (Production)
The proper fix is to update the backend to allow your web app's origin. If the backend is Flask:

```python
from flask_cors import CORS

app = Flask(__name__)
CORS(app, origins=[
    "http://localhost:8081",  # Development
    "https://yourdomain.com"   # Production
])
```

For Express/Node.js:
```javascript
const cors = require('cors');
app.use(cors({
  origin: ['http://localhost:8081', 'https://yourdomain.com']
}));
```

---

## 🐛 Troubleshooting

### Proxy Not Running
**Error:** `Failed to fetch` or `ERR_CONNECTION_REFUSED`
**Fix:** Make sure the proxy server is running on port 3000

### Wrong API URL
**Check:** Open browser console and verify requests go to `http://localhost:3000/api/...`
**Fix:** Clear cache and reload

### Port Already in Use
**Error:** `EADDRINUSE: address already in use :::3000`
**Fix:** Kill the process on port 3000:
```bash
lsof -ti:3000 | xargs kill -9
```

---

## 📝 Quick Start Commands

```bash
# Terminal 1: Start CORS Proxy
npm run web:proxy

# Terminal 2: Start Web App
npm run web

# Then open: http://localhost:8081
```

---

## 🎯 Next Steps for Production

1. **Contact backend team** to add CORS headers for your production domain
2. **Update `api.web.ts`** to use the direct backend URL once CORS is configured
3. **Remove the proxy** - it's only needed during development

---

**Need Help?** Check the browser console for detailed error messages and verify both servers are running.

