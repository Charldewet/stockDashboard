import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { StatusBar, Platform, View } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import * as Notifications from 'expo-notifications';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/contexts/AuthContext';
import { NotificationsProvider } from './src/contexts/NotificationsContext';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { getStableDeviceId, getEnvInfo } from './src/utils/device';
import { registerDevice } from './src/services/pushApi';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    // shouldShowAlert is deprecated – use banner/list instead
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const AppContent = () => {
  const { themeMode, colors } = useTheme();
  
  return (
    <>
      <StatusBar 
        barStyle={themeMode === 'dark' ? 'light-content' : 'dark-content'} 
        backgroundColor={colors.bgGradientFrom} 
      />
      <AuthProvider>
        <NotificationsProvider>
          <AppNavigator />
        </NotificationsProvider>
      </AuthProvider>
    </>
  );
};

const App = () => {
  useEffect(() => {
    (async () => {
      try {
        // Detect environment and request appropriate permissions
        const isTestFlight = Platform.OS === 'ios' && !__DEV__;
        
        if (isTestFlight) {
          console.log('APP:TESTFLIGHT_DETECTED - Requesting Apple notification permissions');
          await Notifications.requestPermissionsAsync({
            ios: {
              allowAlert: true,
              allowBadge: true,
              allowSound: true,
            },
          });
        } else {
          console.log('APP:EXPO_GO_DETECTED - Requesting standard notification permissions');
          await Notifications.requestPermissionsAsync();
        }
        
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'Default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
            sound: 'default',
          });
        }

        // Device registration moved to after user login to ensure proper user context
        console.log('APP:DEVICE_REGISTRATION_SKIPPED', 'Will register after user login');
      } catch {}
    })();
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </SafeAreaProvider>
  );
};

export default App;
