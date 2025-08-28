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
  Alert,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { AuthNavigationProp } from '../../types/navigation';
import LineChart, { LineChartDataPoint } from '../../components/common/LineChart';
import SimpleLineChart from '../../components/common/SimpleLineChart';
import ErrorAlert from '../../components/common/ErrorAlert';
import CustomDatePicker from '../../components/common/CustomDatePicker';
import DateScroller from '../../components/common/DateScroller';
import { useAuth } from '../../contexts/AuthContext';
import { newPharmacyAPI } from '../../services/api';
import { getPharmacyByCode } from '../../config/api';
import { formatDateLocal, getYesterday, formatDateDisplay } from '../../utils/dateUtils';
import { formatCurrency, formatPercentage, calculatePercentageChange } from '../../utils/formatUtils';
import { TrendingUp, TrendingDown, AlertCircle, ChevronDown, Calendar, CheckCircle, AlertTriangle, Menu, LogOut, User, Bell, Shield, Settings, DollarSign, ShoppingCart, ShoppingBasket, BarChart3, ChevronRight } from 'lucide-react-native';
import DoubleLineChart from '../../components/common/DoubleLineChart';
import SimpleBarChart from '../../components/common/SimpleBarChart';

const { width } = Dimensions.get('window');

// Interface for monthly data
interface MonthlyData {
  turnover: number;
  grossProfit: number;
  grossProfitPercent: number;
  basketValue: number;
  basketItems: number;
  costOfSales: number;
  purchases: number;
  dispensaryPercent: number;
  dispensaryTurnover: number;
  scriptsDispensed: number;
  cashSales: number;
  accountSales: number;
}

