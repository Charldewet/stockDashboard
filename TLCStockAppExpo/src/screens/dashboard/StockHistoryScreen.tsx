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
  Modal,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { ChevronLeft, TrendingUp, AlertTriangle, Package, DollarSign, Download } from 'lucide-react-native';
import { dailyStockAPI } from '../../services/api';
import { formatDateLocal } from '../../utils/dateUtils';
import { exportStockDataToPDF } from '../../utils/pdfUtils';
import { API_CONFIG, getPharmacyByCode } from '../../config/api';

const { width } = Dimensions.get('window');

// Helper function to get pharmacy ID from pharmacy code
const getPharmacyId = (pharmacyCode: string): number => {
  // If the code is already numeric, use it directly (e.g., "100")
  const asNum = Number(pharmacyCode);
  if (Number.isFinite(asNum) && String(asNum) === pharmacyCode) {
    return asNum;
  }
  // Try resolve via config by code
  const byCode = getPharmacyByCode(pharmacyCode);
  if (byCode && typeof byCode.id === 'number') {
    return byCode.id;
  }
  // Resolve by name in config (case-insensitive)
  const upper = String(pharmacyCode).toUpperCase();
  const byName = API_CONFIG.PHARMACIES.find(p => String(p.name).toUpperCase() === upper);
  if (byName) return byName.id;
  // Fallback to 1
  return 1;
};

const useColors = () => useTheme().colors;

interface StockProduct {
  productName?: string;
  stockCode?: string;
  quantityMoved?: number;
  grossProfit?: number;
  valueMovement?: number;
  departmentName?: string;
  departmentCode?: string;
  grossProfitPercent?: number;
  dailyAvgSales?: number;
  estimatedCostValue?: number;
  currentSOH?: number;
  daysOfStock?: number;
  costPerUnit?: number;
  // Additional fields for API compatibility
  sales_qty?: number;
  quantity?: number;
  gross_profit_percent?: string | number;
  description?: string;
  name?: string;
  product_name?: string;
  desc?: string;
  stock_code?: string;
  code?: string;
  department_code?: string;
  // New fields from stock-activity API
  qty_sold?: number;
  gp_pct?: number;
  sales_val?: number;
  product_code?: string;
}

