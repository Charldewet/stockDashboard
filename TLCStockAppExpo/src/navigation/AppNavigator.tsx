import React, { useEffect, useRef } from 'react';
import { View, AppState } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../contexts/AuthContext';
import * as Notifications from 'expo-notifications';
import { useNotifications } from '../contexts/NotificationsContext';

// Icons
import { TrendingUp, Calendar, BarChart3, Package, Bell, Home } from 'lucide-react-native';

// Screens
import LoginScreen from '../screens/auth/LoginScreen';
import DashboardScreen from '../screens/dashboard/DashboardScreen';
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
import BroadcastModal from '../screens/dashboard/BroadcastModal';
import OperationalAlertsModal from '../screens/dashboard/OperationalAlertsModal';

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
  Dashboard: undefined;
  Daily: undefined;
  Monthly: undefined;
  Yearly: undefined;
  Stock: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Dashboard: undefined;
  Notifications: undefined;
  Data: undefined;
  Account: undefined;
  Reporting: undefined;
  Preferences: undefined;
  DailySummaryModal: { pharmacyCode: string; pharmacyName: string } | undefined;
  LowGPAlertModal: { pharmacyCode: string; pharmacyName: string; lowGPItems: any[]; threshold: number } | undefined;
  BroadcastModal: { title: string; body: string; category?: string; data?: any } | undefined;
  OperationalAlertsModal: { pharmacyCode: string; pharmacyName: string } | undefined;
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
  const { colors, themeMode } = useTheme();
  return (
    <Tab.Navigator
      key={themeMode}
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let IconComponent;

          if (route.name === 'Dashboard') {
            IconComponent = Home;
          } else if (route.name === 'Daily') {
            IconComponent = TrendingUp;
          } else if (route.name === 'Monthly') {
            IconComponent = Calendar;
          } else if (route.name === 'Yearly') {
            IconComponent = BarChart3;
          } else if (route.name === 'Stock') {
            IconComponent = Package;
          }

          return IconComponent ? (
            <IconComponent 
              size={size * 0.8} 
              color={color}
              strokeWidth={focused ? 2.5 : 2}
            />
          ) : null;
        },
        tabBarActiveTintColor: colors.accentPrimary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surfacePrimary,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          paddingBottom: 2,
          paddingTop: 2,
          height: 80,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        headerStyle: {
          backgroundColor: colors.bgGradientFrom,
        },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: {
          fontWeight: 'bold',
          fontSize: 24,
        },
      })}
    >
      <Tab.Screen 
        name="Dashboard" 
        component={DashboardScreen}
        options={{
          title: 'Dashboard',
          headerShown: false,
        }}
      />
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

    Notifications.setNotificationCategoryAsync('OPERATIONAL_ALERT', [
      { identifier: 'VIEW', buttonTitle: 'Open App' },
      { identifier: 'DISMISS', buttonTitle: 'Close', options: { isDestructive: true } },
    ]).catch(() => {});

    // Helper function to add notification to our internal list
    const addNotificationToList = (notification: any, timestamp?: number) => {
      const content = notification.request?.content || notification.content || {};
      const data: any = content?.data || {};
      let type = data?.type as string | undefined; // may be undefined on APNs TestFlight payloads
      const identifier = notification.request?.identifier || notification.identifier || Date.now().toString();
      const title = content?.title || 'TLC PharmaSight';
      const body = content?.body || '';
      
      // Infer type from title/body if missing (APNs often strips custom data on TestFlight)
      if (!type) {
        const t = `${title} ${body}`.toLowerCase();
        if (t.includes('low gp')) type = 'LOW_GP_ALERT';
        else if (t.includes('daily summary')) type = 'DAILY_SUMMARY';
        else if (t.includes('operational') || t.includes('insight')) type = 'OPERATIONAL_ALERT';
        else if (t.includes('maintenance')) type = 'MAINTENANCE';
        else if (t.includes('promotion') || t.includes('promo') || t.includes('update')) type = 'PROMOTION';
        else type = 'BROADCAST';
        data.type = type; // persist inferred type
      }
      
      console.log('➕ Adding notification to list:', identifier, type);
      
      // Track this notification as processed to prevent future duplicates
      processedNotificationIds.add(identifier);
      
      // Validate timestamp - ensure it's a valid date after 2020 to avoid 1970 dates
      const now = Date.now();
      const minValidDate = new Date('2020-01-01').getTime(); // Minimum valid date
      const validTimestamp = timestamp && timestamp > minValidDate ? timestamp : now;
      
      if (type === 'DAILY_SUMMARY') {
        const code = String(data?.pharmacyCode || '');
        const name = String(data?.pharmacyName || 'Pharmacy');
        addNotification({
          id: `daily-${identifier}-${code}`,
          title: 'TLC PharmaSight',
          body: `Daily Summary for ${name}`,
          data,
          createdAt: validTimestamp,
          read: false,
        });
      } else if (type === 'LOW_GP_ALERT') {
        // Only show low GP notifications if there are actual items below threshold
        const lowGPItems = (data?.lowGPItems 
          ?? data?.lowGpItems 
          ?? data?.low_gp_items 
          ?? data?.items 
          ?? data?.products 
          ?? []) as any[];
        const threshold = Number(data?.threshold ?? data?.gpThreshold ?? 0);
        
        if (Array.isArray(lowGPItems) && lowGPItems.length > 0) {
          const code = String(data?.pharmacyCode || '');
          const name = String(data?.pharmacyName || 'Pharmacy');
          addNotification({
            id: `lowgp-${identifier}-${code}`,
            title: 'TLC PharmaSight - Low GP Alert',
            body: `${lowGPItems.length} items below ${threshold}% GP for ${name}`,
            data: { ...data, lowGPItems },
            createdAt: validTimestamp,
            read: false,
          });
          console.log('✅ Added low GP notification with items:', lowGPItems.length);
        } else {
          // If we cannot extract items list (APNs payload), still add the header card
          const code = String(data?.pharmacyCode || '');
          const name = String(data?.pharmacyName || 'Pharmacy');
          addNotification({
            id: `lowgp-${identifier}-${code}`,
            title: 'TLC PharmaSight - Low GP Alert',
            body: data?.headline || `Low GP alert for ${name}`,
            data,
            createdAt: validTimestamp,
            read: false,
          });
          console.log('⚠️ Added low GP notification without items list');
        }
      } else if (type === 'OPERATIONAL_ALERT') {
        const code = String(data?.pharmacyCode || '');
        const name = String(data?.pharmacyName || 'Pharmacy');
        const insightTitle = content?.title || 'Operational Alert';
        const insightBody = content?.body || 'Operational insight available';
        addNotification({
          id: `operational-${identifier}-${code}`,
          title: 'TLC PharmaSight - Operational',
          body: `${insightBody}`,
          data,
          createdAt: validTimestamp,
          read: false,
        });
      } else if (type === 'BROADCAST' || type === 'PROMOTION' || type === 'SYSTEM_UPDATE' || type === 'MAINTENANCE') {
        // Handle broadcast/announcement notifications
        const category = data?.category || 'general';
        addNotification({
          id: `broadcast-${identifier}-${category}`,
          title: title || 'TLC PharmaSight',
          body: body || 'New announcement',
          data,
          createdAt: validTimestamp,
          read: false,
        });
        console.log('✅ Added broadcast notification:', type, category);
      } else {
        // Fallback: add generic notification
        addNotification({
          id: `generic-${identifier}`,
          title: title || 'TLC PharmaSight',
          body: body,
          data,
          createdAt: validTimestamp,
          read: false,
        });
        console.log('✅ Added generic notification (no recognizable type)');
      }
    };

    // Track last check time to prevent excessive checking
    let lastCheckTime = 0;
    const CHECK_INTERVAL = 30000; // Only check every 30 seconds

    // Keep track of processed notifications to prevent duplicates
    const processedNotificationIds = new Set<string>();

    // Check for all received notifications (including those received while app was closed/background)
    const checkAllReceivedNotifications = async () => {
      try {
        const now = Date.now();
        
        // Prevent excessive checking - only run if enough time has passed
        if (now - lastCheckTime < CHECK_INTERVAL) {
          console.log('🚫 Skipping notification check - too soon');
          return;
        }
        lastCheckTime = now;

        console.log('🔍 Checking for delivered notifications...');
        
        // Get all delivered notifications (these are notifications that were received by the device)
        const delivered = await Notifications.getPresentedNotificationsAsync();
        
        console.log(`📱 Found ${delivered.length} delivered notifications`);
        
        // Process all delivered notifications
        for (const notification of delivered) {
          const identifier = notification.request.identifier;
          
          // Skip if we've already processed this notification
          if (processedNotificationIds.has(identifier)) {
            console.log('⏭️ Skipping already processed notification:', identifier);
            continue;
          }
          
          const data: any = notification.request.content.data || {};
          const type = data?.type;
          
          if (type === 'DAILY_SUMMARY') {
            // Validate and use the notification's timestamp
            let timestamp = now;
            if (notification.date) {
              const notificationTime = new Date(notification.date).getTime();
              // Only use if it's a valid timestamp after 2020
              if (!isNaN(notificationTime) && notificationTime > new Date('2020-01-01').getTime()) {
                timestamp = notificationTime;
              }
            }
            
            addNotificationToList(notification, timestamp);
            processedNotificationIds.add(identifier);
          } else if (type === 'LOW_GP_ALERT') {
            // For low GP alerts, check if there are actual items before adding
            const data: any = notification.request.content.data || {};
            const lowGPItems = (data?.lowGPItems 
              ?? data?.lowGpItems 
              ?? data?.low_gp_items 
              ?? data?.items 
              ?? data?.products 
              ?? []) as any[];
            
            if (Array.isArray(lowGPItems) && lowGPItems.length > 0) {
              // Normalize key to lowGPItems for downstream UI
              notification.request.content.data = { ...data, lowGPItems };
              
              // Validate and use the notification's timestamp
              let timestamp = now;
              if (notification.date) {
                const notificationTime = new Date(notification.date).getTime();
                // Only use if it's a valid timestamp after 2020
                if (!isNaN(notificationTime) && notificationTime > new Date('2020-01-01').getTime()) {
                  timestamp = notificationTime;
                }
              }
              
              addNotificationToList(notification, timestamp);
              processedNotificationIds.add(identifier);
              console.log('✅ Processed low GP notification with items:', lowGPItems.length);
            } else {
              console.log('⏭️ Skipping low GP notification - no items below threshold');
              // Still mark as processed to avoid re-checking
              processedNotificationIds.add(identifier);
            }
          } else {
            // Handle all other types (broadcasts, promotions, system updates, maintenance, generic)
            let timestamp = now;
            if (notification.date) {
              const notificationTime = new Date(notification.date).getTime();
              if (!isNaN(notificationTime) && notificationTime > new Date('2020-01-01').getTime()) {
                timestamp = notificationTime;
              }
            }
            addNotificationToList(notification, timestamp);
            processedNotificationIds.add(identifier);
          }
        }

        // Note: Removed scheduled notification checking as it was causing duplicates
        // Scheduled notifications will be handled when they actually fire via the listeners
      } catch (error) {
        console.warn('Failed to check received notifications:', error);
      }
    };

    // Ingest the last notification response (e.g., when app was opened via a tap)
    (async () => {
      try {
        const last = await Notifications.getLastNotificationResponseAsync();
        if (last) {
          addNotificationToList(last.notification);
        }
      } catch {}
    })();

    // Listener: when user taps a notification - just navigate, notification already added
    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      try {
        console.log('👆 Notification tapped:', response.notification.request.identifier);
        const data: any = response.notification.request.content.data || {};
        const type = data?.type;
        
        // Always add the notification to our list first
        addNotificationToList(response.notification);
        
        // Then navigate to notifications screen
        if (type === 'DAILY_SUMMARY' || type === 'LOW_GP_ALERT' || type === 'BROADCAST' || type === 'PROMOTION' || type === 'SYSTEM_UPDATE' || type === 'MAINTENANCE') {
          navigationRef.current?.navigate('Notifications');
        }
      } catch {}
    });

    // Listener: when a notification is received (works in all app states)
    const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      try {
        console.log('📥 Notification received:', notification.request.identifier);
        // Always add notification to our internal list when received
        addNotificationToList(notification);
      } catch (error) {
        console.error('❌ Error in notification received listener:', error);
      }
    });

    // Removed initial check for notifications when app starts
    // Only check when returning from background/foreground

    // Listen for app state changes to check for any missed notifications
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        // Ensure next check runs immediately after coming to foreground
        lastCheckTime = 0;
        // Check for notifications that arrived while app was inactive
        checkAllReceivedNotifications();
      } else {
        // Reset so that when we come back to foreground we always check
        lastCheckTime = 0;
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
              <Stack.Screen name="Notifications" component={NotificationsTabScreen} />
              <Stack.Screen name="Data" component={DataScreen} />
              <Stack.Screen name="Account" component={AccountScreen} />
              <Stack.Screen name="Reporting" component={ReportingScreen} />
              <Stack.Screen name="Preferences" component={PreferencesScreen} />
              <Stack.Screen name="DailySummaryModal" component={DailySummaryModal as any} options={{ presentation: 'transparentModal' }} />
              <Stack.Screen name="LowGPAlertModal" component={LowGPAlertModal as any} options={{ presentation: 'transparentModal' }} />
              <Stack.Screen name="BroadcastModal" component={BroadcastModal as any} options={{ presentation: 'transparentModal' }} />
              <Stack.Screen name="OperationalAlertsModal" component={OperationalAlertsModal as any} options={{ presentation: 'transparentModal' }} />
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