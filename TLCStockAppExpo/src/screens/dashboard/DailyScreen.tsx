import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
  Modal,
  FlatList,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { AuthNavigationProp } from '../../types/navigation';
import LineChart, { LineChartDataPoint } from '../../components/common/LineChart';
import SimpleLineChart from '../../components/common/SimpleLineChart';
import ErrorAlert from '../../components/common/ErrorAlert';
import { useAuth } from '../../contexts/AuthContext';
import { newPharmacyAPI } from '../../services/api';
import { getPharmacyByCode } from '../../config/api';
import { formatDateLocal, getYesterday, getPreviousYearSameDayOfWeek, formatDateDisplay } from '../../utils/dateUtils';
import { formatCurrency, formatPercentage, calculatePercentageChange } from '../../utils/formatUtils';
import { TrendingUp, TrendingDown, AlertCircle, ChevronDown, Calendar, CheckCircle, AlertTriangle, Menu, LogOut, User, Bell, Shield, Settings, DollarSign, ShoppingCart, ShoppingBasket, BarChart3, ChevronRight } from 'lucide-react-native';
import CustomDatePicker from '../../components/common/CustomDatePicker';
import DateScroller from '../../components/common/DateScroller';

const { width } = Dimensions.get('window');

interface DailyData {
  turnover: number;
  grossProfit: number;
  grossProfitPercent: number;
  basketValue: number;
  basketItems: number;
  transactionCount: number;
  scriptsDispensed: number;
  cashSales: number;
  accountSales: number;
  costOfSales: number;
  purchases: number;
  dispensaryPercent: number;
  dispensaryTurnover: number;
  // Added fields populated from KPIs summary when available
  avgScriptValue?: number;
  codSales?: number;
}

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

// Add getAlerts function before the component
const getAlerts = (data: DailyData, previousYearData: DailyData | null) => {
  const alerts: Array<{
    severity: 'positive' | 'warning' | 'critical';
    icon: React.ComponentType<any>;
    title: string;
    description: string;
  }> = [];
  
  // Helper to calculate average from array
  const getAverage = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

  // 1. Turnover Alerts - only show if we have meaningful turnover data
  if (previousYearData && data.turnover > 0 && previousYearData.turnover > 0) {
    if (data.turnover < previousYearData.turnover) {
      const diff = previousYearData.turnover - data.turnover;
      const percentDiff = (diff / previousYearData.turnover) * 100;
      
      // Only trigger alert if difference is more than 8%
      if (percentDiff > 7) {
        alerts.push({
          severity: 'warning',
          icon: AlertTriangle,
          title: 'YoY Turnover Down',
          description: `Down ${percentDiff.toFixed(1)}% (${formatCurrency(diff)}) vs last year`
        });
      }
    } else if (data.turnover > previousYearData.turnover) {
      const diff = data.turnover - previousYearData.turnover;
      const percentDiff = (diff / previousYearData.turnover) * 100;
      
      // Only trigger alert if difference is more than 8%
      if (percentDiff > 8) {
        alerts.push({
          severity: 'positive',
          icon: CheckCircle,
          title: 'Strong YoY Performance',
          description: `Up ${percentDiff.toFixed(1)}% (${formatCurrency(diff)}) vs last year`
        });
      }
    }
  }

  // 2. GP% Alerts - only show if we have meaningful turnover data
  if (data.turnover > 0) {
    if (data.grossProfitPercent <= 20) {
      alerts.push({
        severity: 'critical',
        icon: AlertCircle,
        title: 'Critical GP Drop',
        description: `GP at ${data.grossProfitPercent.toFixed(1)}% - Urgent attention needed`
      });
    } else if (data.grossProfitPercent < 25) {
      alerts.push({
        severity: 'warning',
        icon: AlertTriangle,
        title: 'Low GP%',
        description: `GP at ${data.grossProfitPercent.toFixed(1)}% - Below 25% target`
      });
    } else if (data.grossProfitPercent > 30) {
      alerts.push({
        severity: 'positive',
        icon: CheckCircle,
        title: 'Great Margin',
        description: `Strong GP at ${data.grossProfitPercent.toFixed(1)}%`
      });
    }
  }

  // 3. Dispensary % Alerts - only show if we have meaningful turnover data
  if (data.turnover > 0) {
    const dispensaryPercent = (data.dispensaryTurnover / data.turnover) * 100;
    if (dispensaryPercent > 60) {
      alerts.push({
        severity: 'warning',
        icon: AlertTriangle,
        title: 'High Dispensary %',
        description: `Dispensary at ${dispensaryPercent.toFixed(1)}% - Front shop underperforming`
      });
    } else if (dispensaryPercent < 40) {
      alerts.push({
        severity: 'warning',
        icon: AlertTriangle,
        title: 'Low Dispensary %',
        description: `Dispensary at ${dispensaryPercent.toFixed(1)}% - Possible drop in script volumes`
      });
    }
  }

  // 4. Basket Performance - only show if we have meaningful transaction data
  if (data.transactionCount > 0 && data.basketValue > 0) {
    if (data.basketValue < 100) {
      alerts.push({
        severity: 'critical',
        icon: AlertCircle,
        title: 'Very Poor Basket Value',
        description: `Critical: Average basket only ${formatCurrency(data.basketValue)} - Attention needed`
      });
    } else if (data.basketValue < 150) {
      alerts.push({
        severity: 'warning',
        icon: AlertTriangle,
        title: 'Low Basket Value',
        description: `Average basket at ${formatCurrency(data.basketValue)} - Below target of R150`
      });
    } else if (data.basketValue > 200) {
      alerts.push({
        severity: 'positive',
        icon: CheckCircle,
        title: 'Strong Basket Performance',
        description: `Excellent basket value of ${formatCurrency(data.basketValue)} - Above R200 target`
      });
    }
  }

  // 4. Cost of Sales vs Purchases Analysis - only show if we have meaningful data
  if (data.costOfSales > 0 && data.purchases > 0) {  // Prevent division by zero and ensure meaningful data
    const purchaseRatio = (data.purchases / data.costOfSales - 1) * 100;
    
    if (purchaseRatio > 15) {
      alerts.push({
        severity: 'critical',
        icon: AlertCircle,
        title: 'Excessive Stock Purchases',
        description: `Purchases ${purchaseRatio.toFixed(0)}% above cost of sales (${formatCurrency(data.purchases)} vs ${formatCurrency(data.costOfSales)})`
      });
    } else if (purchaseRatio > 7) {
      alerts.push({
        severity: 'warning',
        icon: AlertTriangle,
        title: 'High Stock Purchases',
        description: `Purchases ${purchaseRatio.toFixed(0)}% above cost of sales (${formatCurrency(data.purchases)} vs ${formatCurrency(data.costOfSales)})`
      });
    }
  }

  // 5. Scripts Alert - only show if we have turnover data (indicating business activity)
  if (data.scriptsDispensed === 0 && data.turnover > 0) {
    alerts.push({
      severity: 'critical',
      icon: AlertCircle,
      title: 'No Scripts Recorded',
      description: 'Possible data import issue - please check'
    });
  }

  return alerts;
};

