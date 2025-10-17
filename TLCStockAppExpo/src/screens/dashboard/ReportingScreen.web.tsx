import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AuthNavigationProp } from '../../types/navigation';
import { ChevronLeft, Download, TrendingUp, AlertTriangle, BarChart3, Calendar, Search, Check, X } from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { exportStockDataToPDF, exportTurnoverReportToPDF, exportTradingReportToPDF } from '../../utils/pdfUtils.web';
import { API_CONFIG } from '../../config/api';
import { formatDateLocal, formatDateDisplay } from '../../utils/dateUtils';
import { newPharmacyAPI } from '../../services/api';
import CustomDatePicker from '../../components/common/CustomDatePicker';

// Helper function to get pharmacy ID from pharmacy code (same mapping as StockHistoryScreen)
const getPharmacyId = (pharmacyCode: string): number => {
  // If the selected value is already a numeric id string (from backend), use it directly
  const asNum = Number(pharmacyCode);
  if (Number.isFinite(asNum) && String(asNum) === pharmacyCode) {
    return asNum;
  }
  const pharmacyMap: { [key: string]: number } = {
    'REITZ': 1,
    'TLC WINTERTON': 2
  };
  return pharmacyMap[pharmacyCode] || 1; // Default to 1 if not found
};

const ReportingScreen: React.FC = () => {
  const navigation = useNavigation<AuthNavigationProp>();
  const { colors } = useTheme();
  const { user, pharmacies, selectedPharmacy, selectedDate } = useAuth();

  const [exporting, setExporting] = useState<string | null>(null);

  // Custom report date range
  const [customStartDate, setCustomStartDate] = useState(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
  const [customEndDate, setCustomEndDate] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // Stock search states (same behavior as StockDetail)
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [checkedProducts, setCheckedProducts] = useState<Set<string>>(new Set());
  const [checkedProductsData, setCheckedProductsData] = useState<{ [key: string]: any }>({});
  const [showSelectedProducts, setShowSelectedProducts] = useState(true);

  const username = user?.username || user?.name || 'Unknown';
  const pharmacyName = (() => {
    const pharmacy = (pharmacies || []).find(p => p.code === selectedPharmacy);
    return pharmacy ? pharmacy.name : selectedPharmacy || 'Unknown Pharmacy';
  })();

  // Refs for scrolling and measurements
  const scrollRef = useRef<ScrollView>(null);
  const [customCardY, setCustomCardY] = useState(0);

  const showInfo = (message: string) => Alert.alert('Reporting', message);
  const showError = (message: string) => Alert.alert('Error', message);

  // Normalization used in StockHistoryScreen before PDF export
  const normalizeForPdf = (items: any[]) => {
    return items.map((item: any) => {
      const normalized: any = { ...item };
      normalized.description = item.description || item.productName || item.name || item.product_name || item.desc || '';
      normalized.product_code = item.product_code || item.stock_code || item.stockCode || item.code || '';
      // GP% normalization
      const gpRaw = item.gp_pct ?? item.gross_profit_percent ?? item.grossProfitPercent;
      if (gpRaw !== undefined && gpRaw !== null && gpRaw !== '') {
        const gpNum = typeof gpRaw === 'string' ? parseFloat(gpRaw) : Number(gpRaw);
        normalized.gp_pct = isFinite(gpNum) ? gpNum : undefined;
      } else if (item.grossProfit !== undefined && item.grossProfit !== null && item.valueMovement) {
        const computed = item.valueMovement > 0 ? (item.grossProfit / item.valueMovement) * 100 : undefined;
        normalized.gp_pct = computed;
      }
      // Quantity normalization (for non-Low GP reports)
      normalized.qty_sold = item.qty_sold ?? item.sales_qty ?? item.quantityMoved ?? item.quantity ?? undefined;

      // Sales and Cost normalization for PDF (Top Day, etc.)
      const rawSales = item.sales_value ?? item.sales_val ?? item.valueMovement ?? item.retail_value ?? item.retail ?? undefined;
      const rawGpValue = item.gp_value ?? item.gp ?? item.grossProfit ?? undefined;
      let salesValue: number | undefined = undefined;
      if (rawSales != null) {
        const n = Number(rawSales);
        salesValue = isFinite(n) ? n : undefined;
      }
      let costOfSales: number | undefined = undefined;
      if (item.cost_of_sales != null) {
        const n = Number(item.cost_of_sales);
        costOfSales = isFinite(n) ? n : undefined;
      } else if (item.cost != null) {
        const n = Number(item.cost);
        costOfSales = isFinite(n) ? n : undefined;
      } else if (salesValue != null && rawGpValue != null) {
        const gpNum = Number(rawGpValue);
        if (isFinite(gpNum)) {
          costOfSales = Math.max(salesValue - gpNum, 0);
        }
      }
      if (salesValue != null) normalized.sales_value = salesValue;
      if (costOfSales != null) normalized.cost_of_sales = costOfSales;

      return normalized;
    });
  };

  const fetchTopDay = async (): Promise<any[]> => {
    if (!selectedPharmacy || !selectedDate) return [];
    const dateStr = formatDateLocal(selectedDate);
    const pharmacyId = getPharmacyId(selectedPharmacy);
    try {
      const res = await fetch(`${API_CONFIG.BASE_URL}/pharmacies/${pharmacyId}/stock-activity/by-quantity?date=${dateStr}&limit=100`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${API_CONFIG.API_KEY}`, 'Content-Type': 'application/json' }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      let data: any[] = Array.isArray(json) ? json : (json?.items || []);
      // Sort by quantity sold and take top 30
      data = data
        .sort((a: any, b: any) => (Number(b.qty_sold) || 0) - (Number(a.qty_sold) || 0))
        .slice(0, 30);
      return data;
    } catch {
      return [];
    }
  };

  const fetchLowGP = async (): Promise<any[]> => {
    if (!selectedPharmacy || !selectedDate) return [];
    const dateStr = formatDateLocal(selectedDate);
    const pharmacyId = getPharmacyId(selectedPharmacy);
    try {
      const res = await fetch(`${API_CONFIG.BASE_URL}/pharmacies/${pharmacyId}/stock-activity/by-quantity?date=${dateStr}&limit=200`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${API_CONFIG.API_KEY}`, 'Content-Type': 'application/json' }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      let data: any[] = Array.isArray(json) ? json : (json?.items || []);
      // Keep products with a numeric GP%, then sort by GP ascending and take top 30
      data = data
        .filter((product: any) => product.gp_pct !== undefined && product.gp_pct !== null && !isNaN(parseFloat(String(product.gp_pct))))
        .sort((a: any, b: any) => {
          const gpA = typeof a.gp_pct === 'string' ? parseFloat(a.gp_pct) : Number(a.gp_pct) || 0;
          const gpB = typeof b.gp_pct === 'string' ? parseFloat(b.gp_pct) : Number(b.gp_pct) || 0;
          return gpA - gpB;
        })
        .slice(0, 30);
      return data;
    } catch {
      return [];
    }
  };

  const fetchTop12M = async (): Promise<any[]> => {
    if (!selectedPharmacy || !selectedDate) return [];
    const pharmacyId = getPharmacyId(selectedPharmacy);
    try {
      // First get usage data for daily averages
      const usageRes = await fetch(`${API_CONFIG.BASE_URL}/pharmacies/${pharmacyId}/usage/top-180d?limit=200`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${API_CONFIG.API_KEY}`, 'Content-Type': 'application/json' }
      });
      if (!usageRes.ok) throw new Error(`HTTP ${usageRes.status}`);
      const usageJson = await usageRes.json();
      let usageData: any[] = Array.isArray(usageJson) ? usageJson : (usageJson?.items || []);
      
      // Get stock activity data for GP% information
      const dateStr = formatDateLocal(selectedDate);
      const stockRes = await fetch(`${API_CONFIG.BASE_URL}/pharmacies/${pharmacyId}/stock-activity/by-quantity?date=${dateStr}&limit=200`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${API_CONFIG.API_KEY}`, 'Content-Type': 'application/json' }
      });
      if (!stockRes.ok) throw new Error(`HTTP ${stockRes.status}`);
      const stockJson = await stockRes.json();
      let stockData: any[] = Array.isArray(stockJson) ? stockJson : (stockJson?.items || []);
      
      // Create a map of stock data by product code for GP% lookup
      const stockMap = new Map();
      stockData.forEach((item: any) => {
        const code = item.product_code || item.stock_code || item.code;
        if (code) {
          stockMap.set(code, item);
        }
      });
      
      // Combine usage data with stock data to get both daily avg and GP%
      let data = usageData.map((product: any) => {
        const code = product.product_code || product.stock_code || product.code;
        const stockItem = stockMap.get(code);
        const dailyAvg = product.avg_qty_180d || product.avg_daily_qty || product.avg_daily_quantity || 0;
        
        return {
          ...product,
          // Map daily average to qty_sold for PDF export compatibility
          qty_sold: dailyAvg,
          dailyAvgSales: dailyAvg,
          // Include GP% from stock data if available
          gp_pct: stockItem?.gp_pct || stockItem?.gross_profit_percent || stockItem?.grossProfitPercent,
          // Include monetary fields from stock activity so PDF can render Cost/Sales
          sales_value: stockItem?.sales_value ?? stockItem?.sales_val ?? stockItem?.valueMovement ?? stockItem?.retail_value ?? stockItem?.retail,
          cost_of_sales: stockItem?.cost_of_sales ?? stockItem?.cost,
          gp_value: stockItem?.gp_value ?? stockItem?.gp ?? product?.gp_value ?? product?.gp,
          description: product.description || product.productName || product.name || product.product_name || product.desc || 'Unknown Product',
          stock_code: code || 'N/A'
        };
      })
      .filter((product: any) => typeof product.dailyAvgSales === 'number' && isFinite(product.dailyAvgSales) && product.dailyAvgSales > 0)
      .sort((a: any, b: any) => b.dailyAvgSales - a.dailyAvgSales)
      .slice(0, 30);
      
      return data;
    } catch {
      return [];
    }
  };

  // Fetch Negative Stock items for the selected pharmacy
  const fetchNegativeStock = async (): Promise<any[]> => {
    if (!selectedPharmacy) return [];
    const pharmacyId = getPharmacyId(selectedPharmacy);
    try {
      // Use dedicated negative SOH endpoint (ordered by most negative)
      const dateStr = formatDateLocal(selectedDate || new Date());
      const limit = 200; // cap at API max
      const res = await fetch(`${API_CONFIG.BASE_URL}/pharmacies/${pharmacyId}/stock-activity/negative-soh?date=${dateStr}&limit=${limit}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${API_CONFIG.API_KEY}`, 'Content-Type': 'application/json' }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      let data: any[] = Array.isArray(json) ? json : (json?.items || []);
      // Take top 30 most negative items
      data = data.slice(0, 30);
      return data;
    } catch {
      return [];
    }
  };

  // Search products function (align with StockDetail.web implementation and fallbacks)
  const searchProducts = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchError(null);

    try {
      const searchTerm = searchQuery.trim();

      // Primary working endpoint (no pharmacy path)
      const response = await fetch(`${API_CONFIG.BASE_URL}/products/search?query=${encodeURIComponent(searchTerm)}&page=1&page_size=200`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${API_CONFIG.API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      let items: any[] = [];
      if (Array.isArray(data)) {
        items = data;
      } else if (data?.items && Array.isArray(data.items)) {
        items = data.items;
      } else if (data?.products && Array.isArray(data.products)) {
        items = data.products;
      } else if (data?.data && Array.isArray(data.data)) {
        items = data.data;
      }

      // Basic normalization for display
      const normalized = items.map((p: any) => ({
        ...p,
        description: p.description || p.product_name || p.name || p.title || 'Unknown Product',
        product_code: p.product_code || p.stock_code || p.code || p.sku || p.id,
      }));

      setSearchResults(normalized);
    } catch (error) {
      console.error('Search error:', error);
      setSearchError('Failed to search products');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle product selection
  const toggleProductSelection = (productId: string, productCode: string) => {
    const key = `${productId}-${productCode}`;
    const newChecked = new Set(checkedProducts);
    
    if (newChecked.has(key)) {
      newChecked.delete(key);
      const newData = { ...checkedProductsData };
      delete newData[key];
      setCheckedProductsData(newData);
    } else {
      newChecked.add(key);
      const product = searchResults.find((p: any) => {
        const pCode = p.product_code || p.stock_code || p.code || p.sku;
        return p.id === productId && pCode === productCode;
      });
      if (product) {
        setCheckedProductsData({
          ...checkedProductsData,
          [key]: product
        });
      }
    }
    
    setCheckedProducts(newChecked);
  };

  // Remove product from checked list
  const removeCheckedProduct = (productId: string, productCode: string) => {
    const key = `${productId}-${productCode}`;
    const newChecked = new Set(checkedProducts);
    newChecked.delete(key);
    const newData = { ...checkedProductsData };
    delete newData[key];
    setCheckedProductsData(newData);
    setCheckedProducts(newChecked);
  };

  // Get checked products data as array
  const getCheckedProductsData = () => {
    return Object.values(checkedProductsData);
  };

  // Export stock report
  const exportStockReport = async (reportType: string) => {
    if (!selectedPharmacy || !selectedDate) {
      showError('Please select a pharmacy and date');
      return;
    }

    setExporting(reportType);
    try {
      let data: any[] = [];
      
      switch (reportType) {
        case 'TopDay':
          data = await fetchTopDay();
          break;
        case 'LowGP':
          data = await fetchLowGP();
          break;
        case 'Top12M':
          data = await fetchTop12M();
          break;
        case 'NegativeStock':
          data = await fetchNegativeStock();
          break;
        default:
          throw new Error('Unknown report type');
      }

      if (data.length === 0) {
        showError('No data available for this report');
        return;
      }

      const normalizedData = normalizeForPdf(data);
      const reportName = reportType === 'TopDay' ? 'Top Day' : 
                        reportType === 'LowGP' ? 'Low GP' : 
                        reportType === 'Top12M' ? 'Top 12M' : 'Negative Stock';
      await exportStockDataToPDF(normalizedData, reportName, selectedDate, pharmacyName);
      showInfo(`${reportName} report exported successfully`);
    } catch (error) {
      console.error('Export error:', error);
      showError('Failed to export report');
    } finally {
      setExporting(null);
    }
  };

  // Export selected products
  const exportSelectedProductsSales = async () => {
    if (checkedProducts.size === 0) {
      showError('Please select at least one product');
      return;
    }

    setExporting('CustomStockSales');
    try {
      const data = normalizeForPdf(Object.values(checkedProductsData));
      await exportStockDataToPDF(data, 'Custom Products', selectedDate, pharmacyName);
      showInfo('Custom products report exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      showError('Failed to export custom report');
    } finally {
      setExporting(null);
    }
  };

  // Export turnover report
  const exportDailyTurnover = async () => {
    if (!selectedPharmacy || !selectedDate) {
      showError('Please select a pharmacy and date');
      return;
    }

    setExporting('Turnover');
    try {
      const pharmacyId = getPharmacyId(selectedPharmacy);
      const dateStr = formatDateLocal(selectedDate);
      const daily = await newPharmacyAPI.getDailyTurnover(pharmacyId, dateStr);

      if (!daily) {
        showInfo('No turnover data available for the selected date.');
        return;
      }

      await exportTurnoverReportToPDF(daily, selectedDate, pharmacyName, 'Daily');
      showInfo('Turnover report exported successfully');
    } catch (error: any) {
      showError(error?.message || 'Failed to generate turnover report');
    } finally {
      setExporting(null);
    }
  };

  // Export trading report
  const exportDailyTrading = async () => {
    if (!selectedPharmacy || !selectedDate) {
      showError('Please select a pharmacy and date');
      return;
    }

    setExporting('Trading');
    try {
      const pharmacyId = getPharmacyId(selectedPharmacy);
      const dateStr = formatDateLocal(selectedDate);
      const daily = await newPharmacyAPI.getDailyTurnover(pharmacyId, dateStr);

      if (!daily) {
        showInfo('No trading data available for the selected date.');
        return;
      }

      await exportTradingReportToPDF(daily, selectedDate, pharmacyName, 'Daily');
      showInfo('Trading report exported successfully');
    } catch (error: any) {
      showError(error?.message || 'Failed to generate trading report');
    } finally {
      setExporting(null);
    }
  };

  // Export MTD turnover
  const exportMTDTurnover = async () => {
    if (!selectedPharmacy || !selectedDate) {
      showError('Please ensure a pharmacy and date are selected.');
      return;
    }
    setExporting('TurnoverMTD');
    try {
      const pharmacyId = getPharmacyId(selectedPharmacy);
      const monthKey = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth()+1).padStart(2,'0')}`;
      const through = formatDateLocal(selectedDate);
      const mtd = await newPharmacyAPI.getMTD(pharmacyId, monthKey, through);

      // Enrich with sales breakdown if needed
      const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
      const start = formatDateLocal(startOfMonth);
      const range = await newPharmacyAPI.getDailySales(pharmacyId, start, through);
      const arr = Array.isArray(range) ? range : [];
      const sumField = (key: string) => arr.reduce((s, d) => s + (Number(d?.[key]) || 0), 0);
      const aggCash = sumField('sales_cash');
      const aggAccount = sumField('sales_account');
      const aggCOD = sumField('sales_cod');
      const enriched = {
        ...mtd,
        sales_cash: Number(mtd?.sales_cash) || aggCash,
        sales_account: Number(mtd?.sales_account) || aggAccount,
        sales_cod: Number(mtd?.sales_cod) || aggCOD,
      };

      if (!enriched || !enriched.turnover) {
        showInfo('No MTD turnover data available.');
      } else {
        await exportTurnoverReportToPDF(enriched, selectedDate, pharmacyName, 'MTD');
      }
    } catch (e: any) {
      showError(e?.message || 'Failed to generate MTD turnover report');
    } finally {
      setExporting(null);
    }
  };

  // Export MTD trading
  const exportMTDTrading = async () => {
    if (!selectedPharmacy || !selectedDate) {
      showError('Please ensure a pharmacy and date are selected.');
      return;
    }
    setExporting('TradingMTD');
    try {
      const pharmacyId = getPharmacyId(selectedPharmacy);
      const monthKey = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth()+1).padStart(2,'0')}`;
      const through = formatDateLocal(selectedDate);
      const mtd = await newPharmacyAPI.getMTD(pharmacyId, monthKey, through);

      if (!mtd || !mtd.turnover) {
        showInfo('No MTD trading data available.');
      } else {
        await exportTradingReportToPDF(mtd, selectedDate, pharmacyName, 'MTD');
      }
    } catch (e: any) {
      showError(e?.message || 'Failed to generate MTD trading report');
    } finally {
      setExporting(null);
    }
  };

  const styles = getStyles(colors);

  return (
    <View style={styles.container}>
      {/* Sticky Header */}
      <View style={styles.stickyHeader}>
        <View style={styles.mainHeaderRow}>
          <View style={styles.headerLeft}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <ChevronLeft size={20} color={colors.accentPrimary} />
              <Text style={styles.backButtonText}>Reporting</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.scrollContent}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scrollContentContainer}
          keyboardShouldPersistTaps="handled"
        >
          {/* Stock Reports (Orange) */}
          <View style={styles.cardSection}>
            <Text style={styles.cardSectionTitle}>Stock Reports</Text>
            <View style={styles.actions}>
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => exportStockReport('TopDay')}
                disabled={exporting !== null}
              >
                {exporting === 'TopDay' ? (
                  <View style={styles.leftIconContainer}>
                    <ActivityIndicator size="small" color={colors.bgGradientFrom} />
                  </View>
                ) : (
                  <View style={styles.leftIconContainer}>
                    <TrendingUp size={18} color={colors.bgGradientFrom} />
                  </View>
                )}
                <Text style={styles.actionText}>Top Day</Text>
                <Download size={16} color={colors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => exportStockReport('LowGP')}
                disabled={exporting !== null}
              >
                {exporting === 'LowGP' ? (
                  <View style={styles.leftIconContainer}>
                    <ActivityIndicator size="small" color={colors.bgGradientFrom} />
                  </View>
                ) : (
                  <View style={styles.leftIconContainer}>
                    <AlertTriangle size={18} color={colors.bgGradientFrom} />
                  </View>
                )}
                <Text style={styles.actionText}>Low GP</Text>
                <Download size={16} color={colors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => exportStockReport('Top12M')}
                disabled={exporting !== null}
              >
                {exporting === 'Top12M' ? (
                  <View style={styles.leftIconContainer}>
                    <ActivityIndicator size="small" color={colors.bgGradientFrom} />
                  </View>
                ) : (
                  <View style={styles.leftIconContainer}>
                    <BarChart3 size={18} color={colors.bgGradientFrom} />
                  </View>
                )}
                <Text style={styles.actionText}>Top 12M</Text>
                <Download size={16} color={colors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => exportStockReport('NegativeStock')}
                disabled={exporting !== null}
              >
                {exporting === 'NegativeStock' ? (
                  <View style={styles.leftIconContainer}>
                    <ActivityIndicator size="small" color={colors.bgGradientFrom} />
                  </View>
                ) : (
                  <View style={styles.leftIconContainer}>
                    <AlertTriangle size={18} color={colors.bgGradientFrom} />
                  </View>
                )}
                <Text style={styles.actionText}>Negative Stock</Text>
                <Download size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Custom Product Selection (Purple) */}
          <View style={styles.cardSection} onLayout={(e) => setCustomCardY(e.nativeEvent.layout.y)}>
            <Text style={styles.cardSectionTitle}>Custom Product Selection</Text>
            
            {/* Date Range Selector */}
            <View style={styles.dateRangeSection}>
              <Text style={styles.dateRangeLabel}>Date Range</Text>
              <View style={styles.dateRangeContainer}>
                <TouchableOpacity style={styles.dateButton} onPress={() => setShowStartPicker(true)}>
                  <Calendar size={16} color={colors.textSecondary} />
                  <Text style={styles.dateButtonText}>{formatDateDisplay(customStartDate)}</Text>
                </TouchableOpacity>
                <Text style={styles.dateRangeSeparator}>to</Text>
                <TouchableOpacity style={styles.dateButton} onPress={() => setShowEndPicker(true)}>
                  <Calendar size={16} color={colors.textSecondary} />
                  <Text style={styles.dateButtonText}>{formatDateDisplay(customEndDate)}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Selected Products List */}
            {checkedProducts.size > 0 && (
              <View style={styles.checkedProductsContainer}>
                <TouchableOpacity 
                  style={styles.checkedProductsTitleRow}
                  onPress={() => setShowSelectedProducts(!showSelectedProducts)}
                >
                  <Text style={styles.checkedProductsTitle}>Selected Products ({checkedProducts.size})</Text>
                  <Text style={styles.collapseIcon}>{showSelectedProducts ? '▼' : '▶'}</Text>
                </TouchableOpacity>
                {showSelectedProducts && (
                  <>
                    {getCheckedProductsData().map((product: any, index: number) => {
                      const productCode = product.product_code || product.stock_code || product.code || product.sku;
                      const key = `${product.id}-${productCode}`;
                      return (
                        <View key={key} style={styles.checkedProductItem}>
                          <View style={styles.checkedProductInfo}>
                            <Text style={styles.checkedProductName} numberOfLines={1}>
                              {product.description || product.product_name || product.name || 'Unknown Product'}
                            </Text>
                            <Text style={styles.checkedProductCode}>{productCode}</Text>
                          </View>
                          <TouchableOpacity
                            style={styles.removeButton}
                            onPress={() => removeCheckedProduct(product.id, productCode)}
                          >
                            <X size={16} color={colors.error} />
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </>
                )}
              </View>
            )}

            {/* Search Input */}
            <View style={styles.searchContainer}>
              <Search size={16} color={colors.textSecondary} />
              <View style={styles.searchInputWrapper}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search Product"
                  placeholderTextColor={colors.textSecondary}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onSubmitEditing={searchProducts}
                />
              </View>
            </View>
            
            {isSearching && (
              <View style={styles.searchingContainer}>
                <ActivityIndicator size="small" color={colors.accentPrimary} />
                <Text style={styles.searchingText}>Searching...</Text>
              </View>
            )}
            {searchError && (
              <View style={styles.errorContainer}> 
                <Text style={styles.errorText}>{searchError}</Text>
              </View>
            )}
            {!isSearching && !searchError && searchQuery.trim() && (
              <View style={styles.resultsContainer}>
                <Text style={styles.resultsHeader}>
                  {searchResults.length > 0 ? `Found ${searchResults.length} product${searchResults.length === 1 ? '' : 's'}` : 'No products found'}
                </Text>
                {searchResults.map((item: any, index: number) => {
                  const productCode = item.product_code || item.stock_code || item.code || item.sku;
                  const key = `${item.id}-${productCode}`;
                  const isChecked = checkedProducts.has(key);
                  return (
                    <TouchableOpacity
                      key={index}
                      style={styles.resultItem}
                      onPress={() => toggleProductSelection(item.id, productCode)}
                    >
                      <View style={styles.resultItemContent}>
                        <View style={styles.resultItemInfo}>
                          <Text style={styles.resultItemName} numberOfLines={2}>
                            {item.description || item.product_name || item.name || 'Unknown Product'}
                          </Text>
                          <Text style={styles.resultItemCode}>
                            {productCode}
                          </Text>
                        </View>
                        <View style={styles.checkboxContainer}>
                          <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
                            {isChecked && <Check size={14} color={colors.bgGradientFrom} />}
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <TouchableOpacity 
              style={styles.purpleActionButton}
              onPress={exportSelectedProductsSales}
              disabled={exporting !== null}
            >
              {exporting === 'CustomStockSales' ? (
                <View style={styles.leftIconContainerPurple}>
                  <ActivityIndicator size="small" color={colors.bgGradientFrom} />
                </View>
              ) : (
                <View style={styles.leftIconContainerPurple}>
                  <BarChart3 size={18} color={colors.bgGradientFrom} />
                </View>
              )}
              <Text style={styles.actionText}>Stock Sales in Period</Text>
              <Download size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Daily Reports (Green) */}
          <View style={styles.cardSection}>
            <Text style={styles.cardSectionTitle}>Daily Reports</Text>
            <View style={styles.actions}>
              <TouchableOpacity 
                style={styles.greenActionButton}
                onPress={exportDailyTurnover}
                disabled={exporting !== null}
              >
                {exporting === 'Turnover' ? (
                  <View style={styles.leftIconContainerGreen}>
                    <ActivityIndicator size="small" color={colors.bgGradientFrom} />
                  </View>
                ) : (
                  <View style={styles.leftIconContainerGreen}>
                    <TrendingUp size={18} color={colors.bgGradientFrom} />
                  </View>
                )}
                <Text style={styles.actionText}>Turnover Report Today</Text>
                <Download size={16} color={colors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.greenActionButton}
                onPress={exportDailyTrading}
                disabled={exporting !== null}
              >
                {exporting === 'Trading' ? (
                  <View style={styles.leftIconContainerGreen}>
                    <ActivityIndicator size="small" color={colors.bgGradientFrom} />
                  </View>
                ) : (
                  <View style={styles.leftIconContainerGreen}>
                    <BarChart3 size={18} color={colors.bgGradientFrom} />
                  </View>
                )}
                <Text style={styles.actionText}>Trading Report Today</Text>
                <Download size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Monthly Reports (Yellow) */}
          <View style={styles.cardSection}>
            <Text style={styles.cardSectionTitle}>Monthly Reports</Text>
            <View style={styles.actions}>
              <TouchableOpacity 
                style={styles.yellowActionButton}
                onPress={exportMTDTurnover}
                disabled={exporting !== null}
              >
                {exporting === 'TurnoverMTD' ? (
                  <View style={styles.leftIconContainerYellow}>
                    <ActivityIndicator size="small" color={colors.bgGradientFrom} />
                  </View>
                ) : (
                  <View style={styles.leftIconContainerYellow}>
                    <TrendingUp size={18} color={colors.bgGradientFrom} />
                  </View>
                )}
                <Text style={styles.actionText}>Turnover Report MTD</Text>
                <Download size={16} color={colors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.yellowActionButton}
                onPress={exportMTDTrading}
                disabled={exporting !== null}
              >
                {exporting === 'TradingMTD' ? (
                  <View style={styles.leftIconContainerYellow}>
                    <ActivityIndicator size="small" color={colors.bgGradientFrom} />
                  </View>
                ) : (
                  <View style={styles.leftIconContainerYellow}>
                    <BarChart3 size={18} color={colors.bgGradientFrom} />
                  </View>
                )}
                <Text style={styles.actionText}>Trading Report MTD</Text>
                <Download size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Start Date Picker Modal */}
      <Modal
        visible={showStartPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowStartPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.datePickerContainer}>
              <CustomDatePicker 
                value={customStartDate} 
                onChange={setCustomStartDate} 
                maximumDate={customEndDate} 
                minimumDate={new Date(2020, 0, 1)} 
              />
            </View>
            <View style={styles.datePickerActions}>
              <TouchableOpacity style={styles.datePickerButton} onPress={() => setShowStartPicker(false)}>
                <Text style={styles.datePickerButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.datePickerButton, styles.datePickerButtonPrimary]} onPress={() => setShowStartPicker(false)}>
                <Text style={[styles.datePickerButtonText, styles.datePickerButtonTextPrimary]}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* End Date Picker Modal */}
      <Modal
        visible={showEndPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowEndPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.datePickerContainer}>
              <CustomDatePicker 
                value={customEndDate} 
                onChange={setCustomEndDate} 
                minimumDate={customStartDate} 
                maximumDate={new Date()} 
              />
            </View>
            <View style={styles.datePickerActions}>
              <TouchableOpacity style={styles.datePickerButton} onPress={() => setShowEndPicker(false)}>
                <Text style={styles.datePickerButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.datePickerButton, styles.datePickerButtonPrimary]} onPress={() => setShowEndPicker(false)}>
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
  stickyHeader: {
    padding: 16,
    paddingTop: 8,
    backgroundColor: colors.bgGradientFrom,
    zIndex: 1000,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingBottom: 24,
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
  cardSection: {
    backgroundColor: colors.surfacePrimary,
    borderRadius: 12,
    padding: 16,
    margin: 10,
  },
  cardSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  actions: {
    gap: 12,
  },
  actionButton: {
    backgroundColor: colors.accentPrimary + '22',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  leftIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greenActionButton: {
    backgroundColor: colors.statusSuccess + '22',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  leftIconContainerGreen: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.statusSuccess,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yellowActionButton: {
    backgroundColor: colors.statusWarning + '22',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  leftIconContainerYellow: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.statusWarning,
    alignItems: 'center',
    justifyContent: 'center',
  },
  purpleActionButton: {
    backgroundColor: colors.accentPurple + '22',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 12,
  },
  leftIconContainerPurple: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.accentPurple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  dateRangeSection: {
    marginBottom: 16,
  },
  dateRangeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  dateRangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  dateButtonText: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  dateRangeSeparator: {
    fontSize: 14,
    color: colors.textSecondary,
    marginHorizontal: 4,
  },
  checkedProductsContainer: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  checkedProductsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  checkedProductsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  collapseIcon: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  checkedProductItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: colors.bgGradientFrom,
    borderRadius: 6,
    marginBottom: 6,
  },
  checkedProductInfo: {
    flex: 1,
    marginRight: 8,
  },
  checkedProductName: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  checkedProductCode: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  removeButton: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  searchInputWrapper: {
    flex: 1,
  },
  searchInput: {
    fontSize: 14,
    color: colors.textPrimary,
    paddingVertical: 4,
  },
  searchingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
  },
  searchingText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  errorContainer: {
    padding: 12,
  },
  errorText: {
    fontSize: 14,
    color: colors.error,
  },
  resultsContainer: {
    maxHeight: 300,
  },
  resultsHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  resultItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  resultItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultItemInfo: {
    flex: 1,
    marginRight: 12,
  },
  resultItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  resultItemCode: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  checkboxContainer: {
    padding: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.accentPrimary,
    borderColor: colors.accentPrimary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.surfacePrimary,
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  datePickerContainer: {
    marginBottom: 20,
  },
  datePickerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  datePickerButton: {
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  datePickerButtonPrimary: {
    backgroundColor: colors.accentPrimary,
  },
  datePickerButtonText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  datePickerButtonTextPrimary: {
    color: '#FFFFFF',
  },
});

export default ReportingScreen;
