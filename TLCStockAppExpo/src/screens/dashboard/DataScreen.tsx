import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { AuthNavigationProp } from '../../types/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import DataCalendar, { DataStatus } from '../../components/common/DataCalendar';
import MonthYearPicker from '../../components/common/MonthYearPicker';
import { useAuth } from '../../contexts/AuthContext';
import { formatDateLocal } from '../../utils/dateUtils';
import api from '../../services/api';

const { width } = Dimensions.get('window');

// Helper function to get pharmacy ID from pharmacy code
const getPharmacyId = (pharmacyCode: string): number => {
  const asNum = Number(pharmacyCode);
  if (Number.isFinite(asNum) && String(asNum) === pharmacyCode) {
    return asNum;
  }
  const pharmacyMap: { [key: string]: number } = {
    'REITZ': 1,
    'TLC WINTERTON': 2
  };
  return pharmacyMap[pharmacyCode] || 1; // Default to 1 if not found
};

// Color scheme matching web app
const colors = {
  // Background gradients
  bgGradientFrom: '#111827',
  bgGradientTo: '#0F172A',
  
  // Surface colors
  surfacePrimary: '#1F2937',
  surfaceSecondary: '#111827',
  
  // Text colors
  textPrimary: '#F9FAFB',
  textSecondary: '#9CA3AF',
  
  // Accent colors
  accentPrimary: '#FF4500',
  accentPrimaryHover: '#E63E00',
  accentPrimaryFocus: '#FFA500',
  
  // Status colors
  statusSuccess: '#10B981',
  statusWarning: '#F59E0B',
  statusError: '#EF4444',
  
  // Chart colors
  chartGold: '#FFD600',
  chartCoquelicot: '#FF4509',
  costSales: '#A0FC4E',
  
  // Border colors
  border: '#374151',
};

// Required report types for a date to be considered complete
const REQUIRED_REPORTS = [
  { key: 'inv249_turnover', label: 'Turnover Report' },
  { key: 'stk261_trading', label: 'Trading Report' },
  { key: 'phm080_scripts', label: 'Scripts Report' },
  { key: 'stk260_gp', label: 'GP Report' },
] as const;

type ReportKey = typeof REQUIRED_REPORTS[number]['key'];

interface LogbookEntry {
  business_date: string;
  pharmacy_id: number;
  inv249_turnover: boolean;
  stk261_trading: boolean;
  phm080_scripts: boolean;
  stk260_gp: boolean;
  last_updated: string;
}

const toDateKey = (d: string | Date): string => {
  if (typeof d === 'string') return d.split('T')[0];
  return formatDateLocal(d);
};

