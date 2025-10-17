import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

const DEVICE_ID_KEY = 'stableDeviceId';

export async function getStableDeviceId(): Promise<string> {
	const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
	if (existing) return existing;
	// Fallback to Application installation id if available, else random UUID
	let id = '';
	try {
		// Prefer vendor/installation IDs if available
		if (Platform.OS === 'android' && (Application as any).getAndroidId) {
			id = await (Application as any).getAndroidId();
		} else if (Platform.OS === 'ios' && Application.getIosIdForVendorAsync) {
			const iosId = await Application.getIosIdForVendorAsync();
			id = iosId || '';
		}
	} catch {}
	if (!id) {
		id = `${Platform.OS}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
	}
	await AsyncStorage.setItem(DEVICE_ID_KEY, String(id));
	return String(id);
}

export function getEnvInfo() {
	return {
		appVersion: Application.nativeApplicationVersion || 'unknown',
		deviceModel: Device.modelName || 'unknown',
		osVersion: Device.osVersion || 'unknown',
		locale: Intl.DateTimeFormat().resolvedOptions().locale,
		platform: Platform.OS === 'ios' ? 'ios' : 'android',
		timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
	};
} 