import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { newPharmacyAPI } from '../../services/api';
import { formatDateLocal, getPreviousYearSameDayOfWeek } from '../../utils/dateUtils';
import { calculatePercentageChange } from '../../utils/formatUtils';

const colors = {
  bgGradientFrom: '#111827',
  surfacePrimary: '#1F2937',
  textPrimary: '#F9FAFB',
  textSecondary: '#9CA3AF',
  accentPrimary: '#FF4500',
  statusSuccess: '#10B981',
  statusError: '#EF4444',
  costSales: '#A0FC4E',
};

interface DailySummaryModalProps {
  route: {
    params: {
      pharmacyCode: string;
      pharmacyName: string;
    };
  };
}

const DailySummaryModal: React.FC<DailySummaryModalProps> = ({ route }) => {
  const navigation = useNavigation();
  const { pharmacyCode, pharmacyName } = route.params || { pharmacyCode: '', pharmacyName: 'Pharmacy' };

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<any | null>(null);
  const [previousYearData, setPreviousYearData] = useState<any | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const today = new Date();
        const dateStr = formatDateLocal(today);
        
        // Map pharmacy code to id (same logic used in DailyScreen)
        const map: any = { 'REITZ': 1, 'TLC WINTERTON': 2 };
        const pharmacyId = map[pharmacyCode] || Number(pharmacyCode) || 1;
        
        // Always fetch current day data
        const dailyTurnoverData = await newPharmacyAPI.getDailyTurnover(pharmacyId, dateStr);
        
        // Previous-year comparable day (same day of week) - same logic as DailyScreen
        const currentYear = today.getFullYear();
        const shouldFetchPreviousYear = currentYear > 2024;
        const previousYearDate = shouldFetchPreviousYear ? getPreviousYearSameDayOfWeek(today) : null;
        const previousYearDateStr = previousYearDate ? formatDateLocal(previousYearDate) : null;
        
        // Try to fetch previous-year data, but do not fail if it errors/missing
        let prevYearData: any = null;
        if (previousYearDateStr) {
          try {
            const prevYearTurnoverData = await newPharmacyAPI.getDailyTurnover(pharmacyId, previousYearDateStr);
            prevYearData = prevYearTurnoverData;
          } catch (prevErr) {
            console.warn('Previous-year daily data unavailable; continuing without it:', prevErr);
            prevYearData = null;
          }
        }

        setMetrics(dailyTurnoverData || {});
        setPreviousYearData(prevYearData);
      } catch (e: any) {
        setError('Failed to load summary.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [pharmacyCode]);

  const close = () => (navigation as any).goBack();
  const openApp = () => (navigation as any).navigate('Dashboard');

  // Calculate growth percentage using the same function as DailyScreen
  const getGrowthPercentage = () => {
    if (!metrics?.turnover || !previousYearData?.turnover) return null;
    const current = Number(metrics.turnover);
    const previous = Number(previousYearData.turnover);
    return calculatePercentageChange(current, previous);
  };

  const growthPct = getGrowthPercentage();
  const isPositive = growthPct !== null && growthPct >= 0;

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <Text style={styles.title}>Daily Summary - {pharmacyName}</Text>
        {loading ? (
          <ActivityIndicator color={colors.accentPrimary} />
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : (
          <View style={styles.metrics}> 
            <View style={styles.row}><Text style={styles.label}>Turnover</Text><Text style={styles.value}>R {Number(metrics?.turnover || 0).toLocaleString()}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Growth vs PY</Text><Text style={[styles.value, { color: growthPct !== null ? (isPositive ? colors.statusSuccess : colors.statusError) : colors.textSecondary }]}>{growthPct !== null ? `${isPositive ? '+' : ''}${growthPct.toFixed(1)}%` : '-'}</Text></View>
            <View style={styles.row}><Text style={styles.label}>GP%</Text><Text style={styles.value}>{Number(metrics?.gp_pct || 0).toFixed(1)}%</Text></View>
            <View style={styles.row}><Text style={styles.label}>Dispensary%</Text><Text style={styles.value}>{metrics?.disp_pct != null ? Number(metrics.disp_pct).toFixed(1) + '%' : (metrics?.turnover && metrics?.dispensary_turnover ? ((Number(metrics.dispensary_turnover) / Number(metrics.turnover)) * 100).toFixed(1) + '%' : '-')}</Text></View>
          </View>
        )}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.buttonPrimary} onPress={close}>
            <Text style={styles.buttonPrimaryText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '90%',
    backgroundColor: colors.surfacePrimary,
    borderRadius: 16,
    padding: 20,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorText: {
    color: colors.textSecondary,
    textAlign: 'center',
  },
  metrics: {
    marginTop: 4,
    marginBottom: 12,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  value: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 6,
  },
  buttonSecondary: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.textSecondary,
    minWidth: 120,
    alignItems: 'center',
  },
  buttonSecondaryText: {
    color: colors.textSecondary,
    fontSize: 16,
  },
  buttonPrimary: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: colors.accentPrimary,
    minWidth: 120,
    alignItems: 'center',
  },
  buttonPrimaryText: {
    color: colors.bgGradientFrom,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default DailySummaryModal; 