const DataScreen = () => {
  const navigation = useNavigation<AuthNavigationProp>();
  const { selectedPharmacy } = useAuth();

  const [currentMonth, setCurrentMonth] = useState<Date>(new Date(2025, 7, 1)); // August 2025 (month is 0-indexed)
  const [loading, setLoading] = useState<boolean>(false);
  const [dataStatus, setDataStatus] = useState<DataStatus[]>([]);
  const [missingByDate, setMissingByDate] = useState<Record<string, string[]>>({});
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showMonthYearPicker, setShowMonthYearPicker] = useState<boolean>(false);

  const getMonthRange = (date: Date) => {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return { start, end };
  };

  const fetchMonthPresence = useCallback(async () => {
    if (!selectedPharmacy) return;
    setLoading(true);
    try {
      const { start, end } = getMonthRange(currentMonth);
      const startStr = formatDateLocal(start);
      const endStr = formatDateLocal(end);

      console.log('Fetching logbook data for:', { startStr, endStr, selectedPharmacy });

      // Fetch logbook data for the month using the authenticated API instance
      const pharmacyId = getPharmacyId(selectedPharmacy);
      const response = await api.get(`/pharmacies/${pharmacyId}/logbook`, {
        params: { 
          from: startStr, 
          to: endStr 
        }
      });

      console.log('Logbook API response:', response.data);
      const logbookData: LogbookEntry[] = response.data || [];
      
      // Create a map of date to logbook entry
      const logbookByDate = new Map<string, LogbookEntry>();
      logbookData.forEach(entry => {
        logbookByDate.set(entry.business_date, entry);
      });

      console.log('Logbook by date map:', Object.fromEntries(logbookByDate));

      // Specific debug for August 15, 2025
      const aug15Key = '2025-08-15';
      console.log(`August 15, 2025 (${aug15Key}) in logbook:`, logbookByDate.has(aug15Key));
      if (logbookByDate.has(aug15Key)) {
        console.log('August 15 data:', logbookByDate.get(aug15Key));
      }

      const daysInMonth = end.getDate();
      const today = new Date();
      const todayKey = toDateKey(today);

      const statusList: DataStatus[] = [];
      const missingMap: Record<string, string[]> = {};

      for (let day = 1; day <= daysInMonth; day++) {
        const dateObj = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        const dateKey = toDateKey(dateObj);

        // Mark future days explicitly as none
        if (dateObj > today) {
          statusList.push({ date: dateKey, status: 'none' });
          missingMap[dateKey] = REQUIRED_REPORTS.map(r => r.label);
          continue;
        }

        const logbookEntry = logbookByDate.get(dateKey);
        
        console.log(`Date ${dateKey}:`, logbookEntry ? 'Has data' : 'No data');
        
        if (!logbookEntry) {
          // No data/reports for this date
          statusList.push({ date: dateKey, status: 'none' });
          missingMap[dateKey] = REQUIRED_REPORTS.map(r => r.label);
          continue;
        }

        // Check which reports are present
        const presentReports = REQUIRED_REPORTS.filter(report => 
          logbookEntry[report.key as keyof LogbookEntry] === true
        );

        const missingReports = REQUIRED_REPORTS.filter(report => 
          logbookEntry[report.key as keyof LogbookEntry] !== true
        );

        console.log(`Date ${dateKey} - Present:`, presentReports.map(r => r.label), 'Missing:', missingReports.map(r => r.label));

        if (missingReports.length === 0) {
          // All reports present
          statusList.push({ date: dateKey, status: 'complete' });
          missingMap[dateKey] = [];
        } else if (presentReports.length === 0) {
          // No reports present
          statusList.push({ date: dateKey, status: 'none' });
          missingMap[dateKey] = REQUIRED_REPORTS.map(r => r.label);
        } else {
          // Some reports present
          statusList.push({ date: dateKey, status: 'partial' });
          missingMap[dateKey] = missingReports.map(r => r.label);
        }
      }

      console.log('Final status list:', statusList);
      console.log('Final missing map:', missingMap);

      setDataStatus(statusList);
      setMissingByDate(missingMap);
    } catch (err) {
      console.error('Error fetching logbook data:', err);
      setDataStatus([]);
      setMissingByDate({});
    } finally {
      setLoading(false);
    }
  }, [selectedPharmacy, currentMonth]);

  useEffect(() => {
    fetchMonthPresence();
  }, [fetchMonthPresence]);

  useFocusEffect(
    useCallback(() => {
      fetchMonthPresence();
      return undefined;
    }, [fetchMonthPresence])
  );

  const handlePreviousMonth = () => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() - 1);
    setCurrentMonth(newDate);
    setSelectedDate(null);
  };

  const handleNextMonth = () => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + 1);
    setCurrentMonth(newDate);
    setSelectedDate(null);
  };

  const handleDatePress = (date: Date) => {
    setSelectedDate(date);
  };

  const handleMonthYearSelect = (date: Date) => {
    setCurrentMonth(date);
    setSelectedDate(null);
  };

  const handleMonthLabelPress = () => {
    setShowMonthYearPicker(true);
  };

  const formatDisplayDate = (date: Date) =>
    date.toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: '2-digit' });

  const getMissingForSelected = (): string[] => {
    if (!selectedDate) return [];
    const y = selectedDate.getFullYear(); 
    const m = String(selectedDate.getMonth()+1).padStart(2,'0'); 
    const d = String(selectedDate.getDate()).padStart(2,'0'); 
    const key = `${y}-${m}-${d}`;
    return missingByDate[key] || [];
  };

  const getStatusForSelected = (): 'complete' | 'partial' | 'none' | null => {
    if (!selectedDate) return null;
    const y = selectedDate.getFullYear(); 
    const m = String(selectedDate.getMonth()+1).padStart(2,'0'); 
    const d = String(selectedDate.getDate()).padStart(2,'0'); 
    const key = `${y}-${m}-${d}`;
    const status = dataStatus.find(s => s.date === key);
    return status ? status.status : null;
  };

  return (
    <View style={styles.container}>
      <View style={styles.stickyHeader}>
        <View style={styles.mainHeaderRow}>
          <View style={styles.headerLeft}>
            <TouchableOpacity 
              style={styles.backButton} 
              onPress={() => navigation.goBack()}
            >
              <ChevronLeft size={20} color={colors.accentPrimary} />
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView style={styles.scrollContent}>
        <View style={styles.monthNavigation}>
          <TouchableOpacity 
            style={styles.navButton} 
            onPress={handlePreviousMonth}
            disabled={loading}
          >
            <ChevronLeft size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleMonthLabelPress} disabled={loading}>
            <Text style={styles.monthText}>
              {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.navButton} 
            onPress={handleNextMonth}
            disabled={loading}
          >
            <ChevronRight size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loaderBox}>
            <ActivityIndicator size="small" color={colors.accentPrimary} />
            <Text style={styles.helperText}>Checking report coverage…</Text>
          </View>
        ) : null}

        <DataCalendar
          currentDate={currentMonth}
          dataStatus={dataStatus}
          onDatePress={handleDatePress}
        />

        <View style={styles.missingPanel}>
          <Text style={styles.sectionTitle}>Report Coverage</Text>
          {!selectedDate ? (
            <Text style={styles.helperText}>Tap a day to see which reports are missing.</Text>
          ) : (
            (() => {
              const status = getStatusForSelected();
              const missing = getMissingForSelected();
              
              if (status === 'complete') {
                return (
                  <Text style={[styles.helperText, { color: colors.statusSuccess }]}>
                    All reports available for {formatDisplayDate(selectedDate)}.
                  </Text>
                );
              } else if (status === 'partial') {
                return (
                  <>
                    <Text style={styles.missingDateLabel}>{formatDisplayDate(selectedDate)} - Partial Coverage</Text>
                    <Text style={styles.helperText}>Missing reports:</Text>
                    <View style={styles.missingList}>
                      {missing.map((item) => (
                        <View key={item} style={styles.missingChip}>
                          <Text style={styles.missingChipText}>{item}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                );
              } else if (status === 'none') {
                return (
                  <>
                    <Text style={styles.missingDateLabel}>{formatDisplayDate(selectedDate)} - No Reports</Text>
                    <Text style={styles.helperText}>Missing reports:</Text>
                    <View style={styles.missingList}>
                      {missing.map((item) => (
                        <View key={item} style={styles.missingChip}>
                          <Text style={styles.missingChipText}>{item}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                );
              } else {
                return (
                  <Text style={styles.helperText}>No data recorded for {formatDisplayDate(selectedDate)}.</Text>
                );
              }
            })()
          )}
        </View>
      </ScrollView>

      <MonthYearPicker
        visible={showMonthYearPicker}
        currentDate={currentMonth}
        onDateSelect={handleMonthYearSelect}
        onClose={() => setShowMonthYearPicker(false)}
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
  scrollContent: {
    flex: 1,
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
  // Month navigation styles
  monthNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  navButton: {
    padding: 8,
    backgroundColor: colors.surfacePrimary,
    borderRadius: 8,
  },
  monthText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.accentPrimary,
    textDecorationLine: 'underline',
  },
  loaderBox: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  // Missing reports styles
  missingPanel: {
    paddingHorizontal: 16,
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  helperText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  missingDateLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  missingList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  missingChip: {
    backgroundColor: colors.surfacePrimary,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  missingChipText: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '500',
  },
});

export default DataScreen; 