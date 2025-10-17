import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, SafeAreaView, Animated, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../contexts/ThemeContext';
import { Bell, TrendingUp, AlertTriangle, RefreshCw, Trash2, X, ChevronLeft } from 'lucide-react-native';
import { useNotifications, InAppNotification } from '../../contexts/NotificationsContext';

const { width: screenWidth } = Dimensions.get('window');

// theme hook

const NotificationsTabScreen = () => {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const { notifications, markAsReadAndRemove, checkMissedNotifications, clearAll } = useNotifications();

  // Store measured heights per item to drive collapse animation without hooks inside renderItem
  const itemHeightsRef = React.useRef<Record<string, number>>({});

  const handleRefresh = async () => {
    try {
      await checkMissedNotifications();
    } catch (error) {
      console.warn('Failed to refresh notifications:', error);
    }
  };

  // Animation for delete confirmation (no flash)
  const createDeleteAnimation = () => {
    const slideAnim = new Animated.Value(1); // For slide out animation
    const collapseAnim = new Animated.Value(1); // 1 = full height, 0 = collapsed
    const opacityAnim = new Animated.Value(1); // For fade out
    
    const triggerDelete = (callback: () => void) => {
      // Slide out, fade out, and collapse height simultaneously
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: false,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: false,
        }),
        Animated.timing(collapseAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: false,
        }),
      ]).start(() => {
        callback();
      });
    };

    return { slideAnim, collapseAnim, opacityAnim, triggerDelete };
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
      const lowGPItems = (item?.data?.lowGPItems 
        ?? item?.data?.lowGpItems 
        ?? item?.data?.low_gp_items 
        ?? item?.data?.items 
        ?? item?.data?.products 
        ?? []) as any[];
      const threshold = Number(item?.data?.threshold ?? item?.data?.gpThreshold ?? 0);
      navigation.navigate('LowGPAlertModal', { pharmacyCode: code, pharmacyName: name, lowGPItems, threshold });
    } else if (type === 'OPERATIONAL_ALERT') {
      const code = String(item?.data?.pharmacyCode || '');
      const name = String(item?.data?.pharmacyName || 'Pharmacy');
      navigation.navigate('OperationalAlertsModal', { pharmacyCode: code, pharmacyName: name });
    } else if (type === 'BROADCAST' || type === 'PROMOTION' || type === 'SYSTEM_UPDATE' || type === 'MAINTENANCE' || type === 'TEST') {
      const category = item?.data?.category || type.toLowerCase();
      navigation.navigate('BroadcastModal', { 
        title: item.title, 
        body: item.body, 
        category: category,
        data: item.data 
      });
    }
    markAsReadAndRemove(item.id);
  };

  const getSeverityColors = (type: string) => {
    // Align with DailyScreen opaque card styles
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
    } else if (type === 'OPERATIONAL_ALERT') {
      return {
        background: colors.accentPrimary + '20',
        iconBg: colors.accentPrimary,
        text: colors.accentPrimary,
      };
    } else if (type === 'BROADCAST' || type === 'PROMOTION' || type === 'TEST') {
      // Use brand purple for broadcasts/promotions/test notifications
      return {
        background: colors.brandPurple + '20',
        iconBg: colors.brandPurple,
        text: colors.brandPurple,
      };
    } else if (type === 'SYSTEM_UPDATE' || type === 'MAINTENANCE') {
      return {
        background: colors.statusError + '20',
        iconBg: colors.statusError,
        text: colors.statusError,
      };
    }
    // Default to BROADCAST (purple) instead of grey for any unknown notification types
    return {
      background: colors.brandPurple + '20',
      iconBg: colors.brandPurple,
      text: colors.brandPurple,
    };
  };

  const normalizeType = (item: InAppNotification): string => {
    const type = item?.data?.type as string | undefined;
    if (type) {
      if (type === 'TEST') return 'BROADCAST';
      if (type === 'OPERATIONAL_ALERT') return 'OPERATIONAL_ALERT';
      return type;
    }
    
    const titleLower = (item?.title || '').toLowerCase();
    const bodyLower = (item?.body || '').toLowerCase();
    const combined = `${titleLower} ${bodyLower}`;
    
    if (combined.includes('low gp') || combined.includes('gp alert')) return 'LOW_GP_ALERT';
    if (combined.includes('daily summary')) return 'DAILY_SUMMARY';
    if (combined.includes('operational') || combined.includes('insight') || combined.includes('alert:')) return 'OPERATIONAL_ALERT';
    if (combined.includes('maintenance') || combined.includes('system')) return 'MAINTENANCE';
    if (combined.includes('promotion') || combined.includes('promo') || combined.includes('update')) return 'PROMOTION';
    
    return 'BROADCAST';
  };

  const getIcon = (type: string) => {
    if (type === 'DAILY_SUMMARY') {
      return TrendingUp;
    } else if (type === 'LOW_GP_ALERT') {
      return AlertTriangle;
    } else if (type === 'OPERATIONAL_ALERT') {
      return AlertTriangle;
    } else if (type === 'BROADCAST' || type === 'PROMOTION' || type === 'SYSTEM_UPDATE' || type === 'MAINTENANCE') {
      return Bell;
    }
    return Bell;
  };

  const renderItem = ({ item }: { item: InAppNotification }) => {
    const normalizedType = normalizeType(item);
    const severityColors = getSeverityColors(normalizedType);
    const IconComponent = getIcon(normalizedType);
    const { slideAnim, collapseAnim, opacityAnim, triggerDelete } = createDeleteAnimation();

    const measuredHeight = itemHeightsRef.current[item.id] || 0;
    const onItemLayout = (e: any) => {
      const h = e?.nativeEvent?.layout?.height;
      if (typeof h === 'number' && h > 0) {
        itemHeightsRef.current[item.id] = h;
      }
    };
    
    return (
      <Animated.View 
        style={[
          styles.itemContainer,
          {
            opacity: opacityAnim,
            transform: [{ 
              translateX: slideAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [200, 0],
              })
            }],
            height: collapseAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, measuredHeight || 80],
            }),
            overflow: 'hidden',
          }
        ]}
      >
        <View style={styles.alertCardContainer} onLayout={onItemLayout}>
          
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
              
              {/* Delete X button */}
              <TouchableOpacity 
                style={styles.deleteButton}
                onPress={(e) => {
                  e.stopPropagation();
                  triggerDelete(() => {
                    markAsReadAndRemove(item.id);
                  });
                }}
                activeOpacity={0.7}
              >
                <View style={styles.deleteButtonCircle}>
                  <X size={16} color={colors.textPrimary} strokeWidth={2.5} />
                </View>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

  if (notifications.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.backRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <ChevronLeft size={22} color={colors.accentPrimary} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        </View>
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

  const styles = getStyles(colors);
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.backRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ChevronLeft size={22} color={colors.accentPrimary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Alerts</Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
              <RefreshCw size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={clearAll} style={styles.clearAllButton}>
              <Trash2 size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
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

const getStyles = (colors: any) => StyleSheet.create({
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
  backRow: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 4,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backText: {
    color: colors.accentPrimary,
    fontSize: 20,
    fontWeight: '700',
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
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  refreshButton: {
    padding: 8,
  },
  clearAllButton: {
    padding: 8,
    marginLeft: 8,
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
    padding: 12,
    paddingTop: 2,
  },
  alertCardContainer: {
    position: 'relative',
  },
  alertCard: {
    borderRadius: 12,
    padding: 8,
    marginBottom: 4,
  },
  alertContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
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
  deleteButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.statusError,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  deleteButtonCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfacePrimary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemContainer: {
    position: 'relative',
  },
  flashOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
    pointerEvents: 'none',
  },
});

export default NotificationsTabScreen; 