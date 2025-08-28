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
import ErrorAlert from '../../components/common/ErrorAlert';
import CustomDatePicker from '../../components/common/CustomDatePicker';
import DateScroller from '../../components/common/DateScroller';
import { useAuth } from '../../contexts/AuthContext';
import { newPharmacyAPI } from '../../services/api';
import { getPharmacyByCode } from '../../config/api';
import { formatDateLocal, getYesterday, formatDateDisplay } from '../../utils/dateUtils';
import { formatCurrency, formatPercentage, calculatePercentageChange } from '../../utils/formatUtils';
import { TrendingUp, TrendingDown, AlertCircle, ChevronDown, Calendar, CheckCircle, AlertTriangle, Menu, LogOut, User, Bell, Shield, Settings, DollarSign, ShoppingCart, ShoppingBasket, Package, BarChart3, ChevronRight } from 'lucide-react-native';
import { API_CONFIG } from '../../config/api';

const { width } = Dimensions.get('window');

// Helper function to get pharmacy ID from pharmacy code
const getPharmacyId = (pharmacyCode: string): number => {
  // If the code is already numeric, use it directly
  const asNum = Number(pharmacyCode);
  if (Number.isFinite(asNum) && String(asNum) === pharmacyCode) {
    return asNum;
  }

  // Resolve via config by code
  const byCode = getPharmacyByCode(pharmacyCode);
  if (byCode && typeof byCode.id === 'number') {
    return byCode.id;
  }

  // Resolve by name match in config (case-insensitive)
  const upper = String(pharmacyCode).toUpperCase();
  const byName = API_CONFIG.PHARMACIES.find(p => String(p.name).toUpperCase() === upper);
  if (byName) return byName.id;

  // Fallback: return 1 to avoid crashes but indicate defaulting
  return 1;
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

const StockScreen = () => {
  const navigation = useNavigation<AuthNavigationProp>();
  const { selectedPharmacy, pharmacies, setSelectedPharmacy, selectedDate, setSelectedDate, logout } = useAuth();
  
  // Selector states
  const [showPharmacyDropdown, setShowPharmacyDropdown] = useState(false);
  const [showHamburgerMenu, setShowHamburgerMenu] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempSelectedDate, setTempSelectedDate] = useState(selectedDate);
  const slideAnim = useRef(new Animated.Value(-width)).current;

  // Card expansion states
  const [stockValueCardExpanded, setStockValueCardExpanded] = useState(false);
  const [daysOfInventoryCardExpanded, setDaysOfInventoryCardExpanded] = useState(false);
  const [purchasesCardExpanded, setPurchasesCardExpanded] = useState(false);
  const [gpPercentCardExpanded, setGpPercentCardExpanded] = useState(false);

  // Stock data state
  const [stockData, setStockData] = useState({
    stockValue: 0,
    openingStock: 0,
    daysOfInventory: 0,
    purchases: 0,
    costOfSales: 0,
    gpPercent: 0,
    gpValue: 0,
    avgDailyCostOfSales: 0,
    currentInventory: 0
  });
  const [stockDataLoading, setStockDataLoading] = useState(false);
  const [previousMonthStockValue, setPreviousMonthStockValue] = useState(0);
  const [stockValuePercentageChange, setStockValuePercentageChange] = useState(0);

  // Top moving products state
  interface TopMovingProduct {
    // API response fields from /pharmacies/{pharmacy_id}/stock-activity
    product_code?: string;
    description?: string;
    qty_sold?: number;
    sales_val?: number;
    cost_of_sales?: number;
    gp_value?: number;
    gp_pct?: number;
    on_hand?: number;
    department_code?: string;
    product_id?: number;
    
    // API response fields from /products_usage/{pharmacy_id}
    avg_daily_qty?: number;
    avg_daily_quantity?: number;
    average_daily_qty?: number;
    
    // API response fields from /pharmacies/{pid}/usage/* endpoints
    avg_qty_30d?: number;
    avg_qty_90d?: number;
    avg_qty_180d?: number;
    last_recalc?: string;
    
    // Legacy fields for backward compatibility
  productName?: string;
  name?: string;
  product_name?: string;
  desc?: string;
  stockCode?: string;
  code?: string;
  stock_code?: string;
  quantityMoved?: number;
  quantity?: number;
  units?: number;
  qty?: number;
  amount?: number;
  qtySold?: number;
  quantitySold?: number;
  sold?: number;
  sales_qty?: number;
  grossProfit?: number;
  valueMovement?: number;
  grossProfitPercent?: number;
  gross_profit?: number;
  sales_value?: number;
  gross_profit_percent?: string | number;
  dailyAvgSales?: number;
  avgDailySales?: number;
  monthlyQty?: number;
  daysInMonth?: number;
  dailyQty?: number;
  estimatedCostValue?: number;
  salesQty?: number;
  salesValue?: number;
  stockLevelScore?: number;
  currentSOH?: number;
  current_soh?: number;
  soh?: number;
  stock_on_hand?: number;
  days_of_stock?: number;
  daysOfStock?: number;
  days?: number;
}
  
  const [topMovingProducts, setTopMovingProducts] = useState<TopMovingProduct[]>([]);
  const [topMovingProductsLoading, setTopMovingProductsLoading] = useState(false);
  const [topMovingProductsError, setTopMovingProductsError] = useState<string | null>(null);

  // Low GP products state
  const [lowGPProducts, setLowGPProducts] = useState<TopMovingProduct[]>([]);
  const [lowGPProductsLoading, setLowGPProductsLoading] = useState(false);
  const [lowGPProductsError, setLowGPProductsError] = useState<string | null>(null);

  // Top Sellers state
  const [topSellers, setTopSellers] = useState<TopMovingProduct[]>([]);
  const [topSellersLoading, setTopSellersLoading] = useState(false);
  const [topSellersError, setTopSellersError] = useState<string | null>(null);

  // High Stock Levels state
  const [highStockLevels, setHighStockLevels] = useState<TopMovingProduct[]>([]);
  const [highStockLevelsLoading, setHighStockLevelsLoading] = useState(false);
  const [highStockLevelsError, setHighStockLevelsError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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

  const getCurrentPharmacyName = () => {
    const pharmacy = pharmacies.find(p => p.code === selectedPharmacy);
    return pharmacy ? pharmacy.name : selectedPharmacy;
  };

  // Helper function to calculate percentage change
  const calculatePercentageChange = (current: number, previous: number) => {
    if (!previous || previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  };

  // Get alerts function based on web app rules
  const getAlerts = (data: any) => {
    const alerts: Array<{
      severity: 'positive' | 'warning' | 'critical';
      icon: React.ComponentType<any>;
      title: string;
      description: string;
    }> = [];

    // Only show stock variance alerts if we have meaningful stock data
    if (data.openingStock > 0 && data.stockValue > 0) {
      const stockVariancePercent = calculatePercentageChange(data.stockValue, data.openingStock);
      const absStockVariancePercent = Math.abs(stockVariancePercent);

      if (absStockVariancePercent <= 7) {
        alerts.push({
          title: 'Stable Stock Performance',
          description: `Stock value change is stable at ${stockVariancePercent.toFixed(1)}%.`,
          severity: 'positive',
          icon: TrendingUp
        });
      } else if (absStockVariancePercent > 7 && absStockVariancePercent <= 15) {
        alerts.push({
          title: 'Moderate Stock Change',
          description: `Stock value change is moderate at ${stockVariancePercent.toFixed(1)}%. Consider reviewing purchasing strategies.`,
          severity: 'warning',
          icon: AlertTriangle
        });
      } else if (absStockVariancePercent > 15) {
        alerts.push({
          title: 'Significant Stock Change',
          description: `Stock value change is significant at ${stockVariancePercent.toFixed(1)}%. Immediate action may be required to adjust purchasing.`,
          severity: 'critical',
          icon: AlertCircle
        });
      }
    }

    // Only show inventory alerts if we have meaningful days of inventory data
    if (data.daysOfInventory > 0 && data.daysOfInventory < 1000) { // Add reasonable upper bound check
      const daysOfInventory = data.daysOfInventory;
      const daysOfInventoryTarget = 45;

      if (daysOfInventory < 15) {
        alerts.push({
          title: 'Critically Low Days of Inventory',
          description: 'Days of inventory are critically low. Immediate action required to restock.',
          severity: 'critical',
          icon: AlertCircle
        });
      } else if (daysOfInventory >= 15 && daysOfInventory < 30) {
        alerts.push({
          title: 'Good Inventory Levels',
          description: 'Good inventory levels. Maintain current stock strategy.',
          severity: 'positive',
          icon: TrendingUp
        });
      } else if (daysOfInventory >= 30 && daysOfInventory <= 45) {
        alerts.push({
          title: 'Slightly Elevated Stock Holding',
          description: 'Slightly elevated stock holding. Monitor inventory closely.',
          severity: 'warning',
          icon: AlertTriangle
        });
      } else if (daysOfInventory > 45) {
        alerts.push({
          title: 'Very High Days of Inventory',
          description: 'Stock holding is very high and needs to be reduced.',
          severity: 'critical',
          icon: AlertCircle
        });
      }
    }

    return alerts;
  };

  // Function to fetch stock data
  const fetchStockData = async () => {
    if (!selectedPharmacy || !selectedDate) return;

    setStockDataLoading(true);
    try {
      const dateStr = formatDateLocal(selectedDate);
      console.log(`Fetching stock data for pharmacy: ${selectedPharmacy}, date: ${dateStr}`);
      
      // Get pharmacy ID for API calls
      const pharmacyId = getPharmacyId(selectedPharmacy);
      
      // For group pharmacy (100), also use MTD API for consistency with MonthlyScreen
      if (pharmacyId === 100) {
        // Get daily data for stock value only
        const dailySalesResponse = await fetch(`${API_CONFIG.BASE_URL}/pharmacies/${pharmacyId}/days?from=${dateStr}&to=${dateStr}`, {
          method: 'GET',
          headers: { 
            'Authorization': `Bearer ${API_CONFIG.API_KEY}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (dailySalesResponse.ok) {
          const dailySalesData = await dailySalesResponse.json();
          console.log('Group daily sales data response:', dailySalesData);
          
          let currentStockValue: number = 0;
          
          if (dailySalesData && Array.isArray(dailySalesData) && dailySalesData.length > 0) {
            const salesRecord = dailySalesData[0];
            currentStockValue = Number(salesRecord.closing_stock) || 0;
          }
          
          // For group, use simpler calculations to avoid multiple API calls
          const openingStockValue = currentStockValue; // Simplified for group
          const daysOfInventory = currentStockValue > 0 ? 30 : 0; // Default estimate for group
          
          // Note: costOfSales, purchases, gpValue, and gpPercent will be set from MTD API below
          // This ensures consistency with MonthlyScreen
          
          setStockData({
            stockValue: currentStockValue,
            openingStock: openingStockValue,
            daysOfInventory: daysOfInventory,
            purchases: 0, // Will be updated from MTD API
            costOfSales: 0, // Will be updated from MTD API
            gpPercent: 0, // Will be updated from MTD API
            gpValue: 0, // Will be updated from MTD API
            avgDailyCostOfSales: 0, // Will be updated from MTD API
            currentInventory: currentStockValue
          });
          
          setPreviousMonthStockValue(currentStockValue);
          setStockValuePercentageChange(0);
          // Don't return early - continue to MTD calculation for consistency
        }
      }
      
      // Original logic for individual pharmacies (1-5)
      // Get daily sales data for the selected date using the proper API endpoint
      // GET /pharmacies/{pharmacy_id}/days?from={date}&to={date}
      const dailySalesResponse = await fetch(`${API_CONFIG.BASE_URL}/pharmacies/${pharmacyId}/days?from=${dateStr}&to=${dateStr}`, {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${API_CONFIG.API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!dailySalesResponse.ok) {
        throw new Error(`HTTP error! status: ${dailySalesResponse.status}`);
      }
      
      const dailySalesData = await dailySalesResponse.json();
      console.log('Daily sales data response:', dailySalesData);
      
      let currentStockValue: number = 0;
      let openingStockValue: number = 0;
      let costOfSales: number = 0;
      let purchases: number = 0;
      let gpValue: number = 0;
      let gpPercent: number = 0;
      
      if (dailySalesData && Array.isArray(dailySalesData) && dailySalesData.length > 0) {
        const salesRecord = dailySalesData[0];
        console.log('Sales record:', salesRecord);
        
        // Extract stock value from the daily sales data using actual API field names
        if (salesRecord.closing_stock !== undefined && salesRecord.closing_stock !== null) {
          currentStockValue = Number(salesRecord.closing_stock);
          console.log(`Using closing_stock as current stock value: ${currentStockValue}`);
        } else {
          console.log('No closing_stock found in daily sales data, using 0');
        }
        
        // Extract other financial data
        costOfSales = Number(salesRecord.cost_of_sales) || 0;
        purchases = Number(salesRecord.purchases) || 0;
        gpValue = Number(salesRecord.gp_value) || 0;
        gpPercent = Number(salesRecord.gp_pct) || 0;
        
        console.log('Extracted financial data:', {
          costOfSales,
          purchases,
          gpValue,
          gpPercent
        });
      } else {
        console.log('No daily sales data found, using 0');
      }

      // Get previous day's data to calculate opening stock
      const previousDay = new Date(selectedDate);
      previousDay.setDate(previousDay.getDate() - 1);
      const previousDayStr = formatDateLocal(previousDay);
      
      console.log(`Fetching previous day data for opening stock: ${previousDayStr}`);
      
      let prevDayStockValue: number = 0;
      try {
        const prevDayResponse = await fetch(`${API_CONFIG.BASE_URL}/pharmacies/${pharmacyId}/days?from=${previousDayStr}&to=${previousDayStr}`, {
          method: 'GET',
          headers: { 
            'Authorization': `Bearer ${API_CONFIG.API_KEY}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (prevDayResponse.ok) {
          const prevDayData = await prevDayResponse.json();
          console.log('Previous day data response:', prevDayData);
          
          if (prevDayData && Array.isArray(prevDayData) && prevDayData.length > 0) {
            const prevDayRecord = prevDayData[0];
            
            if (prevDayRecord.closing_stock !== undefined && prevDayRecord.closing_stock !== null) {
              prevDayStockValue = Number(prevDayRecord.closing_stock);
              openingStockValue = prevDayStockValue; // Opening stock = Previous day's closing stock
              console.log(`Previous day closing_stock (${prevDayRecord.business_date}): ${prevDayStockValue}`);
              console.log(`Using as opening stock for current day: ${openingStockValue}`);
            }
          }
        }
      } catch (error) {
        console.warn('Error fetching previous day data:', error);
        // If we can't get previous day data, use current day's value as fallback
        openingStockValue = currentStockValue;
      }

      // Calculate previous month's date range for comparison
      const prevMonth = new Date(selectedDate);
      prevMonth.setMonth(prevMonth.getMonth() - 1);
      const prevMonthStart = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), 1);
      const prevMonthEnd = new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0); // Last day of previous month
      
      const prevMonthStartStr = formatDateLocal(prevMonthStart);
      const prevMonthEndStr = formatDateLocal(prevMonthEnd);
      
      console.log(`Fetching previous month data: ${prevMonthStartStr} to ${prevMonthEndStr}`);
      
      // Get previous month's data for comparison
      let prevMonthStockValue: number = 0;
      try {
        const prevMonthResponse = await fetch(`${API_CONFIG.BASE_URL}/pharmacies/${pharmacyId}/days?from=${prevMonthStartStr}&to=${prevMonthEndStr}`, {
          method: 'GET',
          headers: { 
            'Authorization': `Bearer ${API_CONFIG.API_KEY}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (prevMonthResponse.ok) {
          const prevMonthData = await prevMonthResponse.json();
          console.log('Previous month data response:', prevMonthData);
      
          if (prevMonthData && Array.isArray(prevMonthData) && prevMonthData.length > 0) {
        // Get the last day of the previous month (highest date)
            const sortedData = prevMonthData.sort((a: any, b: any) => {
              const dateA = new Date(a.business_date || 0);
              const dateB = new Date(b.business_date || 0);
          return dateB.getTime() - dateA.getTime();
        });
        const lastDayRecord = sortedData[0];
            
            if (lastDayRecord.closing_stock !== undefined && lastDayRecord.closing_stock !== null) {
          prevMonthStockValue = Number(lastDayRecord.closing_stock);
              console.log(`Previous month closing_stock (${lastDayRecord.business_date}): ${prevMonthStockValue}`);
            }
          }
        }
      } catch (error) {
        console.warn('Error fetching previous month data:', error);
      }

      // Calculate percentage change
      let percentageChange = 0;
      if (prevMonthStockValue > 0 && typeof currentStockValue === 'number' && typeof prevMonthStockValue === 'number') {
        percentageChange = ((currentStockValue - prevMonthStockValue) / prevMonthStockValue) * 100;
        console.log(`Percentage change vs previous month: ${percentageChange.toFixed(1)}%`);
      }

      // Calculate date range for current month (MTD) - using same method as MonthlyScreen
      const monthKey = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}`;
      const throughDate = formatDateLocal(selectedDate);
      
      console.log(`Fetching MTD data using getMTD: ${monthKey} through ${throughDate}`);
      
      // Get MTD data using the exact same method as MonthlyScreen
      let finalCostOfSales = costOfSales; // Use the daily value as starting point
      let finalPurchases = purchases;
      let finalGpValue = gpValue;
      let finalGpPercent = gpPercent;
      
      try {
        const mtdData = await newPharmacyAPI.getMTD(pharmacyId, monthKey, throughDate);
        console.log('MTD data response from getMTD:', mtdData);
        
        if (mtdData) {
          // Use MTD totals directly from API (same as MonthlyScreen)
          if (mtdData.cost_of_sales !== undefined && mtdData.cost_of_sales !== null) {
            finalCostOfSales = Number(mtdData.cost_of_sales) || 0;
          }
          if (mtdData.purchases !== undefined && mtdData.purchases !== null) {
            finalPurchases = Number(mtdData.purchases) || 0;
          }
          if (mtdData.gp_value !== undefined && mtdData.gp_value !== null) {
            finalGpValue = Number(mtdData.gp_value) || 0;
          }
          // Also extract type_r_sales for GP% calculation consistency
          const typeRSales = Number(mtdData.type_r_sales) || 0;
      
          // Calculate GP percentage from MTD totals (exactly same as MonthlyScreen)
          if (mtdData.turnover && mtdData.turnover > 0) {
            // Use same calculation as MonthlyScreen: gp_value / (turnover - type_r_sales) * 100
            const denominator = mtdData.turnover - typeRSales;
            finalGpPercent = denominator > 0 ? (finalGpValue / denominator) * 100 : 0;
          }
          
          console.log('MTD totals from getMTD:', { 
            turnover: mtdData.turnover,
            cost_of_sales: finalCostOfSales, 
            purchases: finalPurchases, 
            gp_percent: finalGpPercent, 
            gp_value: finalGpValue 
          });
        }
      } catch (error) {
        console.warn('Error fetching MTD data from getMTD:', error);
      }

      // Calculate average daily turnover for last 30 days (for inventory calculations)
      let avgDailyTurnover = 0;
      try {
        // Calculate last 30 days range
        const last30Start = new Date(selectedDate);
        last30Start.setDate(last30Start.getDate() - 29); // 30 days including today
        const last30StartStr = formatDateLocal(last30Start);
        const last30EndStr = formatDateLocal(selectedDate);
        
        console.log(`Fetching last 30 days data: ${last30StartStr} to ${last30EndStr}`);
        
        const last30Response = await fetch(`${API_CONFIG.BASE_URL}/pharmacies/${pharmacyId}/days?from=${last30StartStr}&to=${last30EndStr}`, {
          method: 'GET',
          headers: { 
            'Authorization': `Bearer ${API_CONFIG.API_KEY}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (last30Response.ok) {
          const last30Data = await last30Response.json();
          
          if (last30Data && Array.isArray(last30Data)) {
            // Calculate average daily turnover
            const totalTurnover = last30Data.reduce((acc: number, day: any) => acc + (day.turnover || 0), 0);
            avgDailyTurnover = totalTurnover / 30;
            console.log('Last 30 days total turnover:', totalTurnover);
            console.log('Avg daily turnover (last 30 days):', avgDailyTurnover);
          }
        }
      } catch (error) {
        console.warn('Error fetching last 30 days data:', error);
      }

      // Calculate days of inventory based on average daily turnover
      let daysOfInventory = 0;
      if (avgDailyTurnover > 0) {
        daysOfInventory = currentStockValue / avgDailyTurnover;
        console.log(`Calculated days of inventory: ${daysOfInventory}`);
      }

      console.log(`Final values - Stock Value: ${currentStockValue}, Opening Stock: ${openingStockValue}`);
      console.log(`Days of Inventory: ${daysOfInventory}`);
      
      // Log the final values
      console.log('✅ Final values from StockScreen:');
      console.log(`   📊 Stock Value (Closing): R ${currentStockValue.toLocaleString('en-ZA')}`);
      console.log(`   📊 Opening Stock: R ${openingStockValue.toLocaleString('en-ZA')}`);
      console.log(`   📊 Days of Inventory: ${daysOfInventory.toFixed(1)}`);
      console.log(`   📊 MTD Cost of Sales: R ${finalCostOfSales.toLocaleString('en-ZA')}`);
      console.log(`   📊 MTD Purchases: R ${finalPurchases.toLocaleString('en-ZA')}`);
      console.log(`   📊 GP %: ${finalGpPercent.toFixed(1)}%`);
      console.log(`   📊 GP Value: R ${finalGpValue.toLocaleString('en-ZA')}`);

      setStockData({
        stockValue: currentStockValue,
        openingStock: openingStockValue,
        daysOfInventory: daysOfInventory,
        purchases: finalPurchases,
        costOfSales: finalCostOfSales,
        gpPercent: finalGpPercent,
        gpValue: finalGpValue,
        avgDailyCostOfSales: avgDailyTurnover, // Using turnover as proxy
        currentInventory: currentStockValue
      });
      
      setPreviousMonthStockValue(prevMonthStockValue);
      setStockValuePercentageChange(percentageChange);
      
    } catch (error: any) {
      console.error('Error fetching stock data:', error);
      console.error('Error details:', {
        message: error?.message,
        response: error?.response?.data,
        status: error?.response?.status
      });
      // Use zeros on error since we want to show real data
      setStockData({
        stockValue: 0,
        openingStock: 0,
        daysOfInventory: 0,
        purchases: 0,
        costOfSales: 0,
        gpPercent: 0,
        gpValue: 0,
        avgDailyCostOfSales: 0,
        currentInventory: 0
      });
      setPreviousMonthStockValue(0);
      setStockValuePercentageChange(0);
    } finally {
      setStockDataLoading(false);
    }
  };

  // Helper: fetch all stock-activity items for a date by following pagination cursor
  const fetchAllStockActivityItems = async (pharmacyId: number, dateStr: string): Promise<any[]> => {
    const baseUrl = `${API_CONFIG.BASE_URL}/pharmacies/${pharmacyId}/stock-activity`;
    let cursor: string | null = null;
    let page = 0;
    // Limit pages aggressively for group (id 100) to avoid long loads when data is sparse
    const isGroup = pharmacyId === 100;
    const maxPages = isGroup ? 1 : 5; // Reduced from 2/10 to 1/5 for faster loading
    const allItems: any[] = [];

    do {
      const urlToFetch: string = cursor
        ? `${baseUrl}?date=${dateStr}&cursor=${encodeURIComponent(cursor)}`
        : `${baseUrl}?date=${dateStr}`;

      const resp: Response = await fetch(urlToFetch, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${API_CONFIG.API_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      if (!resp.ok) {
        throw new Error(`HTTP error! status: ${resp.status}`);
      }

      const data: any = await resp.json();
      const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      allItems.push(...items);

      cursor = typeof data?.nextCursor === 'string' && data.nextCursor.length > 0 ? data.nextCursor : null;
      page += 1;
    } while (cursor && page < maxPages);

    console.log(`Fetched ${allItems.length} stock-activity items across ${page} page(s) for ${dateStr}`);
    return allItems;
  };

  // Function to fetch top products by quantity
  const fetchTopMovingProducts = async () => {
    console.log('fetchTopMovingProducts called with:', { selectedPharmacy, selectedDate });
    if (!selectedPharmacy || !selectedDate) {
      console.log('fetchTopMovingProducts: Missing pharmacy or date, returning early');
      return;
    }

    setTopMovingProductsLoading(true);
    setTopMovingProductsError(null);
    try {
      const dateStr = formatDateLocal(selectedDate);
      console.log(`Fetching top products by quantity for pharmacy: ${selectedPharmacy}, date: ${dateStr}`);
      
      const pharmacyId = getPharmacyId(selectedPharmacy);

      // 1) Preferred: dedicated endpoint by quantity
      try {
        const resp = await fetch(`${API_CONFIG.BASE_URL}/pharmacies/${pharmacyId}/stock-activity/by-quantity?date=${dateStr}&limit=15`, { // Reduced from 20 to 15 for faster loading
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${API_CONFIG.API_KEY}`,
            'Content-Type': 'application/json'
          }
        });
        if (resp.ok) {
          const data = await resp.json();
          const items = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
          if (items.length > 0) {
            // Filter out KSAA and sort desc by qty_sold
            const nonKSAA = items.filter((p: any) => !(p?.department_code || '').startsWith('KSAA'));
            const sorted = nonKSAA.sort((a: any, b: any) => (Number(b?.qty_sold) || 0) - (Number(a?.qty_sold) || 0));
            const top5 = sorted.slice(0, 5);
            if (top5.length > 0) {
              setTopMovingProducts(top5);
              return; // done
            }
          }
        } else {
          console.warn('by-quantity endpoint returned non-OK:', resp.status);
        }
      } catch (e) {
        console.warn('by-quantity endpoint failed:', e);
      }
      
      // 2) Fallback: for group (100), skip heavy pagination and return no data quickly
      if (pharmacyId === 100) {
        setTopMovingProductsError('No top products by quantity data available for this date');
        setTopMovingProducts([]);
        return;
      }

      // Fallback: fetch all stock-activity pages and sort client-side (non-group only)
      const products = await fetchAllStockActivityItems(pharmacyId, dateStr);
      if (!products || products.length === 0) {
        console.log('Top products by quantity API returned empty array - no data available for this date');
        setTopMovingProductsError('No top products by quantity data available for this date');
        setTopMovingProducts([]);
        return;
      }
      
      // Exclude KSAA department items (e.g., clinic service fees)
      const nonKSAAProducts = products.filter((p: any) => {
        const dept = p.department_code || '';
        return !dept.startsWith('KSAA');
      });
      
      const sortedProducts = nonKSAAProducts.sort((a: any, b: any) => {
        const qtyA = Number(a.qty_sold) || 0;
        const qtyB = Number(b.qty_sold) || 0;
        return qtyB - qtyA; // Descending order
      });
      
      // Take only the top 5 for display
      const top5Products = sortedProducts.slice(0, 5);
      console.log('Final top 5 products by quantity (fallback):', top5Products.map((p: any) => ({ description: p.description, qty_sold: p.qty_sold, product_code: p.product_code })));
      
      setTopMovingProducts(top5Products);
      
    } catch (error: any) {
      console.error('Error fetching top moving products:', error);
      console.error('Error details:', {
        message: error?.message,
        response: error?.response?.data,
        status: error?.response?.status
      });
      setTopMovingProductsError('Failed to fetch top products by quantity');
      setTopMovingProducts([]);
    } finally {
      setTopMovingProductsLoading(false);
    }
  };

  // Function to fetch low GP products (excluding PDST department)
  const fetchLowGPProducts = async () => {
    if (!selectedPharmacy || !selectedDate) return;

    setLowGPProductsLoading(true);
    setLowGPProductsError(null);
    try {
      const dateStr = formatDateLocal(selectedDate);
      console.log(`Fetching low GP products for pharmacy: ${selectedPharmacy}, date: ${dateStr}`);
      
      const pharmacyId = getPharmacyId(selectedPharmacy);

      // 1) Preferred: dedicated endpoint worst GP
      try {
        const resp = await fetch(`${API_CONFIG.BASE_URL}/pharmacies/${pharmacyId}/stock-activity/worst-gp?date=${dateStr}&limit=15`, { // Reduced from 20 to 15 for faster loading
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${API_CONFIG.API_KEY}`,
            'Content-Type': 'application/json'
          }
        });
        if (resp.ok) {
          const data = await resp.json();
          let items: any[] = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
          // Filter out PDST and KSAA
          items = items.filter((product: any) => {
            const deptCode = product.department_code || '';
            return !deptCode.startsWith('PDST') && !deptCode.startsWith('KSAA');
          });
          if (items.length > 0) {
            // Already worst-gp sorted by server; take top 5
            setLowGPProducts(items.slice(0, 5));
            return; // done
          }
        } else {
          console.warn('worst-gp endpoint returned non-OK:', resp.status);
        }
      } catch (e) {
        console.warn('worst-gp endpoint failed:', e);
      }
      
      // 2) Fallback: for group (100), skip heavy pagination and return no data quickly
      if (pharmacyId === 100) {
        setLowGPProductsError('No low GP products data available for this date');
        setLowGPProducts([]);
        return;
      }

      // Fallback: use full stock-activity list and compute (non-group only)
      const products = await fetchAllStockActivityItems(pharmacyId, dateStr);
      if (!products || products.length === 0) {
        console.log('Low GP products API returned empty array - no data available for this date');
        setLowGPProductsError('No low GP products data available for this date');
        setLowGPProducts([]);
        return;
      }
      
      // Filter out PDST and KSAA department products
      const nonPDSTProducts = products.filter((product: any) => {
        const deptCode = product.department_code || '';
        return !deptCode.startsWith('PDST') && !deptCode.startsWith('KSAA');
      });
          
      if (nonPDSTProducts.length === 0) {
        console.log('No non-PDST products available after filtering');
        setLowGPProductsError('No low GP products available (excluding SEP)');
        setLowGPProducts([]);
        return;
      }
      
      // Sort by GP percentage with NULLs first (lowest GP first = worst GP)
      const sortedLowGPProducts = nonPDSTProducts.sort((a: any, b: any) => {
        const aRaw = a.gp_pct;
        const bRaw = b.gp_pct;
        const aIsNull = aRaw === null || aRaw === undefined || Number.isNaN(Number(aRaw));
        const bIsNull = bRaw === null || bRaw === undefined || Number.isNaN(Number(bRaw));
        if (aIsNull && !bIsNull) return -1; // NULLs first
        if (!aIsNull && bIsNull) return 1;
        if (aIsNull && bIsNull) return 0;
        const gpA = Number(aRaw);
        const gpB = Number(bRaw);
        return gpA - gpB; // Ascending order (lowest GP first)
      });
      
      // Take the top 5 worst GP products
      const top5WorstGPProducts = sortedLowGPProducts.slice(0, 5);
      console.log('Final top 5 worst GP products (fallback):', top5WorstGPProducts.map((p: any) => ({ description: p.description, gp_pct: p.gp_pct, product_code: p.product_code })));
      
      setLowGPProducts(top5WorstGPProducts);
      
    } catch (error: any) {
      console.error('Error fetching low GP products:', error);
      setLowGPProductsError('Failed to fetch low GP products (excluding SEP)');
      setLowGPProducts([]);
    } finally {
      setLowGPProductsLoading(false);
    }
  };

  // Function to fetch top sellers using 180-day average daily usage
  const fetchTopSellers = async () => {
    if (!selectedPharmacy || !selectedDate) return;

    setTopSellersLoading(true);
    setTopSellersError(null);
    try {
      const pharmacyId = getPharmacyId(selectedPharmacy);
      console.log(`Fetching top usage (180d) for pharmacy: ${selectedPharmacy} (id=${pharmacyId})`);

      // For group pharmacy (100), use a simplified approach
      if (pharmacyId === 100) {
        // Use the by-quantity endpoint for group as it's faster
        const dateStr = formatDateLocal(selectedDate);
        const resp = await fetch(`${API_CONFIG.BASE_URL}/pharmacies/${pharmacyId}/stock-activity/by-quantity?date=${dateStr}&limit=15`, { // Reduced from 20 to 15 for faster loading
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${API_CONFIG.API_KEY}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (resp.ok) {
          const data = await resp.json();
          const items = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
          if (items.length > 0) {
            // Take top 5 by quantity for group
            const top5 = items.slice(0, 5);
            setTopSellers(top5);
            return;
          }
        }
        
        setTopSellersError('No top sellers data available for group');
        setTopSellers([]);
        return;
      }

      // Primary: Get top 5 products by 180-day average usage from the entire database
      const usageResponse = await fetch(`${API_CONFIG.BASE_URL}/pharmacies/${pharmacyId}/usage/top-180d?limit=100`, { // Reduced from 500 to 100
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${API_CONFIG.API_KEY}`,
          'Content-Type': 'application/json'
        }
        });
        
      if (usageResponse.ok) {
        const usageData = await usageResponse.json();
        const usageItems = Array.isArray(usageData) ? usageData : Array.isArray(usageData?.items) ? usageData.items : [];
        
        if (usageItems.length > 0) {
          // Sort by avg_qty_180d descending and take top 5
          const top5ByUsage = usageItems
            .filter((item: any) => {
              const avg180 = Number(item?.avg_qty_180d);
              return typeof avg180 === 'number' && isFinite(avg180) && avg180 > 0;
            })
            .sort((a: any, b: any) => (Number(b.avg_qty_180d) || 0) - (Number(a.avg_qty_180d) || 0))
            .slice(0, 5);

          if (top5ByUsage.length > 0) {
            console.log('Using usage/top-180d data for top sellers');
            setTopSellers(top5ByUsage);
            return;
          }
        }
      }

      // Fallback: If usage endpoint fails or returns no data, use stock-activity for the selected date
      console.log('Usage endpoint unavailable, falling back to stock-activity by quantity for selected date');
      const dateStr = formatDateLocal(selectedDate);
      const fallbackResponse = await fetch(`${API_CONFIG.BASE_URL}/pharmacies/${pharmacyId}/stock-activity/by-quantity?date=${dateStr}&limit=15`, { // Reduced from 20 to 15 for faster loading
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${API_CONFIG.API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      if (fallbackResponse.ok) {
        const fallbackData = await fallbackResponse.json();
        const fallbackItems = Array.isArray(fallbackData) ? fallbackData : Array.isArray(fallbackData?.items) ? fallbackData.items : [];
        
        if (fallbackItems.length > 0) {
          // Enrich with usage data and sort by usage (not by daily sales)
          const enrichedResults = await Promise.allSettled(
            fallbackItems.slice(0, 8).map(async (item: any) => { // Reduced from 10 to 8 for faster processing
              try {
                const code = encodeURIComponent(item.product_code || item.code);
                const r = await fetch(`${API_CONFIG.BASE_URL}/pharmacies/${pharmacyId}/usage/product/${code}`, {
                  method: 'GET',
                  headers: {
                    'Authorization': `Bearer ${API_CONFIG.API_KEY}`,
                    'Content-Type': 'application/json'
                  }
                });
                if (!r.ok) return null;
                const d = await r.json();
                const avg180 = Number(d?.avg_qty_180d);
                if (!isFinite(avg180) || avg180 <= 0) return null;
          return {
                  ...item,
                  avg_qty_180d: avg180
                };
              } catch {
                return null;
              }
            })
          );

          const enriched = enrichedResults
            .filter((r: any) => r.status === 'fulfilled' && r.value)
            .map((r: any) => r.value as any)
            .sort((a: any, b: any) => (Number(b.avg_qty_180d) || 0) - (Number(a.avg_qty_180d) || 0))
          .slice(0, 5);
        
          if (enriched.length > 0) {
            setTopSellers(enriched);
            return;
          }
        }
      }

      setTopSellersError('No top sellers data available');
        setTopSellers([]);

    } catch (error: any) {
      console.error('Error fetching top sellers:', error);
      setTopSellersError('Failed to fetch top sellers');
      setTopSellers([]);
    } finally {
      setTopSellersLoading(false);
    }
  };

  // Function to fetch high stock levels
  const fetchHighStockLevels = async () => {
    if (!selectedPharmacy || !selectedDate) return;

    setHighStockLevelsLoading(true);
    setHighStockLevelsError(null);
    try {
      const dateStr = formatDateLocal(selectedDate);
      const pharmacyId = getPharmacyId(selectedPharmacy);
      console.log(`Computing high stock levels for ${selectedPharmacy} on ${dateStr}`);
      
      // For group pharmacy (100), skip this expensive calculation
      if (pharmacyId === 100) {
        setHighStockLevelsError('High stock levels calculation not available for group view');
        setHighStockLevels([]);
        return;
      }
      
      // Safe fetchers that never throw
      const safeFetchUsageTop = async (): Promise<any[]> => {
        try {
          const r = await fetch(`${API_CONFIG.BASE_URL}/pharmacies/${pharmacyId}/usage/top-180d?limit=100`, { // Reduced from 500 to 100
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${API_CONFIG.API_KEY}`,
              'Content-Type': 'application/json'
            }
          });
          if (!r.ok) {
            console.warn('usage/top-180d returned non-OK:', r.status);
            return [];
          }
          const d = await r.json();
          return Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : [];
        } catch (e) {
          console.warn('usage/top-180d fetch failed:', e);
          return [];
        }
      };

      const safeFetchActivity = async (): Promise<any[]> => {
        try {
          return await fetchAllStockActivityItems(pharmacyId, dateStr);
        } catch (e) {
          console.warn('stock-activity fetch failed:', e);
          return [];
        }
      };

      // Fetch in parallel
      const [usageTop, activityItems] = await Promise.all([
        safeFetchUsageTop(),
        safeFetchActivity()
      ]);

      if (!Array.isArray(activityItems) || activityItems.length === 0) {
        setHighStockLevelsError('No stock activity available for selected date');
          setHighStockLevels([]);
          return;
        }

      // Build usage map
      const usageMap = new Map<string, number>();
      for (const u of usageTop) {
        const code = u?.product_code || u?.code;
        const avg180 = Number(u?.avg_qty_180d);
        if (code && isFinite(avg180) && avg180 > 0) usageMap.set(code, avg180);
      }

      // Map activity to candidates and try compute days using usageMap
      let candidates = activityItems
        .map((item: any) => {
          const productCode = item.product_code || item.stock_code || item.code;
          const onHand = Number(item.on_hand ?? item.current_soh ?? item.currentSOH ?? item.soh ?? 0);
          const avg180 = usageMap.get(productCode);
          // Only calculate days if we have meaningful usage data
          const days = avg180 && avg180 > 0.1 ? onHand / avg180 : undefined;
          return {
            ...item,
            product_code: productCode,
            current_soh: onHand,
            avg_qty_180d: avg180,
            days_of_stock: days
          };
        })
        .filter((p: any) => p.product_code && p.current_soh > 4);

      // If we have no usable days from usageMap, fallback to per-product usage for top SOH candidates
      const haveAnyDays = candidates.some((p: any) => typeof p.days_of_stock === 'number' && p.days_of_stock > 0 && p.days_of_stock < 1000);
      if (!haveAnyDays) {
        console.log('No valid days from usage top list; falling back to per-product usage lookups');
        const topBySOH = candidates
          .sort((a: any, b: any) => (b.current_soh || 0) - (a.current_soh || 0))
          .slice(0, 25); // Reduced from 50 to 25 for faster processing

        const fallbackResults = await Promise.allSettled(
          topBySOH.map(async (item: any) => {
            try {
              const code = encodeURIComponent(item.product_code);
              const r = await fetch(`${API_CONFIG.BASE_URL}/pharmacies/${pharmacyId}/usage/product/${code}`, {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${API_CONFIG.API_KEY}`,
                  'Content-Type': 'application/json'
                }
              });
              if (!r.ok) return null;
              const d = await r.json();
              const avg180 = Number(d?.avg_qty_180d);
              if (!isFinite(avg180) || avg180 <= 0.1) return null;
              const days = item.current_soh / avg180;
              // Validate that days calculation makes sense
              if (days <= 0 || days > 1000) return null;
              return { ...item, avg_qty_180d: avg180, days_of_stock: days };
            } catch {
              return null;
            }
          })
        );

        candidates = fallbackResults
          .filter((r: any) => r.status === 'fulfilled' && r.value)
          .map((r: any) => r.value as any);
      } else {
        // Filter to only those with computable and reasonable days
        candidates = candidates.filter((p: any) => 
          typeof p.days_of_stock === 'number' && 
          p.days_of_stock > 0 && 
          p.days_of_stock < 1000
        );
      }

      if (!candidates || candidates.length === 0) {
        setHighStockLevelsError('No products with calculable days of stock');
        setHighStockLevels([]);
        return;
      }
      
      const top5HighStock = candidates
        .sort((a: any, b: any) => (b.days_of_stock || 0) - (a.days_of_stock || 0))
        .slice(0, 5);

      // Enrich with estimated cost value for right-side display (SOH × avg_unit_cost)
      const fromDate = (() => {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() - 180);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      })();
      const toDate = formatDateLocal(selectedDate);

      const valueResults = await Promise.allSettled(
        top5HighStock.map(async (item: any) => {
          try {
            const code = encodeURIComponent(item.product_code);
            const r = await fetch(`${API_CONFIG.BASE_URL}/products/${code}/sales/summary?from_date=${fromDate}&to_date=${toDate}&pharmacy_id=${pharmacyId}`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${API_CONFIG.API_KEY}`,
                'Content-Type': 'application/json'
              }
            });
            if (!r.ok) return item;
            const d = await r.json();
            const unitCost = Number(d?.avg_unit_cost);
            if (!isFinite(unitCost) || unitCost <= 0) return item;
            const estimatedCostValue = unitCost * Number(item.current_soh || 0);
            return { ...item, estimatedCostValue };
          } catch {
            return item;
          }
        })
      );

      const top5WithValues = valueResults
        .filter((res: any) => res.status === 'fulfilled' && res.value)
        .map((res: any) => res.value as any);
      
      setHighStockLevels(top5WithValues);
    } catch (error: any) {
      console.error('Error fetching high stock levels:', error);
      setHighStockLevelsError('Failed to compute high stock levels');
      setHighStockLevels([]);
    } finally {
      setHighStockLevelsLoading(false);
    }
  };

  // Debug effect to log state changes
  useEffect(() => {
    console.log('topProductsByQuantity state changed:', topMovingProducts);
  }, [topMovingProducts]);

  // Debug effect to log low GP products state changes (excluding PDST)
  useEffect(() => {
    console.log('lowGPProducts state changed (excluding SEP):', lowGPProducts);
  }, [lowGPProducts]);

  // Debug effect to log high stock levels state changes
  useEffect(() => {
    console.log('highStockLevels state changed:', highStockLevels);
  }, [highStockLevels]);

  // Fetch data only when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      if (selectedPharmacy && selectedDate) {
        fetchStockData();
        fetchTopMovingProducts();
        fetchLowGPProducts();
        fetchTopSellers();
        fetchHighStockLevels();
      }
    }, [selectedPharmacy, selectedDate])
  );

  // Pull-to-refresh handler
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        fetchStockData(),
        fetchTopMovingProducts(),
        fetchLowGPProducts(),
        fetchTopSellers(),
        fetchHighStockLevels()
      ]);
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleDateFromScroller = (d: Date) => setSelectedDate(d);

  return (
    <View style={styles.container}>
      {(stockDataLoading || topMovingProductsLoading || lowGPProductsLoading || topSellersLoading || highStockLevelsLoading) && (
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
          <Text style={styles.summaryTitle}>Stock Summary</Text>
          <TouchableOpacity style={styles.showMoreButton} onPress={() => navigation.navigate('StockDetail' as never)}>
            <Text style={styles.showMoreSummaryText}>Stock Details</Text>
          </TouchableOpacity>
        </View>
        
        {/* Quick Stats Grid */}
        <View style={styles.metricsGrid}>
          <TouchableOpacity 
            style={styles.stockValueCard} 
            onPress={() => setStockValueCardExpanded(!stockValueCardExpanded)}
            activeOpacity={0.8}
          >
            <View style={styles.stockValueCardContent}>
              <View style={styles.stockValueIconContainer}>
                <DollarSign size={16} color={colors.bgGradientFrom} strokeWidth={2.5} />
              </View>
              <View style={styles.stockValueTextContainer}>
                <View style={styles.labelRow}>
                  <Text style={styles.stockValueLabel}>Stock Value</Text>
                  <ChevronRight 
                    size={14} 
                    color={colors.textSecondary} 
                    style={[
                      styles.expandArrow,
                      { transform: [{ rotate: stockValueCardExpanded ? '90deg' : '0deg' }] }
                    ]}
                  />
                </View>
                <Text style={styles.stockValueValue}>
                  {stockDataLoading ? 'Loading...' : `R ${Math.round(stockData.stockValue).toLocaleString('en-ZA')}`}
                </Text>
              </View>
            </View>
            
            {stockValueCardExpanded && (
              <View style={styles.stockValueExpandedContent}>
                <View style={styles.stockValueComparisonRow}>
                  <Text style={styles.comparisonText}>
                    vs Previous Month: {Math.round(previousMonthStockValue).toLocaleString('en-ZA')}
                  </Text>
                  <Text style={[
                    styles.changeText, 
                    { 
                      color: stockValuePercentageChange >= 0 ? colors.statusSuccess : colors.statusError 
                    }
                  ]}>
                    {stockValuePercentageChange >= 0 ? '+' : ''}{stockValuePercentageChange.toFixed(1)}%
                  </Text>
                </View>
              </View>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.daysOfInventoryCard} 
            onPress={() => setDaysOfInventoryCardExpanded(!daysOfInventoryCardExpanded)}
            activeOpacity={0.8}
          >
            <View style={styles.daysOfInventoryCardContent}>
              <View style={styles.daysOfInventoryIconContainer}>
                <Package size={16} color={colors.bgGradientFrom} strokeWidth={2.5} />
              </View>
              <View style={styles.daysOfInventoryTextContainer}>
                <View style={styles.labelRow}>
                  <Text style={styles.daysOfInventoryLabel}>Days</Text>
                  <ChevronRight 
                    size={14} 
                    color={colors.textSecondary} 
                    style={[
                      styles.expandArrow,
                      { transform: [{ rotate: daysOfInventoryCardExpanded ? '90deg' : '0deg' }] }
                    ]}
                  />
                </View>
                <Text style={styles.daysOfInventoryValue}>
                  {stockDataLoading ? 'Loading...' : stockData.daysOfInventory.toFixed(1)}
                </Text>
              </View>
            </View>
            
            {daysOfInventoryCardExpanded && (
              <View style={styles.daysOfInventoryExpandedContent}>
                <View style={styles.daysOfInventoryDetailRow}>
                  <Text style={styles.daysOfInventoryDetailLabel}>Days of inventory left</Text>
                </View>
    
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.purchasesCard} 
            onPress={() => setPurchasesCardExpanded(!purchasesCardExpanded)}
            activeOpacity={0.8}
          >
            <View style={styles.purchasesCardContent}>
              <View style={styles.purchasesIconContainer}>
                <ShoppingCart size={16} color={colors.bgGradientFrom} strokeWidth={2.5} />
              </View>
              <View style={styles.purchasesTextContainer}>
                <View style={styles.labelRow}>
                  <Text style={styles.purchasesLabel}>Cost of Sales</Text>
                  <ChevronRight 
                    size={14} 
                    color={colors.textSecondary} 
                    style={[
                      styles.expandArrow,
                      { transform: [{ rotate: purchasesCardExpanded ? '90deg' : '0deg' }] }
                    ]}
                  />
                </View>
                <Text style={styles.purchasesValue}>
                  {stockDataLoading ? 'Loading...' : `R ${Math.round(stockData.costOfSales).toLocaleString('en-ZA')}`}
                </Text>
              </View>
            </View>
            
            {purchasesCardExpanded && (
              <View style={styles.purchasesExpandedContent}>
                <View style={styles.purchasesDetailRow}>
                  <Text style={styles.purchasesDetailLabel}>Purchases</Text>
                  <Text style={styles.purchasesDetailValue}>
                    {stockDataLoading ? 'Loading...' : `R ${Math.round(stockData.purchases).toLocaleString('en-ZA')}`}
                  </Text>
                </View>
                <View style={styles.purchasesDetailRow}>
                  <Text style={styles.purchasesDetailLabel}>Period</Text>
                  <Text style={styles.purchasesDetailValue}>MTD</Text>
                </View>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.gpPercentCard} 
            onPress={() => setGpPercentCardExpanded(!gpPercentCardExpanded)}
            activeOpacity={0.8}
          >
            <View style={styles.gpPercentCardContent}>
              <View style={styles.gpPercentIconContainer}>
                <TrendingUp size={16} color={colors.bgGradientFrom} strokeWidth={2.5} />
              </View>
              <View style={styles.gpPercentTextContainer}>
                <View style={styles.labelRow}>
                  <Text style={styles.gpPercentLabel}>MTD GP</Text>
                  <ChevronRight 
                    size={14} 
                    color={colors.textSecondary} 
                    style={[
                      styles.expandArrow,
                      { transform: [{ rotate: gpPercentCardExpanded ? '90deg' : '0deg' }] }
                    ]}
                  />
                </View>
                <Text style={styles.gpPercentValue}>
                  {stockDataLoading ? 'Loading...' : `${stockData.gpPercent.toFixed(1)}%`}
                </Text>
              </View>
            </View>
            
            {gpPercentCardExpanded && (
              <View style={styles.gpPercentExpandedContent}>
                <View style={styles.gpPercentDetailRow}>
                  <Text style={styles.gpPercentDetailLabel}>GP</Text>
                  <Text style={styles.gpPercentDetailValue}>
                    {stockDataLoading ? 'Loading...' : `R ${Math.round(stockData.gpValue).toLocaleString('en-ZA')}`}
                  </Text>
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
                if (!stockData || stockData.stockValue === 0) {
                  return (
                    <View style={styles.noAlertsContainer}>
                      <Text style={styles.noAlertsText}>Loading data...</Text>
                    </View>
                  );
                }
                const alerts = getAlerts(stockData);
                
                if (!alerts || alerts.length === 0) {
                  return (
                    <View style={styles.noAlertsContainer}>
                      <Text style={styles.noAlertsText}>No alerts to display</Text>
                    </View>
                  );
                }

                return (
                  <View style={styles.alertsGrid}>
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
                          style={[styles.alertCard, { backgroundColor: severityColors.background }]}
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
                  </View>
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

        {/* Daily Stock Activity Section */}
        <View style={styles.dailyStockActivitySection}>
          <View style={styles.dailyStockActivityHeader}>
            <Text style={styles.dailyStockActivityTitle}>Daily Stock Activity</Text>
            <TouchableOpacity 
              style={styles.showMoreButton} 
              onPress={() => navigation.navigate('StockHistory' as never)}
            >
              <Text style={styles.showMoreText}>Show More</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Top Moving Products Section */}
        <View style={styles.topMovingProductsSection}>
          <Text style={styles.topMovingProductsTitle}>Top Products by Quantity Today</Text>
        </View>
        
        {/* Top Moving Products Card */}
        <View style={styles.section}>
          
          {topMovingProductsLoading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading top products by quantity...</Text>
            </View>
          ) : topMovingProductsError ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{topMovingProductsError}</Text>
            </View>
          ) : topMovingProducts.length > 0 ? (
            <View style={styles.topMovingProductsList}>
              {topMovingProducts.slice(0, 5).map((product, index) => {
                console.log(`Product ${index} by quantity:`, product);
                return (
                  <View key={index} style={styles.topMovingProductItem}>
                    <View style={styles.topMovingProductContent}>
                      <View style={styles.topMovingProductInfo}>
                                              <Text style={styles.topMovingProductName} numberOfLines={1} ellipsizeMode="tail">
                          {product.description || `Product ${index + 1}`}
                      </Text>
                      <Text style={styles.topMovingProductCode}>
                          {product.product_code || 'N/A'}
                      </Text>
                      </View>
                      <View style={styles.topMovingProductStats}>
                                              <Text style={styles.topMovingProductQuantity}>
                          {product.qty_sold || 0} units
                      </Text>
                        {product.gp_pct !== undefined && product.gp_pct !== null ? (
                        <Text style={styles.topMovingProductGP}>
                            {product.gp_pct.toFixed(1)}% GP
                        </Text>
                      ) : null}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.noDataContainer}>
              <Text style={styles.noDataText}>No top products by quantity available</Text>
            </View>
          )}
        </View>

        {/* Low GP Products Section */}
        <View style={styles.lowGPProductsSection}>
          <Text style={styles.lowGPProductsTitle}>Low GP Products (Excluding SEP)</Text>
        </View>
        
        {/* Low GP Products Card */}
        <View style={styles.section}>
          
          {lowGPProductsLoading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading low GP products (excluding SEP)...</Text>
            </View>
          ) : lowGPProductsError ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{lowGPProductsError}</Text>
            </View>
          ) : lowGPProducts.length > 0 ? (
            <View style={styles.lowGPProductsList}>
              {lowGPProducts.slice(0, 5).map((product, index) => {
                console.log(`Low GP Product ${index} (excluding PDST):`, product);
                return (
                  <View key={index} style={styles.lowGPProductItem}>
                    <View style={styles.lowGPProductContent}>
                      <View style={styles.lowGPProductInfo}>
                        <Text style={styles.lowGPProductName} numberOfLines={1} ellipsizeMode="tail">
                          {product.description || `Product ${index + 1}`}
                        </Text>
                        <Text style={styles.lowGPProductCode}>
                          {product.product_code || 'N/A'}
                        </Text>
                      </View>
                      <View style={styles.lowGPProductStats}>
                        {product.gp_pct !== undefined && product.gp_pct !== null ? (
                          <Text style={styles.lowGPProductQuantity}>
                            {product.gp_pct.toFixed(1)}% GP
                          </Text>
                        ) : (
                          <Text style={styles.lowGPProductQuantity}>--</Text>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.noDataContainer}>
              <Text style={styles.noDataText}>No low GP products available (excluding SEP)</Text>
            </View>
          )}
        </View>

        {/* Top Sellers Section */}
        <View style={styles.topSellersSection}>
          <Text style={styles.topSellersTitle}>Top Sellers (180d)</Text>
        </View>
        
        {/* Top Sellers Card */}
        <View style={styles.section}>
          
          {topSellersLoading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading top sellers...</Text>
            </View>
          ) : topSellersError ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{topSellersError}</Text>
            </View>
          ) : topSellers.length > 0 ? (
            <View style={styles.topSellersList}>
              {topSellers.slice(0, 5).map((product: TopMovingProduct, index: number) => (
                <View key={index} style={styles.topSellerItem}>
                  <View style={styles.topSellerContent}>
                    <View style={styles.topSellerInfo}>
                      <Text style={styles.topSellerName} numberOfLines={1} ellipsizeMode="tail">
                        {product.description || product.productName || product.name || product.product_name || product.desc || `Product ${index + 1}`}
                      </Text>
                      <Text style={styles.topSellerCode}>
                        {product.product_code || product.stock_code || product.stockCode || product.code || 'N/A'}
                      </Text>
                    </View>
                    <View style={styles.topSellerStats}>
                      <Text style={styles.topSellerAvgDaily}>
                        {(() => {
                          const avg180 = (product as any).avg_qty_180d;
                          const avg90 = (product as any).avg_qty_90d;
                          const avg30 = (product as any).avg_qty_30d;
                          const chosenAvg = typeof avg180 === 'number' && isFinite(avg180) && avg180 > 0
                            ? avg180
                            : typeof avg90 === 'number' && isFinite(avg90) && avg90 > 0
                              ? avg90
                              : typeof avg30 === 'number' && isFinite(avg30) && avg30 > 0
                                ? avg30
                                : undefined;
                          if (typeof chosenAvg === 'number') {
                            return `${chosenAvg.toFixed(2)} avg/day`;
                          }
                          const qtySold = (product as any).qty_sold || (product as any).quantity || (product as any).units || (product as any).qty || 0;
                          return qtySold ? `${Number(qtySold).toFixed(1)} units` : '--';
                        })()}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.noDataContainer}>
              <Text style={styles.noDataText}>No top sellers available</Text>
            </View>
          )}
        </View>

        {/* High Stock Levels Section */}
        <View style={styles.highStockLevelsSection}>
          <Text style={styles.highStockLevelsTitle}>High Stock Levels</Text>
        </View>
        
        {/* High Stock Levels Card */}
        <View style={styles.section}>
          
          {highStockLevelsLoading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading high stock levels...</Text>
            </View>
          ) : highStockLevelsError ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{highStockLevelsError}</Text>
            </View>
          ) : highStockLevels.length > 0 ? (
            <View style={styles.highStockLevelsList}>
              {highStockLevels.slice(0, 5).map((product, index) => {
                console.log(`High Stock Product ${index}:`, product);
                return (
                  <View key={index} style={styles.highStockLevelItem}>
                    <View style={styles.highStockLevelContent}>
                      <View style={styles.highStockLevelInfo}>
                        <Text style={styles.highStockLevelName} numberOfLines={1} ellipsizeMode="tail">
                          {product.description || product.productName || product.name || product.product_name || product.desc || `Product ${index + 1}`}
                        </Text>
                        <Text style={styles.highStockLevelCode}>
                          {product.product_code || product.stock_code || product.stockCode || product.code || 'N/A'}
                        </Text>
                      </View>
                      <View style={styles.highStockLevelStats}>
                        <Text style={styles.highStockLevelValue}>
                          {(() => {
                            const raw = Number((product as any).days_of_stock ?? (product as any).daysOfStock ?? (product as any).days);
                            if (!isFinite(raw) || raw <= 0) return '--';
                            if (raw > 60) return '60+ days';
                            return `${Math.round(raw)} days`;
                          })()}
                        </Text>
                                              <View style={styles.highStockLevelDetails}>
                        <Text style={styles.highStockLevelSOH}>
                            SOH: {(() => {
                              const soh = Number((product as any).current_soh ?? (product as any).currentSOH ?? (product as any).soh ?? (product as any).stock_on_hand ?? 0);
                              return isFinite(soh) ? soh.toFixed(1) : '0.0';
                            })()}
                        </Text>
                      </View>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.noDataContainer}>
              <Text style={styles.noDataText}>No high stock levels available</Text>
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
  dateLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
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
    fontWeight: '600',
  },
  showMoreSummaryText: {
    fontSize: 14,
    color: colors.accentPrimary,
    fontWeight: '500',
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  // Metrics grid styles
  metricsGrid: {
    paddingHorizontal: 16,
    gap: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  // Stock Value card styles
  stockValueCard: {
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
  stockValueCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stockValueIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.accentPrimary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stockValueTextContainer: {
    flex: 1,
  },
  stockValueLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  stockValueValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.accentPrimary,
  },
  stockValueExpandedContent: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  stockValueComparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stockValueDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  stockValueDetailLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  stockValueDetailValue: {
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  // Days of Inventory card styles
  daysOfInventoryCard: {
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
  daysOfInventoryCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  daysOfInventoryIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.chartGold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  daysOfInventoryTextContainer: {
    flex: 1,
  },
  daysOfInventoryLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  daysOfInventoryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.chartGold,
  },
  daysOfInventoryExpandedContent: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  daysOfInventoryDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  daysOfInventoryDetailLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  daysOfInventoryDetailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  daysOfInventoryComparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // Purchases card styles
  purchasesCard: {
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
  purchasesCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  purchasesIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.costSales,
    justifyContent: 'center',
    alignItems: 'center',
  },
  purchasesTextContainer: {
    flex: 1,
  },
  purchasesLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  purchasesValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.costSales,
  },
  purchasesExpandedContent: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  purchasesDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  purchasesDetailLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  purchasesDetailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  purchasesComparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // GP% card styles
  gpPercentCard: {
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
  gpPercentCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  gpPercentIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gpPercentTextContainer: {
    flex: 1,
  },
  gpPercentLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  gpPercentValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#8B5CF6',
  },
  gpPercentExpandedContent: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  gpPercentDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gpPercentDetailLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  gpPercentDetailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  gpPercentComparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // Common styles for comparison text
  comparisonText: {
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
  },
  changeText: {
    fontSize: 12,
    fontWeight: '600',
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
  // Daily Stock Activity section styles
  dailyStockActivitySection: {
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: -4,
  },
  dailyStockActivityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dailyStockActivityTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  // Top Moving Products section styles
  topMovingProductsSection: {
    paddingHorizontal: 16,
    marginTop: 4,
    marginBottom: -4,
  },
  // Low GP Products section styles
  lowGPProductsSection: {
    paddingHorizontal: 16,
    marginTop: 4,
    marginBottom: -4,
  },
  lowGPProductsHeader: {
    marginBottom: 12,
  },
  lowGPProductsTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lowGPProductsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  lowGPProductsCountBadge: {
    backgroundColor: colors.statusError + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  lowGPProductsCountText: {
    fontSize: 12,
    color: colors.statusError,
    fontWeight: '600',
  },
  lowGPProductsList: {
    gap: 0,
  },
  lowGPProductItem: {
    padding: 12,
  },
  lowGPProductContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  lowGPProductInfo: {
    flex: 1,
    minWidth: 0,
  },
  lowGPProductName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  lowGPProductCode: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  lowGPProductStats: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
  lowGPProductQuantity: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.statusError,
    marginBottom: 2,
  },
  lowGPProductGP: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  topMovingProductsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  // Top Moving Products styles
  topMovingProductsTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topMovingProductsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 100,
  },
  loadingText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 100,
  },
  errorText: {
    fontSize: 14,
    color: colors.statusError,
  },
  topMovingProductsList: {
    gap: 0,
  },
  topMovingProductItem: {
    padding: 12,
  },
  topMovingProductContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  topMovingProductRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accentPrimary,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  topMovingProductRankText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  topMovingProductInfo: {
    flex: 1,
    minWidth: 0,
  },
  topMovingProductName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  topMovingProductCode: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  topMovingProductStats: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  topMovingProductQuantity: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.statusSuccess,
    marginBottom: 2,
  },
  topMovingProductGP: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  noDataContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 100,
  },
  noDataText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  // Top Sellers section styles
  topSellersSection: {
    paddingHorizontal: 16,
    marginTop: 4,
    marginBottom: -4,
  },
  topSellersTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  topSellersList: {
    gap: 0,
  },
  topSellerItem: {
    padding: 12,
  },
  topSellerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  topSellerInfo: {
    flex: 1,
    minWidth: 0,
  },
  topSellerName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  topSellerCode: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  topSellerStats: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
  topSellerAvgDaily: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.statusSuccess,
    marginBottom: 2,
  },
  // High Stock Levels section styles
  highStockLevelsSection: {
    paddingHorizontal: 16,
    marginTop: 4,
    marginBottom: -4,
  },
  highStockLevelsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  highStockLevelsList: {
    gap: 0,
  },
  highStockLevelItem: {
    padding: 12,
  },
  highStockLevelContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  highStockLevelInfo: {
    flex: 1,
    minWidth: 0,
  },
  highStockLevelName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  highStockLevelCode: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  highStockLevelStats: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
  highStockLevelValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.statusError,
    marginBottom: 2,
  },
  highStockLevelSOH: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  highStockLevelDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  highStockLevelDays: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  // Expandable arrow styles
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
});

export default StockScreen; 