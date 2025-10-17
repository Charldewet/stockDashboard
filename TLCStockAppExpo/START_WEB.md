# Quick Start - Web App

## Run Web App

```bash
npm run web
```

The app will open in your browser at `http://localhost:8081`

## What's Included

✅ **Login Screen** - Full authentication with your existing backend  
✅ **Dashboard Screen** - Home screen with navigation and stats  
✅ **Theme Toggle** - Light/Dark mode  
✅ **Pharmacy Selection** - Switch between pharmacies  

## Test Login

Use your existing user credentials from the backend API.

## File Structure

All web-specific files end with `.web.tsx` or `.web.ts`:

```
App.web.tsx                              # Main web entry
src/contexts/AuthContext.web.tsx         # Auth (no notifications)
src/contexts/NotificationsContext.web.tsx # Stub
src/navigation/AppNavigator.web.tsx      # Web navigation
src/screens/dashboard/DashboardScreen.web.tsx # Dashboard
src/utils/device.web.ts                  # Device utils
src/services/pushApi.web.ts              # Push stub
```

## Next Steps

1. **Test the login** - Use your backend credentials
2. **Check the dashboard** - Should show navigation cards
3. **Test theme switching** - Click the sun/moon icon
4. **Test pharmacy selection** - Click the pharmacy dropdown

See `WEB_APP_GUIDE.md` and `WEB_MIGRATION_SUMMARY.md` for more details.

## Troubleshooting

**Issue**: Metro bundler fails to start  
**Fix**: `npx expo start --clear`

**Issue**: Can't reach API  
**Fix**: Check CORS settings on backend

**Issue**: White screen  
**Fix**: Check browser console for errors

