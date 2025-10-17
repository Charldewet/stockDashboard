import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG } from '../config/api';
import { Platform } from 'react-native';

const api = axios.create({
	baseURL: API_CONFIG.BASE_URL,
	timeout: API_CONFIG.TIMEOUT,
	headers: { 'Content-Type': 'application/json' },
});

async function getAuthHeaders() {
	const token = await AsyncStorage.getItem('authToken');
	return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function registerDevice(params: {
	deviceId: string;
	pushToken: string | null; // Allow null for Apple APNs
	timezone: string;
	appVersion?: string;
	deviceModel?: string;
	osVersion?: string;
	locale?: string;
	platform?: 'ios' | 'android';
}) {
	const headers = await getAuthHeaders();
	const payload = {
		deviceId: params.deviceId,
		platform: params.platform || (Platform.OS === 'ios' ? 'ios' : 'android'),
		pushToken: params.pushToken,
		timezone: params.timezone,
		appVersion: params.appVersion,
		deviceModel: params.deviceModel,
		osVersion: params.osVersion,
		locale: params.locale,
	};
	const res = await api.post('/push/register', payload, { headers });
	return res.data;
}

export async function unregisterDevice(by: { deviceId?: string; pushToken?: string }) {
	const headers = await getAuthHeaders();
	const res = await api.post('/push/unregister', by, { headers });
	return res.data;
}

export type BroadcastNotificationPayload = {
	title: string;
	body: string;
	data?: {
		type: 'BROADCAST' | 'PROMOTION' | 'SYSTEM_UPDATE' | 'MAINTENANCE';
		category?: string;
		url?: string;
		pharmacyCode?: string;
		[key: string]: any;
	};
	targetAudience?: 'all' | 'pharmacy_specific' | 'role_specific';
	pharmacyIds?: string[];
	userRoles?: string[];
};

export async function sendBroadcastNotification(payload: BroadcastNotificationPayload) {
	const headers = await getAuthHeaders();
	try {
		const res = await api.post('/push/broadcast', payload, { headers });
		return res.data;
	} catch (e: any) {
		const status = e?.response?.status;
		const body = e?.response?.data;
		console.log('PUSH:BROADCAST_FAILURE', { status, body, payload });
		throw e;
	}
}

export async function sendPharmacyBroadcast(pharmacyId: string, payload: Omit<BroadcastNotificationPayload, 'targetAudience' | 'pharmacyIds'>) {
	const headers = await getAuthHeaders();
	try {
		const res = await api.post(`/push/broadcast/pharmacy/${pharmacyId}`, payload, { headers });
		return res.data;
	} catch (e: any) {
		const status = e?.response?.status;
		const body = e?.response?.data;
		console.log('PUSH:PHARMACY_BROADCAST_FAILURE', { status, body, payload, pharmacyId });
		throw e;
	}
}

export async function sendRoleBroadcast(role: string, payload: Omit<BroadcastNotificationPayload, 'targetAudience' | 'userRoles'>) {
	const headers = await getAuthHeaders();
	try {
		const res = await api.post(`/push/broadcast/role/${role}`, payload, { headers });
		return res.data;
	} catch (e: any) {
		const status = e?.response?.status;
		const body = e?.response?.data;
		console.log('PUSH:ROLE_BROADCAST_FAILURE', { status, body, payload, role });
		throw e;
	}
}

export type NotificationSettingsPayload = {
	dailySummary: { enabled: boolean; time: string; pharmacyIds: number[] };
	lowGpAlerts: { enabled: boolean; time: string; pharmacyIds: number[]; threshold: number };
	operationalAlerts?: { enabled: boolean; time: string; pharmacyIds: number[] };
};

export async function saveNotificationSettings(settings: NotificationSettingsPayload) {
	const headers = await getAuthHeaders();
	try {
		const res = await api.put('/notifications/settings', settings, { headers });
		return res.data;
	} catch (e: any) {
		const status = e?.response?.status;
		const body = e?.response?.data;
		console.log('PUSH:SAVE_SETTINGS_FAILURE', { status, body, payload: settings });
		throw e;
	}
} 