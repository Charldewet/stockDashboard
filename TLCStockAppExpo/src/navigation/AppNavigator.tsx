import React, { useEffect, useRef } from 'react';
import { View, AppState } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../contexts/AuthContext';
import * as Notifications from 'expo-notifications';
import { useNotifications } from '../contexts/NotificationsContext';

// Icons
import { TrendingUp, Calendar, BarChart3, Package, Bell } from 'lucide-react-native';

// Screens
import LoginScreen from '../screens/auth/LoginScreen';
import DailyScreen from '../screens/dashboard/DailyScreen';
import DailyHistoryScreen from '../screens/dashboard/DailyHistoryScreen';
import MonthlyScreen from '../screens/dashboard/MonthlyScreen';
import MonthlyHistoryScreen from '../screens/dashboard/MonthlyHistoryScreen';
import YearlyScreen from '../screens/dashboard/YearlyScreen';
import StockScreen from '../screens/dashboard/StockScreen';
import StockHistoryScreen from '../screens/dashboard/StockHistoryScreen';
import DataScreen from '../screens/dashboard/DataScreen';
import SplashScreen from '../components/common/SplashScreen';
import AccountScreen from '../screens/dashboard/AccountScreen';
import ReportingScreen from '../screens/dashboard/ReportingScreen';
import PreferencesScreen from '../screens/dashboard/PreferencesScreen';
import DailySummaryModal from '../screens/dashboard/DailySummaryModal';
import LowGPAlertModal from '../screens/dashboard/LowGPAlertModal';
import NotificationsTabScreen from '../screens/dashboard/NotificationsTabScreen';

export type DailyStackParamList = {
  DailyMain: undefined;
  DailyHistory: undefined;
};

export type MonthlyStackParamList = {
  MonthlyMain: undefined;
  MonthlyHistory: undefined;
};

export type StockStackParamList = {
  StockMain: undefined;
  StockHistory: undefined;
  StockDetail: undefined;
};

export type RootTabParamList = {
  Daily: undefined;
  Monthly: undefined;
  Yearly: undefined;
  Stock: undefined;
  Notifications: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Dashboard: undefined;
  Data: undefined;
  Account: undefined;
  Reporting: undefined;
  Preferences: undefined;
  DailySummaryModal: { pharmacyCode: string; pharmacyName: string } | undefined;
  LowGPAlertModal: { pharmacyCode: string; pharmacyName: string; lowGPItems: any[]; threshold: number } | undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createStackNavigator<AuthStackParamList>();
const DailyStack = createStackNavigator<DailyStackParamList>();
const MonthlyStack = createStackNavigator<MonthlyStackParamList>();
const StockStack = createStackNavigator<StockStackParamList>();

const DailyStackNavigator = () => {
  return (
    <DailyStack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <DailyStack.Screen name="DailyMain" component={DailyScreen} />
      <DailyStack.Screen name="DailyHistory" component={DailyHistoryScreen} />
    </DailyStack.Navigator>
  );
};

const MonthlyStackNavigator = () => {
  return (
    <MonthlyStack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <MonthlyStack.Screen name="MonthlyMain" component={MonthlyScreen} />
      <MonthlyStack.Screen name="MonthlyHistory" component={MonthlyHistoryScreen} />
    </MonthlyStack.Navigator>
  );
};

const StockStackNavigator = () => {
  return (
    <StockStack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <StockStack.Screen name="StockMain" component={StockScreen} />
      <StockStack.Screen name="StockHistory" component={StockHistoryScreen} />
      <StockStack.Screen name="StockDetail" component={require('../screens/dashboard/StockDetail').default} />
    </StockStack.Navigator>
  );
};

const TabNavigator = () => {
  const { unreadCount } = useNotifications();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let IconComponent;

          if (route.name === 'Daily') {
            IconComponent = TrendingUp;
          } else if (route.name === 'Monthly') {
            IconComponent = Calendar;
          } else if (route.name === 'Yearly') {
            IconComponent = BarChart3;
          } else if (route.name === 'Stock') {
            IconComponent = Package;
          } else if (route.name === 'Notifications') {
            IconComponent = Bell;
          }

          return IconComponent ? (
            <IconComponent 
              size={size * 0.8} 
              color={color}
              strokeWidth={focused ? 2.5 : 2}
            />
          ) : null;
        },
        tabBarActiveTintColor: '#FF4500',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          backgroundColor: '#1F2937',
          borderTopWidth: 1,
          borderTopColor: '#374151',
          paddingBottom: 2,
          paddingTop: 2,
          height: 80,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        headerStyle: {
          backgroundColor: '#111827',
        },
        headerTintColor: '#F9FAFB',
        headerTitleStyle: {
          fontWeight: 'bold',
          fontSize: 24,
        },
      })}
    >
      <Tab.Screen 
        name="Daily" 
        component={DailyStackNavigator}
        options={{
          title: 'Daily',
          headerShown: false,
        }}
      />
      <Tab.Screen 
        name="Monthly" 
        component={MonthlyStackNavigator}
        options={{
          title: 'Monthly',
          headerShown: false,
        }}
      />
      <Tab.Screen 
        name="Yearly" 
        component={YearlyScreen}
        options={{
          title: 'Yearly',
          headerShown: false,
        }}
      />
      <Tab.Screen 
        name="Stock" 
        component={StockStackNavigator}
        options={{
          title: 'Stock',
          headerShown: false,
        }}
      />
      <Tab.Screen 
        name="Notifications" 
        component={NotificationsTabScreen}
        options={{
          title: 'Alerts',
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          headerShown: false,
        }}
      />
    </Tab.Navigator>
  );
};

