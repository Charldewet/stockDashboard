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
  checkMissedNotifications: () => Promise<void>;
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

  const checkMissedNotifications = async () => {
    try {
      const Notifications = require('expo-notifications');
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

  const unreadCount = useMemo(() => notifications.length, [notifications]);

  const value: NotificationsContextValue = {
    notifications,
    unreadCount,
    addNotification,
    markAsReadAndRemove,
    clearAll,
    checkMissedNotifications,
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