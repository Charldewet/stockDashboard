import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { ChevronLeft, DollarSign, TrendingUp, ShoppingCart, ShoppingBasket, Package } from 'lucide-react-native';
import { newPharmacyAPI } from '../../services/api';
import { getPharmacyByCode } from '../../config/api';

const { width } = Dimensions.get('window');

// theme hook
const useColors = () => useTheme().colors;

interface HistoryItem {
  date: string;
  value: number;
  formattedValue: string;
}

const DailyHistoryScreen = () => {
  const navigation = useNavigation();
  const { selectedPharmacy, pharmacies, setSelectedPharmacy, logout, selectedDate } = useAuth();
  const { colors } = useTheme();
  
  // Selector states
  const [selectedFilter, setSelectedFilter] = useState('Turnover');

  // Data states
  const [historyData, setHistoryData] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get icon for selected filter
  const getFilterIcon = () => {
    switch (selectedFilter) {
      case 'Turnover':
        return <DollarSign size={20} color={colors.textPrimary} />;
      case 'G Profit':
        return <TrendingUp size={20} color={colors.textPrimary} />;
      case 'Cost of Sales':
        return <ShoppingCart size={20} color={colors.textPrimary} />;
      case 'Purchases':
        return <Package size={20} color={colors.textPrimary} />;
      case 'Basket':
        return <ShoppingBasket size={20} color={colors.textPrimary} />;
      default:
        return <DollarSign size={20} color={colors.textPrimary} />;
    }
  };

  // Format currency value
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Format percentage value
  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  // Remove mock generator; we'll fetch from API

  // Fetch history data for the last 30 days
  const fetchHistoryData = async () => {
    if (!selectedPharmacy) return;

    setLoading(true);
    setError(null);

    try {
      const endDate = new Date(selectedDate);
      const startDate = new Date(selectedDate);
      startDate.setDate(endDate.getDate() - 29);

      const pharmacy = getPharmacyByCode(selectedPharmacy);
      if (!pharmacy) throw new Error('Invalid pharmacy selected');

      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      const rangeData = await newPharmacyAPI.getDailySales(pharmacy.id, startDateStr, endDateStr);
      const dailyArray = Array.isArray(rangeData) ? rangeData : [];

      const transformed: HistoryItem[] = dailyArray.map((item: any) => {
        const date = item.business_date;
        let value = 0;
        let formattedValue = '';
        switch (selectedFilter) {
          case 'Turnover':
            value = Number(item.turnover) || 0;
            formattedValue = formatCurrency(value);
            break;
          case 'G Profit':
            const gpTurnover = Number(item.turnover) || 0;
            const gpValue = Number(item.gp_value) || 0;
            const gpTypeRSales = Number(item.type_r_sales) || 0;
            const gpDenom = Math.max(0, gpTurnover - gpTypeRSales);
            value = gpDenom > 0 ? (gpValue / gpDenom) * 100 : 0;
            formattedValue = formatPercentage(value);
            break;
          case 'Cost of Sales':
            value = Number(item.cost_of_sales) || 0;
            formattedValue = formatCurrency(value);
            break;
          case 'Purchases':
            value = Number(item.purchases) || 0;
            formattedValue = formatCurrency(value);
            break;
          case 'Basket':
            const basketTurnover = Number(item.turnover) || 0;
            const basketTypeRSales = Number(item.type_r_sales) || 0;
            const transactionCount = Number(item.transaction_count) || 0;
            const basketDenom = Math.max(0, basketTurnover - basketTypeRSales);
            value = transactionCount > 0 ? basketDenom / transactionCount : 0;
            formattedValue = formatCurrency(value);
            break;
          default:
            value = 0;
            formattedValue = formatCurrency(0);
        }
        return { date, value, formattedValue };
      });

      // Remove zero-value currency days (keep GP% even if 0%)
      const filtered = transformed.filter((it) => (selectedFilter === 'G Profit' ? true : it.value > 0));

      // Sort by date (newest first)
      filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setHistoryData(filtered);
    } catch (err: any) {
      console.error('Error fetching daily history data:', err);
      setError('Failed to load daily history data');
    } finally {
      setLoading(false);
    }
  };

  // Handle filter change
  const handleFilterChange = (filter: string) => {
    setSelectedFilter(filter);
  };

  // Handle refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchHistoryData();
    setRefreshing(false);
  };

  // Fetch data when component mounts or filter changes
  useEffect(() => {
    fetchHistoryData();
  }, [selectedFilter, selectedPharmacy, selectedDate]);

  // Hide tab bar when screen is focused, show when unfocused
  useFocusEffect(
    React.useCallback(() => {
      // Hide tab bar
      navigation.getParent()?.setOptions({
        tabBarStyle: { display: 'none' }
      });

      // Show tab bar when screen loses focus
      return () => {
        navigation.getParent()?.setOptions({
          tabBarStyle: {
            backgroundColor: colors.surfacePrimary,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            paddingBottom: 2,
            paddingTop: 2,
            height: 80,
          }
        });
      };
    }, [navigation])
  );

  const getCurrentPharmacyName = () => {
    const pharmacy = pharmacies.find(p => p.code === selectedPharmacy);
    return pharmacy ? pharmacy.name : selectedPharmacy;
  };

  // Format date for display
  const formatDisplayDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: '2-digit',
    });
  };

  const styles = getStyles(colors);
  return (
    <View style={styles.container}>
      {/* Sticky Header */}
      <View style={styles.stickyHeader}>
        {/* Main Header Row */}
        <View style={styles.mainHeaderRow}>
          {/* Left side: Back Button */}
          <View style={styles.headerLeft}>
            <TouchableOpacity 
              style={styles.backButton} 
              onPress={() => navigation.goBack()}
            >
              <ChevronLeft size={20} color={colors.accentPrimary} />
              <Text style={styles.backButtonText}>Daily Summary</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Scrollable Content */}
      <ScrollView
        style={styles.scrollContent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            tintColor={colors.textPrimary}
            colors={[colors.accentPrimary]}
          />
        }
      >
        {/* Daily History Section */}
        <View style={styles.historySection}>
          <Text style={styles.historyTitle}>Daily History</Text>
        </View>
        
        {/* Filter Buttons */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.filterScrollView}
          contentContainerStyle={styles.filterContainer}
        >
          <TouchableOpacity 
            style={[
              styles.filterButton,
              selectedFilter === 'Turnover' && styles.filterButtonSelected
            ]}
            onPress={() => handleFilterChange('Turnover')}
          >
            <Text style={[
              styles.filterButtonText,
              selectedFilter === 'Turnover' && styles.filterButtonTextSelected
            ]}>
              Turnover
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.filterButton,
              selectedFilter === 'G Profit' && styles.filterButtonSelected
            ]}
            onPress={() => handleFilterChange('G Profit')}
          >
            <Text style={[
              styles.filterButtonText,
              selectedFilter === 'G Profit' && styles.filterButtonTextSelected
            ]}>
              GP
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.filterButton,
              selectedFilter === 'Cost of Sales' && styles.filterButtonSelected
            ]}
            onPress={() => handleFilterChange('Cost of Sales')}
          >
            <Text style={[
              styles.filterButtonText,
              selectedFilter === 'Cost of Sales' && styles.filterButtonTextSelected
            ]}>
              Cost of Sales
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.filterButton,
              selectedFilter === 'Purchases' && styles.filterButtonSelected
            ]}
            onPress={() => handleFilterChange('Purchases')}
          >
            <Text style={[
              styles.filterButtonText,
              selectedFilter === 'Purchases' && styles.filterButtonTextSelected
            ]}>
              Purchases
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.filterButton,
              selectedFilter === 'Basket' && styles.filterButtonSelected
            ]}
            onPress={() => handleFilterChange('Basket')}
          >
            <Text style={[
              styles.filterButtonText,
              selectedFilter === 'Basket' && styles.filterButtonTextSelected
            ]}>
              Basket
            </Text>
          </TouchableOpacity>
        </ScrollView>
        
        {/* Loading State */}
        {loading && !refreshing && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accentPrimary} />
            <Text style={styles.loadingText}>Loading history data...</Text>
          </View>
        )}

        {/* Error State */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchHistoryData}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* History List */}
        {!loading && !error && historyData.length > 0 && (
          <View style={styles.historyListContainer}>
            {historyData.map((item, index) => (
              <View key={index} style={styles.historyItem}>
                <View style={styles.historyItemLeft}>
                  {getFilterIcon()}
                  <View style={styles.historyItemContent}>
                    <Text style={styles.historyItemTitle}>
                      {selectedFilter === 'G Profit' ? 'Gross Profit' : selectedFilter}
                    </Text>
                    <Text style={styles.historyItemDate}>{formatDisplayDate(item.date)}</Text>
                  </View>
                </View>
                <View style={styles.historyItemRight}>
                  <Text style={styles.historyItemValue}>{item.formattedValue}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Empty State */}
        {!loading && !error && historyData.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No {selectedFilter.toLowerCase()} data available for the last 30 days</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
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
  // History section styles
  historySection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  historyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  // Filter buttons styles
  filterScrollView: {
    marginBottom: 16,
  },
  filterContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterButton: {
    backgroundColor: colors.surfacePrimary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 0,
  },
  filterButtonSelected: {
    backgroundColor: colors.costSales,
  },
  filterButtonText: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  filterButtonTextSelected: {
    color: colors.bgGradientFrom,
    fontWeight: '600',
  },
  // Loading styles
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 16,
  },
  // Error styles
  errorContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 16,
    color: colors.statusError,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: colors.accentPrimary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  // History list styles
  historyListContainer: {
    paddingHorizontal: 16,
  },
  historyItem: {
    backgroundColor: colors.surfacePrimary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  historyItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  historyItemContent: {
    marginLeft: 12,
    flex: 1,
  },
  historyItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  historyItemDate: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  historyItemRight: {
    alignItems: 'flex-end',
  },
  historyItemValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.costSales,
  },
  // Empty state styles
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },

});

export default DailyHistoryScreen; 