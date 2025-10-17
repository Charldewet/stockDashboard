#!/usr/bin/env node

/**
 * Production Web Server
 * Serves the static web app build with proper headers
 */

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8081;
const DIST_DIR = path.join(__dirname, 'dist');

// Check if dist directory exists
if (!fs.existsSync(DIST_DIR)) {
  console.error(`❌ ERROR: dist directory not found at ${DIST_DIR}`);
  console.error(`Current directory: ${__dirname}`);
  console.error(`Directory contents:`, fs.readdirSync(__dirname));
  process.exit(1);
}

// Check if index.html exists
const indexPath = path.join(DIST_DIR, 'index.html');
if (!fs.existsSync(indexPath)) {
  console.error(`❌ ERROR: index.html not found at ${indexPath}`);
  console.error(`dist contents:`, fs.readdirSync(DIST_DIR));
  process.exit(1);
}

console.log(`✅ Found dist directory: ${DIST_DIR}`);
console.log(`✅ Found index.html: ${indexPath}`);

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Serve static files from dist directory
app.use(express.static(DIST_DIR, {
  maxAge: '1d',
  etag: true,
}));

// SPA fallback - serve index.html for all routes
app.get('/*', (req, res) => {
  console.log(`Serving index.html for: ${req.url}`);
  res.sendFile(indexPath);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 TLC PharmaSight Web App`);
  console.log(`📡 Server running on port ${PORT}`);
  console.log(`📂 Serving from: ${DIST_DIR}`);
  console.log(`🌐 Visit: http://localhost:${PORT}\n`);
});


