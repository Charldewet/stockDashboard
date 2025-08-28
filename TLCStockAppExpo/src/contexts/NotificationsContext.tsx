import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type InAppNotification = {
  id: string;
  title: string;
  body: string;
  data: any;
  createdAt: number;
  read: boolean;
};

interface NotificationsContextValue {
  notifications: InAppNotification[];
  unreadCount: number;
  addNotification: (n: InAppNotification) => void;
  markAsReadAndRemove: (id: string) => void;
  clearAll: () => void;
}

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

const STORAGE_KEY = 'inAppNotifications';

export const NotificationsProvider = ({ children }: { children: ReactNode }) => {
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed: InAppNotification[] = JSON.parse(raw);
          setNotifications(Array.isArray(parsed) ? parsed : []);
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(notifications)).catch(() => {});
  }, [notifications]);

  const addNotification = (n: InAppNotification) => {
    setNotifications(prev => [n, ...prev.filter(p => p.id !== n.id)]);
  };

  const markAsReadAndRemove = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAll = () => setNotifications([]);

  const unreadCount = useMemo(() => notifications.length, [notifications]);

  const value: NotificationsContextValue = {
    notifications,
    unreadCount,
    addNotification,
    markAsReadAndRemove,
    clearAll,
  };

  return (
    <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
  );
};

export const useNotifications = () => {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
}; 