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
import { ChevronLeft, DollarSign, TrendingUp, ShoppingCart, Package } from 'lucide-react-native';
import { newPharmacyAPI } from '../../services/api';
import { getPharmacyByCode } from '../../config/api';

const { width } = Dimensions.get('window');

const useColors = () => useTheme().colors;

interface HistoryItem {
  date: string;
  value: number;
  formattedValue: string;
}

const MonthlyHistoryScreen = () => {
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

  // Fetch history data for the last 12 months
  const fetchHistoryData = async () => {
    if (!selectedPharmacy) return;

    setLoading(true);
    setError(null);

    try {
      const pharmacy = getPharmacyByCode(selectedPharmacy);
      if (!pharmacy) throw new Error('Invalid pharmacy selected');

      const ymd = (y: number, mZeroBased: number, d: number) => `${y}-${String(mZeroBased + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

      // Special handling for Turnover and GP: top = current MTD (through selectedDate),
      // then 12 months of complete months (through last day of each month)
      if (['Turnover', 'G Profit', 'Cost of Sales', 'Purchases'].includes(selectedFilter)) {
        // Current month MTD
        const currentMonthKey = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}`;
        const currentThrough = ymd(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
        const currentFirstOfMonth = ymd(selectedDate.getFullYear(), selectedDate.getMonth(), 1);

        const currentMTD = await newPharmacyAPI.getMTD(pharmacy.id, currentMonthKey, currentThrough);
        let currentItem: HistoryItem;
        if (selectedFilter === 'Turnover') {
          currentItem = {
            date: currentFirstOfMonth,
            value: Number(currentMTD?.turnover) || 0,
            formattedValue: formatCurrency(Number(currentMTD?.turnover) || 0),
          };
        } else if (selectedFilter === 'G Profit') {
          const turnover = Number(currentMTD?.turnover) || 0;
          const gpValue = Number(currentMTD?.gp_value) || 0;
          const typeRSales = Number(currentMTD?.type_r_sales) || 0;
          const denom = Math.max(0, turnover - typeRSales);
          const gpPct = denom > 0 ? (gpValue / denom) * 100 : 0;
          currentItem = {
            date: currentFirstOfMonth,
            value: gpPct,
            formattedValue: formatPercentage(gpPct),
          };
        } else if (selectedFilter === 'Cost of Sales') {
          currentItem = {
            date: currentFirstOfMonth,
            value: Number(currentMTD?.cost_of_sales) || 0,
            formattedValue: formatCurrency(Number(currentMTD?.cost_of_sales) || 0),
          };
        } else { // Purchases
          currentItem = {
            date: currentFirstOfMonth,
            value: Number(currentMTD?.purchases) || 0,
            formattedValue: formatCurrency(Number(currentMTD?.purchases) || 0),
          };
        }

        // Previous 12 full months
        const prevMonths: { key: string; through: string; displayDate: string }[] = [];
        for (let i = 1; i <= 12; i++) {
          const d = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
          d.setMonth(d.getMonth() - i);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);
          const through = ymd(endOfMonth.getFullYear(), endOfMonth.getMonth(), endOfMonth.getDate());
          const firstOfMonth = ymd(d.getFullYear(), d.getMonth(), 1);
          prevMonths.push({ key, through, displayDate: firstOfMonth });
        }
        const prevResults = await Promise.all(
          prevMonths.map((m) => newPharmacyAPI.getMTD(pharmacy.id, m.key, m.through))
        );
        const prevItems: HistoryItem[] = prevResults.map((mtd, idx) => {
          const date = prevMonths[idx].displayDate;
          if (selectedFilter === 'Turnover') {
            const val = Number(mtd?.turnover) || 0;
            return { date, value: val, formattedValue: formatCurrency(val) };
          } else if (selectedFilter === 'G Profit') {
            const turnover = Number(mtd?.turnover) || 0;
            const gpValue = Number(mtd?.gp_value) || 0;
            const typeRSales = Number(mtd?.type_r_sales) || 0;
            const denom = Math.max(0, turnover - typeRSales);
            const gpPct = denom > 0 ? (gpValue / denom) * 100 : 0;
            return { date, value: gpPct, formattedValue: formatPercentage(gpPct) };
          } else if (selectedFilter === 'Cost of Sales') {
            const val = Number(mtd?.cost_of_sales) || 0;
            return { date, value: val, formattedValue: formatCurrency(val) };
          } else { // Purchases
            const val = Number(mtd?.purchases) || 0;
            return { date, value: val, formattedValue: formatCurrency(val) };
          }
        });

        // Combine with current MTD on top; then sort remaining by date desc
        prevItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const combined = [currentItem, ...prevItems];

        // Filter out zero months except keep current item regardless
        const filtered = ['G Profit', 'Cost of Sales', 'Purchases'].includes(selectedFilter)
          ? combined // keep GP% even if 0
          : [combined[0], ...combined.slice(1).filter((it) => it.value > 0)];
        setHistoryData(filtered);
        return;
      }

      // Default handling (G Profit, Cost of Sales, Purchases) using MTD per month
      // Build list of last 12 month keys with appropriate through dates
      const months: { key: string; through: string; displayDate: string }[] = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(selectedDate);
        d.setMonth(d.getMonth() - i);
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        // Through: end of that month, except for current month use selectedDate
        const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        const isCurrentMonth = d.getFullYear() === selectedDate.getFullYear() && d.getMonth() === selectedDate.getMonth();
        const through = isCurrentMonth ? selectedDate.toISOString().split('T')[0] : ymd(endOfMonth.getFullYear(), endOfMonth.getMonth(), endOfMonth.getDate());
        // Use first day of month as the date to display/order
        const firstOfMonth = ymd(d.getFullYear(), d.getMonth(), 1);
        months.push({ key: monthKey, through, displayDate: firstOfMonth });
      }

      // Fetch all months' MTD aggregates
      const results = await Promise.all(
        months.map((m) => newPharmacyAPI.getMTD(pharmacy.id, m.key, m.through))
      );

      const transformed: HistoryItem[] = results.map((mtd, idx) => {
        const date = months[idx].displayDate;
        let value = 0;
        let formattedValue = '';

        const turnover = Number(mtd?.turnover) || 0;
        const gpValue = Number(mtd?.gp_value) || 0;
        const typeRSales = Number(mtd?.type_r_sales) || 0;
        const denom = Math.max(0, turnover - typeRSales);

        switch (selectedFilter) {
          case 'G Profit':
            value = denom > 0 ? (gpValue / denom) * 100 : 0;
            formattedValue = formatPercentage(value);
            break;
          case 'Cost of Sales':
            value = Number(mtd?.cost_of_sales) || 0;
            formattedValue = formatCurrency(value);
            break;
          case 'Purchases':
            value = Number(mtd?.purchases) || 0;
            formattedValue = formatCurrency(value);
            break;
          default:
            value = 0;
            formattedValue = formatCurrency(0);
        }
        return { date, value, formattedValue };
      });

      // Remove zero-value currency months (keep GP% even if 0%)
      const filtered = transformed.filter((it) => (selectedFilter === 'G Profit' ? true : it.value > 0));

      // Sort by date (newest first)
      filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setHistoryData(filtered);
    } catch (err: any) {
      console.error('Error fetching monthly history data:', err);
      setError('Failed to load monthly history data');
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
      month: 'long',
      year: 'numeric',
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
              <Text style={styles.backButtonText}>Monthly Summary</Text>
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
        {/* Monthly History Section */}
        <View style={styles.historySection}>
          <Text style={styles.historyTitle}>Monthly History</Text>
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
        </ScrollView>
        
        {/* Loading State */}
        {loading && !refreshing && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accentPrimary} />
            <Text style={styles.loadingText}>Loading monthly history data...</Text>
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
            <Text style={styles.emptyText}>No {selectedFilter.toLowerCase()} data available for the last 12 months</Text>
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

export default MonthlyHistoryScreen; 