# Backend CORS Configuration Required

## ⚠️ CRITICAL: Update Your Backend API

Your web app at **`https://tlc-pharmasight-web.onrender.com`** (after deployment) needs CORS permissions from your backend API.

## Backend API Details
- **URL**: `https://pharmacy-api-webservice.onrender.com`
- **Repository**: (wherever your Python backend is hosted)

## Required CORS Configuration

### Option 1: Using Flask-CORS (Recommended)

```python
from flask import Flask
from flask_cors import CORS

app = Flask(__name__)

# Configure CORS
CORS(app, resources={
    r"/*": {
        "origins": [
            "https://tlc-pharmasight-web.onrender.com",  # Production web app
            "http://localhost:8081",                      # Local development
            "http://localhost:3000",                      # Local CORS proxy
            "http://192.168.*.*:8081",                   # Local network (mobile testing)
        ],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
        "allow_headers": ["Content-Type", "Authorization", "X-Pharmacy", "X-Requested-With"],
        "expose_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True,
        "max_age": 3600
    }
})

# Your routes here...
```

### Option 2: Manual Headers

```python
from flask import Flask, request, jsonify

app = Flask(__name__)

@app.after_request
def after_request(response):
    # Get origin from request
    origin = request.headers.get('Origin')
    
    # Allowed origins
    allowed_origins = [
        'https://tlc-pharmasight-web.onrender.com',
        'http://localhost:8081',
        'http://localhost:3000',
    ]
    
    # Check if origin is allowed
    if origin in allowed_origins or origin and origin.startswith('http://192.168.'):
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS, PATCH'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Pharmacy, X-Requested-With'
        response.headers['Access-Control-Expose-Headers'] = 'Content-Type, Authorization'
        response.headers['Access-Control-Max-Age'] = '3600'
        response.headers['Access-Control-Allow-Credentials'] = 'true'
    
    return response

@app.route('/<path:path>', methods=['OPTIONS'])
def handle_options(path):
    return '', 200
```

### Option 3: Environment Variable (Flexible)

```python
import os
from flask import Flask
from flask_cors import CORS

app = Flask(__name__)

# Get allowed origins from environment variable
ALLOWED_ORIGINS = os.environ.get(
    'CORS_ALLOWED_ORIGINS',
    'https://tlc-pharmasight-web.onrender.com,http://localhost:8081'
).split(',')

CORS(app, 
     origins=ALLOWED_ORIGINS,
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
     allow_headers=["Content-Type", "Authorization", "X-Pharmacy"])
```

Then in Render dashboard for your backend:
- Add environment variable: `CORS_ALLOWED_ORIGINS`
- Value: `https://tlc-pharmasight-web.onrender.com,http://localhost:8081,http://localhost:3000`

## Installation

If not already installed:

```bash
pip install flask-cors
```

Add to your `requirements.txt`:
```
flask-cors>=4.0.0
```

## Testing CORS

After updating your backend and redeploying:

1. **Test with curl:**
```bash
curl -H "Origin: https://tlc-pharmasight-web.onrender.com" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type, Authorization" \
     -X OPTIONS \
     --verbose \
     https://pharmacy-api-webservice.onrender.com/auth/login
```

2. **Check for headers in response:**
   - `Access-Control-Allow-Origin: https://tlc-pharmasight-web.onrender.com`
   - `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS, PATCH`
   - `Access-Control-Allow-Headers: Content-Type, Authorization, X-Pharmacy`

3. **Test in browser:**
   - Open DevTools → Network tab
   - Login to your web app
   - Check request headers show CORS headers

## Common CORS Errors

### "No 'Access-Control-Allow-Origin' header"
- Backend not configured for CORS
- Origin not in allowed list

### "CORS policy: Response to preflight request doesn't pass"
- Missing OPTIONS handler
- Missing required headers

### "Credentials flag is true, but Access-Control-Allow-Credentials is not"
- Need to set `supports_credentials: True` in CORS config

## Deployment Checklist

- [ ] Install flask-cors: `pip install flask-cors`
- [ ] Add flask-cors to requirements.txt
- [ ] Add CORS configuration to your Flask app
- [ ] Add web app URL to allowed origins
- [ ] Test OPTIONS requests work
- [ ] Redeploy backend to Render
- [ ] Test login from deployed web app
- [ ] Monitor backend logs for CORS errors

## Need Help?

If CORS is still not working:

1. Check backend logs on Render dashboard
2. Check browser DevTools → Console for CORS errors
3. Check Network tab for OPTIONS (preflight) requests
4. Verify backend is accessible: `curl https://pharmacy-api-webservice.onrender.com`

## Security Notes

- Never use `origins: "*"` in production
- Only allow specific domains you control
- Use HTTPS in production (HTTP only for localhost)
- Consider rate limiting for public APIs

---

**Quick Copy-Paste for Backend:**

```python
from flask_cors import CORS

CORS(app, resources={r"/*": {
    "origins": ["https://tlc-pharmasight-web.onrender.com", "http://localhost:8081"],
    "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    "allow_headers": ["Content-Type", "Authorization", "X-Pharmacy"]
}})
```

