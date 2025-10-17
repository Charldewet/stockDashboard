import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Dimensions,
  Modal,
  FlatList,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { AuthNavigationProp } from '../../types/navigation';
import ErrorAlert from '../../components/common/ErrorAlert';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationsContext';
import { useTheme } from '../../contexts/ThemeContext';
import { newPharmacyAPI } from '../../services/api';
import { getPharmacyByCode } from '../../config/api';
import { formatDateDisplay, formatDateLocal, getPreviousYearSameDayOfWeek } from '../../utils/dateUtils';
import { formatCurrency, calculatePercentageChange } from '../../utils/formatUtils';
import { TrendingUp, TrendingDown, AlertCircle, ChevronDown, Calendar, CheckCircle, AlertTriangle, Menu, LogOut, User, Bell, Shield, Settings, DollarSign, ShoppingCart, ShoppingBasket, BarChart3, ChevronRight, Moon, Sun } from 'lucide-react-native';
import CustomDatePicker from '../../components/common/CustomDatePicker';
// import DateScroller from '../../components/common/DateScroller';
import PlaceholderChart from '../../components/common/PlaceholderChart';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { Image } from 'react-native';

const { width } = Dimensions.get('window');

const DashboardScreen = () => {
  const navigation = useNavigation<AuthNavigationProp>();
  const { selectedPharmacy, pharmacies, setSelectedPharmacy, selectedDate, setSelectedDate, logout, user } = useAuth();
  const { unreadCount } = useNotifications();
  const { colors, themeMode, toggleTheme } = useTheme();
  const styles = getStyles(colors);
  
  const [tempSelectedDate, setTempSelectedDate] = useState(selectedDate);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Chart data states
  const [sevenDayData, setSevenDayData] = useState<{
    currentYear: Array<{ date: Date; turnover: number; label: string }>;
    previousYear: Array<{ date: Date; turnover: number; label: string }>;
  }>({ currentYear: [], previousYear: [] });
  const [chartLoading, setChartLoading] = useState(true);

  const username = (user?.username || user?.name || '').toString();
  
  // Purchases chart data
  const [purchasesData, setPurchasesData] = useState<Array<{
    date: Date;
    purchases: number;
    sales: number;
    costOfSales: number;
    gpPercent?: number;
    label: string;
  }>>([]);
  const [purchasesChartLoading, setPurchasesChartLoading] = useState(true);
  // Basket chart data
  const [basketData, setBasketData] = useState<Array<{
    date: Date;
    basketValue: number; // average basket value for the day
    transactions: number; // transaction quantity for the day
    label: string; // day label
  }>>([]);
  const [basketChartLoading, setBasketChartLoading] = useState(true);
  const [selectedBasketTab, setSelectedBasketTab] = useState<'value' | 'transactions'>('value');
  const [basketTooltip, setBasketTooltip] = useState<{
    index: number;
    x: number;
    y: number;
    title: string;
    percent?: number;
    count?: number;
    color: string;
  } | null>(null);
  // GP Percentage section
  const [gpCollapsed, setGpCollapsed] = useState(false);
  const [gpTooltip, setGpTooltip] = useState<{
    index: number;
    x: number;
    y: number;
    title: string;
    color: string;
  } | null>(null);
  // Section collapse states
  const [turnoverCollapsed, setTurnoverCollapsed] = useState(false);
  const [purchasesCollapsed, setPurchasesCollapsed] = useState(false);
  const [basketCollapsed, setBasketCollapsed] = useState(false);
  const [dailyTooltip, setDailyTooltip] = useState<{
    index: number;
    x: number;
    y: number;
    title: string;
    percent: number;
    color: string;
  } | null>(null);
  const [monthlyChartLoading, setMonthlyChartLoading] = useState(true);
  const [monthlyTooltip, setMonthlyTooltip] = useState<{
    index: number;
    x: number;
    y: number;
    title: string;
    percent: number;
    color: string;
  } | null>(null);
  const [selectedTurnoverTab, setSelectedTurnoverTab] = useState<'day' | 'year'>('day');
  const [selectedPurchasesTab, setSelectedPurchasesTab] = useState<'sales' | 'cos'>('sales');
  const [purchasesTooltip, setPurchasesTooltip] = useState<{
    index: number;
    x: number;
    y: number;
    title: string;
    percent: number;
    color: string;
  } | null>(null);
  const [twelveMonthData, setTwelveMonthData] = useState<{
    currentYear: Array<{ monthKey: string; turnover: number; label: string }>;
    previousYear: Array<{ monthKey: string; turnover: number; label: string }>;
  }>({ currentYear: [], previousYear: [] });
  
  // Error alert states
  const [showErrorAlert, setShowErrorAlert] = useState(false);
  const [errorTitle, setErrorTitle] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  
  // Selector states
  const [showPharmacyDropdown, setShowPharmacyDropdown] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showScoreCardsInfo, setShowScoreCardsInfo] = useState(false);
  const [showHamburgerMenu, setShowHamburgerMenu] = useState(false);
  const slideAnim = useRef(new Animated.Value(-width)).current;

  // Fetch 12-day turnover data
  const fetchSevenDayData = async () => {
    if (!selectedPharmacy) return;

    try {
      setChartLoading(true);
      const pharmacy = getPharmacyByCode(selectedPharmacy);
      if (!pharmacy) return;

      // Build a candidate date range scanning back far enough to find 12 trading days
      const maxLookbackDays = 45;
      const candidateDates: Date[] = [];
      for (let i = 0; i < maxLookbackDays; i++) {
        const d = new Date(selectedDate);
        d.setDate(selectedDate.getDate() - i);
        candidateDates.push(d);
      }

      // Fetch current-year data for the candidate window (range-based request)
      const candidateStart = candidateDates[candidateDates.length - 1];
      const candidateEnd = candidateDates[0];
      const currentRangeStartStr = formatDateLocal(candidateStart);
      const currentRangeEndStr = formatDateLocal(candidateEnd);

      const currentYearData = await newPharmacyAPI.getDailySales(
        pharmacy.id,
        currentRangeStartStr,
        currentRangeEndStr
      );

      const currentYearMap = new Map<string, number>();
      (Array.isArray(currentYearData) ? currentYearData : []).forEach((d: any) => {
        currentYearMap.set(d.business_date, Number(d.turnover) || 0);
      });

      // Select most recent 12 dates with trading (> 0)
      const selectedCurrentDatesDesc: Date[] = [];
      for (const d of candidateDates) {
        const ds = formatDateLocal(d);
        const val = currentYearMap.get(ds) || 0;
        if (val > 0) {
          selectedCurrentDatesDesc.push(d);
        }
        if (selectedCurrentDatesDesc.length === 12) break;
      }

      const selectedCurrentDates = selectedCurrentDatesDesc
        .slice()
        .reverse(); // chronological order

      if (selectedCurrentDates.length === 0) {
        setSevenDayData({ currentYear: [], previousYear: [] });
        setChartLoading(false);
        return;
      }

      // Compute corresponding previous-year dates for the selected current dates
      const selectedPreviousDates = selectedCurrentDates.map(d => getPreviousYearSameDayOfWeek(d));

      // Fetch previous-year data for min..max of selected previous-year dates
      const prevStart = selectedPreviousDates[0];
      const prevEnd = selectedPreviousDates[selectedPreviousDates.length - 1];
      const prevStartStr = formatDateLocal(prevStart);
      const prevEndStr = formatDateLocal(prevEnd);

      const previousYearData = await newPharmacyAPI.getDailySales(
        pharmacy.id,
        prevStartStr,
        prevEndStr
      );

      const previousYearMap = new Map<string, number>();
      (Array.isArray(previousYearData) ? previousYearData : []).forEach((d: any) => {
        previousYearMap.set(d.business_date, Number(d.turnover) || 0);
      });

      // Build chart datasets in chronological order
      const currentYearChartData = selectedCurrentDates.map(date => {
        const dateStr = formatDateLocal(date);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        return {
          date,
          turnover: currentYearMap.get(dateStr) || 0,
          label: dayName,
        };
      });

      const previousYearChartData = selectedPreviousDates.map((date, index) => {
        const dateStr = formatDateLocal(date);
        const dayName = selectedCurrentDates[index].toLocaleDateString('en-US', { weekday: 'short' });
        return {
          date,
          turnover: previousYearMap.get(dateStr) || 0,
          label: dayName,
        };
      });

      setSevenDayData({ currentYear: currentYearChartData, previousYear: previousYearChartData });
    } catch (error) {
      console.error('Error fetching 12-day data:', error);
      setSevenDayData({ currentYear: [], previousYear: [] });
    } finally {
      setChartLoading(false);
    }
  };

  // Fetch 12-month turnover data (month vs same month previous year, aligned to same day-of-month)
  const fetchTwelveMonthData = async () => {
    if (!selectedPharmacy) return;
    try {
      setMonthlyChartLoading(true);
      const pharmacy = getPharmacyByCode(selectedPharmacy);
      if (!pharmacy) return;

      // Build 12 months back including selected month, chronological order
      const months: Array<{ y: number; m: number; isCurrentMonth: boolean }> = [];
      const base = new Date(selectedDate);
      const selectedYear = base.getFullYear();
      const selectedMonth = base.getMonth();
      
      for (let i = 11; i >= 0; i--) {
        const monthDate = new Date(selectedYear, selectedMonth - i, 1);
        const y = monthDate.getFullYear();
        const m = monthDate.getMonth();
        const isCurrentMonth = (y === selectedYear && m === selectedMonth);
        months.push({ y, m, isCurrentMonth });
      }

      const pad2 = (n: number) => String(n).padStart(2, '0');
      const ymd = (y: number, mZero: number, d: number) => `${y}-${pad2(mZero + 1)}-${pad2(d)}`;
      const monthKey = (y: number, mZero: number) => `${y}-${pad2(mZero + 1)}`;

      // Prepare requests
      const currentReqs: Array<Promise<any>> = [];
      const prevReqs: Array<Promise<any>> = [];
      const currentMeta: Array<{ key: string; label: string; through: string }> = [];
      const prevMeta: Array<{ key: string; label: string; through: string }> = [];

      months.forEach(({ y, m, isCurrentMonth }) => {
        const curKey = monthKey(y, m);
        
        // For current month: use selectedDate as through date
        // For past months: use last day of month (complete month)
        let curThrough: string;
        if (isCurrentMonth) {
          curThrough = formatDateLocal(selectedDate);
        } else {
          const lastDayOfMonth = new Date(y, m + 1, 0).getDate();
          curThrough = ymd(y, m, lastDayOfMonth);
        }
        
        currentMeta.push({ 
          key: curKey, 
          label: new Date(y, m, 1).toLocaleDateString('en-US', { month: 'short' }), 
          through: curThrough 
        });
        currentReqs.push(newPharmacyAPI.getMTD(pharmacy.id, curKey, curThrough));

        // Previous year: same logic but one year back
        const py = y - 1;
        const prevKey = monthKey(py, m);
        let prevThrough: string;
        if (isCurrentMonth) {
          // Use same day-of-month as selectedDate, but in previous year
          const prevYearDate = new Date(py, m, selectedDate.getDate());
          // Clamp to month end if needed
          const lastDayPrevYear = new Date(py, m + 1, 0).getDate();
          if (prevYearDate.getDate() > lastDayPrevYear) {
            prevYearDate.setDate(lastDayPrevYear);
          }
          prevThrough = formatDateLocal(prevYearDate);
        } else {
          const lastDayOfMonth = new Date(py, m + 1, 0).getDate();
          prevThrough = ymd(py, m, lastDayOfMonth);
        }
        
        prevMeta.push({ 
          key: prevKey, 
          label: new Date(y, m, 1).toLocaleDateString('en-US', { month: 'short' }), 
          through: prevThrough 
        });
        prevReqs.push(newPharmacyAPI.getMTD(pharmacy.id, prevKey, prevThrough));
      });

      const [currentRes, prevRes] = await Promise.all([
        Promise.all(currentReqs),
        Promise.all(prevReqs),
      ]);

      const currentYear = currentRes.map((res: any, idx: number) => ({
        monthKey: currentMeta[idx].key,
        turnover: Number(res?.turnover) || 0,
        label: currentMeta[idx].label,
      }));

      const previousYear = prevRes.map((res: any, idx: number) => ({
        monthKey: prevMeta[idx].key,
        turnover: Number(res?.turnover) || 0,
        label: prevMeta[idx].label,
      }));

      // Debug logging for September and October 2025
      console.log('📊 Monthly Chart Debug:');
      currentMeta.forEach((meta, idx) => {
        if (meta.key.includes('2025-09') || meta.key.includes('2025-10')) {
          console.log(`Current ${meta.key} (${meta.label}): through=${meta.through}, turnover=${currentYear[idx]?.turnover}`);
        }
      });
      prevMeta.forEach((meta, idx) => {
        if (meta.key.includes('2024-09') || meta.key.includes('2024-10')) {
          console.log(`Previous ${meta.key} (${meta.label}): through=${meta.through}, turnover=${previousYear[idx]?.turnover}`);
        }
      });

      setTwelveMonthData({ currentYear, previousYear });
    } catch (e) {
      console.error('Error fetching 12-month data:', e);
      setTwelveMonthData({ currentYear: [], previousYear: [] });
    } finally {
      setMonthlyChartLoading(false);
    }
  };

  // Fetch purchases data for 12 days
  const fetchPurchasesData = async () => {
    if (!selectedPharmacy) return;
    try {
      setPurchasesChartLoading(true);
      const pharmacy = getPharmacyByCode(selectedPharmacy);
      if (!pharmacy) return;

      const maxLookbackDays = 45;
      const candidateDates: Date[] = [];
      for (let i = 0; i < maxLookbackDays; i++) {
        const d = new Date(selectedDate);
        d.setDate(selectedDate.getDate() - i);
        candidateDates.push(d);
      }

      const candidateStart = candidateDates[candidateDates.length - 1];
      const candidateEnd = candidateDates[0];
      const startStr = formatDateLocal(candidateStart);
      const endStr = formatDateLocal(candidateEnd);

      const data = await newPharmacyAPI.getDailySales(pharmacy.id, startStr, endStr);
      const dataMap = new Map<string, any>();
      (Array.isArray(data) ? data : []).forEach((d: any) => {
        dataMap.set(d.business_date, d);
      });

      const selectedDatesDesc: Date[] = [];
      for (const d of candidateDates) {
        const ds = formatDateLocal(d);
        const dayData = dataMap.get(ds);
        if (dayData && Number(dayData.turnover || 0) > 0) {
          selectedDatesDesc.push(d);
        }
        if (selectedDatesDesc.length === 12) break;
      }

      const selectedDates = selectedDatesDesc.slice().reverse();
      const chartData = selectedDates.map(date => {
        const dateStr = formatDateLocal(date);
        const dayData = dataMap.get(dateStr);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        return {
          date,
          purchases: Number(dayData?.purchases) || 0,
          sales: Number(dayData?.turnover) || 0,
          costOfSales: Number(dayData?.cost_of_sales) || 0,
          gpPercent: (() => {
            const apiVal = dayData?.gp_percent ?? dayData?.gpPercent ?? dayData?.gross_profit_percent;
            if (apiVal !== undefined && apiVal !== null && !isNaN(Number(apiVal))) {
              return Number(apiVal);
            }
            const salesVal = Number(dayData?.turnover) || 0;
            const cosVal = Number(dayData?.cost_of_sales) || 0;
            if (salesVal <= 0) return 0;
            return ((salesVal - cosVal) / salesVal) * 100;
          })(),
          label: dayName,
        };
      });

      setPurchasesData(chartData);
    } catch (e) {
      console.error('Error fetching purchases data:', e);
      setPurchasesData([]);
    } finally {
      setPurchasesChartLoading(false);
    }
  };

  // Fetch basket chart data (last 12 trading days)
  const fetchBasketData = async () => {
    if (!selectedPharmacy) return;
    try {
      setBasketChartLoading(true);
      const pharmacy = getPharmacyByCode(selectedPharmacy);
      if (!pharmacy) return;

      const maxLookbackDays = 45;
      const candidateDates: Date[] = [];
      for (let i = 0; i < maxLookbackDays; i++) {
        const d = new Date(selectedDate);
        d.setDate(selectedDate.getDate() - i);
        candidateDates.push(d);
      }

      const start = candidateDates[candidateDates.length - 1];
      const end = candidateDates[0];
      const startStr = formatDateLocal(start);
      const endStr = formatDateLocal(end);

      const data = await newPharmacyAPI.getDailySales(pharmacy.id, startStr, endStr);
      const map = new Map<string, any>();
      (Array.isArray(data) ? data : []).forEach((d: any) => {
        map.set(d.business_date, d);
      });

      const selectedDatesDesc: Date[] = [];
      for (const d of candidateDates) {
        const ds = formatDateLocal(d);
        const dayData = map.get(ds);
        // treat trading day if turnover > 0
        if (dayData && Number(dayData.turnover || 0) > 0) {
          selectedDatesDesc.push(d);
        }
        if (selectedDatesDesc.length === 12) break;
      }

      const selectedDates = selectedDatesDesc.slice().reverse();
      const chartData = selectedDates.map(date => {
        const ds = formatDateLocal(date);
        const d = map.get(ds);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        // Resolve basket value from possible fields; fallback to turnover/transactions
        const sales = Number(d?.turnover) || 0;
        const tx = Number(
          d?.transaction_count ?? d?.transactions ?? d?.txn_count ?? d?.slips ?? d?.tx_count ?? d?.slip_count ?? 0
        );
        const avField = d?.avg_basket ?? d?.avgBasket ?? d?.avg_basket_value ?? d?.basket_value ?? d?.basketValue;
        const basketValue = avField !== undefined && !isNaN(Number(avField))
          ? Number(avField)
          : (tx > 0 ? sales / tx : 0);
        return { date, basketValue, transactions: tx, label: dayName };
      });

      setBasketData(chartData);
    } catch (e) {
      console.error('Error fetching basket data:', e);
      setBasketData([]);
    } finally {
      setBasketChartLoading(false);
    }
  };

  // Fetch data when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      if (selectedPharmacy) {
        fetchSevenDayData();
        fetchTwelveMonthData();
        fetchPurchasesData();
        fetchBasketData();
      }
    }, [selectedPharmacy, selectedDate])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchSevenDayData(), fetchTwelveMonthData(), fetchPurchasesData(), fetchBasketData()]);
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

  // Date change via scroller
  const handleDateFromScroller = (d: Date) => setSelectedDate(d);

  const clearTooltips = () => {
    setDailyTooltip(null);
    setMonthlyTooltip(null);
    setPurchasesTooltip(null);
    setBasketTooltip(null);
  };

  // Calculate score based on growth percentage
  // 10% growth = 100 score, 0% growth = 60 score, 20% growth = 120 score
  // Formula: score = 60 + (growth% * 4)
  const calculateScore = (growthPercent: number): number => {
    return Math.round(60 + (growthPercent * 4));
  };

  // Score Cards Component
  const ScoreCards = () => {
    // Calculate 12-day average growth for Sales
    const salesGrowth = (() => {
      if (!sevenDayData.currentYear.length || !sevenDayData.previousYear.length) return 0;
      
      const filteredPairs = sevenDayData.currentYear
        .map((c, i) => ({ current: c, previous: sevenDayData.previousYear[i] }))
        .filter(pair => (pair.current?.turnover || 0) > 0);
      
      if (filteredPairs.length === 0) return 0;
      
      // Calculate total for current and previous
      const currentTotal = filteredPairs.reduce((sum, pair) => sum + pair.current.turnover, 0);
      const previousTotal = filteredPairs.reduce((sum, pair) => sum + pair.previous.turnover, 0);
      
      return calculatePercentageChange(currentTotal, previousTotal);
    })();

    // Average GP% across 12 trading days
    const gpGrowth = (() => {
      if (!purchasesData.length) return 0;
      const valid = purchasesData.filter(d => typeof d.gpPercent === 'number');
      if (!valid.length) return 0;
      const avg = valid.reduce((sum, d) => sum + (d.gpPercent || 0), 0) / valid.length;
      return avg;
    })();
    
    // Purchases percentage against Sales for the same 12 days
    const purchasesPercent = (() => {
      if (!purchasesData.length) return 0;
      const totals = purchasesData.reduce(
        (acc, d) => {
          acc.purchases += Number(d.purchases) || 0;
          acc.sales += Number(d.sales) || 0;
          return acc;
        },
        { purchases: 0, sales: 0 }
      );
      if (totals.sales <= 0) return 0;
      return (totals.purchases / totals.sales) * 100;
    })();

    // Purple highlight condition
    const highlightPurple = (lowerTitle: string) => {
      if (lowerTitle === 'gp') return gpGrowth > 30;
      if (lowerTitle === 'sales growth' || lowerTitle === 'sales') return salesGrowth > 20;
      if (lowerTitle === 'purchases') return false; // no purple rule provided
      return false;
    };
    const purchasesGrowth = 0; // Placeholder

    const ScoreCard = ({ title, growthPercent, isPlaceholder = false }: { title: string; growthPercent: number; isPlaceholder?: boolean }) => {
      // Determine background color based on card type and growth
      const lowerTitle = title.toLowerCase();
      const getCardColor = () => {
        if (highlightPurple(lowerTitle)) {
          return colors.chartPurple;
        }
        if (lowerTitle === 'sales' || lowerTitle === 'sales growth') {
          if (growthPercent > 6) return colors.costSales; // green
          if (growthPercent >= 0) return colors.accentPrimaryFocus; // yellow
          return colors.accentPrimary; // orange
        } else if (lowerTitle === 'purchases' || lowerTitle.includes('purchases')) {
          // Purchases against Sales: green when <= 75%, orange when > 75%
          return growthPercent > 75 ? colors.accentPrimary : colors.costSales;
        }
        // Default/placeholder color for other cards for now
        if (growthPercent >= 10) return colors.costSales;
        if (growthPercent >= 5) return colors.accentPrimaryFocus;
        if (growthPercent >= 0) return colors.accentPrimary;
        return colors.statusError;
      };

      const cardColor = getCardColor();
      const rounded = Math.round(growthPercent);
      const lower = title.toLowerCase();
      const showPlus = lower === 'sales growth' && rounded > 0 || (lower === 'sales' && rounded > 0);
      const displayValue = `${showPlus ? '+' : ''}${rounded}%`;
      const titleText = (() => {
        const lowerTitle = lower;
        if (lowerTitle === 'sales growth') return 'SALES\nGROWTH';
        if (lowerTitle === 'gp') return 'GP\nPERCENTAGE';
        return title.toUpperCase();
      })();

      return (
        <View style={[styles.scoreCard, { backgroundColor: cardColor }]}>
          <Text style={[styles.scoreValue, { color: colors.bgGradientFrom }]} numberOfLines={1}>{displayValue}</Text>
          <Text style={styles.scoreTitle} numberOfLines={2}>{titleText}</Text>
        </View>
      );
    };

    return (
      <View style={styles.scoreCardsRow}>
        <View style={[styles.scoreCardWrapper, styles.scoreCardSide]}>
          <ScoreCard title="GP" growthPercent={gpGrowth} isPlaceholder />
        </View>
        <View style={[styles.scoreCardWrapper, styles.scoreCardCenter]}>
          <ScoreCard title="Sales Growth" growthPercent={salesGrowth} />
        </View>
        <View style={[styles.scoreCardWrapper, styles.scoreCardSide]}>
          <ScoreCard title="Purchases vs Sales" growthPercent={purchasesPercent} isPlaceholder />
        </View>
        <TouchableOpacity 
          style={styles.infoIcon}
          onPress={() => setShowScoreCardsInfo(true)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.infoIconText}>i</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Combined Turnover Chart Component with Tabs
  const TurnoverChartWithTabs = () => {
    const activeTooltip = dailyTooltip || monthlyTooltip;
    return (
      <View style={styles.sectionContainer}>
        {/* Title Row (collapsible) */}
        <TouchableOpacity style={styles.sectionHeaderRow} onPress={() => setTurnoverCollapsed(!turnoverCollapsed)} activeOpacity={0.7}>
          {turnoverCollapsed ? (
            <ChevronRight size={16} color={colors.textSecondary} />
          ) : (
            <ChevronDown size={16} color={colors.textSecondary} />
          )}
          <Text style={[styles.contentTitle, { marginBottom: 0 }]}>Turnover</Text>
        </TouchableOpacity>
        
        {/* Tab Selector */}
        {!turnoverCollapsed && (
        <View style={styles.tabContainerWrapper}>
          <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[
              styles.tabButton,
              selectedTurnoverTab === 'day' && styles.tabButtonActive
            ]}
            onPress={() => {
              setSelectedTurnoverTab('day');
              clearTooltips();
            }}
            activeOpacity={0.7}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          >
            <Text style={[
              styles.tabButtonText,
              selectedTurnoverTab === 'day' && styles.tabButtonTextActive
            ]}>
              Day
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.tabButton,
              selectedTurnoverTab === 'year' && styles.tabButtonActive
            ]}
            onPress={() => {
              setSelectedTurnoverTab('year');
              clearTooltips();
            }}
            activeOpacity={0.7}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          >
            <Text style={[
              styles.tabButtonText,
              selectedTurnoverTab === 'year' && styles.tabButtonTextActive
            ]}>
              Year
            </Text>
          </TouchableOpacity>
          </View>
        </View>
        )}

        {/* Chart Content */}
        {!turnoverCollapsed && (
        <View style={styles.chartWrapper}>
          {selectedTurnoverTab === 'day' ? <DayChart /> : <YearChart />}
        </View>
        )}

        {/* Fixed tooltip at top-right of section (hidden when collapsed) */}
        {activeTooltip && !turnoverCollapsed && (
          <View style={[
            styles.fixedTooltip,
            { borderColor: activeTooltip.color }
          ]} pointerEvents="none">
            <Text style={styles.fixedTooltipTitle}>{activeTooltip.title}</Text>
            <Text style={[styles.fixedTooltipValue, { color: activeTooltip.color }]}>
              {`${activeTooltip.percent > 0 ? '+' : ''}${activeTooltip.percent.toFixed(1)}%`}
            </Text>
          </View>
        )}
      </View>
    );
  };

  // Day Chart (formerly OverlaidBarChart)
  const DayChart = () => {
    if (chartLoading) {
      return (
        <View style={{ height: 120, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="small" color={colors.accentPrimary} />
        </View>
      );
    }

    if (sevenDayData.currentYear.length === 0) {
      return (
        <PlaceholderChart 
          height={120} 
          message="No data available" 
        />
      );
    }

    // Build paired data and filter out days with no trading (current year turnover == 0)
    const pairedData = sevenDayData.currentYear.map((c, i) => ({ current: c, previous: sevenDayData.previousYear[i] }));
    const filteredPairs = pairedData.filter(pair => (pair.current?.turnover || 0) > 0);

    if (filteredPairs.length === 0) {
      return (
        <PlaceholderChart 
          height={160} 
          message="No trading days in range" 
        />
      );
    }

    // Layout without card/axes/legend
    const chartWidth = width - 32; // screen padding 16 on each side
    const chartHeight = 108;
    const padding = { top: 8, right: 8, bottom: 28, left: 8 }; // Bottom padding for labels
    const chartArea = {
      width: chartWidth - padding.left - padding.right,
      height: chartHeight - padding.top - padding.bottom,
    };

    // Get max value from filtered datasets for scaling
    const allValues = [
      ...filteredPairs.map(p => p.current.turnover),
      ...filteredPairs.map(p => p.previous.turnover)
    ];
    const maxValue = Math.max(...allValues) || 1;

    // Calculate bar dimensions based on filtered count
    const count = filteredPairs.length;
    const barWidth = (chartArea.width / count) * 0.8; // 60% of available space per day
    const barSpacing = chartArea.width / count;

    return (
      <View onStartShouldSetResponder={() => true} onResponderRelease={() => {}}>
        <Svg width={chartWidth} height={chartHeight}>
          {/* Bars only */}
          {filteredPairs.map((pair, index) => {
          const x = padding.left + (index * barSpacing) + (barSpacing - barWidth) / 2;

          // Previous year bar (grey background)
          const heightScale = 0.7; // 30% of current height
          const prevBarHeight = (pair.previous.turnover / maxValue) * chartArea.height * heightScale;
          const prevBarY = padding.top + chartArea.height - prevBarHeight;

          // Current year bar (colored overlay)
          const currentBarHeight = (pair.current.turnover / maxValue) * chartArea.height * heightScale;
          const currentBarY = padding.top + chartArea.height - currentBarHeight;
          
          // Determine color based on comparison
          const isHigher = pair.current.turnover >= pair.previous.turnover;
          // Use app card colors: green for higher (costSales), orange for lower (accentPrimary)
          const currentBarColor = isHigher ? colors.costSales : colors.accentPrimary;

            const onPress = () => {
              const percent = calculatePercentageChange(pair.current.turnover, pair.previous.turnover);
              const bubbleX = x + barWidth / 2;
              const bubbleY = Math.min(prevBarY, currentBarY) - 8;
              setMonthlyTooltip(null);
              setDailyTooltip({
                index,
                x: bubbleX,
                y: bubbleY,
                title: pair.current.label,
                percent,
                color: currentBarColor,
              });
            };

            return (
              <React.Fragment key={index}>
                {/* Previous year bar (grey background) */}
                <Rect
                  x={x}
                  y={prevBarY}
                  width={barWidth}
                  height={prevBarHeight}
                  fill={colors.textSecondary}
                  opacity={0.4}
                  rx={2}
                />
                
                {/* Current year bar (colored overlay) */}
                <Rect
                  x={x}
                  y={currentBarY}
                  width={barWidth}
                  height={currentBarHeight}
                  fill={currentBarColor}
                  rx={2}
                  onPress={onPress}
                />
              </React.Fragment>
            );
          })}
          {/* X-axis labels */}
          {filteredPairs.map((pair, index) => {
            const x = padding.left + (index * barSpacing) + (barSpacing - barWidth) / 2;
            const labelX = x + barWidth / 2;
            const labelY = chartHeight - 10;
            return (
              <SvgText
                key={`label-${index}`}
                x={labelX}
                y={labelY}
                fontSize="12"
                fill={colors.textSecondary}
                textAnchor="middle"
              >
                {pair.current.label}
              </SvgText>
            );
          })}
        </Svg>
      </View>
    );
  };

  // Year Chart (formerly OverlaidMonthlyBarChart)
  const YearChart = () => {
    if (monthlyChartLoading) {
      return (
        <View style={{ height: 140, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="small" color={colors.accentPrimary} />
        </View>
      );
    }
    if (!twelveMonthData.currentYear.length) {
      return <PlaceholderChart height={140} message="No monthly data available" />;
    }

    const pairs = twelveMonthData.currentYear.map((c, i) => ({ current: c, previous: twelveMonthData.previousYear[i] }));

    const chartWidth = width - 32;
    const chartHeight = 108;
    const padding = { top: 8, right: 8, bottom: 28, left: 8 }; // Bottom padding for labels
    const chartArea = { width: chartWidth - padding.left - padding.right, height: chartHeight - padding.top - padding.bottom };

    const maxValue = Math.max(
      ...pairs.map(p => p.current.turnover),
      ...pairs.map(p => p.previous.turnover),
      1
    );

    const count = pairs.length; // expected 12
    const barWidth = (chartArea.width / count) * 0.75;
    const barSpacing = chartArea.width / count;
    const heightScale = 0.8;

    return (
      <View onStartShouldSetResponder={() => true} onResponderRelease={() => {}}>
        <Svg width={chartWidth} height={chartHeight}>
          {pairs.map((pair, index) => {
            const x = padding.left + (index * barSpacing) + (barSpacing - barWidth) / 2;
            const prevH = (pair.previous.turnover / maxValue) * chartArea.height * heightScale;
            const prevY = padding.top + chartArea.height - prevH;
            const curH = (pair.current.turnover / maxValue) * chartArea.height * heightScale;
            const curY = padding.top + chartArea.height - curH;
            const isHigher = pair.current.turnover >= pair.previous.turnover;
            const curColor = isHigher ? colors.costSales : colors.accentPrimary;
            const onPress = () => {
              const percent = calculatePercentageChange(pair.current.turnover, pair.previous.turnover);
              const bubbleX = x + barWidth / 2;
              const bubbleY = Math.min(prevY, curY) - 8;
              setDailyTooltip(null);
              setMonthlyTooltip({ index, x: bubbleX, y: bubbleY, title: pair.current.label, percent, color: curColor });
            };
            return (
              <React.Fragment key={index}>
                <Rect x={x} y={prevY} width={barWidth} height={prevH} fill={colors.textSecondary} opacity={0.4} rx={2} />
                <Rect x={x} y={curY} width={barWidth} height={curH} fill={curColor} rx={2} onPress={onPress} />
              </React.Fragment>
            );
          })}
          {/* X-axis labels */}
          {pairs.map((pair, index) => {
            const x = padding.left + (index * barSpacing) + (barSpacing - barWidth) / 2;
            const labelX = x + barWidth / 2;
            const labelY = chartHeight - 10;
            return (
              <SvgText
                key={`label-${index}`}
                x={labelX}
                y={labelY}
                fontSize="12"
                fill={colors.textSecondary}
                textAnchor="middle"
              >
                {pair.current.label}
              </SvgText>
            );
          })}
        </Svg>
      </View>
    );
  };

  // Purchases Chart Component with Sales/CoS tabs  
  const PurchasesChartWithTabs = () => {
    return (
      <View style={[styles.sectionContainer, { marginTop: 16 }]}> 
        <TouchableOpacity style={styles.sectionHeaderRow} onPress={() => setPurchasesCollapsed(!purchasesCollapsed)} activeOpacity={0.7}>
          {purchasesCollapsed ? (
            <ChevronRight size={16} color={colors.textSecondary} />
          ) : (
            <ChevronDown size={16} color={colors.textSecondary} />
          )}
          <Text style={[styles.contentTitle, { marginBottom: 0 }]}>Purchases</Text>
        </TouchableOpacity>
        
        {!purchasesCollapsed && (
        <View style={styles.tabContainerWrapper}>
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tabButton, selectedPurchasesTab === 'sales' && styles.tabButtonActive]}
              onPress={() => { setSelectedPurchasesTab('sales'); clearTooltips(); }}
              activeOpacity={0.7}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
            >
              <Text style={[styles.tabButtonText, selectedPurchasesTab === 'sales' && styles.tabButtonTextActive]}>Sales</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.tabButton, selectedPurchasesTab === 'cos' && styles.tabButtonActive]}
              onPress={() => { setSelectedPurchasesTab('cos'); clearTooltips(); }}
              activeOpacity={0.7}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
            >
              <Text style={[styles.tabButtonText, selectedPurchasesTab === 'cos' && styles.tabButtonTextActive]}>CoS</Text>
            </TouchableOpacity>
          </View>
        </View>
        )}

        {!purchasesCollapsed && (
        <View style={styles.chartWrapper}>
          {purchasesChartLoading ? (
            <View style={{ height: 108, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator size="small" color={colors.accentPrimary} />
            </View>
          ) : (
            <PurchasesChart />
          )}
        </View>
        )}
        {/* Fixed tooltip at top-right of section (hidden when collapsed) */}
        {purchasesTooltip && !purchasesCollapsed && (
          <View style={[
            styles.fixedTooltip,
            { borderColor: purchasesTooltip.color }
          ]} pointerEvents="none">
            <Text style={styles.fixedTooltipTitle}>{purchasesTooltip.title}</Text>
            <Text style={[styles.fixedTooltipValue, { color: purchasesTooltip.color }]}>
              {`${purchasesTooltip.percent.toFixed(1)}%`}
            </Text>
          </View>
        )}

        {!purchasesCollapsed && (
          <Text style={styles.infoText}>
            {selectedPurchasesTab === 'sales'
              ? 'Purchases should not be more than 75% of Sales for extended periods of time.'
              : 'Purchases should not exceed Cost of Sales for extended periods of time.'}
          </Text>
        )}
      </View>
    );
  };

  // Basket Charts Section
  const GpPercentageSection = () => {
    const activeTooltip = gpTooltip;
    const displayValue = (() => {
      if (activeTooltip == null) return '';
      const d = purchasesData[activeTooltip.index];
      if (!d) return '';
      return `${Math.round(d.gpPercent || 0)}%`;
    })();

    return (
      <View style={[styles.sectionContainer, { marginTop: 16 }]}> 
        <TouchableOpacity style={styles.sectionHeaderRow} onPress={() => setGpCollapsed(!gpCollapsed)} activeOpacity={0.7}>
          {gpCollapsed ? (
            <ChevronRight size={16} color={colors.textSecondary} />
          ) : (
            <ChevronDown size={16} color={colors.textSecondary} />
          )}
          <Text style={[styles.contentTitle, { marginBottom: 0 }]}>GP Percentage</Text>
        </TouchableOpacity>

        {!gpCollapsed && (
          <>
            <View style={styles.chartWrapper}>
              <GpPercentageChart />
            </View>
            {activeTooltip && (
              <View style={[styles.fixedTooltip, { borderColor: activeTooltip.color, top: 8, zIndex: 20 }]} pointerEvents="none">
                <Text style={styles.fixedTooltipTitle}>{activeTooltip.title}</Text>
                <Text style={[styles.fixedTooltipValue, { color: activeTooltip.color }]}>{displayValue}</Text>
              </View>
            )}
          </>
        )}
      </View>
    );
  };

  const GpPercentageChart = () => {
    // Use purchasesData.gpPercent for 12 most recent trading days
    if (!purchasesData.length) return <PlaceholderChart height={108} message="No data" />;
    const chartWidth = width - 32;
    const chartHeight = 108;
    const padding = { top: 8, right: 8, bottom: 28, left: 8 };
    const chartArea = { width: chartWidth - padding.left - padding.right, height: chartHeight - padding.top - padding.bottom };
    const count = purchasesData.length;
    const barWidth = (chartArea.width / count) * 0.8;
    const barSpacing = chartArea.width / count;
    const maxValue = Math.max(25, ...purchasesData.map(d => d.gpPercent || 0), 1);

    return (
      <View>
        <Svg width={chartWidth} height={chartHeight}>
          {purchasesData.map((d, index) => {
            const x = padding.left + (index * barSpacing) + (barSpacing - barWidth) / 2;
            const baseH = (25 / maxValue) * chartArea.height * 0.7; // background set to 25%
            const baseY = padding.top + chartArea.height - baseH;
            const gp = d.gpPercent || 0;
            const gpH = (gp / maxValue) * chartArea.height * 0.7;
            const gpY = padding.top + chartArea.height - gpH;
            const overlayColor = gp >= 25 ? colors.costSales : colors.accentPrimary; // green if >= 25, else orange
            const onPress = () => {
              const bubbleX = x + barWidth / 2;
              const bubbleY = Math.min(baseY, gpY) - 8;
              setGpTooltip({ index, x: bubbleX, y: bubbleY, title: d.label, color: overlayColor });
            };
            return (
              <React.Fragment key={`gp-${index}`}>
                <Rect x={x} y={baseY} width={barWidth} height={baseH} fill={colors.textSecondary} opacity={0.4} rx={2} />
                <Rect x={x} y={gpY} width={barWidth} height={gpH} fill={overlayColor} rx={2} onPress={onPress} />
              </React.Fragment>
            );
          })}
          {purchasesData.map((d, index) => {
            const x = padding.left + (index * barSpacing) + (barSpacing - barWidth) / 2;
            const labelX = x + barWidth / 2;
            const labelY = chartHeight - 10;
            return (
              <SvgText key={`gplbl-${index}`} x={labelX} y={labelY} fontSize="12" fill={colors.textSecondary} textAnchor="middle">{d.label}</SvgText>
            );
          })}
        </Svg>
      </View>
    );
  };
  const BasketChartWithTabs = () => {
    const activeTooltip = basketTooltip;
    const displayValue = (() => {
      if (activeTooltip == null) return '';
      const d = basketData[activeTooltip.index];
      if (!d) return '';
      if (selectedBasketTab === 'value') return `R${Math.round(d.basketValue || 0)}`;
      return `${Math.round(d.transactions || 0)}`;
    })();

    return (
      <View style={[styles.sectionContainer, { marginTop: 16 }]}> 
        <TouchableOpacity style={styles.sectionHeaderRow} onPress={() => setBasketCollapsed(!basketCollapsed)} activeOpacity={0.7}>
          {basketCollapsed ? (
            <ChevronRight size={16} color={colors.textSecondary} />
          ) : (
            <ChevronDown size={16} color={colors.textSecondary} />
          )}
          <Text style={[styles.contentTitle, { marginBottom: 0 }]}>Basket</Text>
        </TouchableOpacity>
        {!basketCollapsed && (
        <View style={styles.tabContainerWrapper}>
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tabButton, selectedBasketTab === 'value' && styles.tabButtonActive]}
              onPress={() => { setSelectedBasketTab('value'); clearTooltips(); }}
              activeOpacity={0.7}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
            >
              <Text style={[styles.tabButtonText, selectedBasketTab === 'value' && styles.tabButtonTextActive]}>Value</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabButton, selectedBasketTab === 'transactions' && styles.tabButtonActive]}
              onPress={() => { setSelectedBasketTab('transactions'); clearTooltips(); }}
              activeOpacity={0.7}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
            >
              <Text style={[styles.tabButtonText, selectedBasketTab === 'transactions' && styles.tabButtonTextActive]}>Trans</Text>
            </TouchableOpacity>
          </View>
        </View>
        )}
        {!basketCollapsed && (
          <>
            <View style={styles.chartWrapper}>
              {basketChartLoading ? (
                <View style={{ height: 108, alignItems: 'center', justifyContent: 'center' }}>
                  <ActivityIndicator size="small" color={colors.accentPrimary} />
                </View>
              ) : (
                selectedBasketTab === 'value' ? <BasketValueChart /> : <BasketTransactionsChart />
              )}
            </View>

            {activeTooltip && (
              <View style={[styles.fixedTooltip, { borderColor: colors.chartPurple }]} pointerEvents="none">
                <Text style={styles.fixedTooltipTitle}>{activeTooltip.title}</Text>
                <Text style={[styles.fixedTooltipValue, { color: colors.chartPurple }]}>{displayValue}</Text>
              </View>
            )}
          </>
        )}
      </View>
    );
  };

  const BasketValueChart = () => {
    if (!basketData.length) return <PlaceholderChart height={108} message="No data" />;
    const chartWidth = width - 32;
    const chartHeight = 108;
    const padding = { top: 8, right: 8, bottom: 28, left: 8 };
    const chartArea = { width: chartWidth - padding.left - padding.right, height: chartHeight - padding.top - padding.bottom };
    const count = basketData.length;
    const barWidth = (chartArea.width / count) * 0.8;
    const barSpacing = chartArea.width / count;
    // Max for scaling: compare to max of 200 and max actual value
    const maxValue = Math.max(200, ...basketData.map(d => d.basketValue), 1);

    return (
      <View>
        <Svg width={chartWidth} height={chartHeight}>
          {basketData.map((d, index) => {
            const x = padding.left + (index * barSpacing) + (barSpacing - barWidth) / 2;
            const baseH = (200 / maxValue) * chartArea.height * 0.7; // background set to R200
            const baseY = padding.top + chartArea.height - baseH;
            const purH = (d.basketValue / maxValue) * chartArea.height * 0.7;
            const purY = padding.top + chartArea.height - purH;
            const overlayColor = (d.basketValue || 0) >= 200 ? colors.costSales : colors.accentPrimary; // green if >= 200, else orange
            const onPress = () => {
              const bubbleX = x + barWidth / 2;
              const bubbleY = Math.min(baseY, purY) - 8;
              setBasketTooltip({ index, x: bubbleX, y: bubbleY, title: d.label, color: overlayColor });
            };
            return (
              <React.Fragment key={index}>
                <Rect x={x} y={baseY} width={barWidth} height={baseH} fill={colors.textSecondary} opacity={0.4} rx={2} />
                <Rect x={x} y={purY} width={barWidth} height={purH} fill={overlayColor} rx={2} onPress={onPress} />
              </React.Fragment>
            );
          })}
          {/* X labels */}
          {basketData.map((d, index) => {
            const x = padding.left + (index * barSpacing) + (barSpacing - barWidth) / 2;
            const labelX = x + barWidth / 2;
            const labelY = chartHeight - 10;
            return (
              <SvgText key={`basklbl-${index}`} x={labelX} y={labelY} fontSize="12" fill={colors.textSecondary} textAnchor="middle">{d.label}</SvgText>
            );
          })}
        </Svg>
      </View>
    );
  };

  const BasketTransactionsChart = () => {
    if (!basketData.length) return <PlaceholderChart height={108} message="No data" />;
    const chartWidth = width - 32;
    const chartHeight = 108;
    const padding = { top: 8, right: 8, bottom: 28, left: 8 };
    const chartArea = { width: chartWidth - padding.left - padding.right, height: chartHeight - padding.top - padding.bottom };
    const count = basketData.length;
    const barWidth = (chartArea.width / count) * 0.8;
    const barSpacing = chartArea.width / count;
    const maxValue = Math.max(...basketData.map(d => d.transactions), 1);
    return (
      <View>
        <Svg width={chartWidth} height={chartHeight}>
          {basketData.map((d, index) => {
            const x = padding.left + (index * barSpacing) + (barSpacing - barWidth) / 2;
            const h = (d.transactions / maxValue) * chartArea.height * 0.7;
            const y = padding.top + chartArea.height - h;
            const onPress = () => {
              const bubbleX = x + barWidth / 2;
              const bubbleY = y - 8;
              setBasketTooltip({ index, x: bubbleX, y: bubbleY, title: d.label, color: colors.costSales });
            };
            return <Rect key={`basktx-${index}`} x={x} y={y} width={barWidth} height={h} fill={colors.costSales} rx={2} onPress={onPress} />;
          })}
          {basketData.map((d, index) => {
            const x = padding.left + (index * barSpacing) + (barSpacing - barWidth) / 2;
            const labelX = x + barWidth / 2;
            const labelY = chartHeight - 10;
            return (
              <SvgText key={`basktxlbl-${index}`} x={labelX} y={labelY} fontSize="12" fill={colors.textSecondary} textAnchor="middle">{d.label}</SvgText>
            );
          })}
        </Svg>
      </View>
    );
  };

  const PurchasesChart = () => {
    if (!purchasesData.length) return <PlaceholderChart height={88} message="No data" />;
    
    const chartWidth = width - 32;
    const chartHeight = 108;
    const padding = { top: 8, right: 8, bottom: 28, left: 8 };
    const chartArea = { width: chartWidth - padding.left - padding.right, height: chartHeight - padding.top - padding.bottom };
    
    const comparisonField = selectedPurchasesTab === 'sales' ? 'sales' : 'costOfSales';
    const maxValue = Math.max(...purchasesData.map(d => Math.max(d.purchases, d[comparisonField])), 1);
    const count = purchasesData.length;
    const barWidth = (chartArea.width / count) * 0.8;
    const barSpacing = chartArea.width / count;
    const heightScale = 0.7;

    return (
      <View onStartShouldSetResponder={() => true} onResponderRelease={() => {}}>
        <Svg width={chartWidth} height={chartHeight}>
          {purchasesData.map((day, index) => {
            const x = padding.left + (index * barSpacing) + (barSpacing - barWidth) / 2;
            const baseValue = day[comparisonField];
            const baseH = (baseValue / maxValue) * chartArea.height * heightScale;
            const baseY = padding.top + chartArea.height - baseH;
            const purH = (day.purchases / maxValue) * chartArea.height * heightScale;
            const purY = padding.top + chartArea.height - purH;
            
            // Dynamic color by tab
            let purchasesColor = colors.chartPurple;
            if (selectedPurchasesTab === 'cos') {
              // Cost of Sales: green if purchases <= CoS, orange if > CoS
              purchasesColor = day.purchases > (day.costOfSales || 0)
                ? colors.accentPrimary
                : colors.costSales;
            } else if (selectedPurchasesTab === 'sales') {
              // Sales: green if purchases < 75% of sales, orange otherwise
              const sales = day.sales || 0;
              const pctOfSales = sales > 0 ? (day.purchases / sales) : 0;
              purchasesColor = pctOfSales < 0.75 ? colors.costSales : colors.accentPrimary;
            }
            
            const onPress = () => {
              const percent = baseValue > 0 ? (day.purchases / baseValue) * 100 : 0;
              setPurchasesTooltip({
                index,
                x: x + barWidth / 2,
                y: Math.min(baseY, purY) - 8,
                title: day.label,
                percent,
                color: purchasesColor,
              });
            };

            // For 'sales' tab, base is sales; overlay is purchases (purple)
            // For 'cos' tab, base is cost of sales; overlay is purchases (yellow/orange by comparison)
            return (
              <React.Fragment key={index}>
                {/* Base bar (grey) */}
                <Rect x={x} y={baseY} width={barWidth} height={baseH} fill={colors.textSecondary} opacity={0.4} rx={2} />
                {/* Overlay: Purchases */}
                <Rect x={x} y={purY} width={barWidth} height={purH} fill={purchasesColor} rx={2} onPress={onPress} />
              </React.Fragment>
            );
          })}
          {/* X-axis labels */}
          {purchasesData.map((day, index) => {
            const x = padding.left + (index * barSpacing) + (barSpacing - barWidth) / 2;
            const labelX = x + barWidth / 2;
            const labelY = chartHeight - 10;
            return (
              <SvgText
                key={`label-${index}`}
                x={labelX}
                y={labelY}
                fontSize="12"
                fill={colors.textSecondary}
                textAnchor="middle"
              >
                {day.label}
              </SvgText>
            );
          })}
        </Svg>
      </View>
    );
  };

  // Overlaid Bar Chart Component
  const OverlaidBarChart = () => {
    if (chartLoading) {
      return (
        <View style={{ height: 160, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="small" color={colors.accentPrimary} />
        </View>
      );
    }
    if (chartLoading) {
      return (
        <View style={{ height: 160, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="small" color={colors.accentPrimary} />
        </View>
      );
    }

    if (sevenDayData.currentYear.length === 0) {
      return (
        <PlaceholderChart 
          height={160} 
          message="No data available" 
        />
      );
    }

    // Build paired data and filter out days with no trading (current year turnover == 0)
    const pairedData = sevenDayData.currentYear.map((c, i) => ({ current: c, previous: sevenDayData.previousYear[i] }));
    const filteredPairs = pairedData.filter(pair => (pair.current?.turnover || 0) > 0);

    if (filteredPairs.length === 0) {
      return (
        <PlaceholderChart 
          height={160} 
          message="No trading days in range" 
        />
      );
    }

    // Layout without card/axes/legend
    const chartWidth = width - 32; // screen padding 16 on each side
    const chartHeight = 140;
    const padding = { top: 2, right: 8, bottom: 12, left: 8 };
    const chartArea = {
      width: chartWidth - padding.left - padding.right,
      height: chartHeight - padding.top - padding.bottom,
    };

    // Get max value from filtered datasets for scaling
    const allValues = [
      ...filteredPairs.map(p => p.current.turnover),
      ...filteredPairs.map(p => p.previous.turnover)
    ];
    const maxValue = Math.max(...allValues) || 1;

    // Calculate bar dimensions based on filtered count
    const count = filteredPairs.length;
    const barWidth = (chartArea.width / count) * 0.8; // 60% of available space per day
    const barSpacing = chartArea.width / count;

    return (
      <View style={{ paddingHorizontal: 16, marginTop: 0 }} onStartShouldSetResponder={() => true} onResponderRelease={() => {}}>
        <View style={{ marginBottom: -60 }}>
          <Text style={[styles.contentTitle, { marginBottom: 0 }]}>12 Day Turnover</Text>
        </View>
        <Svg width={chartWidth} height={chartHeight}>
          {/* Bars only */}
          {filteredPairs.map((pair, index) => {
          const x = padding.left + (index * barSpacing) + (barSpacing - barWidth) / 2;

          // Previous year bar (grey background)
          const heightScale = 0.4; // 30% of current height
          const prevBarHeight = (pair.previous.turnover / maxValue) * chartArea.height * heightScale;
          const prevBarY = padding.top + chartArea.height - prevBarHeight;

          // Current year bar (colored overlay)
          const currentBarHeight = (pair.current.turnover / maxValue) * chartArea.height * heightScale;
          const currentBarY = padding.top + chartArea.height - currentBarHeight;
          
          // Determine color based on comparison
          const isHigher = pair.current.turnover >= pair.previous.turnover;
          // Use app card colors: green for higher (costSales), orange for lower (accentPrimary)
          const currentBarColor = isHigher ? colors.costSales : colors.accentPrimary;

            const onPress = () => {
              const percent = calculatePercentageChange(pair.current.turnover, pair.previous.turnover);
              const bubbleX = x + barWidth / 2;
              const bubbleY = Math.min(prevBarY, currentBarY) - 8;
              setMonthlyTooltip(null);
              setDailyTooltip({
                index,
                x: bubbleX,
                y: bubbleY,
                title: pair.current.label,
                percent,
                color: currentBarColor,
              });
            };

            return (
            <React.Fragment key={index}>
              {/* Previous year bar (grey background) */}
              <Rect
                x={x}
                y={prevBarY}
                width={barWidth}
                height={prevBarHeight}
                fill={colors.textSecondary}
                opacity={0.4}
                rx={2}
              />
              
              {/* Current year bar (colored overlay) */}
              <Rect
                x={x}
                y={currentBarY}
                width={barWidth}
                height={currentBarHeight}
                fill={currentBarColor}
                rx={2}
                  onPress={onPress}
              />
            </React.Fragment>
          );
        })}
          {/* Tooltip bubble for daily */}
          {dailyTooltip && (
            <>
              <Rect
                x={dailyTooltip.x - 56}
                y={Math.max(0, dailyTooltip.y - 40)}
                width={112}
                height={40}
                rx={8}
                fill={colors.surfacePrimary}
                opacity={0.95}
              />
              <SvgText
                x={dailyTooltip.x}
                y={Math.max(14, dailyTooltip.y - 24)}
                fontSize="12"
                fill={colors.textPrimary}
                textAnchor="middle"
              >
                {dailyTooltip.title}
              </SvgText>
              <SvgText
                x={dailyTooltip.x}
                y={Math.max(28, dailyTooltip.y - 10)}
                fontSize="12"
                fill={dailyTooltip.color}
                fontWeight="bold"
                textAnchor="middle"
              >
                {`${dailyTooltip.percent > 0 ? '+' : ''}${dailyTooltip.percent.toFixed(1)}%`}
              </SvgText>
            </>
          )}
        </Svg>
      </View>
    );
  };

  // 12-Month Overlaid Bar Chart Component
  const OverlaidMonthlyBarChart = () => {
    if (monthlyChartLoading) {
      return (
        <View style={{ height: 140, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="small" color={colors.accentPrimary} />
        </View>
      );
    }
    if (!twelveMonthData.currentYear.length) {
      return <PlaceholderChart height={140} message="No monthly data available" />;
    }

    const pairs = twelveMonthData.currentYear.map((c, i) => ({ current: c, previous: twelveMonthData.previousYear[i] }));

    const chartWidth = width - 32;
    const chartHeight = 140;
    const padding = { top: 2, right: 8, bottom: 12, left: 8 };
    const chartArea = { width: chartWidth - padding.left - padding.right, height: chartHeight - padding.top - padding.bottom };

    const maxValue = Math.max(
      ...pairs.map(p => p.current.turnover),
      ...pairs.map(p => p.previous.turnover),
      1
    );

    const count = pairs.length; // expected 12
    const barWidth = (chartArea.width / count) * 0.75;
    const barSpacing = chartArea.width / count;
    const heightScale = 0.4;

    return (
      <View style={{ paddingHorizontal: 16, marginTop: 8 }} onStartShouldSetResponder={() => true} onResponderRelease={() => {}}>
        <View style={{ marginBottom: -60 }}>
          <Text style={[styles.contentTitle, { marginBottom: 0 }]}>12 Month Turnover</Text>
        </View>
        <Svg width={chartWidth} height={chartHeight}>
          {pairs.map((pair, index) => {
            const x = padding.left + (index * barSpacing) + (barSpacing - barWidth) / 2;
            const prevH = (pair.previous.turnover / maxValue) * chartArea.height * heightScale;
            const prevY = padding.top + chartArea.height - prevH;
            const curH = (pair.current.turnover / maxValue) * chartArea.height * heightScale;
            const curY = padding.top + chartArea.height - curH;
            const isHigher = pair.current.turnover >= pair.previous.turnover;
            const curColor = isHigher ? colors.costSales : colors.accentPrimary;
            const onPress = () => {
              const percent = calculatePercentageChange(pair.current.turnover, pair.previous.turnover);
              const bubbleX = x + barWidth / 2;
              const bubbleY = Math.min(prevY, curY) - 8;
              setDailyTooltip(null);
              setMonthlyTooltip({ index, x: bubbleX, y: bubbleY, title: pair.current.label, percent, color: curColor });
            };
            return (
              <React.Fragment key={index}>
                <Rect x={x} y={prevY} width={barWidth} height={prevH} fill={colors.textSecondary} opacity={0.4} rx={2} />
                <Rect x={x} y={curY} width={barWidth} height={curH} fill={curColor} rx={2} onPress={onPress} />
              </React.Fragment>
            );
          })}
        </Svg>
      </View>
    );
  };

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

          {/* Right side: Alerts and Calendar */}
          <View style={styles.headerRightRow}>
            <TouchableOpacity 
              style={styles.iconButton}
              onPress={() => navigation.navigate('Notifications' as never)}
            >
              <View>
                <Bell size={20} color={colors.textSecondary} />
                {unreadCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.iconButton}
              onPress={handleDatePickerOpen}
            >
              <Calendar size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
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
              
              <TouchableOpacity 
                style={styles.hamburgerMenuItem}
                onPress={toggleTheme}
              >
                {themeMode === 'dark' ? (
                  <Sun size={20} color={colors.textPrimary} />
                ) : (
                  <Moon size={20} color={colors.textPrimary} />
                )}
                <Text style={styles.hamburgerMenuItemText}>
                  {themeMode === 'dark' ? 'Light Mode' : 'Dark Mode'}
                </Text>
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
      <TouchableWithoutFeedback onPress={clearTooltips}>
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

          {/* Quick date scroller removed per request */}

          {/* Welcome Section */}
          <View style={styles.welcomeContainer}>
            <Image
              source={themeMode === 'dark' ? require('../../../assets/TLC Logo/DARK_LOGO.png') : require('../../../assets/TLC Logo/LIGHT_LOGO.png')}
              style={styles.welcomeLogo}
              resizeMode="contain"
            />
          </View>

          {/* Score Cards */}
          <ScoreCards />

          {/* Turnover Charts with Tabs */}
          <TurnoverChartWithTabs />

          {/* Purchases Charts with Tabs */}
          <PurchasesChartWithTabs />

          {/* GP Percentage (no tabs) */}
          <GpPercentageSection />

          {/* Basket Charts with Tabs */}
          <BasketChartWithTabs />

          
        </ScrollView>
      </TouchableWithoutFeedback>

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

        {/* Score Cards Info Modal */}
        <Modal
          visible={showScoreCardsInfo}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowScoreCardsInfo(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Score Cards Explained</Text>
              
              <View style={styles.infoSection}>
                <Text style={styles.infoSubtitle}>GP Percentage</Text>
                <Text style={styles.scoreCardsInfoText}>Shows the gross profit percentage for the last 12 trading days. Ideal to keep above 25%.</Text>
                
                <Text style={styles.infoSubtitle}>Sales Growth</Text>
                <Text style={styles.scoreCardsInfoText}>Compares total sales for the last 12 trading days to the same period last year.</Text>
                
                <Text style={styles.infoSubtitle}>Purchases vs Sales</Text>
                <Text style={styles.scoreCardsInfoText}>Shows what percentage of sales were spent on purchases over the last 12 trading days. Ideal to keep below 75%.</Text>
              </View>

              <View style={styles.colorSection}>
                <Text style={styles.colorTitle}>Colour Meanings:</Text>
                <View style={styles.colorRow}>
                  <View style={[styles.colorSwatch, { backgroundColor: colors.accentPrimary }]} />
                  <Text style={styles.colorText}>Orange: Needs attention</Text>
                </View>
                <View style={styles.colorRow}>
                  <View style={[styles.colorSwatch, { backgroundColor: colors.costSales }]} />
                  <Text style={styles.colorText}>Green: Good performance</Text>
                </View>
                <View style={styles.colorRow}>
                  <View style={[styles.colorSwatch, { backgroundColor: colors.chartPurple }]} />
                  <Text style={styles.colorText}>Purple: Excellent performance</Text>
                </View>
              </View>

              <TouchableOpacity 
                style={styles.scoreCardsModalButton}
                onPress={() => setShowScoreCardsInfo(false)}
              >
                <Text style={styles.scoreCardsModalButtonText}>Got it</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
    </View>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
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
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    padding: 8,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: colors.bgGradientFrom,
    fontSize: 10,
    fontWeight: '700',
  },
  dateSection: {
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  scoreCardsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    gap: 12,
  },
  scoreCardsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    width: '80%',
    alignSelf: 'center',
    maxWidth: 520,
  },
  welcomeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  welcomeLogo: {
    width: 200,
    height: 60,
    marginBottom: 6,
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  scoreCardWrapper: {
    flex: 1,
  },
  scoreCardSide: {
    zIndex: 0,
    marginHorizontal: -10,
    position: 'relative',
  },
  scoreCardCenter: {
    flex: 1.25,
    zIndex: 10,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 4 },
    elevation: 9,
  },
  scoreCard: {
    flex: 1,
    backgroundColor: colors.surfacePrimary,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 4,
    borderColor: colors.bgGradientFrom,
  },
  scoreValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 3,
  },
  scoreTitle: {
    fontSize: 8,
    fontWeight: '600',
    color: colors.bgGradientFrom,
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  infoIcon: {
    position: 'absolute',
    top: 8,
    right: -8,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  infoIconText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: colors.bgGradientFrom,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 20,
    textAlign: 'center',
  },
  infoSection: {
    marginBottom: 20,
  },
  infoSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 12,
    marginBottom: 4,
  },
  scoreCardsInfoText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 8,
  },
  colorSection: {
    marginBottom: 20,
  },
  colorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  colorSwatch: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 12,
  },
  colorText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  scoreCardsModalButton: {
    backgroundColor: colors.accentPrimary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  scoreCardsModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.bgGradientFrom,
  },
  contentSection: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  contentTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 0,
    marginBottom: 8,
    zIndex: 10,
  },
  sectionArrow: {
    fontSize: 16,
    color: colors.textSecondary,
    width: 14,
    textAlign: 'center',
  },
  contentText: {
    fontSize: 16,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  // Chart styles
  chartContainer: {
    backgroundColor: colors.surfacePrimary,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  chartLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  chartWrapper: {
    marginTop: -8,
    position: 'relative',
    zIndex: 1,
  },
  sectionContainer: {
    paddingHorizontal: 16,
    marginTop: 0,
    position: 'relative',
  },
  fixedTooltip: {
    position: 'absolute',
    top: 32,
    right: 16,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: colors.surfacePrimary,
    borderRadius: 8,
    borderWidth: 1,
    opacity: 0.98,
  },
  fixedTooltipTitle: {
    fontSize: 11,
    color: colors.textPrimary,
    textAlign: 'right',
  },
  fixedTooltipValue: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
  },
  infoText: {
    marginTop: 6,
    paddingHorizontal: 4,
    fontSize: 12,
    color: colors.textSecondary,
  },
  // Tab styles
  tabContainerWrapper: {
    alignItems: 'center',
    marginBottom: 0,
    zIndex: 100,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surfacePrimary,
    borderRadius: 8,
    padding: 4,
    width: '50%',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonActive: {
    backgroundColor: colors.accentPrimary,
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  tabButtonTextActive: {
    color: colors.bgGradientFrom,
    fontWeight: '600',
  },
  // Dropdown styles
  dropdownContainer: {
    position: 'absolute',
    top: 115,
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

export default DashboardScreen;
