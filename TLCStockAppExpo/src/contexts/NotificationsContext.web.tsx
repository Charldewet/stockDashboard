// Web-specific notifications context - stub for compatibility
import { createContext, useContext, ReactNode } from 'react';

export interface InAppNotification {
  id: string;
  title: string;
  body: string;
  data?: any;
  timestamp: number;
  read: boolean;
}

interface NotificationsContextValue {
  notifications: InAppNotification[];
  unreadCount: number;
  addNotification: (notification: Omit<InAppNotification, 'id' | 'timestamp' | 'read'>) => void;
  markAsReadAndRemove: (id: string) => void;
  checkMissedNotifications: () => Promise<void>;
  clearAll: () => void;
}

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

export const NotificationsProvider = ({ children }: { children: ReactNode }) => {
  // Web: No notifications for now, return stub
  const value: NotificationsContextValue = {
    notifications: [],
    unreadCount: 0,
    addNotification: () => {},
    markAsReadAndRemove: () => {},
    checkMissedNotifications: async () => {},
    clearAll: () => {},
  };

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
};

export const useNotifications = () => {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
};

