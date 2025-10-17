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
          if (Array.isArray(parsed)) {
            // Filter out notifications with invalid timestamps (like 1970 dates)
            const minValidDate = new Date('2020-01-01').getTime();
            const validNotifications = parsed.filter(notification => 
              notification.createdAt && notification.createdAt > minValidDate
            );
            setNotifications(validNotifications);
            
            // If we filtered out invalid notifications, save the cleaned list
            if (validNotifications.length !== parsed.length) {
              console.log('Cleaned up', parsed.length - validNotifications.length, 'invalid notifications');
              AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(validNotifications)).catch(() => {});
            }
          }
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(notifications)).catch(() => {});
  }, [notifications]);

  const addNotification = (n: InAppNotification) => {
    // Validate timestamp to prevent 1970 dates
    const minValidDate = new Date('2020-01-01').getTime();
    if (!n.createdAt || n.createdAt < minValidDate) {
      console.warn('Rejecting notification with invalid timestamp:', n.createdAt);
      return;
    }
    
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
      const minValidDate = new Date('2020-01-01').getTime();
      
      // Check for notifications that should have been received recently
      for (const notification of scheduled) {
        const trigger = notification.trigger as any;
        if (trigger && trigger.date) {
          const scheduledTime = new Date(trigger.date).getTime();
          
          // Validate scheduled time first
          if (isNaN(scheduledTime) || scheduledTime < minValidDate) {
            continue; // Skip invalid dates
          }
          
          const timeDiff = now - scheduledTime;
          
          // If notification was scheduled for more than 1 minute ago but less than 24 hours ago
          if (timeDiff > 60000 && timeDiff < 86400000) {
            const data: any = notification.content.data || {};
            const type = data?.type;
            const title = notification.content.title || 'TLC PharmaSight';
            const body = notification.content.body || '';
            
            // Handle all notification types, not just daily and low GP
            if (type === 'DAILY_SUMMARY') {
              const code = String(data?.pharmacyCode || '');
              const name = String(data?.pharmacyName || 'Pharmacy');
              addNotification({
                id: `daily-${notification.identifier}-${code}`,
                title: 'TLC PharmaSight',
                body: `Daily Summary for ${name}`,
                data,
                createdAt: scheduledTime,
                read: false,
              });
            } else if (type === 'LOW_GP_ALERT') {
              const code = String(data?.pharmacyCode || '');
              const name = String(data?.pharmacyName || 'Pharmacy');
              addNotification({
                id: `lowgp-${notification.identifier}-${code}`,
                title: 'TLC PharmaSight - Low GP Alert',
                body: `Low GP products for ${name}`,
                data,
                createdAt: scheduledTime,
                read: false,
              });
            } else {
              // Handle all other types (broadcasts, promotions, etc.) - they'll get colored via normalizeType
              addNotification({
                id: `generic-${notification.identifier}`,
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