const AppNavigator = () => {
  const { isAuthenticated, loading } = useAuth();
  const navigationRef = useRef<any>(null);
  const { addNotification } = useNotifications();

  useEffect(() => {
    // Create notification categories (actions)
    Notifications.setNotificationCategoryAsync('DAILY_SUMMARY', [
      { identifier: 'VIEW', buttonTitle: 'Open App' },
      { identifier: 'DISMISS', buttonTitle: 'Close', options: { isDestructive: true } },
    ]).catch(() => {});

    Notifications.setNotificationCategoryAsync('LOW_GP_ALERT', [
      { identifier: 'VIEW', buttonTitle: 'Open App' },
      { identifier: 'DISMISS', buttonTitle: 'Close', options: { isDestructive: true } },
    ]).catch(() => {});

    // Ingest the last notification response (e.g., when app was opened via a tap)
    (async () => {
      try {
        const last = await Notifications.getLastNotificationResponseAsync();
        if (last) {
          const data: any = last.notification.request.content.data || {};
          const type = data?.type;
          if (type === 'DAILY_SUMMARY') {
            const code = String(data?.pharmacyCode || '');
            const name = String(data?.pharmacyName || 'Pharmacy');
            addNotification({
              id: `daily-${last.notification.request.identifier}-${code}`,
              title: 'TLC PharmaSight',
              body: `Daily Summary for ${name}`,
              data,
              createdAt: Date.now(),
              read: false,
            });
          } else if (type === 'LOW_GP_ALERT') {
            const code = String(data?.pharmacyCode || '');
            const name = String(data?.pharmacyName || 'Pharmacy');
            const lowGPItems = data?.lowGPItems || [];
            const threshold = Number(data?.threshold || 0);
            addNotification({
              id: `lowgp-${last.notification.request.identifier}-${code}`,
              title: 'TLC PharmaSight - Low GP Alert',
              body: `Low GP products for ${name}`,
              data,
              createdAt: Date.now(),
              read: false,
            });
          }
        }
      } catch {}
    })();

    // Listener: when user taps a notification
    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      try {
        const data: any = response.notification.request.content.data || {};
        const type = data?.type;
        if (type === 'DAILY_SUMMARY') {
          const code = String(data?.pharmacyCode || '');
          const name = String(data?.pharmacyName || 'Pharmacy');
          // Open Alerts tab on notification tap
          navigationRef.current?.navigate('Dashboard', { screen: 'Notifications' });
          addNotification({
            id: `daily-${response.notification.request.identifier}-${code}`,
            title: 'TLC PharmaSight',
            body: `Daily Summary for ${name}`,
            data,
            createdAt: Date.now(),
            read: false,
          });
        } else if (type === 'LOW_GP_ALERT') {
          const code = String(data?.pharmacyCode || '');
          const name = String(data?.pharmacyName || 'Pharmacy');
          const lowGPItems = data?.lowGPItems || [];
          const threshold = Number(data?.threshold || 0);
          // Open Alerts tab on notification tap
          navigationRef.current?.navigate('Dashboard', { screen: 'Notifications' });
          addNotification({
            id: `lowgp-${response.notification.request.identifier}-${code}`,
            title: 'TLC PharmaSight - Low GP Alert',
            body: `Low GP products for ${name}`,
            data,
            createdAt: Date.now(),
            read: false,
          });
        }
      } catch {}
    });

    // Listener: when a notification is received while app is in foreground
    const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      try {
        const data: any = notification.request.content.data || {};
        const type = data?.type;
        if (type === 'DAILY_SUMMARY') {
          const code = String(data?.pharmacyCode || '');
          const name = String(data?.pharmacyName || 'Pharmacy');
          addNotification({
            id: `daily-${notification.request.identifier}-${code}`,
            title: 'TLC PharmaSight',
            body: `Daily Summary for ${name}`,
            data,
            createdAt: Date.now(),
            read: false,
          });
        } else if (type === 'LOW_GP_ALERT') {
          const code = String(data?.pharmacyCode || '');
          const name = String(data?.pharmacyName || 'Pharmacy');
          const lowGPItems = data?.lowGPItems || [];
          const threshold = Number(data?.threshold || 0);
          addNotification({
            id: `lowgp-${notification.request.identifier}-${code}`,
            title: 'TLC PharmaSight - Low GP Alert',
            body: `Low GP products for ${name}`,
            data,
            createdAt: Date.now(),
            read: false,
          });
        }
      } catch {}
    });

    // Check for any missed notifications when app becomes active
    const checkMissedNotifications = async () => {
      try {
        const scheduled = await Notifications.getAllScheduledNotificationsAsync();
        const now = Date.now();
        
        // Check for notifications that should have been received recently
        for (const notification of scheduled) {
          const trigger = notification.trigger as any;
          if (trigger && trigger.date) {
            const scheduledTime = new Date(trigger.date).getTime();
            const timeDiff = now - scheduledTime;
            
            // If notification was scheduled for more than 1 minute ago but less than 24 hours ago
            if (timeDiff > 60000 && timeDiff < 86400000) {
              const data: any = notification.content.data || {};
              const type = data?.type;
              
              if (type === 'DAILY_SUMMARY' || type === 'LOW_GP_ALERT') {
                const code = String(data?.pharmacyCode || '');
                const name = String(data?.pharmacyName || 'Pharmacy');
                const title = type === 'DAILY_SUMMARY' ? 'TLC PharmaSight' : 'TLC PharmaSight - Low GP Alert';
                const body = type === 'DAILY_SUMMARY' ? `Daily Summary for ${name}` : `Low GP products for ${name}`;
                
                // Add to alerts tab if not already present
                addNotification({
                  id: `${type === 'DAILY_SUMMARY' ? 'daily' : 'lowgp'}-${notification.identifier}-${code}`,
                  title,
                  body,
                  data,
                  createdAt: scheduledTime,
                  read: false,
                });
              }
            }
          }
        }
      } catch (error) {
        console.warn('Failed to check missed notifications:', error);
      }
    };

    // Check for missed notifications when app becomes active
    checkMissedNotifications();

    // Listen for app state changes to check missed notifications
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        // App became active, check for missed notifications
        checkMissedNotifications();
      }
    };

    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      responseSub.remove();
      receivedSub.remove();
      appStateSubscription?.remove();
    };
  }, []);

  if (loading) {
    return <SplashScreen />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#111827' }}>
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            presentation: 'card',
          }}
        >
          {isAuthenticated ? (
            <>
              <Stack.Screen name="Dashboard" component={TabNavigator} />
              <Stack.Screen name="Data" component={DataScreen} />
              <Stack.Screen name="Account" component={AccountScreen} />
              <Stack.Screen name="Reporting" component={ReportingScreen} />
              <Stack.Screen name="Preferences" component={PreferencesScreen} />
              <Stack.Screen name="DailySummaryModal" component={DailySummaryModal as any} options={{ presentation: 'transparentModal' }} />
              <Stack.Screen name="LowGPAlertModal" component={LowGPAlertModal as any} options={{ presentation: 'transparentModal' }} />
            </>
          ) : (
            <Stack.Screen name="Login" component={LoginScreen} />
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
};

export default AppNavigator; 