const StockHistoryScreen = () => {
  const navigation = useNavigation();
  const { selectedPharmacy, pharmacies, selectedDate, logout } = useAuth();
  const { colors } = useTheme();
  
  // Selector states
  const [selectedFilter, setSelectedFilter] = useState('Top Day');

  // Data states
  const [stockData, setStockData] = useState<StockProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Low GP threshold state
  const [lowGPThreshold, setLowGPThreshold] = useState(20);
  const [showThresholdPicker, setShowThresholdPicker] = useState(false);
  
  // Low GP SEP state
  const [showSEP, setShowSEP] = useState(false);
  
  // Over Stocked days threshold state
  const [overStockedDaysThreshold, setOverStockedDaysThreshold] = useState(30);
  const [showOverStockedPicker, setShowOverStockedPicker] = useState(false);
  
  // Over Stocked category filter state
  const [overStockedCategoryFilter, setOverStockedCategoryFilter] = useState('all');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  
  // Over Stocked value filter state
  const [overStockedValueFilter, setOverStockedValueFilter] = useState(10); // Lowered from 100 to 10 for testing
  const [showValuePicker, setShowValuePicker] = useState(false);

  // Get icon for selected filter
  const getFilterIcon = () => {
    switch (selectedFilter) {
      case 'Top Day':
        return <TrendingUp size={20} color={colors.textPrimary} />;
      case 'Low GP':
        return <AlertTriangle size={20} color={colors.textPrimary} />;
      case 'Top 12M':
        return <Package size={20} color={colors.textPrimary} />;
      case 'Over Stocked':
        return <DollarSign size={20} color={colors.textPrimary} />;
      default:
        return <TrendingUp size={20} color={colors.textPrimary} />;
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

  // Department categories mapping
  const departmentCategories = {
    'all': 'All Categories',
    'dispensary': 'Dispensary',
    'self_med': 'Self-Medication',
    'git': 'GIT',
    'vitamins': 'Vitamins / Supplements',
    'first_aid': 'First Aid',
    'sports': 'Sports',
    'health_foods': 'Confectionary',
    'beauty': 'Beauty & Skincare',
    'bath_body': 'Bath & Body',
    'baby': 'Baby',
    'gifts': 'Gifts',
    'other': 'Other'
  };

  // Department to category mapping
  const getDepartmentCategory = (departmentCode: string) => {
    if (!departmentCode) {
      return 'other';
    }
    const code = departmentCode.toUpperCase();

    // Helper to test prefixes
    const isOneOf = (prefixes: string[]) => prefixes.some(p => code.startsWith(p));

    // Dispensary
    if (isOneOf(['PDSS','PDST','PDSV','PDWB','OPEN'])) return 'dispensary';

    // Self-Medication
    if (isOneOf([
      'PDOB','PDOC','PDOD','PDOE','PDOF','PDOG','PDOI','PDOJ','PDOL','PDOM','PDON','PDOO','PDOQ','PDOR','PDOS','PDOU','PDOZ',
      'MADA','MADC','MADS','MAHC','MAHE','MAHH','MAHP','MAHR','MAHS','MMMO','FPIS','FPJA'
    ])) return 'self_med';

    // GIT
    if (isOneOf(['PDOA','MAHI'])) return 'git';

    // Vitamins / Supplements
    if (isOneOf(['PDOT','HVLA','HVLD','HVLH','HVLL','HVLT','HSNI'])) return 'vitamins';

    // First Aid (includes surgical/medical consumables and devices)
    if (isOneOf([
      'FDAA','FDAB','FDAC','FDAD','FDAE','FDAF','FDAG','FDAH','FDAI','FDAJ','FDAK','FDAL','FDAM','FDAN','FDAO','FFFO',
      'KCAA','KSAA','MADD','MAHD','MAHF','NAAA','NAAB','NAAC','OAAA','OAAB','OAAC','OAAD','OAAE','OAAF','OAAG','OAAH','OAAI','OAAJ','OAAK','OAAL','OAAM','OAAN','OAAO','OAAP','OAAQ','OAAR','OAAS','OAAT','OAAU','OAAV','OAAW','OAAX','OAAY','OAAZ'
    ])) return 'first_aid';

    // Sports
    if (isOneOf([
      'HSNB','HSNC','HSND','HSNE','HSNF','HSNG','HSNJ','HSNK','HSNM','HSNN',
      'HSTA','HSTB','HSTC','HSTD','HSTE','HSTG','HSTS','HSTT','FNTB'
    ])) return 'sports';

    // Health Foods
    if (isOneOf(['HNFF','HNFN','HNFW','HSNA','FNCB','FNCC','FNCD','FNCE','FNCF','FNCS'])) return 'health_foods';

    // Beauty & Skincare
    if (isOneOf([
      'BAAA','BAAB','BAAC','BAAD','BAAE','BAAF','BBSN','BBGA','BBGN','BBGS','BCCE','BCCF','BCCL','BCCN','BCCS',
      'BPFM','BPFP','BPFR','BPFS','BPFT'
    ])) return 'beauty';

    // Bath & Body
    if (isOneOf([
      'FPBA','FPBB','FPBC','FPBF','FPBG','FPBL','FPBS','FPBT','FPCF','FPDM','FPDW','FPFA','FPFT','FPHA','FPHC','FPHD','FPHE','FPHH','FPHI','FPHJ','FPHK','FPHS','FPIF','FPIP',
      'FPOA','FPOB','FPOC','FPOG','FPOH','FPOT','FPSA','FPSB','FPSC','FPSL','FPSM','FPSS','FPVM','FPVW','FNTE','FNTC','ZAJA','ZAJB','ZAJD','ZAUB'
    ])) return 'bath_body';

    // Baby
    if (isOneOf(['FBBA','FBBB','FBBC','FBBD','FBBE','FBBG','FBBH'])) return 'baby';

    // Gifts
    if (isOneOf([
      'BBGF','BBGG','BCAA','BFAA','BFAB','BFAC','BPFB','BPFC','BPFG','BCCG','YBAA','CAAA','DISC','FNAA','FNAQ','FNBA','FNBB','FNBM','FNBN','FNBS','FNDC','FNEA','FNFA',
      'FNGA','FNGB','FNGC','FNGD','FNHC','FNHD','FNHE','FNHH','FNHO','FNHV','FNHW','FNIA','FNKA','FNKC','FNLA','FNMA','FNOA','FNSH','FNTA','FNTD','FNUA','FNUB','FNUC',
      'FNUD','FNUE','FNUF','FNUG','FNVA','FNVB','FNVC','FNVD','FNVE','FPFB','FPIA','SAAA','SAAB','SAAC','SABA','SABB','SABC','SACA','SACB','SACC','SBAA','SBAB','SBBA','SSSO',
      'ZAAA','ZABA','ZADA','ZAEA','ZAXA','BBBO','HHHO','PPPO','ZZZZ'
    ])) return 'gifts';

    return 'other';
  };

  // Filter stock data by category and value
  const getFilteredStockData = (data: StockProduct[]) => {
    let filtered = data;
    
    console.log(`🔍 Starting getFilteredStockData with ${filtered.length} products`);
    console.log(`🔍 Category filter: ${overStockedCategoryFilter}, Value filter: R ${overStockedValueFilter}+`);
    
    // Filter by category
    if (overStockedCategoryFilter !== 'all') {
      const beforeCategoryCount = filtered.length;
      console.log(`🔍 Applying category filter: ${overStockedCategoryFilter}`);
      
      // Show sample of what we're filtering
      const sampleProducts = filtered.slice(0, 5);
      console.log(`🔍 Sample products before category filtering:`);
      sampleProducts.forEach((product, index) => {
        const deptCode = product.departmentCode || 'N/A';
        const category = getDepartmentCategory(deptCode);
        console.log(`  ${index + 1}. ${product.description || 'Unknown'}: ${deptCode} → ${category}`);
      });
      
      filtered = filtered.filter(product => {
        const category = getDepartmentCategory(product.departmentCode || '');
        const matches = category === overStockedCategoryFilter;
        if (!matches) {
          console.log(`🚫 Category filter: ${product.description || 'Unknown'} (${product.departmentCode || 'N/A'}) → ${category} (excluded)`);
        } else {
          console.log(`✅ Category filter: ${product.description || 'Unknown'} (${product.departmentCode || 'N/A'}) → ${category} (included)`);
        }
        return matches;
      });
      console.log(`🔍 After category filtering: ${beforeCategoryCount} → ${filtered.length} products`);
    } else {
      console.log(`🔍 Category filter: Including all categories`);
    }
    
    // Filter by value (for Over Stocked only)
    if (selectedFilter === 'Over Stocked') {
      const beforeValueCount = filtered.length;
      filtered = filtered.filter(product => {
        const stockValue = (product.costPerUnit || 0) * (product.currentSOH || 0);
        const meetsThreshold = stockValue >= overStockedValueFilter;
        
        // Special case: PDST department products should always be included regardless of value
        const isPDST = (product.departmentCode || '').toUpperCase().startsWith('PDST');
        if (isPDST) {
          console.log(`✅ PDST product always included: ${product.description || 'Unknown'} - Stock Value: R ${stockValue.toFixed(2)}`);
          return true; // Always include PDST products
        }
        
        // Debug: Log stock value calculation for first few products
        if (beforeValueCount <= 5 || !meetsThreshold) {
          const unitCost = product.costPerUnit || 0;
          const soh = product.currentSOH || 0;
          console.log(`🔍 Value calculation: ${product.description || 'Unknown'}`);
          console.log(`   Unit Cost: R ${unitCost.toFixed(2)}`);
          console.log(`   SOH: ${soh.toFixed(1)}`);
          console.log(`   Stock Value: R ${stockValue.toFixed(2)} (= R${unitCost.toFixed(2)} × ${soh.toFixed(1)})`);
          console.log(`   Threshold: R ${overStockedValueFilter}`);
          console.log(`   Meets threshold: ${meetsThreshold ? 'YES' : 'NO'}`);
        }
        
        if (!meetsThreshold) {
          console.log(`🚫 Value filter: ${product.description || 'Unknown'} - Stock Value: R ${stockValue.toFixed(2)} < R ${overStockedValueFilter} (excluded)`);
        }
        return meetsThreshold;
      });
      console.log(`🔍 After value filtering: ${beforeValueCount} → ${filtered.length} products`);
    }
    
    console.log(`🔍 Final filtered data: ${filtered.length} products`);
    return filtered;
  };

  // Fetch stock data based on selected filter
  const fetchStockData = async () => {
    if (!selectedPharmacy || !selectedDate) {
      console.log('❌ Missing required data: selectedPharmacy or selectedDate');
      setLoading(false);
      return;
    }

    console.log(`🚀 Starting fetchStockData for filter: ${selectedFilter}`);
    setLoading(true);
    setError(null);

    try {
      const dateStr = formatDateLocal(selectedDate);
      console.log(`📅 Date string: ${dateStr}`);
      let data: StockProduct[] = [];

      switch (selectedFilter) {
        case 'Top Day':
          console.log(`🔍 Fetching Top Day data for pharmacy: ${selectedPharmacy}`);
          
          // Use the new stock-activity API endpoint for top products by quantity
          const topDayPharmacyId = getPharmacyId(selectedPharmacy);
          try {
            console.log(`🌐 Making API call to: ${API_CONFIG.BASE_URL}/pharmacies/${topDayPharmacyId}/stock-activity/by-quantity?date=${dateStr}&limit=50`);
            console.log(`🌐 Pharmacy ID: ${topDayPharmacyId}, Date: ${dateStr}`);
            
            const response = await fetch(`${API_CONFIG.BASE_URL}/pharmacies/${topDayPharmacyId}/stock-activity/by-quantity?date=${dateStr}&limit=50`, {
              method: 'GET',
              headers: { 
                'Authorization': `Bearer ${API_CONFIG.API_KEY}`,
                'Content-Type': 'application/json'
              }
            });
            
            console.log(`🌐 Response status: ${response.status}, ok: ${response.ok}`);
            
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const topMovingResponse = await response.json();
            console.log('📊 Top Day API response:', topMovingResponse);
            console.log('📊 Top Day response type:', typeof topMovingResponse);
            console.log('📊 Top Day response keys:', topMovingResponse ? Object.keys(topMovingResponse) : 'null');
            
            if (topMovingResponse && Array.isArray(topMovingResponse)) {
              data = topMovingResponse;
              console.log('📊 Top Day response is direct array');
            } else if (topMovingResponse && topMovingResponse.items && Array.isArray(topMovingResponse.items)) {
              data = topMovingResponse.items;
              console.log('📊 Top Day response has items property');
            } else {
              data = [];
              console.log('📊 Top Day response structure not recognized');
            }
            
            console.log(`📊 Top Day products count: ${data.length}`);
            if (data.length > 0) {
              console.log('📊 First Top Day product sample:', data[0]);
              console.log('📊 First product keys:', Object.keys(data[0]));
            }
            
            // Sort by quantity sold (highest first) and take top 30
            data = data
              .sort((a: any, b: any) => (Number(b.qty_sold) || 0) - (Number(a.qty_sold) || 0))
              .slice(0, 30);
            
          } catch (error) {
            console.error('❌ Error fetching Top Day data from stock-activity:', error);
            
            // Fallback: Try to use the dailyStockAPI as a backup
            try {
              console.log('🔄 Trying fallback API call...');
              const fallbackResponse = await dailyStockAPI.getTopMovingProducts(selectedPharmacy, dateStr, 30);
              console.log('📊 Fallback API response:', fallbackResponse);
              
              if (fallbackResponse && Array.isArray(fallbackResponse)) {
                data = fallbackResponse;
              } else if (fallbackResponse && fallbackResponse.products && Array.isArray(fallbackResponse.products)) {
                data = fallbackResponse.products;
              } else {
                data = [];
              }
              
              console.log(`📊 Fallback products count: ${data.length}`);
            } catch (fallbackError) {
              console.error('❌ Fallback API also failed:', fallbackError);
              data = [];
            }
          }
          break;

        case 'Low GP':
          console.log(`🔍 Fetching Low GP data for pharmacy: ${selectedPharmacy} with threshold: ${lowGPThreshold}%`);
          console.log(`🔍 SEP setting: showSEP = ${showSEP}, excludePDST = ${!showSEP}`);
          
          // Use the new stock-activity API endpoint for top products by quantity, then filter for low GP
          const lowGPPharmacyId = getPharmacyId(selectedPharmacy);
          try {
            console.log(`🌐 Making Low GP API call to: ${API_CONFIG.BASE_URL}/pharmacies/${lowGPPharmacyId}/stock-activity/worst-gp?date=${dateStr}&limit=100`);
            
            const response = await fetch(`${API_CONFIG.BASE_URL}/pharmacies/${lowGPPharmacyId}/stock-activity/worst-gp?date=${dateStr}&limit=100`, {
              method: 'GET',
              headers: { 
                'Authorization': `Bearer ${API_CONFIG.API_KEY}`,
                'Content-Type': 'application/json'
              }
            });
            
            console.log(`🌐 Low GP Response status: ${response.status}, ok: ${response.ok}`);
            
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const lowGPResponse = await response.json();
            console.log('📊 Low GP API response:', lowGPResponse);
            
            if (lowGPResponse && Array.isArray(lowGPResponse)) {
              data = lowGPResponse;
            } else if (lowGPResponse && lowGPResponse.items && Array.isArray(lowGPResponse.items)) {
              data = lowGPResponse.items;
            } else {
              data = [];
            }
            
            console.log(`📊 Low GP products count before filtering: ${data.length}`);
            
            // Debug: Log some sample GP values to understand the data structure
            if (data.length > 0) {
              console.log('🔍 Sample GP values before filtering:');
              data.slice(0, 5).forEach((product: any, index: number) => {
                const gpPercent = product.gp_pct;
                const productName = product.description || product.productName || product.name || `Product ${index + 1}`;
                console.log(`  ${index + 1}. ${productName}: GP = ${gpPercent} (type: ${typeof gpPercent})`);
              });
            }
            
            // Filter for low GP products based on threshold
            // Note: API returns GP percentages as whole numbers (e.g., 28.616), not decimals
            data = data.filter((product: any) => {
              const gpPercent = product.gp_pct;
              if (gpPercent !== undefined && gpPercent !== null) {
                const gpValue = typeof gpPercent === 'string' ? parseFloat(gpPercent) : gpPercent;
                const isLowGP = gpValue < lowGPThreshold;
                console.log(`🔍 Product GP: ${gpValue}%, Threshold: ${lowGPThreshold}%, Is Low GP: ${isLowGP}`);
                return isLowGP;
              }
              console.log(`🔍 Product has no GP percentage, excluding`);
              return false; // Exclude products without GP percentage
            });
            
            console.log(`📊 Low GP products count after GP filtering: ${data.length}`);
            
            // Log department codes for debugging
            if (data.length > 0) {
              console.log('🔍 Sample department codes from Low GP products:');
              data.slice(0, 5).forEach((product: any, index: number) => {
                const deptCode = product.department_code || product.departmentCode || 'N/A';
                const productName = product.description || product.productName || product.name || `Product ${index + 1}`;
                const gpPercent = product.gp_pct;
                console.log(`  ${index + 1}. ${productName}: ${deptCode} - GP: ${gpPercent}%`);
              });
            }
            
            // Additional frontend filtering to ensure PDST products are excluded when showSEP is false
            if (!showSEP) {
              console.log('🔍 Frontend filtering: Excluding PDST department products');
              const beforeFilterCount = data.length;
              data = data.filter((product: any) => {
                const departmentCode = product.department_code || product.departmentCode || '';
                const isPDST = departmentCode.toUpperCase().startsWith('PDST');
                if (isPDST) {
                  console.log(`🚫 Filtering out PDST product: ${product.description || product.productName || 'Unknown'} (${departmentCode})`);
                }
                return !isPDST;
              });
              const afterFilterCount = data.length;
              console.log(`🔍 Frontend filtering complete: ${beforeFilterCount} → ${afterFilterCount} products (excluded ${beforeFilterCount - afterFilterCount} PDST products)`);
            } else {
              console.log('🔍 Frontend filtering: Including all products (including PDST)');
            }
            
            // Sort by GP percentage (lowest first) and take top 30
            data = data
              .sort((a: any, b: any) => {
                const gpA = typeof a.gp_pct === 'string' ? parseFloat(a.gp_pct) : (a.gp_pct || 0);
                const gpB = typeof b.gp_pct === 'string' ? parseFloat(b.gp_pct) : (b.gp_pct || 0);
                return gpA - gpB; // Ascending order (lowest GP first)
              })
              .slice(0, 30);
            
            console.log(`📊 Low GP products sorted and limited: ${data.length} products`);
            
            // Debug: Log sample sorted GP values
            if (data.length > 0) {
              console.log('🔍 Sample sorted GP values:');
              data.slice(0, 5).forEach((product: any, index: number) => {
                const gpPercent = product.gp_pct;
                const productName = product.description || product.productName || product.name || `Product ${index + 1}`;
                console.log(`  ${index + 1}. ${productName}: ${gpPercent}% GP`);
              });
            }
          } catch (error) {
            console.error('❌ Error fetching Low GP data:', error);
            data = [];
          }
          break;

        case 'Top 12M':
          console.log(`🔍 Fetching Top 12M data for pharmacy: ${selectedPharmacy}`);
          // Declare pharmacyId outside try block so it can be used in catch block
          const top12MPharmacyId = getPharmacyId(selectedPharmacy);
          try {
            // Use the usage API endpoint for actual 180-day average daily usage
            console.log(`🌐 Making Top 12M API call to: ${API_CONFIG.BASE_URL}/pharmacies/${top12MPharmacyId}/usage/top-180d?limit=200`);
            
            const response = await fetch(`${API_CONFIG.BASE_URL}/pharmacies/${top12MPharmacyId}/usage/top-180d?limit=200`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${API_CONFIG.API_KEY}`,
                'Content-Type': 'application/json'
              }
            });
            
            console.log(`🌐 Top 12M Response status: ${response.status}, ok: ${response.ok}`);
            
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            let top12MResponse = await response.json();
            console.log('📊 Top 12M API response:', top12MResponse);
            
            // The usage API returns data as a direct array
            if (top12MResponse && Array.isArray(top12MResponse)) {
              data = top12MResponse;
              console.log('📊 Top 12M response is direct array');
            } else if (top12MResponse && top12MResponse.items && Array.isArray(top12MResponse.items)) {
              data = top12MResponse.items;
              console.log('📊 Top 12M response has items property');
            } else {
              data = [];
              console.log('📊 Top 12M response structure not recognized');
            }
            
            console.log(`📊 Top 12M products count before processing: ${data.length}`);
            
            // Map the usage data to our expected structure
            data = data.map((product: any) => ({
              ...product,
              // Use actual 180-day average daily usage from the API
              dailyAvgSales: product.avg_qty_180d || product.avg_daily_qty || product.avg_daily_quantity || 0,
              // Ensure we have the required fields for display
              description: product.description || product.productName || product.name || product.product_name || product.desc || 'Unknown Product',
              stock_code: product.product_code || product.stock_code || product.stockCode || product.code || 'N/A'
            }));
            
            // Filter for products with valid usage data and sort by daily average (descending)
            data = data
              .filter((product: any) => {
                const hasValidUsage = typeof product.dailyAvgSales === 'number' && isFinite(product.dailyAvgSales) && product.dailyAvgSales > 0;
                return hasValidUsage;
              })
              .sort((a: any, b: any) => b.dailyAvgSales - a.dailyAvgSales)
              .slice(0, 30);
            
            console.log(`📊 Top 12M data processed and ready for display: ${data.length} products`);
            
            // Debug: Log sample data structure for Top 12M
            if (data.length > 0) {
              console.log('🔍 Sample Top 12M product data:');
              data.slice(0, 3).forEach((product: any, index: number) => {
                console.log(`  ${index + 1}. Product: ${product.description || product.productName || product.name || 'Unknown'}`);
                console.log(`     Code: ${product.stock_code || product.stockCode || product.code || 'N/A'}`);
                console.log(`     Daily Avg Sales: ${product.dailyAvgSales || 'N/A'}`);
                console.log(`     All keys:`, Object.keys(product));
              });
            }
          } catch (error) {
            console.error('❌ Error fetching Top 12M data from usage API:', error);
            
            // Fallback: Try to use stock-activity endpoint if usage API fails
            try {
              console.log('🔄 Trying fallback to stock-activity API...');
              const fallbackResponse = await fetch(`${API_CONFIG.BASE_URL}/pharmacies/${top12MPharmacyId}/stock-activity/by-quantity?date=${dateStr}&limit=100`, {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${API_CONFIG.API_KEY}`,
                  'Content-Type': 'application/json'
                }
              });
              
              if (fallbackResponse.ok) {
                let fallbackData = await fallbackResponse.json();
                if (fallbackData && Array.isArray(fallbackData)) {
                  data = fallbackData;
                } else if (fallbackData && fallbackData.items && Array.isArray(fallbackData.items)) {
                  data = fallbackData.items;
                } else {
                  data = [];
                }
                
                // For fallback, use current day's data as proxy (not ideal but functional)
                data = data.map((product: any) => ({
                  ...product,
                  dailyAvgSales: product.qty_sold || product.sales_qty || product.quantity || 0,
                  description: product.description || product.productName || product.name || product.product_name || product.desc || 'Unknown Product',
                  stock_code: product.product_code || product.stock_code || product.stockCode || product.code || 'N/A'
                }));
                
                data = data
                  .filter((product: any) => product.dailyAvgSales > 0)
                  .sort((a: any, b: any) => b.dailyAvgSales - a.dailyAvgSales)
                  .slice(0, 30);
                
                console.log(`📊 Fallback data processed: ${data.length} products`);
              }
            } catch (fallbackError) {
              console.error('❌ Fallback API also failed:', fallbackError);
              data = [];
            }
          }
          break;

        case 'Over Stocked':
          console.log(`🔍 Fetching Over Stocked data for pharmacy: ${selectedPharmacy} with ${overStockedDaysThreshold}+ days threshold`);
          try {
            // Use the new stock-activity API endpoint and simulate overstocked data
            const overStockedPharmacyId = getPharmacyId(selectedPharmacy);
            console.log(`🌐 Making Over Stocked API call to: ${API_CONFIG.BASE_URL}/pharmacies/${overStockedPharmacyId}/stock-activity/by-quantity?date=${dateStr}&limit=100`);
            
            const response = await fetch(`${API_CONFIG.BASE_URL}/pharmacies/${overStockedPharmacyId}/stock-activity/by-quantity?date=${dateStr}&limit=100`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${API_CONFIG.API_KEY}`,
                'Content-Type': 'application/json'
              }
            });
            
            console.log(`🌐 Over Stocked Response status: ${response.status}, ok: ${response.ok}`);
            
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            let overStockedResponse = await response.json();
            console.log('📊 Over Stocked API response:', overStockedResponse);
            
            if (overStockedResponse && Array.isArray(overStockedResponse)) {
              data = overStockedResponse;
            } else if (overStockedResponse && overStockedResponse.items && Array.isArray(overStockedResponse.items)) {
              data = overStockedResponse.items;
            } else {
              data = [];
            }
            
            console.log(`📊 Over Stocked products count before processing: ${data.length}`);
            
            // Build usage map from 180d averages
            let usageMap: Record<string, number> = {};
            try {
              const usageRes = await fetch(`${API_CONFIG.BASE_URL}/pharmacies/${overStockedPharmacyId}/usage/top-180d?limit=200`, {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${API_CONFIG.API_KEY}`,
                  'Content-Type': 'application/json'
                }
              });
              if (usageRes.ok) {
                const usageJson = await usageRes.json();
                const usageArr = Array.isArray(usageJson) ? usageJson : usageJson?.items || [];
                usageArr.forEach((u: any) => {
                  if (u?.product_code && typeof u.avg_qty_180d === 'number') {
                    usageMap[u.product_code] = u.avg_qty_180d;
                  }
                });
              }
            } catch (e) {
              console.log('⚠️ usage top-180d fetch failed, will fallback per product');
            }
            
            // Fallback: fetch usage per missing product codes
            const missingCodes = Array.from(new Set(
              data
                .map((p: any) => p.product_code || p.stock_code || p.code)
                .filter((c: any) => c && usageMap[c] === undefined)
            ));
            if (missingCodes.length > 0) {
              const perProductResults = await Promise.allSettled(
                missingCodes.map((code: string) => (
                  fetch(`${API_CONFIG.BASE_URL}/pharmacies/${overStockedPharmacyId}/usage/product/${code}`, {
                    method: 'GET',
                    headers: {
                      'Authorization': `Bearer ${API_CONFIG.API_KEY}`,
                      'Content-Type': 'application/json'
                    }
                  }).then(r => r.ok ? r.json() : null)
                ))
              );
              perProductResults.forEach((res: any, idx: number) => {
                if (res.status === 'fulfilled' && res.value && typeof res.value.avg_qty_180d === 'number') {
                  usageMap[missingCodes[idx]] = res.value.avg_qty_180d;
                }
              });
            }
            
            // Map real on-hand and compute days of stock
            data = data.map((product: any) => {
              const code = product.product_code || product.stock_code || product.code || '';
              const onHandRaw = product.on_hand ?? product.currentSOH ?? 0;
              const onHand = Number(onHandRaw);
              const avg180 = usageMap[code];
              const qtySold = Number(product.qty_sold || product.sales_qty || 0);
              const costOfSales = Number(product.cost_of_sales || 0);
              const unitCost = qtySold > 0 ? costOfSales / qtySold : 0;
              const days = (typeof avg180 === 'number' && isFinite(avg180) && avg180 > 0.1) ? (onHand / avg180) : 0;
              const roundedSOH = isFinite(onHand) ? Math.round(onHand * 10) / 10 : 0;
              
              return {
                ...product,
                currentSOH: roundedSOH,
                daysOfStock: Math.min(Math.round(days), 45),
                costPerUnit: unitCost,
                departmentCode: product.department_code || product.departmentCode || '',
                description: product.description || product.productName || product.name || product.product_name || product.desc || 'Unknown Product',
                stock_code: code
              };
            });
            
            console.log(`📊 Over Stocked data processed: ${data.length} products`);
            
            // Debug: Analyze department code distribution
            if (data.length > 0) {
              console.log('🔍 Department code analysis:');
              const deptCounts: { [key: string]: number } = {};
              const deptExamples: { [key: string]: string[] } = {};
              const categoryCounts: { [key: string]: number } = {};
              
              data.forEach((product: any) => {
                const deptCode = product.departmentCode || 'N/A';
                const productName = product.description || product.productName || product.name || 'Unknown';
                
                if (!deptCounts[deptCode]) {
                  deptCounts[deptCode] = 0;
                  deptExamples[deptCode] = [];
                }
                deptCounts[deptCode]++;
                
                if (deptExamples[deptCode].length < 3) {
                  deptExamples[deptCode].push(productName);
                }
                
                // Count by category
                const category = getDepartmentCategory(deptCode);
                categoryCounts[category] = (categoryCounts[category] || 0) + 1;
              });
              
              // Sort by count and display
              Object.entries(deptCounts)
                .sort(([,a], [,b]) => b - a)
                .forEach(([deptCode, count]) => {
                  const examples = deptExamples[deptCode].join(', ');
                  const category = getDepartmentCategory(deptCode);
                  console.log(`  ${deptCode}: ${count} products → Category: ${category} (Examples: ${examples})`);
                });
              
              // Show category distribution
              console.log('🔍 Category distribution:');
              Object.entries(categoryCounts)
                .sort(([,a], [,b]) => b - a)
                .forEach(([category, count]) => {
                  console.log(`  ${category}: ${count} products`);
                });
            }
            
            // Debug: Log sample days of stock calculations before filtering
            if (data.length > 0) {
              console.log('🔍 Sample days of stock calculations before filtering:');
              data.slice(0, 5).forEach((product: any, index: number) => {
                const dailySales = product.qty_sold || product.sales_qty || product.quantity || 0;
                const soh = product.currentSOH || 0;
                const unitCost = product.costPerUnit || 0;
                const days = product.daysOfStock || 0;
                const value = unitCost * soh;
                const daysDisplay = days >= 45 ? '45+' : days.toString();
                console.log(`  ${index + 1}. ${product.description || 'Unknown'}:`);
                console.log(`     Daily Sales: ${dailySales}`);
                console.log(`     SOH: ${soh.toFixed(1)}`);
                console.log(`     Unit Cost: R${unitCost.toFixed(2)}`);
                console.log(`     Stock Value: R${value.toFixed(0)} (= R${unitCost.toFixed(2)} × ${soh.toFixed(1)})`);
                console.log(`     Days: ${daysDisplay}`);
              });
            }
            
            // Filter by days of stock threshold
            data = data.filter((product: any) => (product.daysOfStock || 0) >= overStockedDaysThreshold);
            console.log(`📊 After days threshold filtering (${overStockedDaysThreshold}+ days): ${data.length} products`);
            
            // Apply category and value filters
            data = getFilteredStockData(data);
            console.log(`📊 After category and value filtering: ${data.length} products`);
            
            // Sort by days of stock (descending) to show most overstocked first
            data = data.sort((a: any, b: any) => (b.daysOfStock || 0) - (a.daysOfStock || 0));
            
            // Limit to 200 items for performance
            if (data.length > 200) {
              console.log(`⚠️ Limiting Over Stocked products from ${data.length} to 200 for performance`);
              data = data.slice(0, 200);
            }
            
            console.log(`📊 Final Over Stocked data ready for display: ${data.length} products`);
            
            // Debug: Log sample data structure for Over Stocked
            if (data.length > 0) {
              console.log('🔍 Sample Over Stocked product data:');
              data.slice(0, 3).forEach((product: any, index: number) => {
                const daysDisplay = (product.daysOfStock || 0) >= 45 ? '45+' : (product.daysOfStock || 0).toString();
                const stockValue = (product.costPerUnit || 0) * (product.currentSOH || 0);
                console.log(`  ${index + 1}. Product: ${product.description || 'Unknown'}`);
                console.log(`     Code: ${product.stock_code || 'N/A'}`);
                console.log(`     Days of Stock: ${daysDisplay} days`);
                console.log(`     SOH: ${(product.currentSOH || 0).toFixed(1)}`);
                console.log(`     Cost per Unit: R ${(product.costPerUnit || 0).toFixed(0)}`);
                console.log(`     Department: ${product.departmentCode || 'N/A'}`);
                console.log(`     Stock Value: R ${stockValue.toFixed(0)}`);
              });
            }
          } catch (error) {
            console.error('❌ Error fetching Over Stocked data:', error);
            data = [];
          }
          break;

        default:
          console.log(`❌ Unknown filter: ${selectedFilter}`);
          data = [];
      }

      console.log(`✅ Setting stock data with ${data.length} items`);
      setStockData(data);
    } catch (err: any) {
      console.error('❌ Error fetching stock data:', err);
      console.error('❌ Error details:', {
        message: err?.message,
        response: err?.response?.data,
        status: err?.response?.status,
        stack: err?.stack
      });
      setError(`Failed to load stock data: ${err?.message || 'Unknown error'}`);
    } finally {
      console.log('🏁 Setting loading to false');
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
    await fetchStockData();
    setRefreshing(false);
  };

  // Handle PDF export
  const handleExportPDF = async () => {
    try {
      if (stockData.length === 0) {
        console.log('No data to export');
        return;
      }

      const pharmacyName = getCurrentPharmacyName() || selectedPharmacy || 'Unknown Pharmacy';

      // Normalize data for PDF to ensure consistent fields
      const pdfData = stockData.map((item: any) => {
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
        return normalized;
      });

      await exportStockDataToPDF(pdfData, selectedFilter, selectedDate, pharmacyName);
      
      console.log('PDF exported successfully');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      // You could add a toast notification here to inform the user of the error
    }
  };

  // Fetch data when component mounts or filter changes
  useEffect(() => {
    fetchStockData();
  }, [selectedFilter, selectedPharmacy, selectedDate, lowGPThreshold, overStockedDaysThreshold, overStockedCategoryFilter, overStockedValueFilter, showSEP]);

  // Debug effect to log stock data changes
  useEffect(() => {
    console.log('📊 Stock data state changed:', stockData);
    if (stockData.length > 0) {
      console.log('📊 First product in stock data:', stockData[0]);
    }
  }, [stockData]);

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
              <Text style={styles.backButtonText}>Stock History</Text>
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
        {/* Stock History Section */}
        <View style={styles.historySection}>
          <Text style={styles.historyTitle}>Daily Activity</Text>
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
              selectedFilter === 'Top Day' && styles.filterButtonSelected
            ]}
            onPress={() => handleFilterChange('Top Day')}
          >
            <Text style={[
              styles.filterButtonText,
              selectedFilter === 'Top Day' && styles.filterButtonTextSelected
            ]}>
              Top Day
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.filterButton,
              selectedFilter === 'Low GP' && styles.filterButtonSelected
            ]}
            onPress={() => handleFilterChange('Low GP')}
          >
            <Text style={[
              styles.filterButtonText,
              selectedFilter === 'Low GP' && styles.filterButtonTextSelected
            ]}>
              Low GP
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.filterButton,
              selectedFilter === 'Top 12M' && styles.filterButtonSelected
            ]}
            onPress={() => handleFilterChange('Top 12M')}
          >
            <Text style={[
              styles.filterButtonText,
              selectedFilter === 'Top 12M' && styles.filterButtonTextSelected
            ]}>
              Top Products
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.filterButton,
              selectedFilter === 'Over Stocked' && styles.filterButtonSelected
            ]}
            onPress={() => handleFilterChange('Over Stocked')}
          >
            <Text style={[
              styles.filterButtonText,
              selectedFilter === 'Over Stocked' && styles.filterButtonTextSelected
            ]}>
              Over Stocked
            </Text>
          </TouchableOpacity>
        </ScrollView>
        
        {/* Low GP Threshold Selector */}
        {selectedFilter === 'Low GP' && (
          <View style={styles.thresholdContainer}>
            <View style={styles.thresholdRow}>
              <View style={styles.thresholdLeft}>
                <Text style={styles.thresholdLabel}>Show products with GP% below:</Text>
                <TouchableOpacity 
                  style={styles.thresholdWindow}
                  onPress={() => setShowThresholdPicker(true)}
                >
                  <Text style={styles.thresholdWindowText}>{lowGPThreshold}%</Text>
                  <Text style={styles.thresholdWindowIcon}>▼</Text>
                </TouchableOpacity>
              </View>
              
              {/* Download Button */}
              {!loading && !error && stockData.length > 0 && (
                <TouchableOpacity 
                  style={styles.downloadButton}
                  onPress={handleExportPDF}
                >
                  <Download size={16} color={colors.textSecondary} />
                  <Text style={styles.downloadButtonText}>Export PDF</Text>
                </TouchableOpacity>
              )}
            </View>
            
            {/* Show SEP Selector */}
            <View style={styles.thresholdRow}>
              <View style={styles.thresholdLeft}>
                <Text style={styles.thresholdLabel}>Show SEP:</Text>
                <View style={styles.sepToggleContainer}>
                  <TouchableOpacity 
                    style={[
                      styles.sepToggleButton,
                      !showSEP && styles.sepToggleButtonSelected
                    ]}
                    onPress={() => setShowSEP(false)}
                  >
                    <Text style={[
                      styles.sepToggleButtonText,
                      !showSEP && styles.sepToggleButtonTextSelected
                    ]}>
                      No
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[
                      styles.sepToggleButton,
                      showSEP && styles.sepToggleButtonSelected
                    ]}
                    onPress={() => setShowSEP(true)}
                  >
                    <Text style={[
                      styles.sepToggleButtonText,
                      showSEP && styles.sepToggleButtonTextSelected
                    ]}>
                      Yes
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        )}
        
        {/* Over Stocked Days Threshold Selector */}
        {selectedFilter === 'Over Stocked' && (
          <View style={styles.thresholdContainer}>
            <View style={styles.thresholdRow}>
              <View style={styles.thresholdLeft}>
                <Text style={styles.thresholdLabel}>Show products with stock for:</Text>
                <TouchableOpacity 
                  style={styles.thresholdWindow}
                  onPress={() => setShowOverStockedPicker(true)}
                >
                  <Text style={styles.thresholdWindowText}>{overStockedDaysThreshold}+ days</Text>
                  <Text style={styles.thresholdWindowIcon}>▼</Text>
                </TouchableOpacity>
              </View>
              
              {/* Download Button */}
              {!loading && !error && stockData.length > 0 && (
                <TouchableOpacity 
                  style={styles.downloadButton}
                  onPress={handleExportPDF}
                >
                  <Download size={16} color={colors.textSecondary} />
                  <Text style={styles.downloadButtonText}>Export PDF</Text>
                </TouchableOpacity>
              )}
            </View>
            
            {/* Category and Value Filters Row */}
            <View style={styles.thresholdRow}>
              <View style={styles.thresholdLeft}>
                <Text style={styles.thresholdLabel}>Category:</Text>
                <TouchableOpacity 
                  style={styles.thresholdWindow}
                  onPress={() => setShowCategoryPicker(true)}
                >
                  <Text style={styles.thresholdWindowText}>
                    {departmentCategories[overStockedCategoryFilter as keyof typeof departmentCategories] || 'All Categories'}
                  </Text>
                  <Text style={styles.thresholdWindowIcon}>▼</Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.thresholdRight}>
                <Text style={styles.thresholdLabel}>Min Value:</Text>
                <TouchableOpacity 
                  style={styles.thresholdWindow}
                  onPress={() => setShowValuePicker(true)}
                >
                  <Text style={styles.thresholdWindowText}>
                    R {overStockedValueFilter.toLocaleString('en-ZA')}+
                  </Text>
                  <Text style={styles.thresholdWindowIcon}>▼</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
        
        {/* Download Button for other filters */}
        {selectedFilter !== 'Low GP' && selectedFilter !== 'Over Stocked' && !loading && !error && stockData.length > 0 && (
          <View style={styles.downloadContainer}>
            <TouchableOpacity 
              style={styles.downloadButton}
              onPress={handleExportPDF}
            >
              <Download size={16} color={colors.textSecondary} />
              <Text style={styles.downloadButtonText}>Export PDF</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {/* Loading State */}
        {loading && !refreshing && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accentPrimary} />
            <Text style={styles.loadingText}>Loading stock data...</Text>
          </View>
        )}

        {/* Error State */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={fetchStockData}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Stock List */}
        {!loading && !error && stockData.length > 0 && (
          <View style={styles.stockListContainer}>
            {stockData.map((product, index) => (
              <View key={index} style={styles.stockItem}>
                <View style={styles.stockItemLeft}>
                  <View style={styles.stockItemRank}>
                    <Text style={styles.stockItemRankText}>#{index + 1}</Text>
                  </View>
                  <View style={styles.stockItemContent}>
                    <Text style={styles.stockItemTitle}>
                      {product.description || product.productName || product.name || product.product_name || product.desc || `Product ${index + 1}`}
                    </Text>
                    <Text style={styles.stockItemCode}>
                      {product.product_code || product.stock_code || product.stockCode || product.code || 'N/A'}
                    </Text>
                  </View>
                </View>
                <View style={styles.stockItemRight}>
                  {selectedFilter === 'Low GP' ? (
                    // For Low GP filter, show GP% as primary value
                    product.gp_pct ? (
                      <Text style={[styles.stockItemQuantity, { color: colors.statusError }]}>
                        {typeof product.gp_pct === 'string' ? 
                          parseFloat(product.gp_pct).toFixed(1) : 
                          product.gp_pct.toFixed(1)}% GP
                      </Text>
                    ) : product.gross_profit_percent ? (
                      <Text style={[styles.stockItemQuantity, { color: colors.statusError }]}>
                        {typeof product.gross_profit_percent === 'string' ? 
                          parseFloat(product.gross_profit_percent).toFixed(1) : 
                          product.gross_profit_percent.toFixed(1)}% GP
                      </Text>
                    ) : product.grossProfitPercent !== undefined && product.grossProfitPercent !== null ? (
                      <Text style={[styles.stockItemQuantity, { color: colors.statusError }]}>
                        {product.grossProfitPercent.toFixed(1)}% GP
                      </Text>
                    ) : product.grossProfit !== undefined && product.grossProfit !== null && product.valueMovement ? (
                      <Text style={[styles.stockItemQuantity, { color: colors.statusError }]}>
                        {product.valueMovement > 0 ? `${((product.grossProfit / product.valueMovement) * 100).toFixed(1)}% GP` : '--'}
                      </Text>
                    ) : (
                      <Text style={[styles.stockItemQuantity, { color: colors.statusError }]}>--</Text>
                    )
                  ) : selectedFilter === 'Top 12M' ? (
                    // For Top 12M filter, show average daily sales
                    product.dailyAvgSales !== undefined && product.dailyAvgSales !== null ? (
                      <Text style={[styles.stockItemQuantity, { color: colors.statusSuccess }]}>
                        {product.dailyAvgSales.toFixed(2)} avg/day
                      </Text>
                    ) : (
                      <Text style={[styles.stockItemQuantity, { color: colors.statusSuccess }]}>--</Text>
                    )
                  ) : selectedFilter === 'Over Stocked' ? (
                    // For Over Stocked filter, show days on hand as main value, then SOH and VALUE
                    <>
                      <Text style={[styles.stockItemQuantity, { color: colors.statusError }]}>
                        {product.daysOfStock ? 
                          (product.daysOfStock >= 45 ? '45+ days' : `${product.daysOfStock} days`) : '--'}
                      </Text>
                      <Text style={styles.stockItemGP}>
                        SOH: {product.currentSOH ? product.currentSOH.toFixed(1) : '0.0'}
                      </Text>
                      <Text style={styles.stockItemGP}>
                        VALUE: {product.costPerUnit && product.currentSOH ? 
                          `R ${(product.costPerUnit * product.currentSOH).toLocaleString('en-ZA', {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0
                          })}` : '--'}
                      </Text>
                    </>
                  ) : selectedFilter === 'Top Day' ? (
                    // For Top Day filter, show quantity as primary value and GP percentage
                    <>
                      <Text style={styles.stockItemQuantity}>
                        {product.qty_sold || product.sales_qty || product.quantityMoved || product.quantity || 0} units
                      </Text>
                      {product.gp_pct ? (
                        <Text style={styles.stockItemGP}>
                          {typeof product.gp_pct === 'string' ? 
                            parseFloat(product.gp_pct).toFixed(1) : 
                            product.gp_pct.toFixed(1)}% GP
                        </Text>
                      ) : product.gross_profit_percent ? (
                        <Text style={styles.stockItemGP}>
                          {typeof product.gross_profit_percent === 'string' ? 
                            parseFloat(product.gross_profit_percent).toFixed(1) : 
                            product.gross_profit_percent.toFixed(1)}% GP
                        </Text>
                      ) : product.grossProfit !== undefined && product.grossProfit !== null && product.valueMovement ? (
                        <Text style={styles.stockItemGP}>
                          {product.valueMovement > 0 ? `${((product.grossProfit / product.valueMovement) * 100).toFixed(1)}% GP` : '--'}
                        </Text>
                      ) : (
                        <Text style={styles.stockItemGP}>--</Text>
                      )}
                    </>
                  ) : (
                    // For other filters, show quantity as primary value
                    <>
                      <Text style={styles.stockItemQuantity}>
                        {product.qty_sold || product.sales_qty || product.quantityMoved || product.quantity || 0} units
                      </Text>
                      {product.gp_pct ? (
                        <Text style={styles.stockItemGP}>
                          {typeof product.gp_pct === 'string' ? 
                            parseFloat(product.gp_pct).toFixed(1) : 
                            product.gp_pct.toFixed(1)}% GP
                        </Text>
                      ) : product.grossProfit !== undefined && product.grossProfit !== null && product.valueMovement ? (
                        <Text style={styles.stockItemGP}>
                          {product.valueMovement > 0 ? `${((product.grossProfit / product.valueMovement) * 100).toFixed(1)}% GP` : '--'}
                        </Text>
                      ) : null}
                    </>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Empty State */}
        {!loading && !error && stockData.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No {selectedFilter.toLowerCase()} data available</Text>
          </View>
        )}
      </ScrollView>

      {/* Threshold Picker Modal */}
      <Modal
        visible={showThresholdPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowThresholdPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Threshold</Text>
              <TouchableOpacity 
                onPress={() => setShowThresholdPicker(false)}
                style={styles.modalCloseButton}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.pickerContainer}>
              <ScrollView style={styles.pickerScrollView}>
                {Array.from({ length: 21 }, (_, i) => i + 10).map((threshold) => (
                  <TouchableOpacity
                    key={threshold}
                    style={[
                      styles.pickerItem,
                      lowGPThreshold === threshold && styles.pickerItemSelected
                    ]}
                    onPress={() => {
                      setLowGPThreshold(threshold);
                      setShowThresholdPicker(false);
                    }}
                  >
                    <Text style={[
                      styles.pickerItemText,
                      lowGPThreshold === threshold && styles.pickerItemTextSelected
                    ]}>
                      {threshold}%
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </View>
      </Modal>

      {/* Over Stocked Days Picker Modal */}
      <Modal
        visible={showOverStockedPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowOverStockedPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Days Threshold</Text>
              <TouchableOpacity 
                onPress={() => setShowOverStockedPicker(false)}
                style={styles.modalCloseButton}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.pickerContainer}>
              <ScrollView style={styles.pickerScrollView}>
                {[7, 14, 21, 30].map((days) => (
                  <TouchableOpacity
                    key={days}
                    style={[
                      styles.pickerItem,
                      overStockedDaysThreshold === days && styles.pickerItemSelected
                    ]}
                    onPress={() => {
                      setOverStockedDaysThreshold(days);
                      setShowOverStockedPicker(false);
                    }}
                  >
                    <Text style={[
                      styles.pickerItemText,
                      overStockedDaysThreshold === days && styles.pickerItemTextSelected
                    ]}>
                      {days}+ days
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </View>
      </Modal>

      {/* Category Picker Modal */}
      <Modal
        visible={showCategoryPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCategoryPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Category</Text>
              <TouchableOpacity 
                onPress={() => setShowCategoryPicker(false)}
                style={styles.modalCloseButton}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.pickerContainer}>
              <ScrollView style={styles.pickerScrollView}>
                {Object.entries(departmentCategories).map(([key, label]) => (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.pickerItem,
                      overStockedCategoryFilter === key && styles.pickerItemSelected
                    ]}
                    onPress={() => {
                      setOverStockedCategoryFilter(key);
                      setShowCategoryPicker(false);
                    }}
                  >
                    <Text style={[
                      styles.pickerItemText,
                      overStockedCategoryFilter === key && styles.pickerItemTextSelected
                    ]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </View>
      </Modal>

      {/* Value Picker Modal */}
      <Modal
        visible={showValuePicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowValuePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Minimum Value</Text>
              <TouchableOpacity 
                onPress={() => setShowValuePicker(false)}
                style={styles.modalCloseButton}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.pickerContainer}>
              <ScrollView style={styles.pickerScrollView}>
                {[100, 200, 300, 400, 500, 600, 700, 800, 900, 1000].map((value) => (
                  <TouchableOpacity
                    key={value}
                    style={[
                      styles.pickerItem,
                      overStockedValueFilter === value && styles.pickerItemSelected
                    ]}
                    onPress={() => {
                      setOverStockedValueFilter(value);
                      setShowValuePicker(false);
                    }}
                  >
                    <Text style={[
                      styles.pickerItemText,
                      overStockedValueFilter === value && styles.pickerItemTextSelected
                    ]}>
                      R {value.toLocaleString('en-ZA')}+
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
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
  // Threshold selector styles
  thresholdContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  thresholdRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  thresholdLeft: {
    flex: 1,
  },
  thresholdRight: {
    flex: 1,
  },
  thresholdLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
    fontWeight: '500',
  },
  thresholdWindow: {
    backgroundColor: colors.surfacePrimary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    width: width * 0.45,
    alignSelf: 'flex-start',
  },
  thresholdWindowText: {
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  thresholdWindowIcon: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  // SEP toggle styles
  sepToggleContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surfacePrimary,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
    width: width * 0.45,
    alignSelf: 'flex-start',
  },
  sepToggleButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sepToggleButtonSelected: {
    backgroundColor: colors.accentPrimary,
  },
  sepToggleButtonText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  sepToggleButtonTextSelected: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 16,
  },
  modalContent: {
    backgroundColor: colors.bgGradientFrom,
    borderRadius: 16,
    width: width * 0.5,
    maxHeight: '70%',
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalCloseText: {
    fontSize: 20,
    color: colors.textSecondary,
    fontWeight: 'bold',
  },
  pickerContainer: {
    padding: 20,
  },
  pickerScrollView: {
    maxHeight: 300,
  },
  pickerItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 4,
  },
  pickerItemSelected: {
    backgroundColor: colors.statusError,
  },
  pickerItemText: {
    fontSize: 16,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  pickerItemTextSelected: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  // Download button styles
  downloadContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  downloadButton: {
    backgroundColor: colors.surfacePrimary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    height: 48,
  },
  downloadButtonText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
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
  // Stock list styles
  stockListContainer: {
    paddingHorizontal: 16,
  },
  stockItem: {
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
  stockItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  stockItemRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accentPrimary,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  stockItemRankText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  stockItemContent: {
    marginLeft: 12,
    flex: 1,
  },
  stockItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  stockItemCode: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  stockItemRight: {
    alignItems: 'flex-end',
  },
  stockItemQuantity: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.statusSuccess,
    marginBottom: 4,
  },
  stockItemGP: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
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

export default StockHistoryScreen; 