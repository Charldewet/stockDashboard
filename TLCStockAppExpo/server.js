#!/usr/bin/env node

/**
 * Production Web Server
 * Serves the static web app build with proper headers
 */

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8081;
const DIST_DIR = path.join(__dirname, 'dist');

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Serve static files from dist directory
app.use(express.static(DIST_DIR, {
  maxAge: '1d',
  etag: true,
}));

// SPA fallback - serve index.html for all routes
app.get('*', (req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 TLC PharmaSight Web App`);
  console.log(`📡 Server running on port ${PORT}`);
  console.log(`📂 Serving from: ${DIST_DIR}\n`);
});

