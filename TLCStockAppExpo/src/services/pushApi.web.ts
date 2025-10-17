// Web-specific push API - stub implementations for web
// Since we're skipping notifications for now, these are no-ops

interface RegisterDeviceParams {
  deviceId: string;
  pushToken?: string | null;
  timezone?: string;
  platform?: 'ios' | 'android' | 'web';
  appVersion?: string;
  deviceModel?: string;
  osVersion?: string;
  locale?: string;
}

interface UnregisterDeviceParams {
  deviceId: string;
}

export const registerDevice = async (params: RegisterDeviceParams): Promise<void> => {
  // No-op for web - notifications are skipped
  console.log('WEB: registerDevice skipped (notifications disabled)', params);
};

export const unregisterDevice = async (params: UnregisterDeviceParams): Promise<void> => {
  // No-op for web - notifications are skipped
  console.log('WEB: unregisterDevice skipped (notifications disabled)', params);
};

