import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Bell, TrendingUp, AlertTriangle, RefreshCw } from 'lucide-react-native';
import { useNotifications, InAppNotification } from '../../contexts/NotificationsContext';

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
  
  // Status colors (match dashboard)
  statusSuccess: '#10B981',
  statusWarning: '#F59E0B',
  statusError: '#EF4444',
  
  // Border
  border: '#374151',
};

const NotificationsTabScreen = () => {
  const navigation = useNavigation<any>();
  const { notifications, markAsReadAndRemove, checkMissedNotifications } = useNotifications();

  const handleRefresh = async () => {
    try {
      await checkMissedNotifications();
    } catch (error) {
      console.warn('Failed to refresh notifications:', error);
    }
  };

  const handlePress = (item: InAppNotification) => {
    const type = item?.data?.type;
    if (type === 'DAILY_SUMMARY') {
      const code = String(item?.data?.pharmacyCode || '');
      const name = String(item?.data?.pharmacyName || 'Pharmacy');
      navigation.navigate('DailySummaryModal', { pharmacyCode: code, pharmacyName: name });
    } else if (type === 'LOW_GP_ALERT') {
      const code = String(item?.data?.pharmacyCode || '');
      const name = String(item?.data?.pharmacyName || 'Pharmacy');
      const lowGPItems = item?.data?.lowGPItems || [];
      const threshold = Number(item?.data?.threshold || 0);
      navigation.navigate('LowGPAlertModal', { pharmacyCode: code, pharmacyName: name, lowGPItems, threshold });
    }
    markAsReadAndRemove(item.id);
  };

  const getSeverityColors = (type: string) => {
    if (type === 'DAILY_SUMMARY') {
      return {
        background: colors.statusSuccess + '20',
        iconBg: colors.statusSuccess,
        text: colors.statusSuccess,
      };
    } else if (type === 'LOW_GP_ALERT') {
      return {
        background: colors.statusWarning + '20',
        iconBg: colors.statusWarning,
        text: colors.statusWarning,
      };
    }
    return {
      background: colors.surfaceSecondary,
      iconBg: colors.textSecondary,
      text: colors.textSecondary,
    };
  };

  const getIcon = (type: string) => {
    if (type === 'DAILY_SUMMARY') {
      return TrendingUp;
    } else if (type === 'LOW_GP_ALERT') {
      return AlertTriangle;
    }
    return Bell;
  };

  const renderItem = ({ item }: { item: InAppNotification }) => {
    const severityColors = getSeverityColors(item?.data?.type);
    const IconComponent = getIcon(item?.data?.type);
    
    return (
      <TouchableOpacity 
        style={[styles.alertCard, { backgroundColor: severityColors.background }]} 
        onPress={() => handlePress(item)}
        activeOpacity={0.8}
      >
        <View style={styles.alertContent}>
          <View style={[styles.alertIcon, { backgroundColor: severityColors.iconBg }]}>
            <IconComponent size={16} color={colors.surfaceSecondary} />
          </View>
          <View style={styles.alertText}>
            <Text style={[styles.alertTitle, { color: severityColors.text }]}>
              {item.title}
            </Text>
            <Text style={styles.alertDescription}>
              {item.body}
            </Text>
            <Text style={styles.alertTimestamp}>
              {new Date(item.createdAt).toLocaleString()}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (notifications.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <Bell size={48} color={colors.textSecondary} />
          </View>
          <Text style={styles.emptyTitle}>No unseen alerts</Text>
          <Text style={styles.emptySubtitle}>When you receive notifications, they'll appear here</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Alerts</Text>
          <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
            <RefreshCw size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <Text style={styles.headerSubtitle}>{notifications.length} unseen notification{notifications.length !== 1 ? 's' : ''}</Text>
      </View>
      
      <FlatList
        data={notifications}
        keyExtractor={(n) => n.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshing={false}
        onRefresh={handleRefresh}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgGradientFrom,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  refreshButton: {
    padding: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surfacePrimary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  list: {
    padding: 16,
    paddingTop: 8,
  },
  alertCard: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  alertContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  alertIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  alertText: {
    flex: 1,
    minWidth: 0,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  alertDescription: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
    marginBottom: 6,
  },
  alertTimestamp: {
    fontSize: 11,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
});

export default NotificationsTabScreen; 