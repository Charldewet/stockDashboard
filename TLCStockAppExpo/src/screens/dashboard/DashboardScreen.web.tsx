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
  Animated,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { AuthNavigationProp } from '../../types/navigation';
import ErrorAlert from '../../components/common/ErrorAlert';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { newPharmacyAPI } from '../../services/api';
import { getPharmacyByCode } from '../../config/api';
import { formatDateDisplay, formatDateLocal, getPreviousYearSameDayOfWeek } from '../../utils/dateUtils';
import { formatCurrency, calculatePercentageChange } from '../../utils/formatUtils';
import { TrendingUp, TrendingDown, AlertCircle, ChevronDown, Calendar, CheckCircle, AlertTriangle, Menu, LogOut, User, Settings, DollarSign, ShoppingCart, ShoppingBasket, BarChart3, ChevronRight, Moon, Sun, Shield } from 'lucide-react-native';
import CustomDatePicker from '../../components/common/CustomDatePicker';
import PlaceholderChart from '../../components/common/PlaceholderChart';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { Image } from 'react-native';

const { width } = Dimensions.get('window');

const DashboardScreen = () => {
  const navigation = useNavigation<AuthNavigationProp>();
  const { selectedPharmacy, pharmacies, setSelectedPharmacy, selectedDate, setSelectedDate, logout, user } = useAuth();
  const { colors, themeMode, toggleTheme } = useTheme();
  const styles = getStyles(colors);
  
  const [tempSelectedDate, setTempSelectedDate] = useState(selectedDate);
  const [containerWidth, setContainerWidth] = useState<number>(width);
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
    basketValue: number;
    transactions: number;
    label: string;
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

  // Fetch functions (simplified for web - you can add full implementations)
  const fetchSevenDayData = async () => {
    if (!selectedPharmacy) return;
    try {
      setChartLoading(true);
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

      const selectedCurrentDatesDesc: Date[] = [];
      for (const d of candidateDates) {
        const ds = formatDateLocal(d);
        const val = currentYearMap.get(ds) || 0;
        if (val > 0) {
          selectedCurrentDatesDesc.push(d);
        }
        if (selectedCurrentDatesDesc.length === 12) break;
      }

      const selectedCurrentDates = selectedCurrentDatesDesc.slice().reverse();

      if (selectedCurrentDates.length === 0) {
        setSevenDayData({ currentYear: [], previousYear: [] });
        setChartLoading(false);
        return;
      }

      const selectedPreviousDates = selectedCurrentDates.map(d => getPreviousYearSameDayOfWeek(d));

      const prevStart = selectedPreviousDates[0];
      const prevEnd = selectedPreviousDates[selectedPreviousDates.length - 1];
      const prevRangeStartStr = formatDateLocal(prevStart);
      const prevRangeEndStr = formatDateLocal(prevEnd);

      const previousYearData = await newPharmacyAPI.getDailySales(
        pharmacy.id,
        prevRangeStartStr,
        prevRangeEndStr
      );

      const previousYearMap = new Map<string, number>();
      (Array.isArray(previousYearData) ? previousYearData : []).forEach((d: any) => {
        previousYearMap.set(d.business_date, Number(d.turnover) || 0);
      });

      const currentChartData = selectedCurrentDates.map(d => {
        const ds = formatDateLocal(d);
        const turnover = currentYearMap.get(ds) || 0;
        const label = `${d.getDate()}/${d.getMonth() + 1}`;
        return { date: d, turnover, label };
      });

      const previousChartData = selectedPreviousDates.map(d => {
        const ds = formatDateLocal(d);
        const turnover = previousYearMap.get(ds) || 0;
        const label = `${d.getDate()}/${d.getMonth() + 1}`;
        return { date: d, turnover, label };
      });

      setSevenDayData({ currentYear: currentChartData, previousYear: previousChartData });
    } catch (error) {
      console.error('Error fetching 7-day data:', error);
    } finally {
      setChartLoading(false);
    }
  };

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

      // Prepare requests for current year months and previous year months using MTD endpoint
      const currentReqs: Array<Promise<any>> = [];
      const prevReqs: Array<Promise<any>> = [];
      const currentMeta: Array<{ key: string; label: string; through: string }> = [];
      const prevMeta: Array<{ key: string; label: string; through: string }> = [];

      months.forEach(({ y, m, isCurrentMonth }) => {
        const curKey = monthKey(y, m);
        // For current month: through = selectedDate; for past months: through = month end
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

        // Previous year counterpart
        const py = y - 1;
        const prevKey = monthKey(py, m);
        let prevThrough: string;
        if (isCurrentMonth) {
          const prevYearDate = new Date(py, m, selectedDate.getDate());
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

      const currentYearArr = currentRes.map((res: any, idx: number) => ({
        monthKey: currentMeta[idx].key,
        turnover: Number(res?.turnover) || 0,
        label: currentMeta[idx].label,
      }));

      const previousYearArr = prevRes.map((res: any, idx: number) => ({
        monthKey: prevMeta[idx].key,
        turnover: Number(res?.turnover) || 0,
        label: prevMeta[idx].label,
      }));

      setTwelveMonthData({ currentYear: currentYearArr, previousYear: previousYearArr });
    } catch (error) {
      console.error('Error fetching 12-month data:', error);
      setTwelveMonthData({ currentYear: [], previousYear: [] });
    } finally {
      setMonthlyChartLoading(false);
    }
  };

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
      Animated.timing(slideAnim, {
        toValue: -width,
        duration: 300,
        useNativeDriver: false,
      }).start(() => {
        setShowHamburgerMenu(false);
      });
    } else {
      setShowHamburgerMenu(true);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  };

  const handleMenuOptionPress = (option: string) => {
    Animated.timing(slideAnim, {
      toValue: -width,
      duration: 300,
      useNativeDriver: false,
    }).start(() => {
      setShowHamburgerMenu(false);
    });
    
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
    Animated.timing(slideAnim, {
      toValue: -width,
      duration: 300,
      useNativeDriver: false,
    }).start(() => {
      setShowHamburgerMenu(false);
      logout();
    });
  };

  const clearTooltips = () => {
    setDailyTooltip(null);
    setMonthlyTooltip(null);
    setPurchasesTooltip(null);
    setGpTooltip(null);
    setBasketTooltip(null);
  };

  const selectedPharmacyName = pharmacies.find(p => p.code === selectedPharmacy)?.name || 'Select Pharmacy';

  // Score Cards Component
  const ScoreCards = () => {
    const gpGrowth = (() => {
      if (!purchasesData.length) return 0;
      const totalSales = purchasesData.reduce((acc, d) => acc + (Number(d.sales) || 0), 0);
      const totalCos = purchasesData.reduce((acc, d) => acc + (Number(d.costOfSales) || 0), 0);
      if (totalSales <= 0) return 0;
      const gp = totalSales - totalCos;
      return (gp / totalSales) * 100;
    })();

    const salesGrowth = (() => {
      if (!sevenDayData.currentYear.length || !sevenDayData.previousYear.length) return 0;
      const currentTotal = sevenDayData.currentYear.reduce((acc, d) => acc + d.turnover, 0);
      const previousTotal = sevenDayData.previousYear.reduce((acc, d) => acc + d.turnover, 0);
      return calculatePercentageChange(currentTotal, previousTotal);
    })();

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

    const highlightPurple = (lowerTitle: string) => {
      if (lowerTitle === 'gp') return gpGrowth > 30;
      if (lowerTitle === 'sales growth' || lowerTitle === 'sales') return salesGrowth > 20;
      if (lowerTitle === 'purchases') return false;
      return false;
    };

    const ScoreCard = ({ title, growthPercent, isPlaceholder = false }: { title: string; growthPercent: number; isPlaceholder?: boolean }) => {
      const lowerTitle = title.toLowerCase();
      const getCardColor = () => {
        if (highlightPurple(lowerTitle)) {
          return colors.chartPurple;
        }
        if (lowerTitle === 'sales' || lowerTitle === 'sales growth') {
          if (growthPercent > 6) return colors.costSales;
          if (growthPercent >= 0) return colors.accentPrimaryFocus;
          return colors.accentPrimary;
        } else if (lowerTitle === 'purchases' || lowerTitle.includes('purchases')) {
          return growthPercent > 75 ? colors.accentPrimary : colors.costSales;
        }
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
      const scoreTextColor = themeMode === 'dark' ? colors.bgGradientFrom : '#FFFFFF';

      return (
        <View style={[styles.scoreCard, { backgroundColor: cardColor }]}>
          <Text style={[styles.scoreValue, { color: scoreTextColor }]} numberOfLines={1}>{displayValue}</Text>
          <Text style={[styles.scoreTitle, { color: scoreTextColor }]} numberOfLines={2}>{titleText}</Text>
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

  // Turnover Chart Component
  const TurnoverChartWithTabs = () => {
    const activeTooltip = dailyTooltip || monthlyTooltip;
    return (
      <View style={styles.sectionContainer}>
        <TouchableOpacity style={styles.sectionHeaderRow} onPress={() => setTurnoverCollapsed(!turnoverCollapsed)} activeOpacity={0.7}>
          {turnoverCollapsed ? (
            <ChevronRight size={16} color={colors.textSecondary} />
          ) : (
            <ChevronDown size={16} color={colors.textSecondary} />
          )}
          <Text style={styles.sectionTitle}>Turnover</Text>
        </TouchableOpacity>
        
        {!turnoverCollapsed && (
          <>
            <View style={[styles.tabContainer, { marginBottom: 6 }]}>
              <TouchableOpacity
                style={[styles.tab, selectedTurnoverTab === 'day' && styles.tabActive]}
                onPress={() => {
                  setSelectedTurnoverTab('day');
                  clearTooltips();
                }}
              >
                <Text style={[styles.tabText, selectedTurnoverTab === 'day' && styles.tabTextActive]}>Last 12 Days</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, selectedTurnoverTab === 'year' && styles.tabActive]}
                onPress={() => {
                  setSelectedTurnoverTab('year');
                  clearTooltips();
                }}
              >
                <Text style={[styles.tabText, selectedTurnoverTab === 'year' && styles.tabTextActive]}>Last 12 Months</Text>
              </TouchableOpacity>
            </View>

            {selectedTurnoverTab === 'day' ? (
              chartLoading ? (
                <View style={{ height: 140, alignItems: 'center', justifyContent: 'center' }}>
                  <ActivityIndicator size="small" color={colors.accentPrimary} />
                </View>
              ) : sevenDayData.currentYear.length === 0 ? (
                <View style={styles.noDataContainer}>
                  <Text style={styles.noDataText}>No trading data available</Text>
                </View>
              ) : (
                <OverlaidDailyBarChart />
              )
            ) : (
              monthlyChartLoading ? (
                <View style={{ height: 140, alignItems: 'center', justifyContent: 'center' }}>
                  <ActivityIndicator size="small" color={colors.accentPrimary} />
                </View>
              ) : twelveMonthData.currentYear.length === 0 ? (
                <View style={styles.noDataContainer}>
                  <Text style={styles.noDataText}>No monthly data available</Text>
                </View>
              ) : (
                <OverlaidMonthlyBarChart />
              )
            )}
          </>
        )}
      </View>
    );
  };

  // Simplified chart components
  const OverlaidDailyBarChart = () => {
    const rawWidth = Math.min(containerWidth || 0, 430) - 32;
    const chartWidth = Math.max(rawWidth, 0); // guard against negatives
    const chartHeight = 108; // Match other charts
    const padding = { top: 8, right: 8, bottom: 28, left: 8 }; // Match other charts
    const chartArea = {
      width: Math.max(chartWidth - padding.left - padding.right, 0),
      height: Math.max(chartHeight - padding.top - padding.bottom, 0),
    };

    const pairs = sevenDayData.currentYear.map((current, index) => ({
      current,
      previous: sevenDayData.previousYear[index] || { date: current.date, turnover: 0, label: current.label },
    }));

    const filteredPairs = pairs.filter(p => p.current.turnover > 0 || p.previous.turnover > 0);
    const maxValue = Math.max(...filteredPairs.flatMap(p => [p.current.turnover, p.previous.turnover]));
    
    const count = filteredPairs.length;
    const barWidth = (chartArea.width / count) * 0.8; // Match other charts
    const barSpacing = chartArea.width / count;

    return (
      <View style={styles.chartContainer}>
        <Svg width={chartWidth} height={chartHeight}>
          {filteredPairs.map((pair, index) => {
            const x = padding.left + (index * barSpacing) + (barSpacing - barWidth) / 2;
            const heightScale = 0.7;
            const prevBarHeight = (pair.previous.turnover / maxValue) * chartArea.height * heightScale;
            const prevBarY = padding.top + chartArea.height - prevBarHeight;
            const currentBarHeight = (pair.current.turnover / maxValue) * chartArea.height * heightScale;
            const currentBarY = padding.top + chartArea.height - currentBarHeight;
            const isHigher = pair.current.turnover >= pair.previous.turnover;
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
                <Rect
                  x={x}
                  y={prevBarY}
                  width={barWidth}
                  height={prevBarHeight}
                  fill={colors.textSecondary}
                  opacity={0.4}
                  rx={2}
                />
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
          {filteredPairs.map((pair, index) => {
            const x = padding.left + (index * barSpacing) + (barSpacing - barWidth) / 2;
            const labelX = x + barWidth / 2;
            const labelY = chartHeight - 10;
            // Ensure weekday short label (Mon, Tue, ...)
            let labelText = pair.current.label;
            try {
              const d = new Date(pair.current.date);
              if (!isNaN(d.getTime())) {
                labelText = d.toLocaleDateString('en-US', { weekday: 'short' });
              }
            } catch {}
            return (
              <SvgText
                key={`daily-label-${index}`}
                x={labelX}
                y={labelY}
                fontSize="12"
                fill={colors.textSecondary}
                textAnchor="middle"
              >
                {labelText}
              </SvgText>
            );
          })}
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

  const OverlaidMonthlyBarChart = () => {
    const rawWidth = Math.min(containerWidth || 0, 430) - 32;
    const chartWidth = Math.max(rawWidth, 0);
    const chartHeight = 108; // Match other charts
    const padding = { top: 8, right: 8, bottom: 28, left: 8 }; // Match other charts
    const chartArea = {
      width: Math.max(chartWidth - padding.left - padding.right, 0),
      height: Math.max(chartHeight - padding.top - padding.bottom, 0),
    };

    const pairs = twelveMonthData.currentYear.map((current, index) => ({
      current,
      previous: twelveMonthData.previousYear[index] || { monthKey: current.monthKey, turnover: 0, label: current.label },
    }));

    const filteredPairs = pairs.filter(p => p.current.turnover > 0 || p.previous.turnover > 0);
    const maxValue = Math.max(...filteredPairs.flatMap(p => [p.current.turnover, p.previous.turnover]));
    
    const count = filteredPairs.length;
    const barWidth = (chartArea.width / count) * 0.8; // Match other charts
    const barSpacing = chartArea.width / count;

    return (
      <View style={styles.chartContainer}>
        <Svg width={chartWidth} height={chartHeight}>
          {filteredPairs.map((pair, index) => {
            const x = padding.left + (index * barSpacing) + (barSpacing - barWidth) / 2;
            const heightScale = 0.7;
            const prevBarHeight = (pair.previous.turnover / maxValue) * chartArea.height * heightScale;
            const prevBarY = padding.top + chartArea.height - prevBarHeight;
            const currentBarHeight = (pair.current.turnover / maxValue) * chartArea.height * heightScale;
            const currentBarY = padding.top + chartArea.height - currentBarHeight;
            const isHigher = pair.current.turnover >= pair.previous.turnover;
            const currentBarColor = isHigher ? colors.costSales : colors.accentPrimary;

            const onPress = () => {
              const percent = calculatePercentageChange(pair.current.turnover, pair.previous.turnover);
              const bubbleX = x + barWidth / 2;
              const bubbleY = Math.min(prevBarY, currentBarY) - 8;
              setDailyTooltip(null);
              setMonthlyTooltip({
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
                <Rect
                  x={x}
                  y={prevBarY}
                  width={barWidth}
                  height={prevBarHeight}
                  fill={colors.textSecondary}
                  opacity={0.4}
                  rx={2}
                />
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
          {filteredPairs.map((pair, index) => {
            const x = padding.left + (index * barSpacing) + (barSpacing - barWidth) / 2;
            const labelX = x + barWidth / 2;
            const labelY = chartHeight - 10;
            // Ensure month short label (Jan, Feb, ...)
            let labelText = pair.current.label;
            try {
              const d = new Date(pair.current.date || `${pair.current.monthKey}-01`);
              if (!isNaN(d.getTime())) {
                labelText = d.toLocaleDateString('en-US', { month: 'short' });
              } else if (typeof labelText === 'string' && labelText.length > 3) {
                labelText = labelText.slice(0, 3);
              }
            } catch {}
            return (
              <SvgText
                key={`monthly-label-${index}`}
                x={labelX}
                y={labelY}
                fontSize="12"
                fill={colors.textSecondary}
                textAnchor="middle"
              >
                {labelText}
              </SvgText>
            );
          })}
          {monthlyTooltip && (
            <>
              <Rect
                x={monthlyTooltip.x - 56}
                y={Math.max(0, monthlyTooltip.y - 40)}
                width={112}
                height={40}
                rx={8}
                fill={colors.surfacePrimary}
                opacity={0.95}
              />
              <SvgText
                x={monthlyTooltip.x}
                y={Math.max(14, monthlyTooltip.y - 24)}
                fontSize="12"
                fill={colors.textPrimary}
                textAnchor="middle"
              >
                {monthlyTooltip.title}
              </SvgText>
              <SvgText
                x={monthlyTooltip.x}
                y={Math.max(28, monthlyTooltip.y - 10)}
                fontSize="12"
                fill={monthlyTooltip.color}
                fontWeight="bold"
                textAnchor="middle"
              >
                {`${monthlyTooltip.percent > 0 ? '+' : ''}${monthlyTooltip.percent.toFixed(1)}%`}
              </SvgText>
            </>
          )}
        </Svg>
      </View>
    );
  };

  const PurchasesChartWithTabs = () => {
    if (!purchasesData.length) return null;
    
    const chartWidth = Math.min(containerWidth, 430) - 32;
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
      <View style={styles.sectionContainer}>
        <TouchableOpacity style={styles.sectionHeaderRow} onPress={() => setPurchasesCollapsed(!purchasesCollapsed)} activeOpacity={0.7}>
          {purchasesCollapsed ? (
            <ChevronRight size={16} color={colors.textSecondary} />
          ) : (
            <ChevronDown size={16} color={colors.textSecondary} />
          )}
          <Text style={styles.sectionTitle}>Purchases</Text>
        </TouchableOpacity>

        {!purchasesCollapsed && (
          <>
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tab, selectedPurchasesTab === 'sales' && styles.tabActive]}
                onPress={() => {
                  setSelectedPurchasesTab('sales');
                  clearTooltips();
                }}
              >
                <Text style={[styles.tabText, selectedPurchasesTab === 'sales' && styles.tabTextActive]}>Sales</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, selectedPurchasesTab === 'cos' && styles.tabActive]}
                onPress={() => {
                  setSelectedPurchasesTab('cos');
                  clearTooltips();
                }}
              >
                <Text style={[styles.tabText, selectedPurchasesTab === 'cos' && styles.tabTextActive]}>CoS</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.chartContainer}>
              {purchasesChartLoading ? (
                <ActivityIndicator size="small" color={colors.accentPrimary} />
              ) : (
                <Svg width={chartWidth} height={chartHeight}>
                  {purchasesData.map((day, index) => {
                    const x = padding.left + (index * barSpacing) + (barSpacing - barWidth) / 2;
                    const baseValue = day[comparisonField];
                    const baseH = (baseValue / maxValue) * chartArea.height * heightScale;
                    const baseY = padding.top + chartArea.height - baseH;
                    const purH = (day.purchases / maxValue) * chartArea.height * heightScale;
                    const purY = padding.top + chartArea.height - purH;
                    
                    let purchasesColor = colors.chartPurple;
                    if (selectedPurchasesTab === 'cos') {
                      purchasesColor = day.purchases > (day.costOfSales || 0)
                        ? colors.accentPrimary
                        : colors.costSales;
                    } else if (selectedPurchasesTab === 'sales') {
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

                    return (
                      <React.Fragment key={index}>
                        <Rect x={x} y={baseY} width={barWidth} height={baseH} fill={colors.textSecondary} opacity={0.4} rx={2} />
                        <Rect x={x} y={purY} width={barWidth} height={purH} fill={purchasesColor} rx={2} onPress={onPress} />
                      </React.Fragment>
                    );
                  })}
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
              )}
            </View>

            {purchasesTooltip && (
              <View style={[styles.fixedTooltip, { borderColor: purchasesTooltip.color }]}>
                <Text style={styles.fixedTooltipTitle}>{purchasesTooltip.title}</Text>
                <Text style={[styles.fixedTooltipValue, { color: purchasesTooltip.color }]}>
                  {`${purchasesTooltip.percent.toFixed(1)}%`}
                </Text>
              </View>
            )}

            <Text style={styles.infoText}>
              {selectedPurchasesTab === 'sales'
                ? 'Purchases should not be more than 75% of Sales for extended periods of time.'
                : 'Purchases should not exceed Cost of Sales for extended periods of time.'}
            </Text>
          </>
        )}
      </View>
    );
  };

  const GpPercentageSection = () => {
    if (!purchasesData.length) return null;
    
    const chartWidth = Math.min(containerWidth, 430) - 32;
    const chartHeight = 108;
    const padding = { top: 8, right: 8, bottom: 28, left: 8 };
    const chartArea = { width: chartWidth - padding.left - padding.right, height: chartHeight - padding.top - padding.bottom };
    const count = purchasesData.length;
    const barWidth = (chartArea.width / count) * 0.8;
    const barSpacing = chartArea.width / count;
    const maxValue = Math.max(25, ...purchasesData.map(d => d.gpPercent || 0), 1);

    return (
      <View style={styles.sectionContainer}>
        <TouchableOpacity style={styles.sectionHeaderRow} onPress={() => setGpCollapsed(!gpCollapsed)} activeOpacity={0.7}>
          {gpCollapsed ? (
            <ChevronRight size={16} color={colors.textSecondary} />
          ) : (
            <ChevronDown size={16} color={colors.textSecondary} />
          )}
          <Text style={styles.sectionTitle}>GP Percentage</Text>
        </TouchableOpacity>

        {!gpCollapsed && (
          <>
            <View style={styles.chartContainer}>
              <Svg width={chartWidth} height={chartHeight}>
                {purchasesData.map((d, index) => {
                  const x = padding.left + (index * barSpacing) + (barSpacing - barWidth) / 2;
                  const baseH = (25 / maxValue) * chartArea.height * 0.7;
                  const baseY = padding.top + chartArea.height - baseH;
                  const gp = d.gpPercent || 0;
                  const gpH = (gp / maxValue) * chartArea.height * 0.7;
                  const gpY = padding.top + chartArea.height - gpH;
                  const overlayColor = gp >= 25 ? colors.costSales : colors.accentPrimary;
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

            {gpTooltip && (
              <View style={[styles.fixedTooltip, { borderColor: gpTooltip.color }]}>
                <Text style={styles.fixedTooltipTitle}>{gpTooltip.title}</Text>
                <Text style={[styles.fixedTooltipValue, { color: gpTooltip.color }]}>
                  {`${Math.round(purchasesData[gpTooltip.index]?.gpPercent || 0)}%`}
                </Text>
              </View>
            )}
          </>
        )}
      </View>
    );
  };

  const BasketChartWithTabs = () => {
    if (!basketData.length) return null;
    
    const chartWidth = Math.min(containerWidth, 430) - 32;
    const chartHeight = 108;
    const padding = { top: 8, right: 8, bottom: 28, left: 8 };
    const chartArea = { width: chartWidth - padding.left - padding.right, height: chartHeight - padding.top - padding.bottom };
    const count = basketData.length;
    const barWidth = (chartArea.width / count) * 0.8;
    const barSpacing = chartArea.width / count;
    
    const maxValueBV = Math.max(200, ...basketData.map(d => d.basketValue), 1);
    const maxValueTX = Math.max(...basketData.map(d => d.transactions), 1);

    return (
      <View style={styles.sectionContainer}>
        <TouchableOpacity style={styles.sectionHeaderRow} onPress={() => setBasketCollapsed(!basketCollapsed)} activeOpacity={0.7}>
          {basketCollapsed ? (
            <ChevronRight size={16} color={colors.textSecondary} />
          ) : (
            <ChevronDown size={16} color={colors.textSecondary} />
          )}
          <Text style={styles.sectionTitle}>Basket</Text>
        </TouchableOpacity>

        {!basketCollapsed && (
          <>
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tab, selectedBasketTab === 'value' && styles.tabActive]}
                onPress={() => {
                  setSelectedBasketTab('value');
                  clearTooltips();
                }}
              >
                <Text style={[styles.tabText, selectedBasketTab === 'value' && styles.tabTextActive]}>Value</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, selectedBasketTab === 'transactions' && styles.tabActive]}
                onPress={() => {
                  setSelectedBasketTab('transactions');
                  clearTooltips();
                }}
              >
                <Text style={[styles.tabText, selectedBasketTab === 'transactions' && styles.tabTextActive]}>Trans</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.chartContainer}>
              {basketChartLoading ? (
                <ActivityIndicator size="small" color={colors.accentPrimary} />
              ) : (
                <Svg width={chartWidth} height={chartHeight}>
                  {selectedBasketTab === 'value' ? (
                    basketData.map((d, index) => {
                      const x = padding.left + (index * barSpacing) + (barSpacing - barWidth) / 2;
                      const baseH = (200 / maxValueBV) * chartArea.height * 0.7;
                      const baseY = padding.top + chartArea.height - baseH;
                      const purH = (d.basketValue / maxValueBV) * chartArea.height * 0.7;
                      const purY = padding.top + chartArea.height - purH;
                      const overlayColor = (d.basketValue || 0) >= 200 ? colors.costSales : colors.accentPrimary;
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
                    })
                  ) : (
                    basketData.map((d, index) => {
                      const x = padding.left + (index * barSpacing) + (barSpacing - barWidth) / 2;
                      const h = (d.transactions / maxValueTX) * chartArea.height * 0.7;
                      const y = padding.top + chartArea.height - h;
                      const onPress = () => {
                        const bubbleX = x + barWidth / 2;
                        const bubbleY = y - 8;
                        setBasketTooltip({ index, x: bubbleX, y: bubbleY, title: d.label, color: colors.costSales });
                      };
                      return <Rect key={`basktx-${index}`} x={x} y={y} width={barWidth} height={h} fill={colors.costSales} rx={2} onPress={onPress} />;
                    })
                  )}
                  {basketData.map((d, index) => {
                    const x = padding.left + (index * barSpacing) + (barSpacing - barWidth) / 2;
                    const labelX = x + barWidth / 2;
                    const labelY = chartHeight - 10;
                    return (
                      <SvgText key={`basklbl-${index}`} x={labelX} y={labelY} fontSize="12" fill={colors.textSecondary} textAnchor="middle">{d.label}</SvgText>
                    );
                  })}
                </Svg>
              )}
            </View>

            {basketTooltip && (
              <View style={[styles.fixedTooltip, { borderColor: basketTooltip.color }]}>
                <Text style={styles.fixedTooltipTitle}>{basketTooltip.title}</Text>
                <Text style={[styles.fixedTooltipValue, { color: basketTooltip.color }]}>
                  {selectedBasketTab === 'value' 
                    ? `R${Math.round(basketData[basketTooltip.index]?.basketValue || 0)}`
                    : `${Math.round(basketData[basketTooltip.index]?.transactions || 0)}`}
                </Text>
              </View>
            )}
          </>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container} onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}>
      {/* Sticky Header */}
      <View style={styles.stickyHeader}>
        <View style={styles.mainHeaderRow}>
          <View style={styles.headerLeft}>
            <TouchableOpacity style={styles.hamburgerButton} onPress={handleHamburgerToggle}>
              <Menu size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.pharmacyDropdown} onPress={() => setShowPharmacyDropdown(!showPharmacyDropdown)}>
              <Text style={styles.pharmacyName}>{selectedPharmacyName}</Text>
              <ChevronDown size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <View style={styles.headerRightRow}>
            <TouchableOpacity style={styles.iconButton} onPress={handleDatePickerOpen}>
              <Calendar size={20} color={colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={toggleTheme}>
              {themeMode === 'dark' ? (
                <Sun size={20} color={colors.textPrimary} />
              ) : (
                <Moon size={20} color={colors.textPrimary} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Hamburger Menu */}
      {showHamburgerMenu && (
        <View style={styles.hamburgerMenuContainer}>
          <Animated.View style={[styles.hamburgerMenuContent, { transform: [{ translateX: slideAnim }] }]}>
            <View style={styles.hamburgerMenuHeader}>
              <Text style={styles.hamburgerMenuTitle}>Menu</Text>
              <TouchableOpacity onPress={handleHamburgerToggle} style={styles.hamburgerMenuCloseButton}>
                <Text style={styles.hamburgerMenuCloseText}>×</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.hamburgerMenuItems}>
              <TouchableOpacity style={styles.hamburgerMenuItem} onPress={() => handleMenuOptionPress('account')}>
                <User size={20} color={colors.textPrimary} />
                <Text style={styles.hamburgerMenuItemText}>Account</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.hamburgerMenuItem} onPress={() => handleMenuOptionPress('data')}>
                <Shield size={20} color={colors.textPrimary} />
                <Text style={styles.hamburgerMenuItemText}>Data</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.hamburgerMenuItem} onPress={() => handleMenuOptionPress('reporting')}>
                <BarChart3 size={20} color={colors.textPrimary} />
                <Text style={styles.hamburgerMenuItemText}>Reporting</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.hamburgerMenuItem} onPress={() => handleMenuOptionPress('preferences')}>
                <Settings size={20} color={colors.textPrimary} />
                <Text style={styles.hamburgerMenuItemText}>Preferences</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.hamburgerMenuItem} onPress={toggleTheme}>
                {themeMode === 'dark' ? (
                  <Sun size={20} color={colors.textPrimary} />
                ) : (
                  <Moon size={20} color={colors.textPrimary} />
                )}
                <Text style={styles.hamburgerMenuItemText}>{themeMode === 'dark' ? 'Light Mode' : 'Dark Mode'}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.hamburgerMenuFooter}>
              <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
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
          contentContainerStyle={styles.scrollContentContainer}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh}
              tintColor={colors.textPrimary}
              colors={[colors.accentPrimary]}
            />
          }
        >
          <View style={styles.dateSection}>
            <Text style={styles.dateLabel}>
              {formatDateDisplay(selectedDate)}
            </Text>
          </View>

          <View style={styles.welcomeContainer}>
            <Image
              source={themeMode === 'dark' ? require('../../../assets/TLC Logo/DARK_LOGO.png') : require('../../../assets/TLC Logo/LIGHT_LOGO.png')}
              style={styles.welcomeLogo}
              resizeMode="contain"
            />
          </View>

          <ScoreCards />
          <TurnoverChartWithTabs />
          <PurchasesChartWithTabs />
          <GpPercentageSection />
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

      {/* Date Picker Modal */}
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

      <ErrorAlert
        visible={showErrorAlert}
        title={errorTitle}
        message={errorMessage}
        onDismiss={() => setShowErrorAlert(false)}
      />
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
    paddingTop: 8,
    backgroundColor: colors.bgGradientFrom,
    zIndex: 1000,
  },
  mainHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingBottom: 96, // ensure content doesn't sit under bottom tab bar
  },
  dateSection: {
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  dateLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
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
  scoreCardWrapper: {
    flex: 1,
  },
  scoreCardSide: {
    marginHorizontal: 4,
  },
  scoreCardCenter: {
    marginHorizontal: 8,
  },
  scoreCard: {
    height: 72,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  scoreTitle: {
    fontSize: 8,
    fontWeight: '600',
    textAlign: 'center',
    color: '#FFFFFF',
  },
  infoIcon: {
    position: 'absolute',
    top: 8,
    right: -8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.textSecondary + '40',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoIconText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: 'bold',
  },
  sectionContainer: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  tabActive: {
    backgroundColor: colors.accentPrimary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.bgGradientFrom,
  },
  chartContainer: {
    marginTop: 0,
  },
  noDataContainer: {
    padding: 40,
    alignItems: 'center',
  },
  noDataText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  hamburgerMenuContainer: {
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
  dropdownContainer: {
    position: 'absolute',
    top: 110,
    left: 16,
    right: 16,
    zIndex: 1500,
  },
  dropdownContent: {
    backgroundColor: colors.surfacePrimary,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  dropdownItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
    fontWeight: 'bold',
  },
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
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  infoSection: {
    width: '100%',
    marginBottom: 16,
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
  },
  colorSection: {
    width: '100%',
    marginBottom: 16,
  },
  colorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  colorSwatch: {
    width: 20,
    height: 20,
    borderRadius: 4,
  },
  colorText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  scoreCardsModalButton: {
    backgroundColor: colors.accentPrimary,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    marginTop: 8,
  },
  scoreCardsModalButtonText: {
    color: colors.bgGradientFrom,
    fontSize: 16,
    fontWeight: '600',
  },
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
  fixedTooltip: {
    position: 'absolute',
    top: 8,
    right: 16,
    backgroundColor: colors.surfacePrimary,
    borderRadius: 8,
    borderWidth: 2,
    padding: 8,
    minWidth: 80,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 10,
  },
  fixedTooltipTitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  fixedTooltipValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 8,
    marginHorizontal: 4,
    lineHeight: 16,
  },
});

export default DashboardScreen;
