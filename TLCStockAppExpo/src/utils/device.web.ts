// Web-specific device utilities
// Returns safe fallbacks for web environment

export const getStableDeviceId = async (): Promise<string> => {
  // For web, use a stored ID or generate one
  const STORAGE_KEY = 'web_device_id';
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return stored;
    
    // Generate a unique ID for this browser
    const deviceId = `web_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem(STORAGE_KEY, deviceId);
    return deviceId;
  } catch {
    // Fallback if localStorage is blocked
    return `web_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }
};

export const getEnvInfo = () => {
  return {
    platform: 'web',
    appVersion: '1.0.0',
    deviceModel: navigator.userAgent,
    osVersion: navigator.platform,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    locale: navigator.language,
  };
};

