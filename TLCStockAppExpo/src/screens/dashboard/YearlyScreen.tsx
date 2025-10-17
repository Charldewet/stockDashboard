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
import { useAuth } from '../../contexts/AuthContext';
import { newPharmacyAPI } from '../../services/api';
import { getPharmacyByCode } from '../../config/api';
import { formatDateLocal, getYesterday, formatDateDisplay } from '../../utils/dateUtils';
import { formatCurrency, formatPercentage, calculatePercentageChange } from '../../utils/formatUtils';
import { TrendingUp, TrendingDown, AlertCircle, ChevronDown, Calendar, CheckCircle, AlertTriangle, Menu, LogOut, User, Bell, Shield, Settings, DollarSign, ShoppingCart, ShoppingBasket, BarChart3, ChevronRight, Moon, Sun } from 'lucide-react-native';
import { useNotifications } from '../../contexts/NotificationsContext';
import { useTheme } from '../../contexts/ThemeContext';
import CustomDatePicker from '../../components/common/CustomDatePicker';
import DateScroller from '../../components/common/DateScroller';

const { width } = Dimensions.get('window');

const useColors = () => useTheme().colors;

interface YearlyData {
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
  avgScriptValue?: number;
}

// Add getAlerts function before the component
const getAlerts = (data: YearlyData, previousYearData: YearlyData | null) => {
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

  // 4b. Purchases vs Sales - highlight high purchasing relative to sales
  if (data.turnover > 0 && data.purchases > 0) {
    const purchasesVsSales = (data.purchases / data.turnover) * 100;
    if (purchasesVsSales > 90) {
      alerts.push({
        severity: 'critical',
        icon: AlertCircle,
        title: 'Purchases vs Sales Too High',
        description: `${purchasesVsSales.toFixed(1)}% of turnover spent on purchases`
      });
    } else if (purchasesVsSales > 75) {
      alerts.push({
        severity: 'warning',
        icon: AlertTriangle,
        title: 'High Purchases vs Sales',
        description: `${purchasesVsSales.toFixed(1)}% of turnover spent on purchases`
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

const YearlyScreen = () => {
  const navigation = useNavigation<AuthNavigationProp>();
  const { selectedPharmacy, pharmacies, setSelectedPharmacy, selectedDate, setSelectedDate, logout } = useAuth();
  const { colors, themeMode, toggleTheme } = useTheme();
  const [tempSelectedDate, setTempSelectedDate] = useState(selectedDate);
  
  // Data states
  const [yearlyData, setYearlyData] = useState<YearlyData | null>(null);
  const [previousYearData, setPreviousYearData] = useState<YearlyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [backgroundLoading, setBackgroundLoading] = useState(false);
  
  // Selector states
  const [showPharmacyDropdown, setShowPharmacyDropdown] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showHamburgerMenu, setShowHamburgerMenu] = useState(false);
  const slideAnim = useRef(new Animated.Value(-width)).current;
  const [refreshing, setRefreshing] = useState(false);

  // Card expansion states
  const [turnoverCardExpanded, setTurnoverCardExpanded] = useState(false);
  const [gpCardExpanded, setGpCardExpanded] = useState(false);
  const [costOfSalesCardExpanded, setCostOfSalesCardExpanded] = useState(false);
  const [basketCardExpanded, setBasketCardExpanded] = useState(false);
  const [scriptsCardExpanded, setScriptsCardExpanded] = useState(false);
  const { unreadCount } = useNotifications();

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

  // Fetch yearly data
  const fetchYearlyData = async (showLoadingScreen: boolean = true) => {
    if (!selectedPharmacy) return;

    try {
      if (showLoadingScreen) {
        setLoading(true);
      } else {
        setBackgroundLoading(true);
      }
      
      // Get pharmacy object to get the ID
      const pharmacy = getPharmacyByCode(selectedPharmacy);
      if (!pharmacy) {
        console.error('Pharmacy not found:', selectedPharmacy);
        return;
      }

      // Get current year YTD (through selected date)
      const currentYear = selectedDate.getFullYear().toString();
      const currentYearEndDate = formatDateLocal(selectedDate);
      
      // Get previous year YTD (same period)
      const previousYear = (selectedDate.getFullYear() - 1).toString();
      const previousYearEndDate = formatDateLocal(new Date(selectedDate.getFullYear() - 1, selectedDate.getMonth(), selectedDate.getDate()));

      console.log('Fetching yearly data:', {
        pharmacy: selectedPharmacy,
        currentYear: { year: currentYear, through: currentYearEndDate },
        previousYear: { year: previousYear, through: previousYearEndDate }
      });

      // Fetch current and previous year YTD data
      const [currentYTD, previousYTD] = await Promise.all([
        newPharmacyAPI.getYTD(pharmacy.id, currentYear, currentYearEndDate),
        newPharmacyAPI.getYTD(pharmacy.id, previousYear, previousYearEndDate)
      ]);

      console.log('YTD API responses:', { currentYTD, previousYTD });

      // Process current year data
      const currentData: YearlyData = {
        turnover: Number(currentYTD?.turnover) || 0,
        grossProfit: Number(currentYTD?.gp_value) || 0,
        grossProfitPercent: (() => {
          const turnover = Number(currentYTD?.turnover) || 0;
          const gpValue = Number(currentYTD?.gp_value) || 0;
          const typeRSales = Number(currentYTD?.type_r_sales) || 0;
          const denom = Math.max(0, turnover - typeRSales);
          return denom > 0 ? (gpValue / denom) * 100 : 0;
        })(),
        basketValue: (() => {
          const turnover = Number(currentYTD?.turnover) || 0;
          const typeRSales = Number(currentYTD?.type_r_sales) || 0;
          const transactionCount = Number(currentYTD?.transaction_count) || 0;
          const denom = Math.max(0, turnover - typeRSales);
          return transactionCount > 0 ? denom / transactionCount : 0;
        })(),
        basketItems: Number(currentYTD?.transaction_count) || 0,
        costOfSales: Number(currentYTD?.cost_of_sales) || 0,
        purchases: Number(currentYTD?.purchases) || 0,
        dispensaryPercent: (() => {
          const turnover = Number(currentYTD?.turnover) || 0;
          const dispensaryTurnover = Number(currentYTD?.dispensary_turnover) || 0;
          return turnover > 0 ? (dispensaryTurnover / turnover) * 100 : 0;
        })(),
        dispensaryTurnover: Number(currentYTD?.dispensary_turnover) || 0,
        scriptsDispensed: Number(currentYTD?.scripts_qty) || 0,
        cashSales: Number(currentYTD?.sales_cash) || 0,
        accountSales: Number(currentYTD?.sales_account) || 0,
        avgScriptValue: Number(currentYTD?.avg_script_value) || 0,
      };

      // Process previous year data
      const previousData: YearlyData = {
        turnover: Number(previousYTD?.turnover) || 0,
        grossProfit: Number(previousYTD?.gp_value) || 0,
        grossProfitPercent: (() => {
          const turnover = Number(previousYTD?.turnover) || 0;
          const gpValue = Number(previousYTD?.gp_value) || 0;
          const typeRSales = Number(previousYTD?.type_r_sales) || 0;
          const denom = Math.max(0, turnover - typeRSales);
          return denom > 0 ? (gpValue / denom) * 100 : 0;
        })(),
        basketValue: (() => {
          const turnover = Number(previousYTD?.turnover) || 0;
          const typeRSales = Number(previousYTD?.type_r_sales) || 0;
          const transactionCount = Number(previousYTD?.transaction_count) || 0;
          const denom = Math.max(0, turnover - typeRSales);
          return transactionCount > 0 ? denom / transactionCount : 0;
        })(),
        basketItems: Number(previousYTD?.transaction_count) || 0,
        costOfSales: Number(previousYTD?.cost_of_sales) || 0,
        purchases: Number(previousYTD?.purchases) || 0,
        dispensaryPercent: (() => {
          const turnover = Number(previousYTD?.turnover) || 0;
          const dispensaryTurnover = Number(previousYTD?.dispensary_turnover) || 0;
          return turnover > 0 ? (dispensaryTurnover / turnover) * 100 : 0;
        })(),
        dispensaryTurnover: Number(previousYTD?.dispensary_turnover) || 0,
        scriptsDispensed: Number(previousYTD?.scripts_qty) || 0,
        cashSales: Number(previousYTD?.sales_cash) || 0,
        accountSales: Number(previousYTD?.sales_account) || 0,
        avgScriptValue: Number(previousYTD?.avg_script_value) || 0,
      };

      console.log('Processed current year data:', currentData);
      console.log('Processed previous year data:', previousData);

      setYearlyData(currentData);
      setPreviousYearData(previousData);
    } catch (error: any) {
      console.error('Error fetching yearly data:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
    } finally {
      setLoading(false);
      setBackgroundLoading(false);
    }
  };

  // Fetch data only when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      if (selectedPharmacy) {
        fetchYearlyData();
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

  const handleShowMore = () => {
    // TODO: Implement navigation to yearly history
  };

  // Pull-to-refresh handler
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchYearlyData(false);
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleDateFromScroller = (d: Date) => setSelectedDate(d);

  const styles = getStyles(colors);
  return (
    <View style={styles.container}>
      {loading && (
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

          {/* Right side: Calendar and Theme Toggle */}
          <View style={styles.headerRightRow}>
            <TouchableOpacity 
              style={styles.iconButton}
              onPress={handleDatePickerOpen}
            >
              <Calendar size={20} color={colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.iconButton}
              onPress={toggleTheme}
            >
              {themeMode === 'dark' ? (
                <Sun size={20} color={colors.textPrimary} />
              ) : (
                <Moon size={20} color={colors.textPrimary} />
              )}
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
                onPress={() => toggleTheme()}
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
        
              {/* Loading handled by overlay */}
      {yearlyData && (
        <>
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
              <Text style={styles.summaryTitle}>Yearly Summary</Text>
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
                    {getTrendIndicator(yearlyData.turnover, previousYearData?.turnover || 0) || (
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
                      {backgroundLoading ? '...' : formatCurrency(yearlyData.turnover)}
                    </Text>
                  </View>
                </View>
                
                {turnoverCardExpanded && (
                  <View style={styles.turnoverExpandedContent}>
                    <View style={styles.turnoverComparisonRow}>
                      <Text style={styles.comparisonText}>
                        vs Previous Year YTD: {backgroundLoading ? '...' : formatCurrency(previousYearData?.turnover || 0)}
                      </Text>
                      <Text style={[styles.changeText, { color: getChangeIndicator(yearlyData.turnover, previousYearData?.turnover || 0).color }]}>
                        {backgroundLoading ? '...' : getChangeIndicator(yearlyData.turnover, previousYearData?.turnover || 0).text}
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
                      {backgroundLoading ? '...' : `${(yearlyData.grossProfitPercent).toFixed(1)}%`}
                    </Text>
                  </View>
                </View>
                
                {gpCardExpanded && (
                  <View style={styles.gpExpandedContent}>
                    <View style={styles.gpDetailRow}>
                      <Text style={styles.gpDetailLabel}>GP</Text>
                      <Text style={styles.gpDetailValue}>{backgroundLoading ? '...' : formatCurrency(yearlyData.grossProfit)}</Text>
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
                      {backgroundLoading ? '...' : formatCurrency(yearlyData.costOfSales)}
                    </Text>
                  </View>
                </View>
                
                {costOfSalesCardExpanded && (
                  <View style={styles.costOfSalesExpandedContent}>
                    <View style={styles.costOfSalesDetailRow}>
                      <Text style={styles.costOfSalesDetailLabel}>Purchases</Text>
                      <Text style={styles.costOfSalesDetailValue}>{backgroundLoading ? '...' : formatCurrency(yearlyData.purchases)}</Text>
                    </View>
                    <View style={styles.costOfSalesSeparator} />
                    <View style={styles.costOfSalesSubDetailRow}>
                      <Text style={styles.costOfSalesSubDetailLabel}>% Purchases vs Sales</Text>
                      <Text style={[styles.costOfSalesSubDetailValue, { color: (!backgroundLoading && yearlyData && yearlyData.turnover > 0 && (yearlyData.purchases / yearlyData.turnover * 100) > 90) ? colors.statusError : (!backgroundLoading && yearlyData && yearlyData.turnover > 0 && (yearlyData.purchases / yearlyData.turnover * 100) > 75) ? colors.statusWarning : colors.textPrimary }]}>
                        {backgroundLoading ? '...' : ((yearlyData.turnover > 0 ? (yearlyData.purchases / yearlyData.turnover) * 100 : 0).toFixed(1) + '%')}
                      </Text>
                    </View>
                    <View style={styles.costOfSalesSubDetailRow}>
                      <Text style={styles.costOfSalesSubDetailLabel}>% Purchases vs CoS</Text>
                      <Text style={[styles.costOfSalesSubDetailValue, { color: (!backgroundLoading && yearlyData && yearlyData.costOfSales > 0 && (yearlyData.purchases / yearlyData.costOfSales * 100) > 100) ? colors.statusError : (!backgroundLoading && yearlyData && yearlyData.costOfSales > 0 && (yearlyData.purchases / yearlyData.costOfSales * 100) > 90) ? colors.statusWarning : colors.textPrimary }]}>
                        {backgroundLoading ? '...' : ((yearlyData.costOfSales > 0 ? (yearlyData.purchases / yearlyData.costOfSales) * 100 : 0).toFixed(1) + '%')}
                      </Text>
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
                      {backgroundLoading ? '...' : formatCurrency(yearlyData.basketValue)}
                    </Text>
                  </View>
                </View>
                
                {basketCardExpanded && (
                  <View style={styles.basketExpandedContent}>
                    <View style={styles.basketDetailRow}>
                      <Text style={styles.basketDetailLabel}>Basket Size</Text>
                      <Text style={styles.basketDetailValue}>{backgroundLoading ? '...' : Math.round(yearlyData.basketItems)}</Text>
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
                    const alerts = getAlerts(yearlyData, previousYearData);
                    
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
                      <Text style={styles.scriptsLabel}>Scripts YTD</Text>
                      <ChevronRight 
                        size={14} 
                        color={colors.textSecondary} 
                        style={[
                          styles.expandArrow,
                          { transform: [{ rotate: scriptsCardExpanded ? '90deg' : '0deg' }] }
                        ]}
                      />
                    </View>
                    <Text style={styles.scriptsValue}>{backgroundLoading ? '...' : Math.round(yearlyData.scriptsDispensed)}</Text>
                  </View>
                </View>
                
                {scriptsCardExpanded && (
                  <View style={styles.scriptsExpandedContent}>
                    <View style={styles.scriptsComparisonRow}>
                      <Text style={styles.comparisonText}>
                        vs Previous Year YTD: {backgroundLoading ? '...' : Math.round(previousYearData?.scriptsDispensed || 0)}
                      </Text>
                      <Text style={[styles.changeText, { color: getChangeIndicator(yearlyData.scriptsDispensed, previousYearData?.scriptsDispensed || 0).color }]}>
                        {backgroundLoading ? '...' : getChangeIndicator(yearlyData.scriptsDispensed, previousYearData?.scriptsDispensed || 0).text}
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
                      {yearlyData.avgScriptValue && yearlyData.avgScriptValue > 0
                        ? formatCurrency(yearlyData.avgScriptValue)
                        : yearlyData.scriptsDispensed > 0
                          ? formatCurrency(yearlyData.dispensaryTurnover / yearlyData.scriptsDispensed)
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
                    <Text style={[styles.dispensaryPercentageText, { color: colors.chartGold }]}>{Math.round(yearlyData.dispensaryPercent)}%</Text>
                  </View>
                  <Text style={styles.dispensaryBreakdownValue}>
                    {formatCurrency(yearlyData.dispensaryTurnover)}
                  </Text>
                </View>
                <View style={styles.dispensaryBreakdownItem}>
                  <View style={styles.dispensaryBreakdownLeft}>
                    <View style={[styles.dispensaryPercentageCircle, { backgroundColor: colors.textSecondary }]} />
                    <Text style={styles.dispensaryBreakdownLabel}>Front Shop</Text>
                    <Text style={[styles.dispensaryPercentageText, { color: colors.textSecondary }]}>{Math.round(100 - yearlyData.dispensaryPercent)}%</Text>
                  </View>
                  <Text style={styles.dispensaryBreakdownValue}>
                    {formatCurrency(yearlyData.turnover - yearlyData.dispensaryTurnover)}
                  </Text>
                </View>
              </View>

              {/* Progress Bar */}
              <View style={styles.dispensaryPercentageSection}>
                <View style={styles.dispensaryProgressBar}>
                  <View style={[styles.dispensaryProgressFill, { width: `${Math.min(yearlyData.dispensaryPercent, 100)}%`, backgroundColor: colors.chartGold }]} />
                  <View style={[styles.dispensaryProgressFill, { width: `${Math.max(0, 100 - yearlyData.dispensaryPercent)}%`, backgroundColor: colors.textSecondary }]} />
                </View>
              </View>
            </View>
          </>
        )}
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
    paddingTop: 8,
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
  // Loading styles
  loadingContainer: {},
  loadingText: {},
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
  summaryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  showMoreButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  showMoreText: {
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
  costOfSalesSeparator: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 8,
  },
  costOfSalesSubDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  costOfSalesSubDetailLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  costOfSalesSubDetailValue: {
    fontSize: 14,
    fontWeight: '600',
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
  dispensaryPercentageCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  dispensaryPercentageText: {
    fontSize: 14,
    fontWeight: '600',
  },
  dispensaryPercentageSection: {
    gap: 12,
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
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
  datePickerButtonPrimary: {
    backgroundColor: colors.accentPrimary,
    borderColor: colors.accentPrimary,
  },
  datePickerButtonText: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: '600',
    textAlign: 'center',
  },
  datePickerButtonTextPrimary: {
    color: colors.bgGradientFrom,
  },
});

export default YearlyScreen; 