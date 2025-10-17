import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from '../services/api';
import { API_CONFIG } from '../config/api';

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
    const timeoutId = setTimeout(() => {
      console.warn('AUTH:TIMEOUT', 'checkAuthStatus taking too long, forcing loading=false');
      setLoading(false);
    }, 10000);

    try {
      const savedUser = await AsyncStorage.getItem('user');
      if (savedUser) {
        const userData = JSON.parse(savedUser);

        try {
          const token = await AsyncStorage.getItem('authToken');
          if (!token) throw new Error('NO_TOKEN');

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
          
          // Web: Skip device registration (no push notifications)
          console.log('WEB: Device registration skipped');
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

      setPharmacies(formattedPharmacies);
      
      if (formattedPharmacies.length > 0 && !selectedPharmacy) {
        const defaultPharmacy = formattedPharmacies[0].code;
        setSelectedPharmacy(defaultPharmacy);
        
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
      
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      
      await fetchPharmacies(userData.username);
      
      // Web: Skip device registration (no push notifications)
      console.log('WEB: Device registration skipped on login');
      
    } catch (error) {
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
      // Web: Skip device unregistration
      
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

