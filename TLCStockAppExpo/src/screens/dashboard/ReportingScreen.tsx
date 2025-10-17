import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AuthNavigationProp } from '../../types/navigation';
import { ChevronLeft, Download, TrendingUp, AlertTriangle, BarChart3, Calendar, Search, Check, X } from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { exportStockDataToPDF, exportTurnoverReportToPDF, exportTradingReportToPDF } from '../../utils/pdfUtils';
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

// theme hook

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
  const [showSelectedProducts, setShowSelectedProducts] = useState(false);
  const [checkedProductsData, setCheckedProductsData] = useState<{ [key: string]: any }>({});

  const username = user?.username || user?.name || 'Unknown';
  const pharmacyName = (() => {
    const pharmacy = (pharmacies || []).find(p => p.code === selectedPharmacy);
    return pharmacy ? pharmacy.name : selectedPharmacy || 'Unknown Pharmacy';
  })();

  // Refs for scrolling and measurements
  const scrollRef = useRef<ScrollView>(null);
  const [customCardY, setCustomCardY] = useState(0);
  const [bottomInset, setBottomInset] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardWillShow', (e: any) => {
      setBottomInset(Math.max((e?.endCoordinates?.height || 0) - 20, 0));
    });
    const hideSub = Keyboard.addListener('keyboardWillHide', () => setBottomInset(0));
    // Android fallback
    const showSubAndroid = Keyboard.addListener('keyboardDidShow', (e: any) => {
      setBottomInset(Math.max((e?.endCoordinates?.height || 0) - 20, 0));
    });
    const hideSubAndroid = Keyboard.addListener('keyboardDidHide', () => setBottomInset(0));
    return () => {
      showSub.remove();
      hideSub.remove();
      showSubAndroid.remove();
      hideSubAndroid.remove();
    };
  }, []);

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
      const items: any[] = Array.isArray(json) ? json : (json?.items || []);
      // Normalize (API already returns only negative SOH)
      const normalized = items.map((it: any) => {
        const desc = it.description || it.productName || it.name || it.product_name || it.desc || 'Unknown Product';
        const code = it.product_code || it.stock_code || it.code;
        const sohRaw = it.current_soh ?? it.currentSOH ?? it.on_hand ?? it.soh ?? it.stock_on_hand;
        const sohNum = Number(sohRaw);
        return {
          ...it,
          description: desc,
          product_code: code,
          current_soh: sohNum,
        };
      });
      return normalized;
    } catch {
      return [];
    }
  };

  const handleExport = async (report: 'Low GP' | 'Top Day' | 'Top 12M') => {
    try {
      if (!selectedPharmacy || !selectedDate) {
        showError('Please ensure a pharmacy and date are selected.');
        return;
      }
      setExporting(report);
      let data: any[] = [];
      if (report === 'Top Day') data = await fetchTopDay();
      if (report === 'Low GP') data = await fetchLowGP();
      if (report === 'Top 12M') data = await fetchTop12M();

      // Customize report title for PDF
      let reportTitle: string = report;
      if (report === 'Top 12M') {
        reportTitle = 'Top Sellers (Daily Average)';
      }

      if (!data || data.length === 0) {
        showInfo('No data available for the selected parameters.');
        return;
      }

      const normalized = normalizeForPdf(data);
      await exportStockDataToPDF(normalized, reportTitle, selectedDate, pharmacyName);
    } catch (e: any) {
      showError(e?.message || 'Failed to export PDF');
    } finally {
      setExporting(null);
    }
  };

  const handleExportNegativeStock = async () => {
    try {
      if (!selectedPharmacy) {
        showError('Please ensure a pharmacy is selected.');
        return;
      }
      setExporting('NegativeStock');
      const data = await fetchNegativeStock();
      if (!data || data.length === 0) {
        showInfo('No negative stock items found.');
        return;
      }
      // For Negative Stock PDF, reuse exportStockDataToPDF with filterType 'Negative Stock'
      await exportStockDataToPDF(data as any, 'Negative Stock', selectedDate || new Date(), pharmacyName);
    } catch (e: any) {
      showError(e?.message || 'Failed to export Negative Stock report');
    } finally {
      setExporting(null);
    }
  };

  // Perform products search (mirrors StockDetail)
  const performProductSearch = async (query: string) => {
    setIsSearching(true);
    setSearchError(null);
    try {
      const searchTerm = query.trim();
      const response = await fetch(`${API_CONFIG.BASE_URL}/products/search?query=${encodeURIComponent(searchTerm)}&page=1&page_size=200`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${API_CONFIG.API_KEY}`, 'Content-Type': 'application/json' }
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      let items: any[] = [];
      if (Array.isArray(data)) items = data;
      else if (Array.isArray(data?.items)) items = data.items;
      else if (Array.isArray(data?.products)) items = data.products;
      else if (Array.isArray(data?.data)) items = data.data;
      else items = [];

      // Sort: exact matches first, then partials
      const sorted = items.sort((a: any, b: any) => {
        const aCode = (a.product_code || a.stock_code || a.code || a.sku || '').toLowerCase();
        const aDesc = (a.description || a.product_name || a.name || a.title || '').toLowerCase();
        const bCode = (b.product_code || b.stock_code || b.code || b.sku || '').toLowerCase();
        const bDesc = (b.description || b.product_name || b.name || b.title || '').toLowerCase();
        const q = searchTerm.toLowerCase();
        if (aCode === q && bCode !== q) return -1;
        if (bCode === q && aCode !== q) return 1;
        if (aDesc === q && bDesc !== q) return -1;
        if (bDesc === q && aDesc !== q) return 1;
        if (aCode.startsWith(q) && !bCode.startsWith(q)) return -1;
        if (bCode.startsWith(q) && !aCode.startsWith(q)) return 1;
        if (aDesc.startsWith(q) && !bDesc.startsWith(q)) return -1;
        if (bDesc.startsWith(q) && !aDesc.startsWith(q)) return 1;
        return aDesc.length - bDesc.length;
      });
      setSearchResults(sorted);
    } catch (e: any) {
      setSearchError(e?.message || 'Failed to fetch products');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Toggle product selection
  const toggleProductSelection = (productId: string, productCode: string) => {
    const key = `${productId}-${productCode}`;
    const newChecked = new Set(checkedProducts);
    if (newChecked.has(key)) {
      newChecked.delete(key);
      setCheckedProductsData(prev => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
    } else {
      newChecked.add(key);
      // Persist product snapshot for later export even if it falls out of searchResults
      const found = searchResults.find((it: any) => String(it?.id) === String(productId) && String(it?.product_code || it?.stock_code || it?.code || it?.sku) === String(productCode));
      if (found) {
        setCheckedProductsData(prev => ({ ...prev, [key]: found }));
      }
    }
    setCheckedProducts(newChecked);
  };

  // Remove product from checked list
  const removeCheckedProduct = (productId: string, productCode: string) => {
    const key = `${productId}-${productCode}`;
    const newChecked = new Set(checkedProducts);
    newChecked.delete(key);
    setCheckedProducts(newChecked);
  };

  // Get checked products data
  const getCheckedProductsData = () => {
    return Array.from(checkedProducts).map(key => {
      const parts = key.split('-');
      const productId = parts[0];
      const productCode = parts.slice(1).join('-');
      const fromCache = checkedProductsData[key];
      if (fromCache) return fromCache;
      const product = searchResults.find(item => 
        String(item?.id) === String(productId) && 
        String(item?.product_code || item?.stock_code || item?.code || item?.sku) === String(productCode)
      );
      return product;
    }).filter(Boolean);
  };

  // Export selected products' sales over selected period
  const exportSelectedProductsSales = async () => {
    if (!selectedPharmacy) {
      showError('Please select a pharmacy.');
      return;
    }
    if (checkedProducts.size === 0) {
      showError('Please select at least one product.');
      return;
    }
    try {
      setExporting('CustomStockSales');
      const pharmacyId = getPharmacyId(selectedPharmacy);
      const fromStr = customStartDate.toISOString().split('T')[0];
      const toStr = customEndDate.toISOString().split('T')[0];

      const selectedList = Array.from(checkedProducts);
      const fetches = selectedList.map(async (key) => {
        const parts = key.split('-');
        const productId = parts[0];
        const productCode = parts.slice(1).join('-');
        const snapshot = checkedProductsData[key];
        const desc = snapshot?.description || snapshot?.product_name || snapshot?.name || 'Unknown Product';
        try {
          const url = `${API_CONFIG.BASE_URL}/products/${encodeURIComponent(productCode)}/sales?from_date=${fromStr}&to_date=${toStr}&pharmacy_id=${encodeURIComponent(String(pharmacyId))}`;
          const r = await fetch(url, { method: 'GET', headers: { 'Authorization': `Bearer ${API_CONFIG.API_KEY}`, 'Content-Type': 'application/json' } });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const raw = await r.json();
          const totalQty = Number(raw?.summary?.total_qty_sold ?? raw?.total_qty_sold ?? 0) || 0;
          const totalSales = Number(raw?.summary?.total_sales_value ?? raw?.total_sales_value ?? 0) || 0;
          const totalCost = Number(raw?.summary?.total_cost_of_sales ?? raw?.total_cost_of_sales ?? Math.max(totalSales - Number(raw?.summary?.total_gp_value ?? raw?.total_gp_value ?? 0), 0)) || 0;
          const totalGp = Number(raw?.summary?.total_gp_value ?? raw?.total_gp_value ?? (totalSales - totalCost)) || 0;
          const gpPct = totalSales > 0 ? (totalGp / totalSales) * 100 : 0;
          const avgSellingPrice = totalQty > 0 ? totalSales / totalQty : 0;
                   return {
           description: desc,
           product_code: productCode,
           qty_sold: totalQty,
           sales_value: totalSales,
           cost_of_sales: totalCost,
         };
                 } catch (e) {
           return {
            description: desc,
            product_code: productCode,
            qty_sold: 0,
            sales_value: 0,
            cost_of_sales: 0,
           };
         }
      });

      const rows = await Promise.all(fetches);
      // Sort by qty sold desc
      const items = rows.sort((a, b) => (Number(b.qty_sold) || 0) - (Number(a.qty_sold) || 0));
      // Add totals row
      const totalQty = items.reduce((sum, item) => sum + (Number(item.qty_sold) || 0), 0);
      const totalSales = items.reduce((sum, item) => sum + (Number(item.sales_value) || 0), 0);
      const totalCost = items.reduce((sum, item) => sum + (Number(item.cost_of_sales) || 0), 0);
      
      const itemsWithTotals = [
        ...items,
        {
          description: 'TOTALS',
          product_code: 'TOTALS',
          qty_sold: totalQty,
          cost_of_sales: totalCost,
          sales_value: totalSales,
        }
      ];
      
      await exportStockDataToPDF(itemsWithTotals as any, 'Stock Sales in Period', customEndDate, pharmacyName);
    } catch (e: any) {
      showError(e?.message || 'Failed to export report');
    } finally {
      setExporting(null);
    }
  };

  // Debounce product search
  useEffect(() => {
    const t = setTimeout(() => {
      performProductSearch(searchQuery);
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const styles = getStyles(colors);
  return (
    <View style={styles.container}>
      <View style={styles.stickyHeader}>
        <View style={styles.mainHeaderRow}>
          <View style={styles.headerLeft}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <ChevronLeft size={20} color={colors.accentPrimary} />
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={undefined} keyboardVerticalOffset={0}>
        <ScrollView
          ref={scrollRef}
          style={styles.scrollContent}
          contentContainerStyle={styles.scrollContentContainer}
          keyboardShouldPersistTaps="handled"
          contentInset={{ top: 0, left: 0, bottom: 0, right: 0 }}
          scrollIndicatorInsets={{ top: 0, left: 0, bottom: 0, right: 0 }}
        >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reporting</Text>
        </View>

        {/* Custom Reports */}
        <View style={styles.cardSection} onLayout={(e) => setCustomCardY(e.nativeEvent.layout.y)}>
          <Text style={styles.cardSectionTitle}>Custom Reports</Text>
          <View style={styles.actions}>
            {/* Date Range Selector */}
            <View style={styles.dateRangeContainer}>
              <Text style={styles.dateRangeLabel}>Date Range:</Text>
              <View style={styles.dateRangeRow}>
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

            {/* Stock Search */}
            <View style={styles.searchContainer}>
                             {/* Checked Products List */}
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
                               <X size={16} color={colors.statusError} />
                             </TouchableOpacity>
                           </View>
                         );
                       })}
                     </>
                   )}
                </View>
              )}

              <View style={styles.searchInputContainer}>
                <Search size={20} color={colors.textSecondary} style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search Product"
                  placeholderTextColor={colors.textSecondary}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onFocus={() => {
                    if (scrollRef.current) {
                      const y = Math.max(customCardY - 12, 0);
                      scrollRef.current.scrollTo({ y, animated: true });
                    }
                  }}
                />
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
            </View>

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
        </View>

        {/* Daily Reports (Green themed) */}
        <View style={styles.cardSection}>
          <Text style={styles.cardSectionTitle}>Daily Reports</Text>
          <View style={styles.actions}>
            <TouchableOpacity 
              style={styles.greenActionButton}
              onPress={async () => {
                try {
                  if (!selectedPharmacy || !selectedDate) {
                    showError('Please ensure a pharmacy and date are selected.');
                    return;
                  }
                  setExporting('Turnover');
                  const pharmacyId = ((): number => {
                    const map: any = { 'REITZ': 1, 'TLC WINTERTON': 2 };
                    return map[selectedPharmacy] || 1;
                  })();
                  const dateStr = formatDateLocal(selectedDate);
                  const daily = await newPharmacyAPI.getDailyTurnover(pharmacyId, dateStr);
                  if (!daily) {
                    showInfo('No turnover data available for the selected date.');
                  } else {
                    await exportTurnoverReportToPDF(daily, selectedDate, pharmacyName);
                  }
                } catch (e: any) {
                  showError(e?.message || 'Failed to generate turnover report');
                } finally {
                  setExporting(null);
                }
              }}
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
              onPress={async () => {
                try {
                  if (!selectedPharmacy || !selectedDate) {
                    showError('Please ensure a pharmacy and date are selected.');
                    return;
                  }
                  setExporting('Trading');
                  const pharmacyId = ((): number => {
                    const map: any = { 'REITZ': 1, 'TLC WINTERTON': 2 };
                    return map[selectedPharmacy] || 1;
                  })();
                  const dateStr = formatDateLocal(selectedDate);
                  const daily = await newPharmacyAPI.getDailyTurnover(pharmacyId, dateStr);
                  if (!daily) {
                    showInfo('No trading data available for the selected date.');
                  } else {
                    await exportTradingReportToPDF(daily, selectedDate, pharmacyName);
                  }
                } catch (e: any) {
                  showError(e?.message || 'Failed to generate trading report');
                } finally {
                  setExporting(null);
                }
              }}
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

        {/* Monthly Reports (Green themed, MTD) */}
        <View style={styles.cardSection}>
          <Text style={styles.cardSectionTitle}>Monthly Reports</Text>
          <View style={styles.actions}>
            {/* Turnover MTD */}
            <TouchableOpacity 
              style={styles.yellowActionButton}
              onPress={async () => {
                try {
                  if (!selectedPharmacy || !selectedDate) {
                    showError('Please ensure a pharmacy and date are selected.');
                    return;
                  }
                  setExporting('TurnoverMTD');
                  const pharmacyId = ((): number => { const map: any = { 'REITZ': 1, 'TLC WINTERTON': 2 }; return map[selectedPharmacy] || 1; })();
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
                  } as any;

                  if (!enriched) {
                    showInfo('No MTD data available for the selected date.');
                  } else {
                    await exportTurnoverReportToPDF(enriched, selectedDate, pharmacyName, 'MTD');
                  }
                } catch (e: any) {
                  showError(e?.message || 'Failed to generate MTD turnover report');
                } finally {
                  setExporting(null);
                }
              }}
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

            {/* Trading MTD */}
            <TouchableOpacity 
              style={styles.yellowActionButton}
              onPress={async () => {
                try {
                  if (!selectedPharmacy || !selectedDate) {
                    showError('Please ensure a pharmacy and date are selected.');
                    return;
                  }
                  setExporting('TradingMTD');
                  const pharmacyId = ((): number => { const map: any = { 'REITZ': 1, 'TLC WINTERTON': 2 }; return map[selectedPharmacy] || 1; })();
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
                  const lastDay = arr.reduce((acc: any, d: any) => {
                    if (!acc) return d;
                    return (String(d?.business_date || '') > String(acc?.business_date || '')) ? d : acc;
                  }, null);
                  const closingFromDaily = Number(lastDay?.closing_stock) || 0;
                  const enriched = {
                    ...mtd,
                    sales_cash: Number(mtd?.sales_cash) || aggCash,
                    sales_account: Number(mtd?.sales_account) || aggAccount,
                    sales_cod: Number(mtd?.sales_cod) || aggCOD,
                    closing_stock: closingFromDaily || Number(mtd?.closing_stock) || 0,
                  } as any;

                  if (!enriched) {
                    showInfo('No MTD data available for the selected date.');
                  } else {
                    await exportTradingReportToPDF(enriched, selectedDate, pharmacyName, 'MTD');
                  }
                } catch (e: any) {
                  showError(e?.message || 'Failed to generate MTD trading report');
                } finally {
                  setExporting(null);
                }
              }}
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

        <View style={styles.cardSection}>
          <Text style={styles.cardSectionTitle}>Stock Reports</Text>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionButton} onPress={() => handleExport('Low GP')} disabled={exporting !== null}>
              {exporting === 'Low GP' ? (
                <View style={styles.leftIconContainer}>
                  <ActivityIndicator size="small" color={colors.bgGradientFrom} />
                </View>
              ) : (
                <View style={styles.leftIconContainer}>
                  <AlertTriangle size={18} color={colors.bgGradientFrom} />
                </View>
              )}
              <Text style={styles.actionText}>Low GP Products Today</Text>
              <Download size={16} color={colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={handleExportNegativeStock} disabled={exporting !== null}>
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

            <TouchableOpacity style={styles.actionButton} onPress={() => handleExport('Top Day')} disabled={exporting !== null}>
              {exporting === 'Top Day' ? (
                <View style={styles.leftIconContainer}>
                  <ActivityIndicator size="small" color={colors.bgGradientFrom} />
                </View>
              ) : (
                <View style={styles.leftIconContainer}>
                  <TrendingUp size={18} color={colors.bgGradientFrom} />
                </View>
              )}
              <Text style={styles.actionText}>Best Sellers Today</Text>
              <Download size={16} color={colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={() => handleExport('Top 12M')} disabled={exporting !== null}>
              {exporting === 'Top 12M' ? (
                <View style={styles.leftIconContainer}>
                  <ActivityIndicator size="small" color={colors.bgGradientFrom} />
                </View>
              ) : (
                <View style={styles.leftIconContainer}>
                  <BarChart3 size={18} color={colors.bgGradientFrom} />
                </View>
              )}
              <Text style={styles.actionText}>Top Sellers 180 Days</Text>
              <Download size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
      {/* Start Date Picker Modal */}
      <Modal visible={showStartPicker} transparent animationType="slide" onRequestClose={() => setShowStartPicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.datePickerContainer}>
              <CustomDatePicker value={customStartDate} onChange={setCustomStartDate} maximumDate={customEndDate} minimumDate={new Date(2020,0,1)} />
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
      <Modal visible={showEndPicker} transparent animationType="slide" onRequestClose={() => setShowEndPicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.datePickerContainer}>
              <CustomDatePicker value={customEndDate} onChange={setCustomEndDate} minimumDate={customStartDate} maximumDate={new Date()} />
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
    paddingTop: 63,
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
  section: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  value: {
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: '600',
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
    color: colors.textPrimary,
    fontWeight: '600',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  chip: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipText: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  // Date range styles (custom reports)
  dateRangeContainer: {
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  dateRangeLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
    fontWeight: '500',
  },
  dateRangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 5,
    width: '100%',
  },
  dateButton: {
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    width: '45%',
  },
  dateButtonText: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  dateRangeSeparator: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  // Search styles (mirrors StockDetail)
  searchContainer: {
    marginTop: 8,
  },
     checkedProductsContainer: {
     marginBottom: 12,
     padding: 12,
     backgroundColor: colors.surfaceSecondary,
     borderRadius: 12,
   },
     checkedProductsTitle: {
     fontSize: 14,
     color: colors.textPrimary,
     fontWeight: '600',
   },
   checkedProductsTitleRow: {
     flexDirection: 'row',
     alignItems: 'center',
     justifyContent: 'space-between',
     marginBottom: 8,
     paddingVertical: 4,
   },
   collapseIcon: {
     fontSize: 16,
     color: colors.textSecondary,
     fontWeight: '600',
   },
  checkedProductItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.surfacePrimary,
    borderRadius: 8,
    marginBottom: 6,
  },
  checkedProductInfo: {
    flex: 1,
  },
  checkedProductName: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '500',
    marginBottom: 2,
  },
  checkedProductCode: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  removeButton: {
    padding: 4,
  },
  searchInputContainer: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
    padding: 0,
  },
  searchingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    gap: 8,
  },
  searchingText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  errorContainer: {
    padding: 12,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    color: colors.statusError,
    textAlign: 'center',
  },
  resultsContainer: {
    marginTop: 12,
  },
  resultsHeader: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
    textAlign: 'center',
  },
     resultItem: {
     backgroundColor: colors.surfaceSecondary,
     borderRadius: 12,
     padding: 16,
     marginBottom: 8,
   },
  resultItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultItemInfo: {
    flex: 1,
    marginRight: 16,
  },
  resultItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
    lineHeight: 20,
  },
  resultItemCode: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  checkboxContainer: {
    padding: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  checkboxChecked: {
    backgroundColor: colors.accentPrimary,
    borderColor: colors.accentPrimary,
  },
  // Modal styles reused from StockHistoryScreen
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
    alignItems: 'center',
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
    fontWeight: '600',
  },
  // Remove unused styles
  // ... existing code ...
});

export default ReportingScreen; 