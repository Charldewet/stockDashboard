import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { StatusBar, Platform } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import * as Notifications from 'expo-notifications';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/contexts/AuthContext';
import { NotificationsProvider } from './src/contexts/NotificationsContext';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    // shouldShowAlert is deprecated – use banner/list instead
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const App = () => {
  useEffect(() => {
    (async () => {
      try {
        await Notifications.requestPermissionsAsync();
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'Default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
            sound: 'default',
          });
        }
      } catch {}
    })();
  }, []);

  return (
    <SafeAreaProvider>
      {/* Global Status Bar Configuration - Force white text on dark background */}
      <StatusBar barStyle="light-content" backgroundColor="#111827" />
      <AuthProvider>
        <NotificationsProvider>
          <AppNavigator />
        </NotificationsProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
};

export default App;
