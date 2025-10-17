#!/usr/bin/env node

/**
 * Development CORS Proxy Server
 * This server proxies API requests to bypass CORS restrictions during web development
 * DO NOT USE IN PRODUCTION - CORS should be properly configured on the backend
 */

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = 3000;
const API_URL = 'https://pharmacy-api-webservice.onrender.com';

// CORS middleware - allow all origins in development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Pharmacy');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Proxy all /api requests to the backend
app.use('/api', createProxyMiddleware({
  target: API_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/api': '', // Remove /api prefix when forwarding
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[PROXY] ${req.method} ${req.path} -> ${API_URL}${req.path.replace('/api', '')}`);
  },
  onError: (err, req, res) => {
    console.error('[PROXY ERROR]', err);
    res.status(500).json({ error: 'Proxy error', details: err.message });
  },
}));

app.listen(PORT, () => {
  console.log(`\n🚀 CORS Proxy Server running on http://localhost:${PORT}`);
  console.log(`📡 Proxying requests to: ${API_URL}`);
  console.log(`\n💡 Update your web app API_BASE_URL to: http://localhost:${PORT}/api\n`);
});

