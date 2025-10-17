import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';

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

interface LowGPAlertModalProps {
  route: {
    params: {
      pharmacyCode: string;
      pharmacyName: string;
      lowGPItems: Array<{
        description?: string;
        name?: string;
        gp_pct?: number;
        product_code?: string;
        stock_code?: string;
        stockCode?: string;
        code?: string;
        sku?: string;
      }>;
      threshold: number;
    };
  };
}

const LowGPAlertModal: React.FC<LowGPAlertModalProps> = ({ route }) => {
  const navigation = useNavigation();
  const { pharmacyCode, pharmacyName, lowGPItems, threshold } = route.params || { 
    pharmacyCode: '', 
    pharmacyName: 'Pharmacy', 
    lowGPItems: [], 
    threshold: 0 
  };

  const close = () => (navigation as any).goBack();
  const openApp = () => (navigation as any).navigate('Dashboard');

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <Text style={styles.title}>Low GP Alert - {pharmacyName}</Text>
        <Text style={styles.subtitle}>
          {lowGPItems.length} items below {threshold}% GP threshold
        </Text>
        
        <ScrollView style={styles.itemsContainer} showsVerticalScrollIndicator={false}>
          {lowGPItems.map((item, index) => (
            <View key={index} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemName} numberOfLines={2}>
                  {item.description || item.name || 'Unknown Product'}
                </Text>
                <Text style={styles.itemCode}>
                  {item.product_code || item.stock_code || item.stockCode || item.code || item.sku || 'N/A'}
                </Text>
              </View>
              <View style={styles.itemStats}>
                <Text style={styles.gpLabel}>GP Percentage:</Text>
                <Text style={[styles.gpValue, { color: colors.statusError }]}>
                  {item.gp_pct !== undefined && item.gp_pct !== null 
                    ? `${item.gp_pct.toFixed(1)}%` 
                    : '--'
                  }
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
        
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
    maxHeight: '80%',
    backgroundColor: colors.surfacePrimary,
    borderRadius: 16,
    padding: 20,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  itemsContainer: {
    maxHeight: 300,
    marginBottom: 16,
  },
  itemCard: {
    backgroundColor: colors.bgGradientFrom,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  itemHeader: {
    marginBottom: 8,
  },
  itemName: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  itemCode: {
    color: colors.textSecondary,
    fontSize: 12,
    fontFamily: 'monospace',
  },
  itemStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gpLabel: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  gpValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
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

export default LowGPAlertModal; 