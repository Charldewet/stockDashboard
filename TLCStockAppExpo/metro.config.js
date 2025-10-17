const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add web-specific file extensions
config.resolver.sourceExts.push('web.ts', 'web.tsx', 'web.js', 'web.jsx');

module.exports = config;
