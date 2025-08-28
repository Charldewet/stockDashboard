import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Platform, Modal } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, Bell } from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import ErrorAlert from '../../components/common/ErrorAlert';
import { newPharmacyAPI } from '../../services/api';
import { API_CONFIG } from '../../config/api';
import { formatDateLocal } from '../../utils/dateUtils';

// Color scheme matching ReportingScreen
const colors = {
  bgGradientFrom: '#111827',
  bgGradientTo: '#0F172A',
  surfacePrimary: '#1F2937',
  surfaceSecondary: '#111827',
  textPrimary: '#F9FAFB',
  textSecondary: '#9CA3AF',
  accentPrimary: '#FF4500',
  border: '#374151',
  statusSuccess: '#10B981',
  statusError: '#EF4444',
  statusWarning: '#F59E0B',
  accentPurple: '#8B5CF6',
};

type AuthNavigationProp = {
  navigate: (screen: string) => void;
  goBack: () => void;
};

const PreferencesScreen = () => {
  const navigation = useNavigation<AuthNavigationProp>();
  const { pharmacies } = useAuth();

  const [dailySummariesEnabled, setDailySummariesEnabled] = useState(false);
  const [notificationTime, setNotificationTime] = useState('18:00');
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempTime, setTempTime] = useState<Date | null>(null);
  // Independent pharmacy selections
  const [selectedDailyPharmacies, setSelectedDailyPharmacies] = useState<Set<string>>(new Set());
  const [selectedLowGPPharmacies, setSelectedLowGPPharmacies] = useState<Set<string>>(new Set());
  const [lowGPAlertsEnabled, setLowGPAlertsEnabled] = useState(false);
  const [gpThreshold, setGpThreshold] = useState(0);
  const [showThresholdPicker, setShowThresholdPicker] = useState(false);
  const [tempThreshold, setTempThreshold] = useState<Date | null>(null);

  // Save modal state (re-using shared ErrorAlert for consistent look)
  const [showSaveAlert, setShowSaveAlert] = useState(false);
  const [saveAlertTitle, setSaveAlertTitle] = useState('');
  const [saveAlertMessage, setSaveAlertMessage] = useState('');

  useEffect(() => {
    loadNotificationSettings();
    checkNotificationPermissions();
  }, []);

  // Ensure default selection includes all pharmacies when none saved yet
  useEffect(() => {
    if (pharmacies && pharmacies.length > 0) {
      if (selectedDailyPharmacies.size === 0) {
        const all = new Set(pharmacies.map(p => p.code));
        setSelectedDailyPharmacies(all);
      }
      if (selectedLowGPPharmacies.size === 0) {
        const all = new Set(pharmacies.map(p => p.code));
        setSelectedLowGPPharmacies(all);
      }
    }
  }, [pharmacies]);

  const checkNotificationPermissions = async () => {
    try {
      const current = await Notifications.getPermissionsAsync();
      let finalStatus = current.status;
      if (finalStatus !== 'granted') {
        const req = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
          },
        });
        finalStatus = req.status;
      }
      console.log('🔐 Notification permission status:', finalStatus);
      setNotificationsEnabled(finalStatus === 'granted');
    } catch (e) {
      console.warn('permissions error', e);
      setNotificationsEnabled(false);
    }
  };

  const loadNotificationSettings = async () => {
    try {
      const settings = await AsyncStorage.getItem('notificationSettings');
      if (settings) {
        const parsed = JSON.parse(settings);
        setDailySummariesEnabled(!!parsed.dailySummariesEnabled);
        if (parsed.notificationTime) setNotificationTime(parsed.notificationTime);
        // Backward compatibility: if old selectedPharmacies exists, use for both
        if (Array.isArray(parsed.selectedDailyPharmacies)) {
          setSelectedDailyPharmacies(new Set(parsed.selectedDailyPharmacies.map(String)));
        } else if (Array.isArray(parsed.selectedPharmacies)) {
          setSelectedDailyPharmacies(new Set(parsed.selectedPharmacies.map(String)));
        }
        if (Array.isArray(parsed.selectedLowGPPharmacies)) {
          setSelectedLowGPPharmacies(new Set(parsed.selectedLowGPPharmacies.map(String)));
        } else if (Array.isArray(parsed.selectedPharmacies)) {
          setSelectedLowGPPharmacies(new Set(parsed.selectedPharmacies.map(String)));
        }
        setLowGPAlertsEnabled(!!parsed.lowGPAlertsEnabled);
        if (parsed.gpThreshold) setGpThreshold(parsed.gpThreshold);
      }
    } catch {}
  };

  const scheduleDailyNotifications = async (): Promise<number> => {
    if (!dailySummariesEnabled) return 0;
    
    const [hours, minutes] = notificationTime.split(':').map(Number);
    const selected = pharmacies.filter(p => selectedDailyPharmacies.has(p.code));
    console.log('📌 scheduleDailyNotifications → pharmacies:', pharmacies.length, 'selectedDailyPharmacies:', Array.from(selectedDailyPharmacies).length);
    
    let scheduledCount = 0;
    for (const pharmacy of selected) {
      try {
        const notificationId = `daily-summary-${pharmacy.code}-${Date.now()}`;
        const id = await Notifications.scheduleNotificationAsync({
          identifier: notificationId,
          content: {
            title: 'TLC PharmaSight',
            body: `Daily Summary for ${pharmacy.name}`,
            data: { type: 'DAILY_SUMMARY', pharmacyCode: pharmacy.code, pharmacyName: pharmacy.name },
            categoryIdentifier: 'DAILY_SUMMARY',
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: hours,
            minute: minutes,
          },
        });
        scheduledCount += 1;
        console.log(`✅ Scheduled repeating daily summary (${id}) for ${pharmacy.name} at ${hours}:${minutes}`);
      } catch (error) {
        console.error(`❌ Failed to schedule daily summary for ${pharmacy.name}:`, error);
      }
    }
    return scheduledCount;
  };

  const cancelDailyNotifications = async () => {
    await Notifications.cancelAllScheduledNotificationsAsync();
  };

  const scheduleLowGPNotifications = async (): Promise<number> => {
    if (!lowGPAlertsEnabled) return 0;
    
    const selected = pharmacies.filter(p => selectedLowGPPharmacies.has(p.code));
    let scheduledCount = 0;
    for (const pharmacy of selected) {
      try {
        // Use the exact same API method as StockScreen for low GP products
        const map: any = { 'REITZ': 1, 'TLC WINTERTON': 2 };
        const pharmacyId = map[pharmacy.code] || Number(pharmacy.code) || 1;
        
        // Get today's date for the API call
        const today = new Date();
        const dateStr = formatDateLocal(today);
        
        // 1) Preferred: dedicated endpoint worst GP (same as StockScreen)
        let lowGPItems: any[] = [];
        try {
          const resp = await fetch(`${API_CONFIG.BASE_URL}/pharmacies/${pharmacyId}/stock-activity/worst-gp?date=${dateStr}&limit=15`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${API_CONFIG.API_KEY}`,
              'Content-Type': 'application/json'
            }
          });
          if (resp.ok) {
            const data = await resp.json();
            let items: any[] = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
            // Filter out PDST and KSAA (same as StockScreen)
            items = items.filter((product: any) => {
              const deptCode = product.department_code || '';
              return !deptCode.startsWith('PDST') && !deptCode.startsWith('KSAA');
            });
            if (items.length > 0) {
              lowGPItems = items.slice(0, 5); // Take top 5
            }
          }
        } catch (e) {
          console.warn('worst-gp endpoint failed:', e);
        }
        
        // 2) Fallback: use full stock-activity list and compute (same as StockScreen)
        if (lowGPItems.length === 0) {
          try {
            // Fetch all stock-activity items for the date
            const baseUrl = `${API_CONFIG.BASE_URL}/pharmacies/${pharmacyId}/stock-activity`;
            let cursor: string | null = null;
            let page = 0;
            const maxPages = 5; // Same limit as StockScreen
            const allItems: any[] = [];

            do {
              const urlToFetch: string = cursor
                ? `${baseUrl}?date=${dateStr}&cursor=${encodeURIComponent(cursor)}`
                : `${baseUrl}?date=${dateStr}`;

              const resp: Response = await fetch(urlToFetch, {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${API_CONFIG.API_KEY}`,
                  'Content-Type': 'application/json',
                },
              });

              if (!resp.ok) {
                throw new Error(`HTTP error! status: ${resp.status}`);
              }

              const data: any = await resp.json();
              const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
              allItems.push(...items);

              cursor = typeof data?.nextCursor === 'string' && data.nextCursor.length > 0 ? data.nextCursor : null;
              page += 1;
            } while (cursor && page < maxPages);

            // Filter out PDST and KSAA department products (same as StockScreen)
            const nonPDSTProducts = allItems.filter((product: any) => {
              const deptCode = product.department_code || '';
              return !deptCode.startsWith('PDST') && !deptCode.startsWith('KSAA');
            });
            
            if (nonPDSTProducts.length > 0) {
              // Sort by GP percentage with NULLs first (lowest GP first = worst GP)
              const sortedLowGPProducts = nonPDSTProducts.sort((a: any, b: any) => {
                const aRaw = a.gp_pct;
                const bRaw = b.gp_pct;
                const aIsNull = aRaw === null || aRaw === undefined || Number.isNaN(Number(aRaw));
                const bIsNull = bRaw === null || bRaw === undefined || Number.isNaN(Number(bRaw));
                if (aIsNull && !bIsNull) return -1; // NULLs first
                if (!aIsNull && bIsNull) return 1;
                if (aIsNull && bIsNull) return 0;
                const gpA = Number(aRaw);
                const gpB = Number(bRaw);
                return gpA - gpB; // Ascending order (lowest GP first)
              });
              
              // Take the top 5 worst GP products
              lowGPItems = sortedLowGPProducts.slice(0, 5);
            }
          } catch (error) {
            console.warn(`Failed to fetch stock activity for ${pharmacy.name}:`, error);
          }
        }
        
        // Filter items below GP threshold
        const itemsBelowThreshold = lowGPItems.filter((item: any) => {
          const gpPercent = Number(item.gp_pct || 0);
          return gpPercent < gpThreshold;
        });
        
        if (itemsBelowThreshold.length > 0) {
          // Create notification with item list
          const itemList = itemsBelowThreshold.slice(0, 5).map((item: any) => 
            `• ${item.description || item.name || 'Unknown Product'}: ${item.gp_pct?.toFixed(1) || '0.0'}%`
          ).join('\n');
          
          const remainingCount = itemsBelowThreshold.length > 5 ? itemsBelowThreshold.length - 5 : 0;
          const body = remainingCount > 0 
            ? `${itemsBelowThreshold.length} items below ${gpThreshold}% GP:\n${itemList}\n+${remainingCount} more items`
            : `${itemsBelowThreshold.length} items below ${gpThreshold}% GP:\n${itemList}`;
          
          // Schedule Low GP alerts at the SAME time as daily summaries
          const [alertHours, alertMinutes] = notificationTime.split(':').map(Number);
          
          const now = new Date();
          const alertTime = new Date();
          alertTime.setHours(alertHours, alertMinutes, 0, 0);
          if (alertTime <= now) { alertTime.setDate(alertTime.getDate() + 1); }

          const notificationId = `low-gp-alert-${pharmacy.code}-${Date.now()}`;
          const id = await Notifications.scheduleNotificationAsync({
            identifier: notificationId,
            content: {
              title: 'TLC PharmaSight - Low GP Alert',
              body: body,
              data: { 
                type: 'LOW_GP_ALERT', 
                pharmacyCode: pharmacy.code, 
                pharmacyName: pharmacy.name,
                lowGPItems: itemsBelowThreshold,
                threshold: gpThreshold
              },
              categoryIdentifier: 'LOW_GP_ALERT',
            },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: alertTime },
          });
          scheduledCount += 1;
          console.log(`✅ Scheduled Low GP alert (${id}) for ${pharmacy.name} at ${alertTime.toLocaleString()}`);
        }
      } catch (error) {
        console.warn(`Failed to check low GP items for ${pharmacy.name}:`, error);
      }
    }
    return scheduledCount;
  };

  // Function to check current device time and timezone
  const checkDeviceTime = () => {
    const now = new Date();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const localTime = now.toLocaleString();
    const utcTime = now.toUTCString();
    
    console.log('🕐 Device Time Check:');
    console.log(`   📱 Local time: ${localTime}`);
    console.log(`   🌍 Timezone: ${timezone}`);
    console.log(`   🌐 UTC time: ${utcTime}`);
    console.log(`   ⏰ Hours: ${now.getHours()}, Minutes: ${now.getMinutes()}`);
    
    setSaveAlertTitle('Device Time Info');
    setSaveAlertMessage(`Local: ${localTime}\nTimezone: ${timezone}\nUTC: ${utcTime}`);
    setShowSaveAlert(true);
  };

  // Function to test immediate scheduling (for testing purposes)
  const testImmediateScheduling = async () => {
    try {
      console.log('🧪 Testing immediate notification scheduling...');
      
      // Get current time and add 1 minute
      const now = new Date();
      const testTime = new Date(now.getTime() + 60000); // 1 minute from now
      const testHours = testTime.getHours();
      const testMinutes = testTime.getMinutes();
      
      console.log(`⏰ Current time: ${now.getHours()}:${now.getMinutes()}`);
      console.log(`⏰ Test notification scheduled for: ${testHours}:${testMinutes}`);
      console.log(`🌍 Current timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
      console.log(`📱 Device time: ${now.toLocaleString()}`);
      
      const selected = pharmacies.filter(p => selectedDailyPharmacies.has(p.code));
      const p = selected[0] || pharmacies[0];
      if (!p) return;
      
      // For immediate testing, use seconds-based trigger instead of calendar
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'TLC PharmaSight - Test',
          body: `Test notification scheduled for ${testHours}:${testMinutes}`,
          data: { type: 'DAILY_SUMMARY', pharmacyCode: p.code, pharmacyName: p.name },
          categoryIdentifier: 'DAILY_SUMMARY',
          icon: './assets/app_logo.png',
        } as any,
        trigger: { seconds: 60 } as any, // 60 seconds from now
      });
      
      console.log(`✅ Test notification scheduled for 60 seconds from now`);
      setSaveAlertTitle('Test Scheduled');
      setSaveAlertMessage('Test notification scheduled for 60 seconds from now.');
      setShowSaveAlert(true);
    } catch (error) {
      console.error('❌ Failed to schedule test notification:', error);
      setSaveAlertTitle('Test Failed');
      setSaveAlertMessage('Could not schedule the test notification.');
      setShowSaveAlert(true);
    }
  };

  const saveNotificationSettings = async () => {
    try {
      const settings = { 
        dailySummariesEnabled, 
        notificationTime, 
        selectedDailyPharmacies: Array.from(selectedDailyPharmacies),
        selectedLowGPPharmacies: Array.from(selectedLowGPPharmacies),
        lowGPAlertsEnabled,
        gpThreshold,
      };
      await AsyncStorage.setItem('notificationSettings', JSON.stringify(settings));
      await checkNotificationPermissions();
      // Cancel existing notifications to avoid duplicates
      await Notifications.cancelAllScheduledNotificationsAsync();
      const dailyCount = await scheduleDailyNotifications();
      const lowGPCount = await scheduleLowGPNotifications();
      // Small delay to ensure scheduling completes before counting
      await new Promise(resolve => setTimeout(resolve, 100));
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      console.log(`🗓️ Final scheduled count: ${scheduled.length}, Daily attempted: ${dailyCount}, Low GP attempted: ${lowGPCount}`);
      
      // Debug: Log details of scheduled notifications
      scheduled.forEach((notif, index) => {
        console.log(`📅 Notification ${index + 1}:`, {
          identifier: notif.identifier,
          trigger: notif.trigger,
          content: { title: notif.content.title, body: notif.content.body }
        });
      });
      
      setSaveAlertTitle('Settings Saved');
      setSaveAlertMessage(`Daily: ${dailyCount}, Low GP: ${lowGPCount}. Total queued: ${scheduled.length}. Will trigger at ${notificationTime}.`);
      setShowSaveAlert(true);
    } catch {
      setSaveAlertTitle('Save Failed');
      setSaveAlertMessage('Failed to save notification settings. Please try again.');
      setShowSaveAlert(true);
    }
  };

  const formatTime = (date: Date) => {
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  };

  const getCurrentTimeAsDate = () => {
    const [h, m] = notificationTime.split(':').map(Number);
    const d = new Date();
    d.setHours(h || 0, m || 0, 0, 0);
    return d;
  };

  const openTimePicker = () => {
    setTempTime(getCurrentTimeAsDate());
    setShowTimePicker(true);
  };

  const cancelTimePicker = () => {
    setShowTimePicker(false);
    setTempTime(null);
  };

  const confirmTimePicker = () => {
    if (tempTime) {
      setNotificationTime(formatTime(tempTime));
    }
    setShowTimePicker(false);
  };

  const openThresholdPicker = () => {
    setTempThreshold(new Date());
    setShowThresholdPicker(true);
  };

  const cancelThresholdPicker = () => {
    setShowThresholdPicker(false);
    setTempThreshold(null);
  };

  const confirmThresholdPicker = () => {
    if (tempThreshold) {
      setGpThreshold(tempThreshold.getHours()); // Assuming threshold is a percentage (0-100)
    }
    setShowThresholdPicker(false);
  };

  // Independent toggles for pharmacy selection
  const toggleDailyPharmacy = (code: string) => {
    setSelectedDailyPharmacies(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const toggleLowGPPharmacy = (code: string) => {
    setSelectedLowGPPharmacies(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  return (
    <View style={styles.container}>
      {/* Sticky Header (same pattern as ReportingScreen) */}
      <View style={styles.stickyHeader}>
        <View style={styles.mainHeaderRow}>
          <View style={styles.headerLeft}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <ChevronLeft size={20} color={colors.accentPrimary} />
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollContentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
        </View>

        {/* Notification Status */}
        <View style={styles.cardSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.cardSectionTitle}>Notification Status</Text>
          </View>
          <View style={notificationsEnabled ? styles.greenStatusCard : styles.orangeStatusCard}>
            <View style={notificationsEnabled ? styles.leftIconContainerGreen : styles.leftIconContainerOrange}>
              <Bell size={18} color={colors.bgGradientFrom} />
            </View>
            <Text style={styles.statusCardTitle}>{notificationsEnabled ? 'Notifications Enabled' : 'Notifications Disabled'}</Text>
          </View>
        </View>

        {/* Notifications (Time) */}
        <View style={styles.cardSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.cardSectionTitle}>Notification Preferences</Text>
          </View>
          <View style={styles.settingCard}>
            <View style={styles.timeRow}>
              <Text style={styles.settingLabel}>Send at</Text>
              <TouchableOpacity style={styles.timeButton} onPress={openTimePicker}>
                <Text style={styles.timeButtonText}>{notificationTime}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.settingSubtext}>You can customize this time</Text>
          </View>
        </View>

        {/* Daily Summaries Toggle */}
        <View style={styles.cardSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.cardSectionTitle}>Daily Summaries</Text>
            <Switch
              value={dailySummariesEnabled}
              onValueChange={setDailySummariesEnabled}
              trackColor={{ false: colors.border, true: colors.accentPrimary }}
              thumbColor={dailySummariesEnabled ? colors.bgGradientFrom : '#9CA3AF'}
              disabled={!notificationsEnabled}
            />
          </View>

          {dailySummariesEnabled && (
            <>
              <View style={styles.settingCard}>
                <Text style={styles.settingDescription}>
                  {(() => { const count = Array.from(selectedDailyPharmacies).length; return `Daily summaries will be sent for ${count} ${count === 1 ? 'pharmacy' : 'pharmacies'}`; })()}
                </Text>
                {pharmacies.map((p) => (
                  <View key={p.code} style={styles.pharmacyItem}>
                    <Text style={styles.pharmacyName}>{p.name}</Text>
                    <Switch
                      value={selectedDailyPharmacies.has(p.code)}
                      onValueChange={() => toggleDailyPharmacy(p.code)}
                      trackColor={{ false: colors.border, true: colors.accentPrimary }}
                      thumbColor={selectedDailyPharmacies.has(p.code) ? colors.bgGradientFrom : '#9CA3AF'}
                    />
                  </View>
                ))}
              </View>
            </>
          )}
        </View>

        {/* Low GP Alerts Toggle */}
        <View style={styles.cardSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.cardSectionTitle}>Low GP Alerts</Text>
            <Switch
              value={lowGPAlertsEnabled}
              onValueChange={setLowGPAlertsEnabled}
              trackColor={{ false: colors.border, true: colors.accentPrimary }}
              thumbColor={lowGPAlertsEnabled ? colors.bgGradientFrom : '#9CA3AF'}
              disabled={!notificationsEnabled}
            />
          </View>

          {lowGPAlertsEnabled && (
            <>
              <View style={styles.settingCard}>
                <Text style={styles.settingDescription}>
                  Get notified when gross profit percentage drops below threshold
                </Text>
                <View style={styles.timeRow}>
                  <Text style={styles.settingLabel}>GP% Threshold</Text>
                  <TouchableOpacity style={styles.timeButton} onPress={openThresholdPicker}>
                    <Text style={styles.timeButtonText}>{gpThreshold}%</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.settingSubtext}>Alert when GP% falls below this value</Text>
              </View>

              <View style={styles.settingCard}>
                <Text style={styles.settingDescription}>
                  {(() => { const count = Array.from(selectedLowGPPharmacies).length; return `Low GP alerts will be sent for ${count} ${count === 1 ? 'pharmacy' : 'pharmacies'}`; })()}
                </Text>
                {pharmacies.map((p) => (
                  <View key={p.code} style={styles.pharmacyItem}>
                    <Text style={styles.pharmacyName}>{p.name}</Text>
                    <Switch
                      value={selectedLowGPPharmacies.has(p.code)}
                      onValueChange={() => toggleLowGPPharmacy(p.code)}
                      trackColor={{ false: colors.border, true: colors.accentPrimary }}
                      thumbColor={selectedLowGPPharmacies.has(p.code) ? colors.bgGradientFrom : '#9CA3AF'}
                    />
                  </View>
                ))}
              </View>
            </>
          )}
        </View>

        {/* Action Button (purple, like Reporting screen) */}
        <TouchableOpacity
          style={[styles.purpleActionButton, !notificationsEnabled && { opacity: 0.6 }]}
          onPress={saveNotificationSettings}
          disabled={!notificationsEnabled}
        >
          <View style={styles.leftIconContainerPurple}>
            <Bell size={18} color={colors.bgGradientFrom} />
          </View>
          <Text style={styles.actionText}>Save Settings</Text>
        </TouchableOpacity>

        {/* Info */}
        <View style={styles.cardSection}>
          <Text style={styles.infoText}>
            Configure your notification preferences for daily summaries and low GP alerts. 
            Daily summaries include key business metrics like turnover, gross profit, scripts dispensed,
            and more for each pharmacy you have access to.
          </Text>
        </View>
      </ScrollView>

      {/* Time Picker Modal */}
      <Modal
        visible={showTimePicker}
        transparent
        animationType="slide"
        onRequestClose={cancelTimePicker}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Choose time</Text>
            <DateTimePicker
              value={tempTime || getCurrentTimeAsDate()}
              mode="time"
              is24Hour={true}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(_, d) => d && setTempTime(d)}
              style={{ alignSelf: 'stretch' }}
              themeVariant="dark"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalButton} onPress={cancelTimePicker}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.modalButtonPrimary]} onPress={confirmTimePicker}>
                <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Threshold Picker Modal */}
      <Modal
        visible={showThresholdPicker}
        transparent
        animationType="slide"
        onRequestClose={cancelThresholdPicker}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Choose GP Threshold</Text>
            <View style={styles.thresholdInputContainer}>
              <Text style={styles.thresholdLabel}>GP% Threshold:</Text>
              <View style={styles.thresholdInputRow}>
                <TouchableOpacity 
                  style={styles.thresholdButton} 
                  onPress={() => setGpThreshold(Math.max(0, gpThreshold - 1))}
                >
                  <Text style={styles.thresholdButtonText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.thresholdValue}>{gpThreshold}%</Text>
                <TouchableOpacity 
                  style={styles.thresholdButton} 
                  onPress={() => setGpThreshold(Math.min(100, gpThreshold + 1))}
                >
                  <Text style={styles.thresholdButtonText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalButton} onPress={cancelThresholdPicker}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.modalButtonPrimary]} onPress={cancelThresholdPicker}>
                <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Save Settings Modal (reuses login error modal styling) */}
      <ErrorAlert
        visible={showSaveAlert}
        title={saveAlertTitle}
        message={saveAlertMessage}
        onDismiss={() => setShowSaveAlert(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgGradientFrom,
  },
  stickyHeader: {
    padding: 16,
    paddingTop: 63,
    backgroundColor: colors.bgGradientFrom,
    zIndex: 1000,
  },
  mainHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 0,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 0,
  },
  backButtonText: {
    fontSize: 20,
    color: colors.accentPrimary,
    fontWeight: '600',
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingBottom: 24,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  cardSection: {
    backgroundColor: colors.surfacePrimary,
    borderRadius: 12,
    padding: 16,
    margin: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  statusCardRow: {
    gap: 6,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  statusSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  greenStatusCard: {
    backgroundColor: colors.statusSuccess + '22',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 12,
  },
  orangeStatusCard: {
    backgroundColor: colors.accentPrimary + '22',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 12,
  },
  leftIconContainerGreen: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.statusSuccess,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leftIconContainerOrange: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusCardTitle: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  settingCard: {
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingVertical: 8,
    borderRadius: 0,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  settingDescription: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  settingSubtext: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
    fontStyle: 'italic',
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeButton: {
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  timeButtonText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  thresholdRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  thresholdButtonText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  pharmacyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  pharmacyName: {
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  pharmacyCode: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  purpleActionButton: {
    backgroundColor: colors.accentPurple + '22',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginHorizontal: 10,
    marginTop: 8,
  },
  leftIconContainerPurple: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.accentPurple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  infoText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    textAlign: 'center',
  },
  // Modal styles (aligned with ReportingScreen)
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: colors.surfacePrimary,
    borderRadius: 16,
    padding: 24,
    width: '90%',
    alignItems: 'center',
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 10,
    width: '100%',
    gap: 20,
  },
  modalButton: {
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.textSecondary,
    minWidth: 120,
    alignItems: 'center',
  },
  modalButtonPrimary: {
    backgroundColor: colors.accentPrimary,
    borderColor: colors.accentPrimary,
  },
  modalButtonText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  modalButtonTextPrimary: {
    color: colors.bgGradientFrom,
    fontWeight: '600',
  },
  thresholdInputContainer: {
    marginTop: 10,
    alignItems: 'center',
  },
  thresholdLabel: {
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: '500',
    marginBottom: 8,
  },
  thresholdInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  thresholdButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: colors.accentPurple + '22',
    borderWidth: 1,
    borderColor: colors.accentPurple,
  },
  thresholdValue: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
});

export default PreferencesScreen; 