// Add getAlerts function before the component
const getAlerts = (data: MonthlyData, previousYearData: MonthlyData | null) => {
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

  // 3. Cost of Sales vs Purchases Analysis - only show if we have meaningful data
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

  // 4. Basket Performance - only show if we have meaningful transaction data
  if (data.basketItems > 0 && data.basketValue > 0) {
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

  return alerts;
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

const MonthlyScreen = () => {
  const navigation = useNavigation<AuthNavigationProp>();
  const { selectedPharmacy, pharmacies, setSelectedPharmacy, selectedDate, setSelectedDate, logout } = useAuth();
  
  // State for monthly data
  const [monthlyData, setMonthlyData] = useState<MonthlyData | null>(null);
  const [previousMonthData, setPreviousMonthData] = useState<MonthlyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [backgroundLoading, setBackgroundLoading] = useState(false);
  const [cumulativeTurnoverData, setCumulativeTurnoverData] = useState<any[]>([]);
  const [previousYearCumulativeData, setPreviousYearCumulativeData] = useState<any[]>([]);
  const [last12MonthsData, setLast12MonthsData] = useState<any[]>([]);
  const [costOfSalesData, setCostOfSalesData] = useState<any[]>([]);
  const [purchasesData, setPurchasesData] = useState<any[]>([]);
  const [weekdayAvgData, setWeekdayAvgData] = useState<any[]>([]);
  const [tempSelectedDate, setTempSelectedDate] = useState(selectedDate);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Selector states
  const [showPharmacyDropdown, setShowPharmacyDropdown] = useState(false);
  const [showHamburgerMenu, setShowHamburgerMenu] = useState(false);
  const slideAnim = useRef(new Animated.Value(-width)).current;

  // Card expansion states
  const [turnoverCardExpanded, setTurnoverCardExpanded] = useState(false);
  const [gpCardExpanded, setGpCardExpanded] = useState(false);
  const [costOfSalesCardExpanded, setCostOfSalesCardExpanded] = useState(false);
  const [basketCardExpanded, setBasketCardExpanded] = useState(false);
  const [scriptsCardExpanded, setScriptsCardExpanded] = useState(false);

  const handlePharmacyChange = (pharmacyCode: string) => {
    setSelectedPharmacy(pharmacyCode);
    setShowPharmacyDropdown(false);
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

  const getCurrentPharmacyName = () => {
    const pharmacy = pharmacies.find(p => p.code === selectedPharmacy);
    return pharmacy ? pharmacy.name : selectedPharmacy;
  };

  const fetchCumulativeTurnoverData = async () => {
    if (!selectedPharmacy) return;

    try {
      const pharmacy = getPharmacyByCode(selectedPharmacy);
      if (!pharmacy) return;

      // Current month range
      const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
      const endDate = selectedDate;
      const startDateStr = formatDateLocal(startOfMonth);
      const endDateStr = formatDateLocal(endDate);

      // Previous year same month range (up to same day number)
      const startOfPreviousYearMonth = new Date(selectedDate.getFullYear() - 1, selectedDate.getMonth(), 1);
      const endOfPreviousYearMonth = new Date(selectedDate.getFullYear() - 1, selectedDate.getMonth(), selectedDate.getDate());
      const prevStartDateStr = formatDateLocal(startOfPreviousYearMonth);
      const prevEndDateStr = formatDateLocal(endOfPreviousYearMonth);

      // Fetch both ranges
      const [currentRange, previousRange] = await Promise.all([
        newPharmacyAPI.getDailySales(pharmacy.id, startDateStr, endDateStr),
        newPharmacyAPI.getDailySales(pharmacy.id, prevStartDateStr, prevEndDateStr)
      ]);

      // Normalize by day to produce cumulative series
      const dayCount = endDate.getDate();

      const mapCurrent = new Map<string, number>();
      (Array.isArray(currentRange) ? currentRange : []).forEach((d: any) => {
        mapCurrent.set(d.business_date, Number(d.turnover) || 0);
      });
      const cumulativeCurrent: any[] = [];
      let running = 0;
      for (let day = 1; day <= dayCount; day++) {
        const dateObj = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth(), day);
        const key = formatDateLocal(dateObj);
        running += mapCurrent.get(key) || 0;
        cumulativeCurrent.push({ value: running, label: `${day}`, frontColor: colors.accentPrimary });
      }
      setCumulativeTurnoverData(cumulativeCurrent);

      const mapPrev = new Map<string, number>();
      (Array.isArray(previousRange) ? previousRange : []).forEach((d: any) => {
        mapPrev.set(d.business_date, Number(d.turnover) || 0);
      });
      const cumulativePrev: any[] = [];
      let runningPrev = 0;
      for (let day = 1; day <= dayCount; day++) {
        const dateObj = new Date(startOfPreviousYearMonth.getFullYear(), startOfPreviousYearMonth.getMonth(), day);
        const key = formatDateLocal(dateObj);
        runningPrev += mapPrev.get(key) || 0;
        cumulativePrev.push({ value: runningPrev, label: `${day}`, frontColor: colors.chartGold });
      }
      setPreviousYearCumulativeData(cumulativePrev);
    } catch (error) {
      console.error('Error fetching cumulative turnover data:', error);
      setCumulativeTurnoverData([]);
      setPreviousYearCumulativeData([]);
    }
  };

  const fetchLast12MonthsData = async () => {
    if (!selectedPharmacy) return;

    try {
      const pharmacy = getPharmacyByCode(selectedPharmacy);
      if (!pharmacy) return;

      // Build 12 month keys ending at selected month
      const months: { monthKey: string; through: string }[] = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(selectedDate.getFullYear(), selectedDate.getMonth() - i, 1);
        const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const through = i === 0 ? formatDateLocal(selectedDate) : formatDateLocal(endOfMonth);
        months.push({ monthKey, through });
      }

      const results = await Promise.all(
        months.map(({ monthKey, through }) => newPharmacyAPI.getMTD(pharmacy.id, monthKey, through))
      );

      const monthlyData = results.map((mtd, idx) => {
        const d = new Date(selectedDate.getFullYear(), selectedDate.getMonth() - (11 - idx), 1);
        const label = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`;
        return { value: Number(mtd?.turnover) || 0, label, frontColor: colors.accentPrimary };
      });

      setLast12MonthsData(monthlyData);
    } catch (error) {
      console.error('Error fetching last 12 months data:', error);
      setLast12MonthsData([]);
    }
  };

  const fetchCostOfSalesAndPurchasesData = async () => {
    if (!selectedPharmacy) return;

    try {
      const pharmacy = getPharmacyByCode(selectedPharmacy);
      if (!pharmacy) return;

      const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
      const endDate = selectedDate;
      const startDateStr = formatDateLocal(startOfMonth);
      const endDateStr = formatDateLocal(endDate);

      const range = await newPharmacyAPI.getDailySales(pharmacy.id, startDateStr, endDateStr);
      const arr = Array.isArray(range) ? range : [];

      const dayCount = endDate.getDate();
      const mapCOS = new Map<string, number>();
      const mapPUR = new Map<string, number>();
      arr.forEach((d: any) => {
        mapCOS.set(d.business_date, Number(d.cost_of_sales) || 0);
        mapPUR.set(d.business_date, Number(d.purchases) || 0);
      });

      const cumulativeCostOfSales: any[] = [];
      const cumulativePurchases: any[] = [];
      let runningCOS = 0;
      let runningPUR = 0;
      for (let day = 1; day <= dayCount; day++) {
        const dateObj = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth(), day);
        const key = formatDateLocal(dateObj);
        runningCOS += mapCOS.get(key) || 0;
        runningPUR += mapPUR.get(key) || 0;
        cumulativeCostOfSales.push({ value: runningCOS, label: `${day}`, frontColor: colors.costSales });
        cumulativePurchases.push({ value: runningPUR, label: `${day}`, frontColor: colors.accentPrimary });
      }

      setCostOfSalesData(cumulativeCostOfSales);
      setPurchasesData(cumulativePurchases);
    } catch (error) {
      console.error('Error fetching cost of sales and purchases data:', error);
      setCostOfSalesData([]);
      setPurchasesData([]);
    }
  };

  const fetchWeekdayAverageData = async () => {
    if (!selectedPharmacy) return;

    try {
      const pharmacy = getPharmacyByCode(selectedPharmacy);
      if (!pharmacy) return;

      const endDate = new Date(selectedDate);
      const startDate = new Date(selectedDate);
      startDate.setMonth(startDate.getMonth() - 6);
      const startDateStr = formatDateLocal(startDate);
      const endDateStr = formatDateLocal(endDate);

      const range = await newPharmacyAPI.getDailySales(pharmacy.id, startDateStr, endDateStr);
      const arr = Array.isArray(range) ? range : [];

      const weekdayTotals: { [key: number]: { total: number; count: number } } = {
        0: { total: 0, count: 0 },
        1: { total: 0, count: 0 },
        2: { total: 0, count: 0 },
        3: { total: 0, count: 0 },
        4: { total: 0, count: 0 },
        5: { total: 0, count: 0 },
        6: { total: 0, count: 0 },
      };

      arr.forEach((d: any) => {
        const dt = new Date(d.business_date);
        const w = dt.getDay();
        const t = Number(d.turnover) || 0;
        weekdayTotals[w].total += t;
        weekdayTotals[w].count += 1;
      });

      const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const chartData = weekdayNames.map((name, idx) => {
        const data = weekdayTotals[idx];
        const avg = data.count > 0 ? data.total / data.count : 0;
        return { value: avg, label: name, frontColor: colors.accentPrimary };
      });

      setWeekdayAvgData(chartData);
    } catch (error) {
      console.error('Error fetching weekday average data:', error);
      setWeekdayAvgData([]);
    }
  };

  // Fetch monthly data
  const fetchMonthlyData = async (showLoadingScreen: boolean = true) => {
    if (!selectedPharmacy) return;

    try {
      if (showLoadingScreen) {
        setLoading(true);
      } else {
        setBackgroundLoading(true);
      }
      
      const pharmacy = getPharmacyByCode(selectedPharmacy);
      if (!pharmacy) throw new Error('Invalid pharmacy');

      // Current month key and through-date
      const monthKey = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}`;
      const throughDate = formatDateLocal(selectedDate);

      // Previous year same month key and through-date aligned to same day
      const prevYear = selectedDate.getFullYear() - 1;
      const prevMonthKey = `${prevYear}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}`;
      const prevThroughDate = `${prevYear}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;

      // Fetch MTD aggregates for both current and previous year
      const [currentMTD, prevMTD] = await Promise.all([
        newPharmacyAPI.getMTD(pharmacy.id, monthKey, throughDate),
        newPharmacyAPI.getMTD(pharmacy.id, prevMonthKey, prevThroughDate)
      ]);

      const currentData: MonthlyData = {
        turnover: Number(currentMTD?.turnover) || 0,
        grossProfit: Number(currentMTD?.gp_value) || 0,
        grossProfitPercent: 0,
        basketValue: Number(currentMTD?.avg_basket) || 0,
        basketItems: Number(currentMTD?.transaction_count) || 0,
        costOfSales: Number(currentMTD?.cost_of_sales) || 0,
        purchases: Number(currentMTD?.purchases) || 0,
        dispensaryPercent: Number(currentMTD?.disp_pct) || 0,
        dispensaryTurnover: Number(currentMTD?.dispensary_turnover) || 0,
        scriptsDispensed: Number(currentMTD?.scripts_qty) || 0,
        cashSales: Number(currentMTD?.sales_cash) || 0,
        accountSales: Number(currentMTD?.sales_account) || 0,
      };

      const prevData: MonthlyData = {
        turnover: Number(prevMTD?.turnover) || 0,
        grossProfit: Number(prevMTD?.gp_value) || 0,
        grossProfitPercent: 0,
        basketValue: Number(prevMTD?.avg_basket) || 0,
        basketItems: Number(prevMTD?.transaction_count) || 0,
        costOfSales: Number(prevMTD?.cost_of_sales) || 0,
        purchases: Number(prevMTD?.purchases) || 0,
        dispensaryPercent: Number(prevMTD?.disp_pct) || 0,
        dispensaryTurnover: Number(prevMTD?.dispensary_turnover) || 0,
        scriptsDispensed: Number(prevMTD?.scripts_qty) || 0,
        cashSales: Number(prevMTD?.sales_cash) || 0,
        accountSales: Number(prevMTD?.sales_account) || 0,
      };

      // Compute GP% as gp_value / (turnover - type_r_sales); gp_value comes from API
      const currentDenom = (Number(currentMTD?.turnover) || 0) - (Number(currentMTD?.type_r_sales) || 0);
      currentData.grossProfitPercent = currentDenom > 0 ? (currentData.grossProfit / currentDenom) * 100 : 0;

      const prevDenom = (Number(prevMTD?.turnover) || 0) - (Number(prevMTD?.type_r_sales) || 0);
      prevData.grossProfitPercent = prevDenom > 0 ? (prevData.grossProfit / prevDenom) * 100 : 0;

      // Compute MTD Avg Basket = (turnover − type_r_sales) / transaction_count
      const currentBasketNumerator = (Number(currentMTD?.turnover) || 0) - (Number(currentMTD?.type_r_sales) || 0);
      currentData.basketValue = currentData.basketItems > 0 ? currentBasketNumerator / currentData.basketItems : 0;

      const prevBasketNumerator = (Number(prevMTD?.turnover) || 0) - (Number(prevMTD?.type_r_sales) || 0);
      prevData.basketValue = prevData.basketItems > 0 ? prevBasketNumerator / prevData.basketItems : 0;

      // Compute MTD Dispensary % from amounts
      currentData.dispensaryPercent = currentData.turnover > 0 ? (currentData.dispensaryTurnover / currentData.turnover) * 100 : 0;
      prevData.dispensaryPercent = prevData.turnover > 0 ? (prevData.dispensaryTurnover / prevData.turnover) * 100 : 0;

      setMonthlyData(currentData);
      setPreviousMonthData(prevData);
    } catch (error: any) {
      console.error('Error fetching monthly data (MTD):', error);
      if (showLoadingScreen) {
        Alert.alert('Error', 'Failed to load monthly data. Please try again.');
      }
    } finally {
      if (showLoadingScreen) {
        setLoading(false);
      } else {
        setBackgroundLoading(false);
      }
    }
  };

  // Fetch data only when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      if (selectedPharmacy) {
        fetchMonthlyData(true);
        fetchCumulativeTurnoverData();
        fetchLast12MonthsData();
        fetchCostOfSalesAndPurchasesData();
        fetchWeekdayAverageData();
      }
    }, [selectedPharmacy, selectedDate])
  );

  // Helper functions for percentage changes
  const getPercentageChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const getTrendIndicator = (current: number, previous: number) => {
    const change = getPercentageChange(current, previous);
    if (change > 0) {
      return <TrendingUp size={14} color={colors.bgGradientFrom} strokeWidth={2.5} />;
    } else if (change < 0) {
      return <TrendingDown size={14} color={colors.bgGradientFrom} strokeWidth={2.5} />;
    }
    return null;
  };

  const getChangeIndicator = (current: number, previous: number) => {
    const change = getPercentageChange(current, previous);
    const isPositive = change >= 0;
    return {
      text: `${isPositive ? '+' : ''}${change.toFixed(1)}%`,
      color: isPositive ? colors.statusSuccess : colors.statusError
    };
  };

  // Date picker handlers
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

  const handleShowMore = () => {
    navigation.navigate('MonthlyHistory' as never);
  };

  // Pull-to-refresh handler
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        fetchMonthlyData(false),
        fetchCumulativeTurnoverData(),
        fetchLast12MonthsData(),
        fetchCostOfSalesAndPurchasesData(),
        fetchWeekdayAverageData()
      ]);
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Date change via horizontal scroller
  const handleDateFromScroller = (d: Date) => setSelectedDate(d);

  return (
    <View style={styles.container}>
      {(loading || backgroundLoading) && (
        <View style={styles.loadingOverlay} pointerEvents="auto">
          <ActivityIndicator size="large" color={colors.accentPrimary} />
        </View>
      )}

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

          {/* Right side: Calendar Icon */}
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
        
        {/* Loading overlay is handled at the root */}
        
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
          <Text style={styles.summaryTitle}>Monthly Summary</Text>
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
                {getTrendIndicator(monthlyData?.turnover || 0, previousMonthData?.turnover || 0) || (
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
                <Text style={styles.turnoverValue}>
                  {loading || backgroundLoading ? '...' : formatCurrency(monthlyData?.turnover || 0)}
                </Text>
              </View>
            </View>
            
            {turnoverCardExpanded && (
              <View style={styles.turnoverExpandedContent}>
                <View style={styles.turnoverComparisonRow}>
                  <Text style={styles.comparisonText}>
                    vs Previous Year MTD: {backgroundLoading ? '...' : formatCurrency(previousMonthData?.turnover || 0)}
                  </Text>
                  <Text style={[styles.changeText, { color: getChangeIndicator(monthlyData?.turnover || 0, previousMonthData?.turnover || 0).color }]}>
                    {backgroundLoading ? '...' : getChangeIndicator(monthlyData?.turnover || 0, previousMonthData?.turnover || 0).text}
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
                <Text style={styles.gpValue}>
                  {loading || backgroundLoading ? '...' : `${(monthlyData?.grossProfitPercent || 0).toFixed(1)}%`}
                </Text>
              </View>
            </View>
            
            {gpCardExpanded && (
              <View style={styles.gpExpandedContent}>
                <View style={styles.gpDetailRow}>
                  <Text style={styles.gpDetailLabel}>GP</Text>
                  <Text style={styles.gpDetailValue}>{backgroundLoading ? '...' : formatCurrency(monthlyData?.grossProfit || 0)}</Text>
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
                <Text style={styles.costOfSalesValue}>
                  {loading || backgroundLoading ? '...' : formatCurrency(monthlyData?.costOfSales || 0)}
                </Text>
              </View>
            </View>
            
            {costOfSalesCardExpanded && (
              <View style={styles.costOfSalesExpandedContent}>
                <View style={styles.costOfSalesDetailRow}>
                  <Text style={styles.costOfSalesDetailLabel}>Purchases</Text>
                  <Text style={styles.costOfSalesDetailValue}>{backgroundLoading ? '...' : formatCurrency(monthlyData?.purchases || 0)}</Text>
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
                <Text style={styles.basketValue}>
                  {loading || backgroundLoading ? '...' : formatCurrency(monthlyData?.basketValue || 0)}
                </Text>
              </View>
            </View>
            
            {basketCardExpanded && (
              <View style={styles.basketExpandedContent}>
                <View style={styles.basketDetailRow}>
                  <Text style={styles.basketDetailLabel}>Transactions</Text>
                  <Text style={styles.basketDetailValue}>{backgroundLoading ? '...' : Math.round(monthlyData?.basketItems || 0)}</Text>
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
                if (!monthlyData) {
                  return (
                    <View style={styles.noAlertsContainer}>
                      <Text style={styles.noAlertsText}>Loading data...</Text>
                    </View>
                  );
                }
                const alerts = getAlerts(monthlyData, previousMonthData);
                
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
                  <Text style={styles.scriptsLabel}>Scripts MTD</Text>
                  <ChevronRight 
                    size={14} 
                    color={colors.textSecondary} 
                    style={[
                      styles.expandArrow,
                      { transform: [{ rotate: scriptsCardExpanded ? '90deg' : '0deg' }] }
                    ]}
                  />
                </View>
                <Text style={styles.scriptsValue}>
                  {loading || backgroundLoading ? '...' : Math.round(monthlyData?.scriptsDispensed || 0)}
                </Text>
              </View>
            </View>
            
            {scriptsCardExpanded && (
              <View style={styles.scriptsExpandedContent}>
                <View style={styles.scriptsComparisonRow}>
                  <Text style={styles.comparisonText}>
                    vs Previous Year MTD: {backgroundLoading ? '...' : Math.round(previousMonthData?.scriptsDispensed || 0)}
                  </Text>
                  <Text style={[styles.changeText, { color: getChangeIndicator(monthlyData?.scriptsDispensed || 0, previousMonthData?.scriptsDispensed || 0).color }]}>
                    {backgroundLoading ? '...' : getChangeIndicator(monthlyData?.scriptsDispensed || 0, previousMonthData?.scriptsDispensed || 0).text}
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
                  {loading || backgroundLoading ? '...' : (monthlyData?.scriptsDispensed && monthlyData?.scriptsDispensed > 0 ? formatCurrency((monthlyData?.dispensaryTurnover || 0) / monthlyData.scriptsDispensed) : 'R 0')}
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
                <Text style={[styles.dispensaryPercentageText, { color: colors.chartGold }]}>{Math.round(monthlyData?.dispensaryPercent || 0)}%</Text>
              </View>
              <Text style={styles.dispensaryBreakdownValue}>
                {loading || backgroundLoading ? '...' : formatCurrency((monthlyData?.turnover || 0) * ((monthlyData?.dispensaryPercent || 0) / 100))}
              </Text>
            </View>
            <View style={styles.dispensaryBreakdownItem}>
              <View style={styles.dispensaryBreakdownLeft}>
                <View style={[styles.dispensaryPercentageCircle, { backgroundColor: colors.textSecondary }]} />
                <Text style={styles.dispensaryBreakdownLabel}>Front Shop</Text>
                <Text style={[styles.dispensaryPercentageText, { color: colors.textSecondary }]}>{Math.round(100 - (monthlyData?.dispensaryPercent || 0))}%</Text>
              </View>
              <Text style={styles.dispensaryBreakdownValue}>
                {loading || backgroundLoading ? '...' : formatCurrency((monthlyData?.turnover || 0) * ((100 - (monthlyData?.dispensaryPercent || 0)) / 100))}
              </Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={styles.dispensaryPercentageSection}>
            <View style={styles.dispensaryProgressBar}>
              <View style={[styles.dispensaryProgressFill, { width: `${Math.min(monthlyData?.dispensaryPercent || 0, 100)}%`, backgroundColor: colors.chartGold }]} />
              <View style={[styles.dispensaryProgressFill, { width: `${Math.max(0, 100 - (monthlyData?.dispensaryPercent || 0))}%`, backgroundColor: colors.textSecondary }]} />
            </View>
          </View>
        </View>

        {/* Trends Section */}
        <View style={styles.trendsSection}>
          <Text style={styles.trendsTitle}>Trends</Text>
          <Text style={styles.lineChartTitle}>MTD Turnover</Text>
        </View>
        
        {/* Trends Container */}
        <View style={styles.trendsContainer}>
          {cumulativeTurnoverData.length > 0 ? (
            <View style={[styles.lineChartContainer, { alignItems: 'center' }]}>
              <DoubleLineChart
                data1={cumulativeTurnoverData.map((item: any, index: number) => ({
                  x: item.label,
                  y: item.value,
                  label: cumulativeTurnoverData.length > 15 && index % 2 === 1 ? '' : item.label,
                }))}
                data2={previousYearCumulativeData.map((item: any, index: number) => ({
                  x: item.label,
                  y: item.value,
                  label: previousYearCumulativeData.length > 15 && index % 2 === 1 ? '' : item.label,
                }))}
                width={width - 64}
                height={160}
                theme="dark"
                primaryColor={colors.accentPrimary}
                secondaryColor={colors.chartGold}
                strokeWidth={2}
                formatYLabel={(value: number) => {
                  if (value >= 1000000) return `R${(value / 1000000).toFixed(3)}M`;
                  if (value >= 1000) return `R${(value / 1000).toFixed(0)}k`;
                  return `R${value.toFixed(0)}`;
                }}
                formatXLabel={(value: string | number) => value.toString()}
                data1Label="Current Year"
                data2Label="Previous Year"
              />
            </View>
          ) : (
            <View style={styles.emptyTrendsCard}>
              <Text style={styles.emptyTrendsText}>Loading trends data...</Text>
            </View>
          )}
        </View>

        {/* Cost of Sales vs Purchases Section */}
        <View style={styles.last12MonthsSection}>
          <Text style={styles.barChartTitle}>Cost of Sales vs Purchases</Text>
        </View>
        
        {/* Cost of Sales vs Purchases Chart Container */}
        <View style={styles.trendsContainer}>
          {costOfSalesData.length > 0 && purchasesData.length > 0 ? (
            <View style={[styles.lineChartContainer, { alignItems: 'center' }]}>
              <DoubleLineChart
                data1={costOfSalesData.map((item: any) => ({
                  x: item.label,
                  y: item.value,
                  label: item.label,
                }))}
                data2={purchasesData.map((item: any) => ({
                  x: item.label,
                  y: item.value,
                  label: item.label,
                }))}
                width={width - 64}
                height={160}
                theme="dark"
                primaryColor={colors.costSales}
                secondaryColor={colors.accentPrimary}
                strokeWidth={2}
                formatYLabel={(value: number) => {
                  if (value >= 1000000) return `R${(value / 1000000).toFixed(3)}M`;
                  if (value >= 1000) return `R${(value / 1000).toFixed(0)}k`;
                  return `R${value.toFixed(0)}`;
                }}
                formatXLabel={(value: string | number) => value.toString()}
                data1Label="Cost of Sales"
                data2Label="Purchases"
              />
            </View>
          ) : (
            <View style={styles.emptyTrendsCard}>
              <Text style={styles.emptyTrendsText}>Loading cost of sales and purchases data...</Text>
            </View>
          )}
        </View>

        {/* Weekday Average Section */}
        <View style={styles.last12MonthsSection}>
          <Text style={styles.barChartTitle}>Avg Daily Turnover by Weekday (6 Months)</Text>
        </View>
        
        {/* Weekday Average Bar Chart Container */}
        <View style={styles.trendsContainer}>
          {weekdayAvgData.length > 0 ? (
            <View style={[styles.lineChartContainer, { alignItems: 'center' }]}>
              <SimpleBarChart
                data={weekdayAvgData.map((item: any) => ({
                  x: item.label,
                  y: item.value,
                  label: item.label,
                }))}
                width={width - 64}
                height={150}
                theme="dark"
                primaryColor="#8B5CF6"
                barWidth={30}
                barSpacing={10}
                formatYLabel={(value: number) => {
                  if (value >= 1000000) return `R${(value / 1000000).toFixed(3)}M`;
                  if (value >= 1000) return `R${(value / 1000).toFixed(0)}k`;
                  return `R${value.toFixed(0)}`;
                }}
                formatXLabel={(value: string | number) => value.toString()}
              />
            </View>
          ) : (
            <View style={styles.emptyTrendsCard}>
              <Text style={styles.emptyTrendsText}>Loading weekday average data...</Text>
            </View>
          )}
        </View>

        {/* Last 12 Months Section */}
        <View style={styles.last12MonthsSection}>
          <Text style={styles.barChartTitle}>Last 12 Months Turnover</Text>
        </View>
        
        {/* Last 12 Months Bar Chart Container */}
        <View style={styles.trendsContainer}>
          {last12MonthsData.length > 0 ? (
            <View style={[styles.lineChartContainer, { alignItems: 'center' }]}>
              <SimpleBarChart
                data={last12MonthsData.map((item: any) => ({
                  x: item.label,
                  y: item.value,
                  label: item.label,
                }))}
                width={width - 64}
                height={150}
                theme="dark"
                primaryColor={colors.accentPrimary}
                barWidth={16}
                barSpacing={8}
                formatYLabel={(value: number) => {
                  if (value >= 1000000) return `R${(value / 1000000).toFixed(3)}M`;
                  if (value >= 1000) return `R${(value / 1000).toFixed(0)}k`;
                  return `R${value.toFixed(0)}`;
                }}
                formatXLabel={(value: string | number) => value.toString()}
              />
            </View>
          ) : (
            <View style={styles.emptyTrendsCard}>
              <Text style={styles.emptyTrendsText}>Loading last 12 months data...</Text>
            </View>
          )}
        </View>
      </ScrollView>

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
  stickyHeader: {
    padding: 16,
    paddingTop: 63,
    backgroundColor: colors.bgGradientFrom,
    zIndex: 1000,
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
  scrollContent: {
    flex: 1,
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
  placeholderText: {
    fontSize: 16,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  // Dropdown styles
  dropdownContainer: {
    position: 'absolute',
    top: 0,
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
  // Metric card styles
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
  // Dispensary breakdown styles
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
  // Trends section styles
  trendsSection: {
    paddingHorizontal: 16,
    marginTop: 4,
    marginBottom: -32,
  },
  last12MonthsSection: {
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
  lineChartContainer: {
    alignItems: 'flex-start',
    paddingVertical: 16,
  },
  lineChartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 16,
    textAlign: 'left',
  },
  barChartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 16,
    textAlign: 'left',
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  dateLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  // Metrics grid styles
  metricsGrid: {
    paddingHorizontal: 16,
    gap: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
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
  // Comparison and change text styles
  comparisonText: {
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
  },
  changeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.statusSuccess,
  },
  // Loading styles
  loadingContainer: {},
  loadingText: {},
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
});

export default MonthlyScreen; 