const DailyScreen = () => {
  const navigation = useNavigation<AuthNavigationProp>();
  const { selectedPharmacy, pharmacies, setSelectedPharmacy, selectedDate, setSelectedDate, logout } = useAuth();
  const [tempSelectedDate, setTempSelectedDate] = useState(selectedDate);
  const [dailyData, setDailyData] = useState<DailyData | null>(null);
  const [previousYearData, setPreviousYearData] = useState<DailyData | null>(null);
  const [mtdTurnover, setMtdTurnover] = useState<number[]>([]);
  const [mtdPreviousYearTurnover, setMtdPreviousYearTurnover] = useState<number[]>([]);
  const [dailyTurnoverData, setDailyTurnoverData] = useState<any[]>([]);
  const [dailyGPPercentData, setDailyGPPercentData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Error alert states
  const [showErrorAlert, setShowErrorAlert] = useState(false);
  const [errorTitle, setErrorTitle] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  
  // Selector states
  const [showPharmacyDropdown, setShowPharmacyDropdown] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showHamburgerMenu, setShowHamburgerMenu] = useState(false);
  const [turnoverCardExpanded, setTurnoverCardExpanded] = useState(false);
  const [gpCardExpanded, setGpCardExpanded] = useState(false);
  const [costOfSalesCardExpanded, setCostOfSalesCardExpanded] = useState(false);
  const [basketCardExpanded, setBasketCardExpanded] = useState(false);
  const [scriptsCardExpanded, setScriptsCardExpanded] = useState(false);
  const slideAnim = useRef(new Animated.Value(-width)).current;

  // Fetch data only when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      if (selectedPharmacy) {
        fetchDailyData();
        // Fetch current year MTD data
        fetchMTDData(selectedDate);
        // Fetch previous year MTD data (only if we're not in 2024 or earlier)
        if (selectedDate.getFullYear() > 2024) {
          const previousYearDate = new Date(selectedDate);
          previousYearDate.setFullYear(previousYearDate.getFullYear() - 1);
          fetchMTDData(previousYearDate, true);
        }
        // Fetch 14-day turnover data
        fetchDailyTurnoverData();
        // Fetch 14-day GP% data
        fetchDailyGPPercentData();
      }
    }, [selectedPharmacy, selectedDate])
  );

  // Date change via scroller
  const handleDateFromScroller = (d: Date) => setSelectedDate(d);

  const fetchDailyTurnoverData = async () => {
    if (!selectedPharmacy) return;

    try {
      const endDate = new Date(selectedDate);
      const startDate = new Date(selectedDate);
      startDate.setDate(startDate.getDate() - 13); // 14 days total (including today)

      const pharmacy = getPharmacyByCode(selectedPharmacy);
      if (!pharmacy) return;

      const startDateStr = formatDateLocal(startDate);
      const endDateStr = formatDateLocal(endDate);

      const rangeData = await newPharmacyAPI.getDailySales(pharmacy.id, startDateStr, endDateStr);
      const dailyArray = Array.isArray(rangeData) ? rangeData : [];

      const sortedData = dailyArray
        .sort((a: any, b: any) => new Date(a.business_date).getTime() - new Date(b.business_date).getTime())
        .map((day: any) => {
          const d = new Date(day.business_date);
          const month = d.getMonth() + 1;
          const dayNum = d.getDate();
          const value = Number(day.turnover) || 0;
          return {
            value,
            label: `${month}/${dayNum}`,
            frontColor: colors.accentPrimary,
          };
        })
        .filter((d: any) => d.value > 0);

      setDailyTurnoverData(sortedData);
    } catch (error) {
      console.error('Error fetching 14-day turnover data:', error);
      setDailyTurnoverData([]);
    }
  };

  const fetchDailyGPPercentData = async () => {
    if (!selectedPharmacy) return;

    try {
      const endDate = new Date(selectedDate);
      const startDate = new Date(selectedDate);
      startDate.setDate(startDate.getDate() - 13);

      const pharmacy = getPharmacyByCode(selectedPharmacy);
      if (!pharmacy) return;

      const startDateStr = formatDateLocal(startDate);
      const endDateStr = formatDateLocal(endDate);

      const rangeData = await newPharmacyAPI.getDailySales(pharmacy.id, startDateStr, endDateStr);
      const dailyArray = Array.isArray(rangeData) ? rangeData : [];

      const sortedData = dailyArray
        .sort((a: any, b: any) => new Date(a.business_date).getTime() - new Date(b.business_date).getTime())
        .map((day: any) => {
          const d = new Date(day.business_date);
          const month = d.getMonth() + 1;
          const dayNum = d.getDate();
          const value = Number(day.gp_pct) || 0;
          return {
            value,
            label: `${month}/${dayNum}`,
            frontColor: colors.chartGold,
          };
        })
        .filter((d: any) => d.value > 0);

      setDailyGPPercentData(sortedData);
    } catch (error) {
      console.error('Error fetching 14-day GP% data:', error);
      setDailyGPPercentData([]);
    }
  };

  const fetchMTDData = async (date: Date, setPreviousYear: boolean = false) => {
    if (!selectedPharmacy) return;

    try {
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      const endDate = date;

      const pharmacy = getPharmacyByCode(selectedPharmacy);
      if (!pharmacy) return;

      const startDateStr = formatDateLocal(startOfMonth);
      const endDateStr = formatDateLocal(endDate);

      const rangeData = await newPharmacyAPI.getDailySales(pharmacy.id, startDateStr, endDateStr);
      const dailyArray = Array.isArray(rangeData) ? rangeData : [];

      const sortedDailyTurnover = dailyArray
        .sort((a: any, b: any) => new Date(a.business_date).getTime() - new Date(b.business_date).getTime());

      const cumulativeData = sortedDailyTurnover.reduce((acc: number[], day: any) => {
        const lastValue = acc.length > 0 ? acc[acc.length - 1] : 0;
        const dayTurnover = Number(day.turnover) || 0;
        acc.push(lastValue + dayTurnover);
        return acc;
      }, []);

      if (setPreviousYear) {
        setMtdPreviousYearTurnover(cumulativeData);
      } else {
        setMtdTurnover(cumulativeData);
      }
    } catch (error) {
      console.error(`Error fetching MTD data for ${setPreviousYear ? 'previous year' : 'current year'}:`, error);
    }
  };

  const fetchDailyData = async () => {
    if (!selectedPharmacy) return;

    setLoading(true);
    try {
      const dateStr = formatDateLocal(selectedDate);

      const currentYear = selectedDate.getFullYear();
      const shouldFetchPreviousYear = currentYear > 2024;
      const previousYearDate = shouldFetchPreviousYear ? getPreviousYearSameDayOfWeek(selectedDate) : null;
      const previousYearDateStr = previousYearDate ? formatDateLocal(previousYearDate) : null;

      const pharmacy = getPharmacyByCode(selectedPharmacy);
      if (!pharmacy) throw new Error('Invalid pharmacy selected');

      // Always fetch current day data; this determines success/failure of the screen
      const dailyTurnoverData = await newPharmacyAPI.getDailyTurnover(pharmacy.id, dateStr);

      const currentData: DailyData = {
        turnover: Number(dailyTurnoverData?.turnover) || 0,
        grossProfit: Number(dailyTurnoverData?.gp_value) || 0,
        grossProfitPercent: Number(dailyTurnoverData?.gp_pct) || 0,
        basketValue: Number(dailyTurnoverData?.avg_basket) || 0,
        basketItems: 0,
        transactionCount: Number(dailyTurnoverData?.transaction_count) || 0,
        scriptsDispensed: Number(dailyTurnoverData?.scripts_qty) || 0,
        cashSales: Number(dailyTurnoverData?.sales_cash) || 0,
        accountSales: Number(dailyTurnoverData?.sales_account) || 0,
        costOfSales: Number(dailyTurnoverData?.cost_of_sales) || 0,
        purchases: Number(dailyTurnoverData?.purchases) || 0,
        dispensaryPercent: dailyTurnoverData?.disp_pct != null
          ? Number(dailyTurnoverData.disp_pct)
          : (dailyTurnoverData?.turnover && dailyTurnoverData?.dispensary_turnover
              ? (Number(dailyTurnoverData.dispensary_turnover) / Number(dailyTurnoverData.turnover)) * 100
              : 0),
        dispensaryTurnover: Number(dailyTurnoverData?.dispensary_turnover) || 0,
        avgScriptValue: Number(dailyTurnoverData?.avg_script_value) || 0,
        codSales: Number(dailyTurnoverData?.sales_cod) || 0,
      };

      // Try to fetch previous-year data, but do not fail the whole screen if it errors/missing
      let previousData: DailyData | null = null;
      if (previousYearDateStr) {
        try {
          const prevYearTurnoverData = await newPharmacyAPI.getDailyTurnover(pharmacy.id, previousYearDateStr);
          previousData = {
            turnover: Number(prevYearTurnoverData?.turnover) || 0,
            grossProfit: Number(prevYearTurnoverData?.gp_value) || 0,
            grossProfitPercent: Number(prevYearTurnoverData?.gp_pct) || 0,
            basketValue: Number(prevYearTurnoverData?.avg_basket) || 0,
            basketItems: 0,
            transactionCount: Number(prevYearTurnoverData?.transaction_count) || 0,
            scriptsDispensed: Number(prevYearTurnoverData?.scripts_qty) || 0,
            cashSales: Number(prevYearTurnoverData?.sales_cash) || 0,
            accountSales: Number(prevYearTurnoverData?.sales_account) || 0,
            costOfSales: Number(prevYearTurnoverData?.cost_of_sales) || 0,
            purchases: Number(prevYearTurnoverData?.purchases) || 0,
            dispensaryPercent: prevYearTurnoverData?.disp_pct != null
              ? Number(prevYearTurnoverData.disp_pct)
              : (prevYearTurnoverData?.turnover && prevYearTurnoverData?.dispensary_turnover
                  ? (Number(prevYearTurnoverData.dispensary_turnover) / Number(prevYearTurnoverData.turnover)) * 100
                  : 0),
            dispensaryTurnover: Number(prevYearTurnoverData?.dispensary_turnover) || 0,
            avgScriptValue: Number(prevYearTurnoverData?.avg_script_value) || 0,
            codSales: Number(prevYearTurnoverData?.sales_cod) || 0,
          };
        } catch (prevErr) {
          console.warn('Previous-year daily data unavailable; continuing without it:', prevErr);
          previousData = null;
        }
      }

      setDailyData(currentData);
      setPreviousYearData(previousData);
    } catch (error) {
      console.error('Error fetching daily data (current day):', error);
      setErrorTitle('Data Fetch Error');
      setErrorMessage('Failed to load daily data. Please try again.');
      setShowErrorAlert(true);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchDailyData();
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  };



  const handlePharmacyChange = (pharmacyCode: string) => {
    setSelectedPharmacy(pharmacyCode);
    setShowPharmacyDropdown(false);
  };

  const handleDateChange = (date: Date) => {
    setTempSelectedDate(date);
  };

  const handleDatePickerOpen = () => {
    setTempSelectedDate(selectedDate);
    setShowDatePicker(true);
  };

  const handleDatePickerDone = () => {
    setSelectedDate(tempSelectedDate);
    setShowDatePicker(false);
  };

  const handleDatePickerCancel = () => {
    setShowDatePicker(false);
  };

  const handleHamburgerToggle = () => {
    if (showHamburgerMenu) {
      // Close menu with animation
      Animated.timing(slideAnim, {
        toValue: -width,
        duration: 300,
        useNativeDriver: false,
      }).start(() => {
        setShowHamburgerMenu(false);
      });
    } else {
      // Open menu with animation
      setShowHamburgerMenu(true);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  };

  const handleMenuOptionPress = (option: string) => {
    console.log(`Menu option pressed: ${option}`);
    // Close menu with animation
    Animated.timing(slideAnim, {
      toValue: -width,
      duration: 300,
      useNativeDriver: false,
    }).start(() => {
      setShowHamburgerMenu(false);
    });
    
    // Handle navigation for different options
    if (option === 'data') {
      navigation.navigate('Data' as never);
    } else if (option === 'account') {
      navigation.navigate('Account' as never);
    } else if (option === 'reporting') {
      navigation.navigate('Reporting' as never);
    } else if (option === 'preferences') {
      navigation.navigate('Preferences' as never);
    }
    // TODO: Implement navigation or actions for other options
  };

  const handleLogout = () => {
    // Close menu with animation
    Animated.timing(slideAnim, {
      toValue: -width,
      duration: 300,
      useNativeDriver: false,
    }).start(() => {
      setShowHamburgerMenu(false);
      // Log out the user
      logout();
    });
  };

  const handleShowMore = () => {
    navigation.navigate('DailyHistory' as never);
  };

  const getCurrentPharmacyName = () => {
    const pharmacy = pharmacies.find(p => p.code === selectedPharmacy);
    return pharmacy ? pharmacy.name : selectedPharmacy;
  };

  const getTrendIndicator = (current: number, previous: number) => {
    const change = calculatePercentageChange(current, previous);
    if (change > 0) {
      return <TrendingUp size={14} color={colors.bgGradientFrom} strokeWidth={2.5} />;
    } else if (change < 0) {
      return <TrendingDown size={14} color={colors.bgGradientFrom} strokeWidth={2.5} />;
    }
    return null;
  };

  const getChangeIndicator = (current: number, previous: number) => {
    const change = calculatePercentageChange(current, previous);
    const isPositive = change >= 0;
    return {
      text: `${isPositive ? '+' : ''}${change.toFixed(1)}%`,
      color: isPositive ? colors.costSales : colors.statusError,
    };
  };

  const renderMetricCard = (
    title: string,
    current: number,
    previous: number,
    formatter: (value: number) => string,
    valueColor: string,
    subtitle?: string,
    subtitleValue?: number,
    showGrowth: boolean = true,
    subtitleFormatter?: (value: number) => string,
    subtitleAsValue: boolean = false,
    customValueFontSize?: number
  ) => {
    const change = calculatePercentageChange(current, previous);
    const isPositive = change >= 0;
    const indicator = getChangeIndicator(current, previous);

    return (
      <View style={styles.metricCard}>
        <View style={styles.metricHeader}>
          <View style={styles.metricContent}>
            <Text style={styles.metricTitle}>{title}</Text>
            <Text style={[
              styles.metricValue, 
              { 
                color: valueColor,
                fontSize: customValueFontSize || 20
              }
            ]}>
              {formatter(current)}
          </Text>
            {subtitle && subtitleValue !== undefined && (
              <View>
                <Text style={subtitleAsValue ? styles.metricTitle : styles.metricSubtitle}>
                  {subtitle}
                </Text>
                <Text style={subtitleAsValue ? [styles.metricValue, { color: valueColor }] : styles.metricSubtitle}>
                  {subtitleFormatter ? subtitleFormatter(subtitleValue) : formatter(subtitleValue)}
                </Text>
        </View>
            )}
      </View>
        </View>
        
        {showGrowth && (
          <View style={styles.metricFooter}>
            <Text style={styles.comparisonText}>
              vs 2024: {formatter(previous)}
            </Text>
            {getTrendIndicator(current, previous)}
            <Text style={[styles.changeText, { color: indicator.color }]}>
              {indicator.text}
            </Text>
          </View>
        )}
      </View>
    );
  };



  if (!dailyData) {
    return (
      <View style={styles.container}>
        {loading ? (
          <View style={styles.loadingOverlay} pointerEvents="auto">
            <ActivityIndicator size="large" color={colors.accentPrimary} />
          </View>
        ) : (
          <View style={styles.errorContainer}>
            <AlertCircle size={48} color={colors.statusError} />
            <Text style={styles.errorText}>No data available yet for the selected date</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchDailyData}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {loading && (
        <View style={styles.loadingOverlay} pointerEvents="auto">
          <ActivityIndicator size="large" color={colors.accentPrimary} />
        </View>
      )}
      {/* Error Alert */}
      <ErrorAlert
        visible={showErrorAlert}
        title={errorTitle}
        message={errorMessage}
        onDismiss={() => setShowErrorAlert(false)}
      />

      {/* Sticky Header */}
      <View style={styles.stickyHeader}>
        {/* Main Header Row */}
        <View style={styles.mainHeaderRow}>
          {/* Left side: Hamburger Menu and Pharmacy Selector */}
          <View style={styles.headerLeft}>
            <TouchableOpacity style={styles.hamburgerButton} onPress={handleHamburgerToggle}>
              <Menu size={24} color={colors.textPrimary} />
        </TouchableOpacity>

            <TouchableOpacity 
              style={styles.pharmacyDropdown} 
              onPress={() => setShowPharmacyDropdown(!showPharmacyDropdown)}
            >
              <Text style={styles.pharmacyName}>{getCurrentPharmacyName()}</Text>
              <ChevronDown size={16} color={colors.textSecondary} />
        </TouchableOpacity>
          </View>

          {/* Right side: Date Selector */}
          <TouchableOpacity 
            style={styles.dateButton} 
            onPress={handleDatePickerOpen}
          >
            <Calendar size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Hamburger Menu Slide-in */}
      {showHamburgerMenu && (
        <View style={styles.hamburgerMenuOverlay}>
          <Animated.View 
            style={[
              styles.hamburgerMenuContent,
              { transform: [{ translateX: slideAnim }] }
            ]}
          >
            <View style={styles.hamburgerMenuHeader}>
              <Text style={styles.hamburgerMenuTitle}>Menu</Text>
              <TouchableOpacity 
                onPress={() => {
                  Animated.timing(slideAnim, {
                    toValue: -width,
                    duration: 300,
                    useNativeDriver: false,
                  }).start(() => {
                    setShowHamburgerMenu(false);
                  });
                }}
                style={styles.hamburgerMenuCloseButton}
              >
                <Text style={styles.hamburgerMenuCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.hamburgerMenuItems}>
              <TouchableOpacity 
                style={styles.hamburgerMenuItem}
                onPress={() => handleMenuOptionPress('account')}
              >
                <User size={20} color={colors.textPrimary} />
                <Text style={styles.hamburgerMenuItemText}>Account</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.hamburgerMenuItem}
                onPress={() => handleMenuOptionPress('data')}
              >
                <Shield size={20} color={colors.textPrimary} />
                <Text style={styles.hamburgerMenuItemText}>Data</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.hamburgerMenuItem}
                onPress={() => handleMenuOptionPress('reporting')}
              >
                <BarChart3 size={20} color={colors.textPrimary} />
                <Text style={styles.hamburgerMenuItemText}>Reporting</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.hamburgerMenuItem}
                onPress={() => handleMenuOptionPress('preferences')}
              >
                <Settings size={20} color={colors.textPrimary} />
                <Text style={styles.hamburgerMenuItemText}>Preferences</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.hamburgerMenuFooter}>
              <TouchableOpacity 
                style={styles.logoutButton}
                onPress={handleLogout}
              >
                <LogOut size={20} color={colors.statusError} />
                <Text style={styles.logoutButtonText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
          <TouchableOpacity 
            style={styles.hamburgerMenuBackdrop} 
            onPress={() => {
              Animated.timing(slideAnim, {
                toValue: -width,
                duration: 300,
                useNativeDriver: false,
              }).start(() => {
                setShowHamburgerMenu(false);
              });
            }}
            activeOpacity={1}
          />
        </View>
      )}

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
        {/* Date Label */}
        <View style={styles.dateSection}>
          <Text style={styles.dateLabel}>
            {formatDateDisplay(selectedDate)}
          </Text>
        </View>

        {/* Horizontal Date Scroller */}
        <DateScroller
          selectedDate={selectedDate}
          onChange={handleDateFromScroller}
          colors={{
            bgGradientFrom: colors.bgGradientFrom,
            surfacePrimary: colors.surfacePrimary,
            textPrimary: colors.textPrimary,
            textSecondary: colors.textSecondary,
            statusError: colors.statusError,
            accentPrimary: colors.accentPrimary,
          }}
        />

        {/* Summary Section */}
        <View style={styles.summarySection}>
          <Text style={styles.summaryTitle}>Daily Summary</Text>
          <TouchableOpacity style={styles.showMoreButton} onPress={handleShowMore}>
            <Text style={styles.showMoreText}>Show More</Text>
          </TouchableOpacity>
        </View>
        
        {/* Quick Stats Grid */}
        <View style={styles.metricsGrid}>
        <TouchableOpacity 
          style={styles.turnoverCard} 
          onPress={() => setTurnoverCardExpanded(!turnoverCardExpanded)}
          activeOpacity={0.8}
        >
          <View style={styles.turnoverCardContent}>
            <View style={styles.turnoverIconContainer}>
              {getTrendIndicator(dailyData.turnover, previousYearData?.turnover || 0) || (
                <DollarSign size={16} color={colors.bgGradientFrom} strokeWidth={2.5} />
              )}
            </View>
            <View style={styles.turnoverTextContainer}>
              <View style={styles.labelRow}>
                <Text style={styles.turnoverLabel}>Turnover</Text>
                <ChevronRight 
                  size={14} 
                  color={colors.textSecondary} 
                  style={[
                    styles.expandArrow,
                    { transform: [{ rotate: turnoverCardExpanded ? '90deg' : '0deg' }] }
                  ]}
                />
              </View>
              <Text style={styles.turnoverValue}>{formatCurrency(dailyData.turnover)}</Text>
            </View>
          </View>

          {turnoverCardExpanded && (
            <View style={styles.turnoverExpandedContent}>
              <View style={styles.turnoverComparisonRow}>
                <Text style={styles.comparisonText}>
                  vs 2024: {formatCurrency(previousYearData?.turnover || 0)}
                </Text>
                <Text style={[styles.changeText, { color: getChangeIndicator(dailyData.turnover, previousYearData?.turnover || 0).color }]}>
                  {getChangeIndicator(dailyData.turnover, previousYearData?.turnover || 0).text}
                </Text>
              </View>
            </View>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.gpCard} 
          onPress={() => setGpCardExpanded(!gpCardExpanded)}
          activeOpacity={0.8}
        >
          <View style={styles.gpCardContent}>
            <View style={styles.gpIconContainer}>
              <DollarSign size={16} color={colors.bgGradientFrom} strokeWidth={2.5} />
            </View>
            <View style={styles.gpTextContainer}>
              <View style={styles.labelRow}>
                <Text style={styles.gpLabel}>GP</Text>
                <ChevronRight 
                  size={14} 
                  color={colors.textSecondary} 
                  style={[
                    styles.expandArrow,
                    { transform: [{ rotate: gpCardExpanded ? '90deg' : '0deg' }] }
                  ]}
                />
              </View>
              <Text style={styles.gpValue}>{dailyData.grossProfitPercent.toFixed(1)}%</Text>
            </View>
          </View>
          
          {gpCardExpanded && (
            <View style={styles.gpExpandedContent}>
              <View style={styles.gpDetailRow}>
                <Text style={styles.gpDetailLabel}>GP</Text>
                <Text style={styles.gpDetailValue}>{formatCurrency(dailyData.grossProfit)}</Text>
              </View>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.costOfSalesCard} 
          onPress={() => setCostOfSalesCardExpanded(!costOfSalesCardExpanded)}
          activeOpacity={0.8}
        >
          <View style={styles.costOfSalesCardContent}>
            <View style={styles.costOfSalesIconContainer}>
              <ShoppingCart size={16} color={colors.bgGradientFrom} strokeWidth={2.5} />
            </View>
            <View style={styles.costOfSalesTextContainer}>
              <View style={styles.labelRow}>
                <Text style={styles.costOfSalesLabel}>Cost of Sales</Text>
                <ChevronRight 
                  size={14} 
                  color={colors.textSecondary} 
                  style={[
                    styles.expandArrow,
                    { transform: [{ rotate: costOfSalesCardExpanded ? '90deg' : '0deg' }] }
                  ]}
                />
              </View>
              <Text style={styles.costOfSalesValue}>{formatCurrency(dailyData.costOfSales)}</Text>
            </View>
          </View>
          
          {costOfSalesCardExpanded && (
            <View style={styles.costOfSalesExpandedContent}>
              <View style={styles.costOfSalesDetailRow}>
                <Text style={styles.costOfSalesDetailLabel}>Purchases</Text>
                <Text style={styles.costOfSalesDetailValue}>{formatCurrency(dailyData.purchases)}</Text>
              </View>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.basketCard} 
          onPress={() => setBasketCardExpanded(!basketCardExpanded)}
          activeOpacity={0.8}
        >
          <View style={styles.basketCardContent}>
            <View style={styles.basketIconContainer}>
              <ShoppingBasket size={16} color={colors.bgGradientFrom} strokeWidth={2.5} />
            </View>
            <View style={styles.basketTextContainer}>
              <View style={styles.labelRow}>
                <Text style={styles.basketLabel}>Basket</Text>
                <ChevronRight 
                  size={14} 
                  color={colors.textSecondary} 
                  style={[
                    styles.expandArrow,
                    { transform: [{ rotate: basketCardExpanded ? '90deg' : '0deg' }] }
                  ]}
                />
              </View>
              <Text style={styles.basketValue}>{formatCurrency(dailyData.basketValue)}</Text>
            </View>
          </View>
          
          {basketCardExpanded && (
            <View style={styles.basketExpandedContent}>
              <View style={styles.basketDetailRow}>
                <Text style={styles.basketDetailLabel}>Transactions</Text>
                <Text style={styles.basketDetailValue}>{Math.round(dailyData.transactionCount)}</Text>
              </View>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Insights & Alerts Section */}
      <View style={styles.insightsSection}>
        <Text style={styles.insightsTitle}>Insights & Alerts</Text>
      </View>
      
      {/* Insights & Alerts */}
      <View style={styles.section}>
        <View style={styles.alertsContainer}>
          {(() => {
            try {
              const alerts = getAlerts(dailyData, previousYearData);
              
              if (!alerts || alerts.length === 0) {
                return (
                  <View style={styles.noAlertsContainer}>
                    <Text style={styles.noAlertsText}>No alerts to display</Text>
                  </View>
                );
              }

              return (
                <ScrollView 
                  style={styles.alertsGrid}
                  showsVerticalScrollIndicator={false}
                  nestedScrollEnabled={true}
                >
                  {alerts.map((alert, index) => {
                    const IconComponent = alert.icon;
                    const getSeverityColors = (severity: string): {
                      background: string;
                      iconBg: string;
                      text: string;
                    } => {
                      switch (severity) {
                        case 'critical':
                          return {
                            background: colors.statusError + '20',
                            iconBg: colors.statusError,
                            text: colors.statusError
                          };
                        case 'warning':
                          return {
                            background: colors.statusWarning + '20',
                            iconBg: colors.statusWarning,
                            text: colors.statusWarning
                          };
                        case 'positive':
                          return {
                            background: colors.statusSuccess + '20',
                            iconBg: colors.statusSuccess,
                            text: colors.statusSuccess
                          };
                        default:
                          return {
                            background: colors.surfaceSecondary,
                            iconBg: colors.textSecondary,
                            text: colors.textSecondary
                          };
                      }
                    };

                    const severityColors = getSeverityColors(alert.severity);

                                          return (
                        <View 
                          key={index} 
                          style={[
                            styles.alertCard, 
                            { 
                              backgroundColor: severityColors.background,
                              marginBottom: index === alerts.length - 1 ? 0 : 12 // No margin for last item
                            }
                          ]}
                        >
                          <View style={styles.alertContent}>
                            <View style={[styles.alertIcon, { backgroundColor: severityColors.iconBg }]}>
                              <IconComponent size={16} color={colors.surfaceSecondary} />
                            </View>
                            <View style={styles.alertText}>
                              <Text style={[styles.alertTitle, { color: severityColors.text }]}>
                                {alert.title}
                              </Text>
                            <Text style={styles.alertDescription}>
                              {alert.description}
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>
              );
            } catch (error) {
              console.error('Error rendering alerts:', error);
              return (
                <View style={styles.noAlertsContainer}>
                  <Text style={styles.noAlertsText}>Error displaying alerts</Text>
                </View>
              );
            }
          })()}
        </View>
      </View>

      {/* Dispensary Section */}
      <View style={styles.dispensarySection}>
        <Text style={styles.dispensaryTitle}>Dispensary</Text>
      </View>
      
      {/* Scripts Metrics Cards */}
      <View style={styles.metricsGrid}>
        <TouchableOpacity 
          style={styles.scriptsCard} 
          onPress={() => setScriptsCardExpanded(!scriptsCardExpanded)}
          activeOpacity={0.8}
        >
          <View style={styles.scriptsCardContent}>
            <View style={styles.scriptsTextContainer}>
              <View style={styles.labelRow}>
                <Text style={styles.scriptsLabel}>Scripts Today</Text>
                <ChevronRight 
                  size={14} 
                  color={colors.textSecondary} 
                  style={[
                    styles.expandArrow,
                    { transform: [{ rotate: scriptsCardExpanded ? '90deg' : '0deg' }] }
                  ]}
                />
              </View>
              <Text style={styles.scriptsValue}>{Math.round(dailyData.scriptsDispensed)}</Text>
            </View>
          </View>
          
          {scriptsCardExpanded && (
            <View style={styles.scriptsExpandedContent}>
              <View style={styles.scriptsComparisonRow}>
                <Text style={styles.comparisonText}>
                  vs 2024: {Math.round(previousYearData?.scriptsDispensed || 0)}
                </Text>
                <Text style={[styles.changeText, { color: getChangeIndicator(dailyData.scriptsDispensed, previousYearData?.scriptsDispensed || 0).color }]}>
                  {getChangeIndicator(dailyData.scriptsDispensed, previousYearData?.scriptsDispensed || 0).text}
                </Text>
              </View>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.metricCard}>
          <View style={styles.metricHeader}>
            <View style={styles.metricContent}>
              <Text style={styles.metricTitle}>Avg Script Value</Text>
              <Text style={styles.metricValue}>
                {dailyData.avgScriptValue && dailyData.avgScriptValue > 0
                  ? formatCurrency(dailyData.avgScriptValue)
                  : dailyData.scriptsDispensed > 0
                    ? formatCurrency(dailyData.dispensaryTurnover / dailyData.scriptsDispensed)
                    : 'R 0'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Dispensary Card */}
      <View style={styles.section}>
        {/* Sales Breakdown */}
        <View style={styles.dispensaryBreakdown}>
          <View style={styles.dispensaryBreakdownItem}>
            <View style={styles.dispensaryBreakdownLeft}>
              <View style={[styles.dispensaryPercentageCircle, { backgroundColor: colors.chartGold }]} />
              <Text style={styles.dispensaryBreakdownLabel}>Dispensary</Text>
              <Text style={[styles.dispensaryPercentageText, { color: colors.chartGold }]}>{Math.round(dailyData.dispensaryPercent)}%</Text>
            </View>
            <Text style={styles.dispensaryBreakdownValue}>
              {formatCurrency(dailyData.dispensaryTurnover)}
            </Text>
          </View>
          <View style={styles.dispensaryBreakdownItem}>
            <View style={styles.dispensaryBreakdownLeft}>
              <View style={[styles.dispensaryPercentageCircle, { backgroundColor: colors.textSecondary }]} />
              <Text style={styles.dispensaryBreakdownLabel}>Front Shop</Text>
              <Text style={[styles.dispensaryPercentageText, { color: colors.textSecondary }]}>{Math.round(100 - dailyData.dispensaryPercent)}%</Text>
            </View>
            <Text style={styles.dispensaryBreakdownValue}>
              {formatCurrency(dailyData.turnover - dailyData.dispensaryTurnover)}
            </Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={styles.dispensaryPercentageSection}>
          
          <View style={styles.dispensaryProgressBar}>
            <View style={[styles.dispensaryProgressFill, { width: `${Math.min(dailyData.dispensaryPercent, 100)}%`, backgroundColor: colors.chartGold }]} />
            <View style={[styles.dispensaryProgressFill, { width: `${Math.max(0, 100 - dailyData.dispensaryPercent)}%`, backgroundColor: colors.textSecondary }]} />
          </View>
        </View>
      </View>

      {/* Trends Section */}
      <View style={styles.trendsSection}>
        <Text style={styles.trendsTitle}>Trends</Text>
        <Text style={styles.barChartTitle}>14 Day Turnover</Text>
      </View>
      
      {/* Trends Container */}
      <View style={styles.trendsContainer}>
        {dailyTurnoverData.length > 0 ? (
          <View style={[styles.barChartContainer, { alignItems: 'center' }]}>
            <SimpleLineChart
              data={dailyTurnoverData.map((item: any) => ({
                x: item.label,
                y: item.value,
                label: item.label,
              }))}
              width={width - 64}
              height={160}
              theme="dark"
              primaryColor={colors.accentPrimary}
              strokeWidth={2}
              formatYLabel={(value: number) => {
                if (value >= 1000000) return `R${(value / 1000000).toFixed(1)}M`;
                if (value >= 1000) return `R${(value / 1000).toFixed(0)}k`;
                return `R${value.toFixed(0)}`;
              }}
              formatXLabel={(value: string | number) => value.toString()}
          />
        </View>
        ) : (
          <View style={styles.emptyTrendsCard}>
            <Text style={styles.emptyTrendsText}>Loading trends data...</Text>
          </View>
        )}
      </View>

      {/* GP% Trends Section */}
      <View style={styles.trendsSection}>
        <Text style={styles.barChartTitle}>14 Day GP%</Text>
      </View>
      
      {/* GP% Trends Container */}
      <View style={styles.trendsContainer}>
        {dailyGPPercentData.length > 0 ? (
          <View style={[styles.barChartContainer, { alignItems: 'center' }]}>
            <SimpleLineChart
              data={dailyGPPercentData.map((item: any) => ({
                x: item.label,
                y: item.value,
                label: item.label,
              }))}
              width={width - 64}
              height={160}
              theme="dark"
              primaryColor={colors.chartGold}
              strokeWidth={2}
              formatYLabel={(value: number) => `${value.toFixed(1)}%`}
              formatXLabel={(value: string | number) => value.toString()}
          />
        </View>
        ) : (
          <View style={styles.emptyTrendsCard}>
            <Text style={styles.emptyTrendsText}>Loading GP% trends data...</Text>
          </View>
        )}
      </View>

      {/* Pharmacy Dropdown */}
      {showPharmacyDropdown && (
        <View style={styles.dropdownContainer}>
          <View style={[
            styles.dropdownContent,
            { maxHeight: Math.min(pharmacies.length * 56 + 20, 300) }
          ]}>
            <ScrollView>
              {pharmacies.map((pharmacy) => (
                  <TouchableOpacity
                  key={pharmacy.code}
                    style={[
                    styles.dropdownItem,
                    selectedPharmacy === pharmacy.code && styles.dropdownItemSelected
                    ]}
                  onPress={() => handlePharmacyChange(pharmacy.code)}
                  >
                    <Text style={[
                    styles.dropdownItemText,
                    selectedPharmacy === pharmacy.code && styles.dropdownItemTextSelected
                    ]}>
                    {pharmacy.name}
                    </Text>
                  </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      )}

      {/* Custom Date Picker Modal */}
      <Modal
        visible={showDatePicker}
        transparent={true}
        animationType="slide"
        onRequestClose={handleDatePickerCancel}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.datePickerContainer}>
              <CustomDatePicker
                value={tempSelectedDate}
                onChange={handleDateChange}
                maximumDate={new Date()}
                minimumDate={new Date(2020, 0, 1)}
              />
            </View>
            <View style={styles.datePickerActions}>
              <TouchableOpacity 
                style={styles.datePickerButton}
                onPress={handleDatePickerCancel}
              >
                <Text style={styles.datePickerButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.datePickerButton, styles.datePickerButtonPrimary]}
                onPress={handleDatePickerDone}
              >
                <Text style={[styles.datePickerButtonText, styles.datePickerButtonTextPrimary]}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
        </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgGradientFrom,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 3000,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bgGradientFrom,
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bgGradientFrom,
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 16,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: colors.accentPrimary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  retryText: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  stickyHeader: {
    padding: 16,
    paddingTop: 63,
    backgroundColor: colors.bgGradientFrom,
    zIndex: 1000,
  },
  dateLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  scrollContent: {
    flex: 1,
  },
  mainHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 0,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  hamburgerButton: {
    padding: 8,
  },
  pharmacyDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
  },
  pharmacyName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  dateButton: {
    padding: 8,
  },
  selectorLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
  },
  selectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectorValue: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '600',
    flex: 1,
  },
  metricsGrid: {
    paddingHorizontal: 16,
    gap: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  metricCard: {
    backgroundColor: colors.surfacePrimary,
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    width: '48%',
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  metricContent: {
    flex: 1,
  },
  metricTitle: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
    marginBottom: 3,
    textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 3,
    color: colors.textPrimary,
  },
  metricSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  comparisonText: {
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
  },
  changeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    backgroundColor: colors.surfacePrimary,
    margin: 16,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  salesBreakdown: {
    gap: 12,
  },
  salesItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  salesLabel: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  salesValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  // Alerts styles
  alertsContainer: {
    maxHeight: 520, // Accommodates ~6 alerts (84px each including gap)
  },
  noAlertsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 128,
  },
  noAlertsText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  alertsGrid: {
    gap: 12,
    paddingBottom: 8, // Add some bottom padding for better scrolling experience
  },
  alertCard: {
    borderRadius: 12,
    padding: 12,
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
  },
  // Modal styles
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
  pharmacyList: {
    maxHeight: 300,
  },
  pharmacyItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pharmacyItemSelected: {
    backgroundColor: colors.accentPrimary + '20',
  },
  pharmacyItemText: {
    fontSize: 16,
    color: colors.textPrimary,
  },
  pharmacyItemTextSelected: {
    color: colors.accentPrimary,
    fontWeight: '600',
  },
  debugText: {
    fontSize: 12,
    color: colors.statusWarning,
    marginTop: 4,
  },
  // Date picker styles
  datePickerContainer: {
    width: '105%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  datePickerActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 10,
    width: '100%',
    gap: 20,
  },
  datePickerButton: {
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.textSecondary,
    minWidth: 120,
  },
  datePickerButtonText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  datePickerButtonPrimary: {
    backgroundColor: colors.accentPrimary,
    borderColor: colors.accentPrimary,
  },
  datePickerButtonTextPrimary: {
    color: colors.bgGradientFrom,
  },
  // Dropdown styles
  dropdownContainer: {
    position: 'absolute',
    top: 0, // Position right below the header
    left: 16,
    right: 16,
    zIndex: 1000,
  },
  dropdownContent: {
    backgroundColor: colors.bgGradientFrom,
    borderRadius: 12,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  dropdownItem: {
    padding: 16,
    borderBottomWidth: 0,
  },
  dropdownItemSelected: {
    backgroundColor: colors.accentPrimary + '20',
  },
  dropdownItemText: {
    fontSize: 16,
    color: colors.textPrimary,
  },
  dropdownItemTextSelected: {
    color: colors.accentPrimary,
    fontWeight: '600',
  },
  // Hamburger menu styles
  hamburgerMenuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2000,
    flexDirection: 'row',
  },
  hamburgerMenuBackdrop: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  hamburgerMenuContent: {
    width: width * 0.8,
    backgroundColor: colors.bgGradientFrom,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  hamburgerMenuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 63,
    borderBottomWidth: 0,
  },
  hamburgerMenuTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  hamburgerMenuCloseButton: {
    padding: 4,
  },
  hamburgerMenuCloseText: {
    fontSize: 20,
    color: colors.textSecondary,
    fontWeight: 'bold',
  },
  hamburgerMenuItems: {
    paddingVertical: 8,
  },
  hamburgerMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderBottomWidth: 0,
  },
  hamburgerMenuItemText: {
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  hamburgerMenuFooter: {
    marginTop: 'auto',
    padding: 16,
    borderTopWidth: 0,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 8,
    backgroundColor: colors.statusError + '20',
  },
  logoutButtonText: {
    fontSize: 16,
    color: colors.statusError,
    fontWeight: '600',
  },
  // Chart styles
  chartSection: {
    backgroundColor: colors.surfacePrimary,
    margin: 16,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  chartContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16
  },
  // Turnover card styles
  turnoverCard: {
    backgroundColor: colors.surfacePrimary,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    width: '54%',
  },
  turnoverCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  turnoverIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.accentPrimary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  turnoverIconPlaceholder: {
    width: 16,
    height: 16,
    borderRadius: 4,
    backgroundColor: colors.textSecondary,
  },
  turnoverTextContainer: {
    flex: 1,
  },
  expandArrowContainer: {
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    paddingLeft: 4,
    marginTop: 2,
  },
  expandArrow: {
    // React Native handles transform animations automatically
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  turnoverLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  turnoverValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.accentPrimary,
  },
  turnoverExpandedContent: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  turnoverComparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // GP card styles
  gpCard: {
    backgroundColor: colors.surfacePrimary,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    width: '42%',
  },
  gpCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  gpIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.chartGold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gpIconPlaceholder: {
    width: 16,
    height: 16,
    borderRadius: 4,
    backgroundColor: colors.chartGold,
  },
  gpTextContainer: {
    flex: 1,
  },
  gpLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  gpValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.chartGold,
  },
  gpExpandedContent: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  gpDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gpDetailLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  gpDetailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  // Cost of Sales card styles
  costOfSalesCard: {
    backgroundColor: colors.surfacePrimary,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    width: '54%',
  },
  costOfSalesCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  costOfSalesIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.costSales,
    justifyContent: 'center',
    alignItems: 'center',
  },
  costOfSalesTextContainer: {
    flex: 1,
  },
  costOfSalesLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  costOfSalesValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.costSales,
  },
  costOfSalesExpandedContent: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  costOfSalesDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  costOfSalesDetailLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  costOfSalesDetailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  // Scripts card styles
  scriptsCard: {
    backgroundColor: colors.surfacePrimary,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    width: '48%',
  },
  scriptsCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  scriptsIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.accentPrimary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scriptsTextContainer: {
    flex: 1,
  },
  scriptsLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  scriptsValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  scriptsExpandedContent: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  scriptsComparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // Basket card styles
  basketCard: {
    backgroundColor: colors.surfacePrimary,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    width: '42%',
  },
  basketCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  basketIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  basketTextContainer: {
    flex: 1,
  },
  basketLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  basketValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#8B5CF6',
  },
  basketExpandedContent: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  basketDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  basketDetailLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  basketDetailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  // Date section styles
  dateSection: {
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  // Summary section styles
  summarySection: {
    paddingHorizontal: 16,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  summaryDate: {
    marginLeft: 12,
    flex: 1,
    fontSize: 12,
    color: colors.textSecondary,
    alignSelf: 'center'
  },
  showMoreButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  showMoreText: {
    fontSize: 14,
    color: colors.accentPrimary,
    fontWeight: '500',
  },
  // Insights section styles
  insightsSection: {
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: -4,
  },
  insightsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  // Dispensary section styles
  dispensarySection: {
    paddingHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
  },
  dispensaryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  // Top cards row
  dispensaryTopRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  dispensaryTopCard: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  dispensaryTopCardLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
    marginBottom: 3,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  dispensaryTopCardValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  // Comparison row
  dispensaryComparisonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 16,
  },
  dispensaryComparisonLabel: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  dispensaryComparisonValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  // Breakdown section
  dispensaryBreakdown: {
    gap: 12,
    marginBottom: 16,
  },
  dispensaryBreakdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  dispensaryBreakdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dispensaryBreakdownLabel: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  dispensaryBreakdownValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  // Percentage section
  dispensaryPercentageSection: {
    gap: 12,
  },
  dispensaryPercentageRow: {
    flexDirection: 'row',
    gap: 16,
  },
  dispensaryPercentageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dispensaryPercentageCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  dispensaryPercentageText: {
    fontSize: 14,
    fontWeight: '600',
  },
  dispensaryProgressBar: {
    height: 8,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 4,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  dispensaryProgressFill: {
    height: '100%',
  },
  dispensaryTargetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dispensaryTargetLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  dispensaryTargetStatus: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Trends section styles
  trendsSection: {
    paddingHorizontal: 16,
    marginTop: 4,
    marginBottom: -32,
  },
  trendsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  trendsContainer: {
    minHeight: 100,
    alignItems: 'center',
    marginTop: 8,
  },
  emptyTrendsCard: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 100,
    borderRadius: 12,
    backgroundColor: colors.surfaceSecondary,
  },
  emptyTrendsText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  barChartContainer: {
    alignItems: 'flex-start',
    paddingVertical: 16,
  },
  barChartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 16,
    textAlign: 'left',
  },

});

export default DailyScreen;