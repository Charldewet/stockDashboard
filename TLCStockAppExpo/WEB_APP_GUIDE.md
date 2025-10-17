# Web App Migration Guide

## Overview
This guide covers the web app version of TLC PharmaSight. The web version has been set up to work alongside the native iOS/Android apps using platform-specific files.

## What Was Created

### 1. Web-Specific Adapters
- **`src/utils/device.web.ts`** - Web-compatible device utilities using localStorage for device ID
- **`src/services/pushApi.web.ts`** - Stub implementation for push notifications (disabled for web)
- **`src/contexts/AuthContext.web.tsx`** - Authentication context without notification dependencies
- **`src/contexts/NotificationsContext.web.tsx`** - Stub notifications context for compatibility

### 2. Web Entry Points
- **`App.web.tsx`** - Main web app entry point (notifications disabled)
- **`index.web.ts`** - Web-specific registration (not used with current Metro setup)
- **`index.ts`** - Updated to detect platform and load appropriate App

### 3. Web-Specific Screens
- **`src/navigation/AppNavigator.web.tsx`** - Simplified navigator without notification features
- **`src/screens/dashboard/DashboardScreen.web.tsx`** - Simplified dashboard for web

### 4. Configuration Files
- **`metro.config.js`** - Updated to support `.web.tsx` file extensions
- **`app.json`** - Web configuration added with Metro bundler
- **`package.json`** - Added `react-dom` dependency
- **`public/index.html`** - HTML template for web app

## How It Works

### Platform-Specific File Loading
React Native Web and Metro automatically load platform-specific files:
1. When running on web, `.web.tsx` files are loaded first
2. If no web-specific file exists, it falls back to the regular `.tsx` file
3. This allows gradual migration - only critical files need web versions

Example:
- On web: `AuthContext.web.tsx` is used
- On iOS/Android: `AuthContext.tsx` is used

### What's Disabled on Web
- Push notifications (no web support implemented yet)
- Device-specific APIs (using browser fallbacks)
- File system operations (can be added later with browser APIs)

## Running the Web App

### Development Server
```bash
npm run web
# or
npx expo start --web
```

This will:
1. Start the Metro bundler
2. Open the app in your default browser at `http://localhost:8081`
3. Enable hot reloading for development

### Production Build
```bash
npx expo export --platform web
```

This creates an optimized production build in the `dist/` directory.

## Current Features

### ✅ Working on Web
- Login screen with authentication
- Dashboard screen with navigation
- Theme switching (light/dark mode)
- Pharmacy selection
- Basic navigation between screens
- API integration (same backend as mobile)

### ❌ Not Yet Implemented on Web
- Push notifications
- File downloads/sharing
- PDF generation
- Advanced charts (may need adjustments)
- Some gesture-based interactions

## File Structure

```
TLCStockAppExpo/
├── App.tsx                 # Native app entry
├── App.web.tsx            # Web app entry
├── index.ts               # Platform-aware entry point
├── public/
│   └── index.html         # Web HTML template
├── src/
│   ├── contexts/
│   │   ├── AuthContext.tsx          # Native auth
│   │   ├── AuthContext.web.tsx      # Web auth (no notifications)
│   │   ├── NotificationsContext.tsx # Native notifications
│   │   └── NotificationsContext.web.tsx # Web stub
│   ├── navigation/
│   │   ├── AppNavigator.tsx         # Native navigation
│   │   └── AppNavigator.web.tsx     # Web navigation
│   ├── screens/
│   │   └── dashboard/
│   │       ├── DashboardScreen.tsx     # Native dashboard
│   │       └── DashboardScreen.web.tsx # Web dashboard
│   ├── services/
│   │   └── pushApi.web.ts          # Web push stub
│   └── utils/
│       └── device.web.ts           # Web device utilities
└── metro.config.js         # Metro bundler config
```

## Next Steps

### To Complete Web Migration:

1. **Add More Screens** - Create web versions of other screens as needed
2. **Implement Web Push** - Add service worker for browser notifications
3. **File Handling** - Implement browser-based file download/upload
4. **Charts** - Test and adjust chart components for web interactions
5. **Responsive Design** - Add media queries for different screen sizes
6. **PWA Features** - Add service worker, offline support, install prompt

### Testing Checklist:
- [ ] Login functionality
- [ ] Dashboard loads correctly
- [ ] Theme switching works
- [ ] Pharmacy selection works
- [ ] API calls succeed
- [ ] Navigation between screens
- [ ] Responsive on different screen sizes
- [ ] Cross-browser testing (Chrome, Safari, Firefox)

## Troubleshooting

### Issue: White screen on web
- Check browser console for errors
- Verify all imports are web-compatible
- Check that `.web.tsx` files are being loaded

### Issue: API calls failing
- Check CORS settings on backend
- Verify API_CONFIG.BASE_URL is accessible from browser
- Check network tab in browser dev tools

### Issue: Build errors
- Run `npm install --legacy-peer-deps` if peer dependency conflicts
- Clear Metro cache: `npx expo start --clear`
- Check for native-only imports in web files

## Notes

- The web app uses the same backend API as mobile apps
- AsyncStorage works on web via `@react-native-async-storage/async-storage`
- Most React Native components work on web via `react-native-web`
- Platform-specific code is isolated in `.web.tsx` files for maintainability

