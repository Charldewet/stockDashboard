import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { newPharmacyAPI } from '../../services/api';
import { formatDateLocal, getPreviousYearSameDayOfWeek } from '../../utils/dateUtils';
import { AlertTriangle, CheckCircle } from 'lucide-react-native';

const colors = {
  bgGradientFrom: '#111827',
  surfacePrimary: '#1F2937',
  textPrimary: '#F9FAFB',
  textSecondary: '#9CA3AF',
  accentPrimary: '#FF4500',
  statusSuccess: '#10B981',
  statusError: '#EF4444',
  statusWarning: '#F59E0B',
};

interface OperationalAlertsModalProps {
  route: {
    params: {
      pharmacyCode: string;
      pharmacyName: string;
    }
  };
}

const OperationalAlertsModal: React.FC<OperationalAlertsModalProps> = ({ route }) => {
  const navigation = useNavigation();
  const { pharmacyCode, pharmacyName } = route.params || { pharmacyCode: '', pharmacyName: 'Pharmacy' };

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<Array<{ title: string; description: string; severity: 'positive' | 'warning' | 'critical' }>>([]);

  useEffect(() => {
    const fetchOperationalAlerts = async () => {
      try {
        setLoading(true);
        setError(null);

        const today = new Date();
        const dateStr = formatDateLocal(today);

        const map: any = { 'REITZ': 1, 'TLC WINTERTON': 2 };
        const pharmacyId = map[pharmacyCode] || Number(pharmacyCode) || 1;

        const dailyData = await newPharmacyAPI.getDailyTurnover(pharmacyId, dateStr);

        // Previous-year comparable day
        const currentYear = today.getFullYear();
        const shouldFetchPreviousYear = currentYear > 2024;
        const previousYearDate = shouldFetchPreviousYear ? getPreviousYearSameDayOfWeek(today) : null;
        const previousYearDateStr = previousYearDate ? formatDateLocal(previousYearDate) : null;

        let previousYearData: any = null;
        if (previousYearDateStr) {
          try {
            previousYearData = await newPharmacyAPI.getDailyTurnover(pharmacyId, previousYearDateStr);
          } catch {
            previousYearData = null;
          }
        }

        const computedAlerts: Array<{ title: string; description: string; severity: 'positive' | 'warning' | 'critical' }> = [];

        // Basic rules aligned with DailyScreen.getAlerts
        if (previousYearData && dailyData?.turnover > 0 && previousYearData?.turnover > 0) {
          const diff = Number(dailyData.turnover) - Number(previousYearData.turnover);
          const pct = (Math.abs(diff) / Number(previousYearData.turnover)) * 100;
          if (diff < 0 && pct > 7) {
            computedAlerts.push({
              severity: 'warning',
              title: 'YoY Turnover Down',
              description: `Down ${pct.toFixed(1)}% vs last year`,
            });
          } else if (diff > 0 && pct > 8) {
            computedAlerts.push({
              severity: 'positive',
              title: 'Strong YoY Performance',
              description: `Up ${pct.toFixed(1)}% vs last year`,
            });
          }
        }

        // GP% Alerts
        const gpPercent = Number(dailyData?.grossProfitPercent || dailyData?.gp_pct || 0);
        if (dailyData?.turnover > 0) {
          if (gpPercent <= 20) {
            computedAlerts.push({
              severity: 'critical',
              title: 'Critical GP Drop',
              description: `GP at ${gpPercent.toFixed(1)}% - Urgent attention needed`,
            });
          } else if (gpPercent < 25) {
            computedAlerts.push({
              severity: 'warning',
              title: 'Low GP%',
              description: `GP at ${gpPercent.toFixed(1)}% - Below 25% target`,
            });
          } else if (gpPercent > 30) {
            computedAlerts.push({
              severity: 'positive',
              title: 'Great Margin',
              description: `Strong GP at ${gpPercent.toFixed(1)}%`,
            });
          }
        }

        // Dispensary % Alerts
        if (Number(dailyData?.turnover || 0) > 0) {
          const dispensaryTurnover = Number(dailyData?.dispensary_turnover || 0);
          const totalTurnover = Number(dailyData?.turnover || 0);
          const dispensaryPercent = totalTurnover > 0 ? (dispensaryTurnover / totalTurnover) * 100 : null;
          if (dispensaryPercent != null) {
            if (dispensaryPercent > 60) {
              computedAlerts.push({
                severity: 'warning',
                title: 'High Dispensary %',
                description: `Dispensary at ${dispensaryPercent.toFixed(1)}% - Front shop underperforming`,
              });
            } else if (dispensaryPercent < 40) {
              computedAlerts.push({
                severity: 'warning',
                title: 'Low Dispensary %',
                description: `Dispensary at ${dispensaryPercent.toFixed(1)}% - Possible drop in script volumes`,
              });
            }
          }
        }

        setAlerts(computedAlerts);
      } catch (e) {
        setError('Failed to load operational alerts.');
      } finally {
        setLoading(false);
      }
    };

    fetchOperationalAlerts();
  }, [pharmacyCode]);

  const close = () => (navigation as any).goBack();

  const getSeverityColor = (s: 'positive' | 'warning' | 'critical') => {
    if (s === 'positive') return colors.statusSuccess;
    if (s === 'warning') return colors.statusWarning;
    return colors.statusError;
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <Text style={styles.title}>Operational Alerts - {pharmacyName}</Text>
        {loading ? (
          <ActivityIndicator color={colors.accentPrimary} />
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : alerts.length === 0 ? (
          <Text style={styles.errorText}>No operational alerts for today.</Text>
        ) : (
          <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ gap: 10 }}>
            {alerts.map((a, idx) => (
              <View key={idx} style={styles.alertRow}>
                <View style={[styles.alertIcon, { backgroundColor: getSeverityColor(a.severity) }]}>
                  {a.severity === 'positive' ? (
                    <CheckCircle size={14} color={colors.bgGradientFrom} />
                  ) : (
                    <AlertTriangle size={14} color={colors.bgGradientFrom} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.alertTitle, { color: getSeverityColor(a.severity) }]}>{a.title}</Text>
                  <Text style={styles.alertDesc}>{a.description}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
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
  alertRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  alertIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  alertDesc: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 8,
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

export default OperationalAlertsModal; 