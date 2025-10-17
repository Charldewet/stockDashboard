import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { authAPI } from '../services/api';
// Remove frontend users config; rely on backend only
// import { type User as ConfigUser, getUserByUsername } from '../config/users';
import { getPharmacyByCode, API_CONFIG } from '../config/api';

interface User {
  username: string;
  name: string;
  role: string;
  pharmacies: string[];
  allowedPharmacies: string[];
  selectedPharmacy?: string;
}

interface AuthContextType {
  user: User | null;
  pharmacies: Array<{ code: string; name: string }>;
  selectedPharmacy: string | null;
  selectedDate: Date;
  loading: boolean;
  loginLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setSelectedPharmacy: (pharmacy: string) => void;
  setSelectedDate: (date: Date) => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [pharmacies, setPharmacies] = useState<Array<{ code: string; name: string }>>([]);
  const [selectedPharmacy, setSelectedPharmacy] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    // Add a timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      console.warn('AUTH:TIMEOUT', 'checkAuthStatus taking too long, forcing loading=false');
      setLoading(false);
    }, 10000); // 10 second timeout

    try {
      const savedUser = await AsyncStorage.getItem('user');
      if (savedUser) {
        const userData = JSON.parse(savedUser);

        // Revalidate using stored JWT; do NOT login with blank password
        try {
          const token = await AsyncStorage.getItem('authToken');
          if (!token) throw new Error('NO_TOKEN');

          // Use existing username to load pharmacies; token will be attached by interceptor
          const username = userData?.username;
          await fetchPharmacies(username);

          const syncedUser: User = {
            username: userData?.username,
            name: userData?.name || userData?.username,
            role: userData?.role || 'user',
            pharmacies: [],
            allowedPharmacies: userData?.allowedPharmacies || [],
            selectedPharmacy: userData.selectedPharmacy,
          };
          setUser(syncedUser);
          await AsyncStorage.setItem('user', JSON.stringify(syncedUser));

          if (syncedUser.selectedPharmacy) {
            setSelectedPharmacy(syncedUser.selectedPharmacy);
          }
          
          // Re-register device when re-authenticating from stored JWT
          try {
            const { getStableDeviceId, getEnvInfo } = await import('../utils/device');
            const { registerDevice } = await import('../services/pushApi');
            
            // NEW WAY (fixes the issue):
            let pushToken: string | null = null;
            const isTestFlight = Platform.OS === 'ios' && !__DEV__;
            
            console.log('🔍 AUTH:ENVIRONMENT_DETECTION', { 
              platform: Platform.OS, 
              isDev: __DEV__, 
              isTestFlight,
              shouldGetExpoToken: !isTestFlight 
            });
            
            if (isTestFlight) {
              // TestFlight/Production iOS - get APNs device token
              console.log('✅ AUTH:GETTING_APNS_DEVICE_TOKEN...');
              try {
                const Notifications = await import('expo-notifications');
                const tokenInfo = await Notifications.getDevicePushTokenAsync();
                pushToken = tokenInfo?.data || null;
                if (pushToken) {
                  console.log('✅ AUTH:APNS_DEVICE_TOKEN_RECEIVED', { pushToken: pushToken.substring(0, 20) + '...' });
                } else {
                  console.log('⚠️  AUTH:APNS_DEVICE_TOKEN_EMPTY');
                }
              } catch (error: any) {
                console.error('❌ AUTH:APNS_TOKEN_GENERATION_FAILED', { error, message: error?.message });
                pushToken = null; // Continue without token
              }
            } else {
              // Expo Go/Development - get Expo token
              console.log('✅ AUTH:GETTING_EXPO_PUSH_TOKEN...');
              try {
                console.log('🔍 AUTH:ABOUT_TO_CALL_GETEXPO_PUSH_TOKEN_ASYNC');
                const tokenInfo = await (await import('expo-notifications')).getExpoPushTokenAsync();
                console.log('🔍 AUTH:GETEXPO_PUSH_TOKEN_ASYNC_SUCCESS', { tokenInfo });
                pushToken = tokenInfo.data;
                console.log('✅ AUTH:EXPO_PUSH_TOKEN_RECEIVED', { pushToken: pushToken.substring(0, 20) + '...' });
              } catch (error: any) {
                console.error('❌ AUTH:EXPO_TOKEN_GENERATION_FAILED', { error, message: error?.message });
                console.log('⚠️  Expo token failed, continuing without it');
                pushToken = null;
              }
            }
            
            console.log('🔍 AUTH:PUSH_TOKEN_FINAL_VALUE', { pushToken, isTestFlight });
            
            const deviceId = await getStableDeviceId();
            const env = getEnvInfo();
            
            console.log('AUTH:RE_REGISTERING_DEVICE', { username: syncedUser.username, deviceId, platform: env.platform, isTestFlight });
            
            // Log the exact payload being sent
            const payload = {
              deviceId,
              pushToken,
              timezone: env.timezone,
              platform: env.platform as any,
              appVersion: env.appVersion,
              deviceModel: env.deviceModel,
              osVersion: env.osVersion,
              locale: env.locale,
            };
            console.log('AUTH:PAYLOAD_BEING_SENT', payload);
            
            await registerDevice(payload);
            console.log('AUTH:DEVICE_RE_REGISTERED_SUCCESS');
          } catch (e: any) {
            console.error('AUTH:DEVICE_RE_REGISTRATION_FAILED', {
              error: e,
              message: e?.message,
              code: e?.code,
              stack: e?.stack,
              username: syncedUser.username
            });
            // Don't fail re-auth if device registration fails
            // Continue with authentication even if device registration fails
          }
        } catch (e) {
          await AsyncStorage.removeItem('user');
          setUser(null);
          setSelectedPharmacy(null);
        }
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      await logout();
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  const fetchPharmacies = async (username?: string) => {
    try {
      const pharmacyList = await authAPI.getPharmacies(username);
      
      // Backend returns [{ code: string(id), name: string }]
      const formattedPharmacies = pharmacyList.map((pharmacy: any): { code: string; name: string } => {
        if (pharmacy && typeof pharmacy === 'object' && pharmacy.code && pharmacy.name) {
          return {
            code: String(pharmacy.code),
            name: pharmacy.name
          };
        }
        if (typeof pharmacy === 'string') {
          return { code: pharmacy, name: pharmacy };
        }
        return { code: String(pharmacy), name: String(pharmacy) };
      });

      // Use backend-provided list as-is
      setPharmacies(formattedPharmacies);
      
      // Set default pharmacy if none is selected
      if (formattedPharmacies.length > 0 && !selectedPharmacy) {
        const defaultPharmacy = formattedPharmacies[0].code;
        setSelectedPharmacy(defaultPharmacy);
        
        // Update user with selected pharmacy
        if (user) {
          const updatedUser = { ...user, selectedPharmacy: defaultPharmacy };
          setUser(updatedUser);
          await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
        }
      }
    } catch (error) {
      console.error('Error fetching pharmacies:', error);
    }
  };

  const login = async (username: string, password: string) => {
    try {
      setLoginLoading(true);

      // Clear any stale auth state before a new login attempt
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('user');
      setUser(null);

      const response = await authAPI.login(username, password);
      
      const userData: User = {
        username: response.user.username,
        name: response.user.name,
        role: response.user.role,
        pharmacies: [],
        allowedPharmacies: response.user.allowedPharmacies || []
      };
      
      // Persist only user state; API access is via API key
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      
      // Load pharmacies for this username from backend
      await fetchPharmacies(userData.username);
      
            // Register device with backend push service after successful login
      try {
        const { getStableDeviceId, getEnvInfo } = await import('../utils/device');
        const { registerDevice } = await import('../services/pushApi');
        
        // NEW WAY (fixes the issue):
        let pushToken: string | null = null;
        const isTestFlight = Platform.OS === 'ios' && !__DEV__;
        
        if (isTestFlight) {
          // TestFlight/Production iOS - get APNs device token
          console.log('✅ AUTH:GETTING_APNS_DEVICE_TOKEN...');
          try {
            const Notifications = await import('expo-notifications');
            const tokenInfo = await Notifications.getDevicePushTokenAsync();
            pushToken = tokenInfo?.data || null;
            if (pushToken) {
              console.log('✅ AUTH:APNS_DEVICE_TOKEN_RECEIVED', { pushToken: pushToken.substring(0, 20) + '...' });
            } else {
              console.log('⚠️  AUTH:APNS_DEVICE_TOKEN_EMPTY');
            }
          } catch (error: any) {
            console.error('❌ AUTH:APNS_TOKEN_GENERATION_FAILED', { error, message: error?.message });
            pushToken = null; // Continue without token
          }
        } else {
          // Expo Go/Development - get Expo token
          console.log('✅ AUTH:GETTING_PUSH_TOKEN...');
          try {
            const tokenInfo = await (await import('expo-notifications')).getExpoPushTokenAsync();
            pushToken = tokenInfo.data;
            console.log('✅ AUTH:EXPO_PUSH_TOKEN_RECEIVED', { pushToken: pushToken.substring(0, 20) + '...' });
          } catch (error: any) {
            console.log('⚠️  Expo token failed, continuing without it');
            pushToken = null;
          }
        }
        
        const deviceId = await getStableDeviceId();
        const env = getEnvInfo();
        
        console.log('AUTH:REGISTERING_DEVICE', { username: userData.username, deviceId, platform: env.platform, isTestFlight });
        
        // Log the exact payload being sent
        const payload = {
          deviceId,
          pushToken, // Will be null for TestFlight, Expo token for Expo Go
          timezone: env.timezone,
          platform: env.platform as any,
          appVersion: env.appVersion,
          deviceModel: env.deviceModel,
          osVersion: env.osVersion,
          locale: env.locale,
        };
        console.log('AUTH:PAYLOAD_BEING_SENT_FOR_LOGIN', payload);
        
        await registerDevice(payload);
        console.log('AUTH:DEVICE_REGISTERED_SUCCESS');
      } catch (e: any) {
        console.error('AUTH:DEVICE_REGISTRATION_FAILED', {
          error: e,
          message: e?.message,
          code: e?.code,
          stack: e?.stack,
          username: userData.username
        });
        // Don't fail login if device registration fails
      }
      
    } catch (error) {
      // Ensure failed login does not leave any auth artifacts
      try {
        await AsyncStorage.removeItem('user');
      } catch {}
      setUser(null);
      throw error;
    } finally {
      setLoginLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      // Attempt push unregister using stored deviceId
      try {
        const { getStableDeviceId } = await import('../utils/device');
        const { unregisterDevice } = await import('../services/pushApi');
        const deviceId = await getStableDeviceId();
        await unregisterDevice({ deviceId });
      } catch {}

      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('user');
      setUser(null);
      setPharmacies([]);
      setSelectedPharmacy(null);
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSetSelectedPharmacy = async (pharmacy: string) => {
    setSelectedPharmacy(pharmacy);
    
    // Update user with selected pharmacy
    if (user) {
      const updatedUser = { ...user, selectedPharmacy: pharmacy };
      setUser(updatedUser);
      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
    }
  };

  const value: AuthContextType = {
    user,
    pharmacies,
    selectedPharmacy,
    selectedDate,
    loading,
    loginLoading,
    login,
    logout,
    setSelectedPharmacy: handleSetSelectedPharmacy,
    setSelectedDate,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
