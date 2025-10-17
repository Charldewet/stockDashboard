import React from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../contexts/AuthContext';

// Icons
import { TrendingUp, Calendar, BarChart3, Package, Home } from 'lucide-react-native';

// Screens
import LoginScreen from '../screens/auth/LoginScreen';
import DashboardScreen from '../screens/dashboard/DashboardScreen';
import DailyScreen from '../screens/dashboard/DailyScreen';
import DailyHistoryScreen from '../screens/dashboard/DailyHistoryScreen';
import MonthlyScreen from '../screens/dashboard/MonthlyScreen';
import MonthlyHistoryScreen from '../screens/dashboard/MonthlyHistoryScreen';
import YearlyScreen from '../screens/dashboard/YearlyScreen';
import StockScreen from '../screens/dashboard/StockScreen';
import StockDetail from '../screens/dashboard/StockDetail';
import StockHistoryScreen from '../screens/dashboard/StockHistoryScreen';
import AccountScreen from '../screens/dashboard/AccountScreen';
import ReportingScreen from '../screens/dashboard/ReportingScreen';
import DataScreen from '../screens/dashboard/DataScreen';

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
  Account: undefined;
  DailyHistory: undefined;
  MonthlyHistory: undefined;
  StockDetail: undefined;
  StockHistory: undefined;
  Reporting: undefined;
  Data: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createStackNavigator<AuthStackParamList>();

const MainTabNavigator = () => {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surfacePrimary,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingBottom: 12,
          paddingTop: 6,
          height: 80,
        },
        tabBarActiveTintColor: colors.accentPrimary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 4,
          marginBottom: 0,
        },
        tabBarIcon: ({ color, size }) => {
          let IconComponent;
          
          if (route.name === 'Dashboard') IconComponent = Home;
          else if (route.name === 'Daily') IconComponent = TrendingUp;
          else if (route.name === 'Monthly') IconComponent = Calendar;
          else if (route.name === 'Yearly') IconComponent = BarChart3;
          else if (route.name === 'Stock') IconComponent = Package;
          else IconComponent = Home;

          return <IconComponent size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen 
        name="Dashboard" 
        component={DashboardScreen}
        options={{ tabBarLabel: 'Home' }}
      />
      <Tab.Screen 
        name="Daily" 
        component={DailyScreen}
        options={{ tabBarLabel: 'Daily' }}
      />
      <Tab.Screen 
        name="Monthly" 
        component={MonthlyScreen}
        options={{ tabBarLabel: 'Monthly' }}
      />
      <Tab.Screen 
        name="Yearly" 
        component={YearlyScreen}
        options={{ tabBarLabel: 'Yearly' }}
      />
      <Tab.Screen 
        name="Stock" 
        component={StockScreen}
        options={{ tabBarLabel: 'Stock' }}
      />
    </Tab.Navigator>
  );
};

const AppNavigator = () => {
  const { isAuthenticated, loading } = useAuth();
  const { themeMode, colors } = useTheme();

  const customLightTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: colors.bgGradientFrom,
      card: colors.surfacePrimary,
      text: colors.textPrimary,
      border: colors.border,
      primary: colors.accentPrimary,
    },
  };

  const customDarkTheme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background: colors.bgGradientFrom,
      card: colors.surfacePrimary,
      text: colors.textPrimary,
      border: colors.border,
      primary: colors.accentPrimary,
    },
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgGradientFrom }}>
        {/* Loading screen */}
      </View>
    );
  }

  return (
    <NavigationContainer theme={themeMode === 'dark' ? customDarkTheme : customLightTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            <Stack.Screen name="Dashboard" component={MainTabNavigator} />
            <Stack.Screen name="Account" component={AccountScreen} />
            <Stack.Screen name="DailyHistory" component={DailyHistoryScreen} />
            <Stack.Screen name="MonthlyHistory" component={MonthlyHistoryScreen} />
            <Stack.Screen name="StockDetail" component={StockDetail} />
            <Stack.Screen name="StockHistory" component={StockHistoryScreen} />
            <Stack.Screen name="Reporting" component={ReportingScreen} />
          <Stack.Screen name="Data" component={DataScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;

