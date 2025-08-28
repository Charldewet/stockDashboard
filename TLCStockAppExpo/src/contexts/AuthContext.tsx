import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from '../services/api';
import { getYesterday } from '../utils/dateUtils';
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
  const [selectedDate, setSelectedDate] = useState<Date>(getYesterday());
  const [loading, setLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const savedUser = await AsyncStorage.getItem('user');
      if (savedUser) {
        const userData = JSON.parse(savedUser);

        // Revalidate user exists on backend
        try {
          const validated = await authAPI.login(userData?.username, '');
          const syncedUser: User = {
            username: validated.user.username,
            name: validated.user.name,
            role: validated.user.role,
            pharmacies: [],
            allowedPharmacies: validated.user.allowedPharmacies || [],
            selectedPharmacy: userData.selectedPharmacy,
          };
          setUser(syncedUser);
          await AsyncStorage.setItem('user', JSON.stringify(syncedUser));

          if (syncedUser.selectedPharmacy) {
            setSelectedPharmacy(syncedUser.selectedPharmacy);
          }

          await fetchPharmacies(syncedUser.username);
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
