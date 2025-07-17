import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Package, AlertTriangle, DollarSign, BarChart3, Calendar, AlertCircle, ShoppingCart } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { stockAPI, financialAPI, dailyStockAPI } from '../services/api'
import { formatDateLocal } from '../utils/dateUtils.js'
import SmartAlertsPanel from '../components/SmartAlertsPanel'
import { Line, Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
)

// Sparkline Chart Component
const SparklineChart = ({ data, color }) => {
  if (!data || data.length === 0) return null
  
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min
  
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * 100
    const y = range === 0 ? 50 : ((max - value) / range) * 100
    return `${x},${y}`
  }).join(' ')
  
  return (
    <div className="mt-2 h-6">
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  )
}

// Gauge component for stock movement
const StockMovementGauge = ({ value }) => {
  // Clamp value between -20 and 20 for display
  const clamped = Math.max(-20, Math.min(20, value));
  // Map -20..0..20 to -90..0..90 degrees (left to right)
  const angle = (clamped / 20) * 90;
  // Color logic
  let needleColor = '#FFF'; // gray
  if (clamped > 0) needleColor = '#FFF'; // green
  if (clamped < 0) needleColor = '#FFF'; // red

  // Arc segment colors
  const arcRed = '#E24313';
  const arcOrange = '#FFA500';
  const arcGreen = '#7ED957';

  // Helper to describe an arc path
  function describeArc(cx, cy, r, startAngle, endAngle) {
    const start = polarToCartesian(cx, cy, r, endAngle);
    const end = polarToCartesian(cx, cy, r, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
    return [
      'M', start.x, start.y,
      'A', r, r, 0, largeArcFlag, 0, end.x, end.y
    ].join(' ');
  }
  function polarToCartesian(cx, cy, r, angleDeg) {
    const angleRad = (angleDeg - 90) * Math.PI / 180.0;
    return {
      x: cx + r * Math.cos(angleRad),
      y: cy + r * Math.sin(angleRad)
    };
  }

  // Arc segments (angles in degrees)
  // -20% to -15%: -90 to -67.5 (red)
  // -15% to -7%: -67.5 to -31.5 (orange)
  // -7% to +7%: -31.5 to +31.5 (green)
  // +7% to +15%: +31.5 to +67.5 (orange)
  // +15% to +20%: +67.5 to +90 (red)
  const cx = 80, cy = 80, r = 60;
  return (
    <div className="flex flex-col items-center justify-center">
      <svg width="160" height="96" viewBox="0 0 160 96">
        {/* Arc segments */}
        {/* Red left */}
        <path d={describeArc(cx, cy, r, -90, -67.5)} fill="none" stroke={arcRed} strokeWidth="30" />
        {/* Orange left */}
        <path d={describeArc(cx, cy, r, -67.5, -31.5)} fill="none" stroke={arcOrange} strokeWidth="30" />
        {/* Green center */}
        <path d={describeArc(cx, cy, r, -31.5, 31.5)} fill="none" stroke={arcGreen} strokeWidth="30" />
        {/* Orange right */}
        <path d={describeArc(cx, cy, r, 31.5, 67.5)} fill="none" stroke={arcOrange} strokeWidth="30" />
        {/* Red right */}
        <path d={describeArc(cx, cy, r, 67.5, 90)} fill="none" stroke={arcRed} strokeWidth="30" />
        {/* Needle */}
        <g transform={`rotate(${angle} 80 80)`}>
          <rect x="78.5" y="20" width="4" height="70" rx="1.5" fill={needleColor} />
        </g>
        {/* Center circle */}
        <circle cx="80" cy="80" r="10" fill={needleColor} />
      </svg>
    </div>
  );
};

const Stock = ({ selectedDate }) => {
  const { selectedPharmacy } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stockData, setStockData] = useState({
    closingStock: 0,
    turnoverRatio: 0,
    daysOfInventory: 0,
    stockAdjustments: 0,
    costOfSales: 0,
    purchases: 0,
    stockValue: 0,
    stockMovement: 0,
    monthlyPurchases: 0,
    monthlyCostOfSales: 0,
    openingStock: 0, // Added openingStock
    avgDailyCostOfSales: 0, // Added avgDailyCostOfSales
    currentInventory: 0 // Added currentInventory
  });
  const [sparklineData, setSparklineData] = useState({
    stockValue: [],
    turnoverRatio: [],
    daysOfInventory: []
  });
  const [monthlyData, setMonthlyData] = useState({
    purchases: [],
    costOfSales: [],
    dates: []
  });
  const [yearlyInventory, setYearlyInventory] = useState({
    values: [],
    dates: []
  });
  
  // Daily Stock Data from Second Database
  const [dailyStockData, setDailyStockData] = useState({
    summary: {
      totalReceipts: 0,
      totalIssues: 0,
      totalAdjustments: 0,
      netMovement: 0
    },
    topMovingProducts: [],
    lowStockAlerts: [],
    lowGPProducts: [],
    topPerformingDepartments: [],
    departmentsHeatmap: [],
    movements: []
  });
  const [dailyStockLoading, setDailyStockLoading] = useState(false);
  const [dailyStockError, setDailyStockError] = useState(null);
  const [gpThreshold, setGpThreshold] = useState(20);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [departmentLowGPProducts, setDepartmentLowGPProducts] = useState([]);
  const [departmentProductsLoading, setDepartmentProductsLoading] = useState(false);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-ZA').format(num);
  };

  // Handle department bar click
  const handleDepartmentClick = async (event, elements) => {
    if (elements.length > 0) {
      const elementIndex = elements[0].index;
      const departmentData = dailyStockData.departmentsHeatmap[elementIndex];
      
      console.log('🔍 Department clicked:', departmentData);
      console.log('📊 All departments data:', dailyStockData.departmentsHeatmap);
      
      if (departmentData) {
        setSelectedDepartment(departmentData);
        setDepartmentProductsLoading(true);
        
        const apiParams = {
          pharmacy: selectedPharmacy,
          date: formatDateLocal(selectedDate),
          departmentCode: departmentData.departmentCode,
          threshold: 25
        };
        
        console.log('🚀 Making API call with params:', apiParams);
        
        try {
          const products = await dailyStockAPI.getLowGPProductsByDepartment(
            selectedPharmacy,
            formatDateLocal(selectedDate),
            departmentData.departmentCode,
            25 // Fixed threshold of 25% for this view
          );
          console.log('✅ API response received:', products);
          setDepartmentLowGPProducts(products);
        } catch (error) {
          console.error('❌ Error fetching department products:', error);
          setDepartmentLowGPProducts([]);
        } finally {
          setDepartmentProductsLoading(false);
        }
      }
    }
  };

  const calculatePercentageChange = (current, previous) => {
    if (!previous || previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  };

  const getChangeIndicator = (current, previous) => {
    const percentageChange = calculatePercentageChange(current, previous);
    const isIncrease = percentageChange > 0;
    const isDecrease = percentageChange < 0;
    
    if (isIncrease) {
      return {
        arrow: '↗',
        color: 'text-status-success',
        text: `+${percentageChange.toFixed(1)}%`
      };
    }
    
    if (isDecrease) {
      return {
        arrow: '↘',
        color: 'text-status-error',
        text: `${percentageChange.toFixed(1)}%`
      };
    } else {
      return {
        arrow: '→',
        color: 'text-text-secondary',
        text: '0%'
      };
    }
  };

  const getTrendIndicator = (currentValue, previousValue) => {
    const percentChange = calculatePercentageChange(currentValue, previousValue);
    if (percentChange > 0) {
      return <TrendingUp className="w-4 h-4 text-status-success" />;
    } else if (percentChange < 0) {
      return <TrendingDown className="w-4 h-4 text-status-error" />;
    }
    return null;
  };

  const getAlerts = (data) => {
    const alerts = [];

    const stockVariancePercent = calculatePercentageChange(data.stockValue, data.openingStock);
    const absStockVariancePercent = Math.abs(stockVariancePercent);

    if (absStockVariancePercent <= 7) {
      alerts.push({
        title: 'Stable Stock Performance',
        description: `Stock value change is stable at ${stockVariancePercent.toFixed(1)}%.`,
        severity: 'success',
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

    // Use the frontend-calculated days of inventory
    const daysOfInventory = calculatedDaysOfInventory;
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
        severity: 'success',
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

    return alerts;
  };

  const fetchStockData = async (dateObj) => {
    setLoading(true);
    setError(null);
    try {
      const date = formatDateLocal(new Date(Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate())));
      
      // Calculate beginning of month date
      const beginningOfMonth = new Date(Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), 1));
      const beginningOfMonthDate = formatDateLocal(beginningOfMonth);
      
      // Calculate month-to-date range for purchases and cost of sales
      const startOfMonth = formatDateLocal(beginningOfMonth);
      const endOfCurrentDate = formatDateLocal(dateObj);
      
      // Calculate last 30 days range
      const last30Start = new Date(dateObj);
      last30Start.setDate(last30Start.getDate() - 29); // 30 days including today
      const last30StartDate = formatDateLocal(last30Start);
      const last30EndDate = formatDateLocal(dateObj);
      
      // Fetch all stock-related data in parallel
      const [
        closingStockData,
        turnoverRatioData,
        daysOfInventoryData,
        stockAdjustmentsData,
        costsData,
        // Monthly purchases and cost of sales
        monthlyPurchasesData,
        monthlyCostOfSalesData,
        openingStockData, // Added openingStockData
        last30CostOfSalesData // Added for last 30 days
      ] = await Promise.all([
        stockAPI.getClosingStockForRange(selectedPharmacy, date, date).catch(() => ({ closing_stock: 0 })),
        stockAPI.getTurnoverRatioForRange(selectedPharmacy, date, date).catch(() => ({ turnover_ratio: 0 })),
        stockAPI.getDaysOfInventoryForRange(selectedPharmacy, date, date).catch(() => ({ days_of_inventory: 0 })),
        stockAPI.getStockAdjustmentsForRange(selectedPharmacy, date, date).catch(() => ({ stock_adjustments: 0 })),
        financialAPI.getCostsForRange(selectedPharmacy, date, date).catch(() => ({ cost_of_sales: 0, purchases: 0 })),
        // Monthly purchases and cost of sales
        financialAPI.getCostsForRange(selectedPharmacy, startOfMonth, endOfCurrentDate).catch(() => ({ purchases: 0 })),
        financialAPI.getCostsForRange(selectedPharmacy, startOfMonth, endOfCurrentDate).catch(() => ({ cost_of_sales: 0 })),
        stockAPI.getOpeningStockForRange(selectedPharmacy, date, date).catch(() => ({ opening_stock: 0 })), // Added openingStockData
        financialAPI.getDailyCostOfSalesForRange(selectedPharmacy, last30StartDate, last30EndDate).catch(() => ({ daily_cost_of_sales: [] })) // Added for last 30 days
      ]);

      // Calculate avg daily cost of sales for last 30 days
      let avgDailyCostOfSales = 0;
      if (last30CostOfSalesData && Array.isArray(last30CostOfSalesData.daily_cost_of_sales)) {
        const sum = last30CostOfSalesData.daily_cost_of_sales.reduce((acc, d) => acc + (d.cost_of_sales || 0), 0);
        avgDailyCostOfSales = sum / 30;
        console.log('Last 30 days cost of sales:', last30CostOfSalesData.daily_cost_of_sales);
        console.log('Sum of last 30 days cost of sales:', sum);
        console.log('Avg daily cost of sales (last 30 days):', avgDailyCostOfSales);
      }

      console.log('Closing Stock Data:', closingStockData);
      console.log('Selected Date:', dateObj);
      console.log('Opening Stock Data:', openingStockData);
      console.log('Days of Inventory Data:', daysOfInventoryData);
      console.log('Avg Daily Cost of Sales (raw):', daysOfInventoryData.avg_daily_cost_of_sales, '| Used value:', avgDailyCostOfSales);

      const currentStock = {
        closingStock: closingStockData.closing_stock || 0,
        turnoverRatio: turnoverRatioData.turnover_ratio || 0,
        daysOfInventory: daysOfInventoryData.days_of_inventory || 0,
        stockAdjustments: stockAdjustmentsData.stock_adjustments || 0,
        costOfSales: costsData.cost_of_sales || 0,
        purchases: costsData.purchases || 0,
        stockValue: closingStockData.closing_stock || 0,
        stockMovement: (closingStockData.closing_stock || 0) - (openingStockData.opening_stock || 0), // Calculate movement as closing - opening
        monthlyPurchases: monthlyPurchasesData.purchases || 0,
        monthlyCostOfSales: monthlyCostOfSalesData.cost_of_sales || 0,
        openingStock: openingStockData.opening_stock || 0, // Added openingStock
        avgDailyCostOfSales: avgDailyCostOfSales, // Now always use last 30 days
        currentInventory: daysOfInventoryData.current_inventory || 0 // Added currentInventory
      };

      setStockData(currentStock);
      
    } catch (err) {
      console.error('❌ Error in fetchStockData:', err);
      setError(err.response?.data?.message || 'Failed to fetch stock data');
    } finally {
      setLoading(false);
    }
  };

  const fetchMonthlyChartData = async (dateObj) => {
    try {
      console.log('Fetching 30-day chart data for:', dateObj);
      
      // Calculate the start date (30 days before the selected date)
      const startDate = new Date(dateObj);
      startDate.setDate(startDate.getDate() - 29); // 30 days including the selected date
      
      const startDateStr = formatDateLocal(startDate);
      const endDateStr = formatDateLocal(dateObj);
      
      console.log('Date range:', { startDate: startDateStr, endDate: endDateStr });
      
      const [purchasesData, costOfSalesData] = await Promise.all([
        financialAPI.getDailyPurchasesForRange(selectedPharmacy, startDateStr, endDateStr),
        financialAPI.getDailyCostOfSalesForRange(selectedPharmacy, startDateStr, endDateStr)
      ]);
      
      console.log('API responses:', {
        purchasesData,
        costOfSalesData
      });
      
      const dates = [];
      const purchases = [];
      const costOfSales = [];
      
      // Generate data for each day in the 30-day range
      for (let i = 0; i < 30; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        const dateStr = formatDateLocal(date);
        
        // Format date for display (day/month)
        const displayDate = `${date.getDate()}/${date.getMonth() + 1}`;
        dates.push(displayDate);
        
        const purchaseAmount = purchasesData.daily_purchases?.find(d => d.date === dateStr)?.purchases || 0;
        const cosAmount = costOfSalesData.daily_cost_of_sales?.find(d => d.date === dateStr)?.cost_of_sales || 0;
        
        purchases.push(purchaseAmount);
        costOfSales.push(cosAmount);
      }
      
      console.log('Processed 30-day data:', { dates, purchases, costOfSales });
      setMonthlyData({ dates, purchases, costOfSales });
    } catch (err) {
      console.error('Error fetching 30-day chart data:', err);
    }
  };

  const fetchYearlyInventoryData = async (dateObj) => {
    try {
      console.log('Fetching yearly inventory data:', dateObj);
      const dates = [];
      const values = [];
      
      // Get data for last 12 months
      for (let i = 11; i >= 0; i--) {
        // Get the last day of the month
        let lastDayOfMonth = new Date(dateObj.getFullYear(), dateObj.getMonth() - i + 1, 0);
        let day = lastDayOfMonth.getDate();
        let month = lastDayOfMonth.getMonth();
        let year = lastDayOfMonth.getFullYear();
        let foundValue = 0;
        let foundDate = null;
        
        // Try each preceding day until we find a non-zero closing stock or reach the 1st
        while (day > 0) {
          const checkDate = new Date(Date.UTC(year, month, day));
          const targetDate = formatDateLocal(checkDate);
          const stockData = await stockAPI.getClosingStockForRange(selectedPharmacy, targetDate, targetDate);
          if (stockData?.closing_stock && stockData.closing_stock > 0) {
            foundValue = stockData.closing_stock;
            foundDate = targetDate;
            break;
          }
          day--;
        }
        
        dates.push(lastDayOfMonth.toLocaleString('default', { month: 'short' }));
        values.push(foundValue);
        
        console.log(`${lastDayOfMonth.toLocaleString('default', { month: 'long' })} closing value (from ${foundDate || 'no data'}):`, foundValue);
      }
      
      console.log('Processed yearly data:', { dates, values });
      setYearlyInventory({ dates, values });
    } catch (err) {
      console.error('Error fetching yearly inventory data:', err);
    }
  };

  const fetchDailyStockData = async (dateObj) => {
    setDailyStockLoading(true);
    setDailyStockError(null);
    
    try {
      const date = formatDateLocal(dateObj);
      console.log('Fetching daily stock data for:', date);
      
      // Fetch data from the second database in parallel
      const [
        summaryData,
        topMovingData,
        lowStockData,
        lowGPData,
        topDepartmentsData,
        heatmapData,
        movementsData
      ] = await Promise.all([
        dailyStockAPI.getDailyStockSummary(selectedPharmacy, date).catch(err => {
          console.warn('Daily stock summary not available:', err.message);
          return { totalReceipts: 0, totalIssues: 0, totalAdjustments: 0, netMovement: 0 };
        }),
        dailyStockAPI.getTopMovingProducts(selectedPharmacy, date, 5).catch(err => {
          console.warn('Top moving products not available:', err.message);
          return { products: [] };
        }),
        dailyStockAPI.getLowStockAlerts(selectedPharmacy, date).catch(err => {
          console.warn('Low stock alerts not available:', err.message);
          return { alerts: [] };
        }),
        dailyStockAPI.getLowGPProducts(selectedPharmacy, date, gpThreshold).catch(err => {
          console.warn('Low GP products not available:', err.message);
          return [];
        }),
        dailyStockAPI.getTopPerformingDepartments(selectedPharmacy, date, 5).catch(err => {
          console.warn('Top performing departments not available:', err.message);
          return { departments: [] };
        }),
        dailyStockAPI.getDepartmentsHeatmapData(selectedPharmacy, date).catch(err => {
          console.warn('Departments heatmap data not available:', err.message);
          return { departments: [] };
        }),
        dailyStockAPI.getDailyStockMovements(selectedPharmacy, date, date).catch(err => {
          console.warn('Daily stock movements not available:', err.message);
          return { movements: [] };
        })
      ]);
      
      setDailyStockData({
        summary: summaryData,
        topMovingProducts: topMovingData.products || [],
        lowStockAlerts: lowStockData.alerts || [],
        lowGPProducts: lowGPData || [],
        topPerformingDepartments: topDepartmentsData.departments || [],
        departmentsHeatmap: heatmapData.departments || [],
        movements: movementsData.movements || []
      });
      
      console.log('Daily stock data loaded:', {
        summary: summaryData,
        topMovingCount: topMovingData.products?.length || 0,
        lowStockCount: lowStockData.alerts?.length || 0,
        lowGPCount: lowGPData?.length || 0,
        topDepartmentsCount: topDepartmentsData.departments?.length || 0,
        heatmapCount: heatmapData.departments?.length || 0,
        movementsCount: movementsData.movements?.length || 0
      });
      
    } catch (err) {
      console.error('Error fetching daily stock data:', err);
      setDailyStockError(err.response?.data?.message || 'Failed to fetch daily stock data');
    } finally {
      setDailyStockLoading(false);
    }
  };

  useEffect(() => {
    if (selectedDate && selectedPharmacy) {
      fetchStockData(selectedDate);
      fetchMonthlyChartData(selectedDate);
      fetchYearlyInventoryData(selectedDate);
      fetchDailyStockData(selectedDate);
    }
  }, [selectedDate, selectedPharmacy, gpThreshold]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary mx-auto mb-4"></div>
            <p className="text-text-secondary">Loading stock data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-status-error mx-auto mb-4" />
            <p className="text-status-error mb-4">Error loading data: {error}</p>
            <button onClick={() => fetchStockData(selectedDate)} className="btn-primary">
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const stockValueChange = calculatePercentageChange(stockData.stockValue, stockData.openingStock);
  let arrow = '–', color = 'text-text-secondary';
  if (stockValueChange > 0) { arrow = '▲'; color = 'text-status-success'; }
  else if (stockValueChange < 0) { arrow = '▼'; color = 'text-status-error'; }

  // Calculate days of inventory in the frontend for display
  const calculatedDaysOfInventory = stockData.avgDailyCostOfSales > 0
    ? stockData.currentInventory / stockData.avgDailyCostOfSales
    : 0;

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="mb-4">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
        <h1 className="text-3xl font-bold text-text-primary leading-tight mb-1">
          Stock Management
        </h1>
        <p className="text-xs text-text-secondary mb-3">
          {selectedDate?.toLocaleDateString('en-ZA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
          </div>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-4">
        <div className="card sm:p-4 p-3">
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-text-secondary text-xs sm:text-sm font-medium">Stock Value</p>
                <p className="text-xl sm:text-3xl font-bold text-accent-primary">
                  {formatCurrency(stockData.stockValue)}
                </p>
              </div>
              <div className="w-8 h-8 sm:w-12 sm:h-12 bg-accent-primary rounded-lg flex items-center justify-center">
                <Package className="text-surface-secondary w-4 h-4 sm:w-6 sm:h-6" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text-secondary text-xs sm:text-sm">vs Beginning of Month:</p>
                <p className="text-text-secondary text-xs sm:text-sm">{formatCurrency(stockData.openingStock)}</p>
              </div>
              <div className="flex items-center gap-1 sm:gap-2">
                {getTrendIndicator(stockData.stockValue, stockData.openingStock)}
                {(() => {
                  const indicator = getChangeIndicator(stockData.stockValue, stockData.openingStock);
                  return (
                    <span className={`text-xs sm:text-sm font-medium ${indicator.color}`}>
                      {indicator.text}
                    </span>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>

        <div className="card sm:p-4 p-3">
          <div className="flex flex-col h-full">
            <div className="flex items-start justify-between mb-2">
              <div className="flex flex-col gap-2">
                <div>
                  <p className="text-text-secondary text-xs sm:text-sm font-medium">Monthly Purchases</p>
                  <p className="text-lg sm:text-2xl font-bold text-chart-gold">
                    {formatCurrency(stockData.monthlyPurchases)}
                  </p>
                </div>
            <div>
                  <p className="text-text-secondary text-xs sm:text-sm font-medium">Cost of Sales</p>
                  <p className="text-lg sm:text-2xl font-bold text-chart-gold">
                    {formatCurrency(stockData.monthlyCostOfSales)}
              </p>
            </div>
              </div>
              <div className="w-8 h-8 sm:w-12 sm:h-12 bg-chart-gold rounded-lg flex items-center justify-center">
                <BarChart3 className="text-surface-secondary w-4 h-4 sm:w-6 sm:h-6" />
              </div>
            </div>
          </div>
        </div>

        <div className="card sm:p-4 p-3">
          <div className="flex flex-col h-full">
            <div className="flex items-start justify-between mb-2">
              <div className="flex flex-col gap-2">
            <div>
                  <p className="text-text-secondary text-xs sm:text-sm font-medium">Days of Inventory</p>
                  <p className="text-lg sm:text-3xl font-bold text-cost-sales">
                    {formatNumber(calculatedDaysOfInventory.toFixed(1))}
              </p>
            </div>
            <p className="text-text-secondary text-xs sm:text-sm">Avg Daily CoS: {formatCurrency(stockData.avgDailyCostOfSales)}</p>
            <p className="text-text-secondary text-xs sm:text-sm">Current Inventory: {formatCurrency(stockData.currentInventory)}</p>
              </div>
              <div className="w-8 h-8 sm:w-12 sm:h-12 bg-cost-sales rounded-lg flex items-center justify-center">
                <Calendar className="text-surface-secondary w-4 h-4 sm:w-6 sm:h-6" />
              </div>
            </div>
          </div>
        </div>

        <div className="card sm:p-4 p-3">
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between mb-2">
              <div className="flex flex-col items-center w-full">
                <p className="text-text-secondary text-xs sm:text-sm font-medium mb-2">Stock Movement</p>
                {/* Gauge replaces value */}
                <div className="flex justify-center w-full">
                  <StockMovementGauge value={calculatePercentageChange(stockData.stockValue, stockData.openingStock)} />
                </div>
              </div>
            </div>
            <div className="flex flex-col items-center justify-center mt-2">
              {/* Percentage label removed as requested */}
            </div>
          </div>
        </div>
      </div>

      {/* Insights & Alerts Section */}
      <div className="mb-4">
          <div className="card">
          <h2 className="text-xl font-semibold text-text-primary mb-4">Insights & Alerts</h2>
          <div className="max-h-[300px] overflow-y-auto">
            {(() => {
              try {
                const alerts = getAlerts(stockData);
                
                if (!alerts || alerts.length === 0) {
                  return (
                    <div className="flex items-center justify-center h-32">
                      <p className="text-text-secondary text-sm">No alerts to display</p>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {alerts.map((alert, index) => {
                      const IconComponent = alert.icon;
                      return (
                        <div 
                          key={index} 
                          className={`p-3 rounded-lg ${
                            alert.severity === 'critical' 
                              ? 'bg-status-error bg-opacity-10' 
                              : alert.severity === 'warning'
                              ? 'bg-status-warning bg-opacity-10'
                              : 'bg-status-success bg-opacity-10'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              alert.severity === 'critical' 
                                ? 'bg-status-error' 
                                : alert.severity === 'warning'
                                ? 'bg-status-warning'
                                : 'bg-status-success'
                            }`}>
                              <IconComponent className="text-surface-secondary w-4 h-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className={`text-sm font-medium ${
                                alert.severity === 'critical' 
                                  ? 'text-status-error' 
                                  : alert.severity === 'warning'
                                  ? 'text-status-warning'
                                  : 'text-status-success'
                              }`}>
                                {alert.title}
                              </h4>
                              <p className="text-sm text-text-secondary mt-0.5 break-words">
                                {alert.description}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              } catch (error) {
                console.error('Error rendering alerts:', error);
                return (
                  <div className="flex items-center justify-center h-32">
                    <p className="text-text-secondary text-sm">Error displaying alerts</p>
                  </div>
                );
              }
            })()}
            </div>
          </div>
        </div>

      {/* Daily Stock Information Section (from Second Database) */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-text-primary">Daily Stock Activity</h2>
          <p className="text-xs text-text-secondary">
            Data from inventory management system
          </p>
        </div>
        
        {dailyStockLoading ? (
          <div className="card">
            <div className="flex items-center justify-center h-32">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-primary mx-auto mb-2"></div>
                <p className="text-text-secondary text-sm">Loading daily stock data...</p>
              </div>
            </div>
          </div>
        ) : dailyStockError ? (
          <div className="card">
            <div className="flex items-center justify-center h-32">
              <div className="text-center">
                <AlertCircle className="h-8 w-8 text-status-warning mx-auto mb-2" />
                <p className="text-status-warning text-sm mb-2">Daily stock data unavailable</p>
                <p className="text-text-secondary text-xs">{dailyStockError}</p>
              </div>
            </div>
          </div>
        ) : (
          <>


            {/* Low Stock Alerts and Top Moving Products Side by Side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
              {/* Low Stock Alerts */}
              <div className="card">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-status-warning" />
                  <h3 className="text-sm font-semibold text-text-primary">Low Stock Alerts</h3>
                  <span className="bg-status-warning bg-opacity-20 text-status-warning text-xs px-2 py-1 rounded-full">
                    {dailyStockData.lowStockAlerts?.length || 0}
                  </span>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {dailyStockData.lowStockAlerts?.length > 0 ? (
                    dailyStockData.lowStockAlerts.map((alert, index) => (
                      <div key={index} className="flex items-center justify-between text-xs p-2 bg-surface-tertiary rounded">
                        <span className="font-medium truncate flex-1">{alert.productName || `Product ${index + 1}`}</span>
                        <span className="text-status-warning font-bold ml-2">
                          {alert.currentStock || 0} left
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-text-secondary text-xs">No low stock alerts</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Top Moving Products */}
              <div className="card">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-status-success" />
                  <h3 className="text-sm font-semibold text-text-primary">Top Moving Products Today</h3>
                </div>
                <div className="space-y-2 max-h-68 overflow-y-auto">
                  {dailyStockData.topMovingProducts?.length > 0 ? (
                    dailyStockData.topMovingProducts.slice(0, 8).map((product, index) => (
                      <div key={index} className="bg-surface-tertiary rounded-lg p-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-xs font-medium text-text-secondary flex-shrink-0">#{index + 1}.</span>
                            <span className="text-sm font-medium text-text-primary truncate">
                              {product.productName || `Product ${index + 1}`}
                            </span>
                          </div>
                          <span className="text-xs text-status-success font-bold flex-shrink-0 ml-2">
                            {product.quantityMoved || 0} units
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-text-secondary text-xs">No top moving products</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Low GP Products and Second Card Side by Side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
              {/* Low GP Products */}
              <div className="card">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-status-error" />
                    <h3 className="text-sm font-semibold text-text-primary">Low GP Products</h3>
                    <span className="bg-status-error bg-opacity-20 text-status-error text-xs px-2 py-1 rounded-full">
                      {dailyStockData.lowGPProducts?.length || 0}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-text-secondary">Below:</span>
                    <div className="flex items-center gap-2">
                      <select
                        value={gpThreshold}
                        onChange={(e) => setGpThreshold(Number(e.target.value))}
                        className="text-xs font-medium text-status-error bg-surface-tertiary border border-surface-tertiary rounded px-2 py-1 focus:outline-none focus:border-status-error cursor-pointer"
                      >
                        {Array.from({ length: 16 }, (_, i) => i + 15).map(value => (
                          <option key={value} value={value}>
                            {value}%
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {dailyStockData.lowGPProducts?.length > 0 ? (
                    dailyStockData.lowGPProducts.map((product, index) => (
                      <div key={index} className="bg-surface-tertiary rounded-lg p-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-xs font-medium text-text-secondary flex-shrink-0">#{index + 1}.</span>
                            <span className="text-sm font-medium text-text-primary truncate">
                              {product.productName || `Product ${index + 1}`}
                            </span>
                          </div>
                          <span className="text-xs text-status-error font-bold flex-shrink-0 ml-2">
                            {product.grossProfitPercent?.toFixed(1)}% GP
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-text-secondary text-xs">No low GP products</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Top Performing Departments */}
              <div className="card">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 className="w-4 h-4 text-status-success" />
                  <h3 className="text-sm font-semibold text-text-primary">Top Performing Departments</h3>
                  <span className="bg-status-success bg-opacity-20 text-status-success text-xs px-2 py-1 rounded-full">
                    {dailyStockData.topPerformingDepartments?.length || 0}
                  </span>
                </div>
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {dailyStockData.topPerformingDepartments?.length > 0 ? (
                    dailyStockData.topPerformingDepartments.map((dept, index) => (
                      <div key={index} className="bg-surface-tertiary rounded-lg p-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-xs font-medium text-text-secondary flex-shrink-0">#{index + 1}.</span>
                            <span className="text-sm font-medium text-text-primary truncate">
                              {dept.departmentName || `Department ${index + 1}`}
                            </span>
                          </div>
                          <div className="flex flex-col items-end text-xs">
                            <span className="text-status-success font-bold">
                              {formatCurrency(dept.totalTurnover)}
                            </span>
                            <span className="text-text-secondary">
                              {dept.productsSold} items
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-text-secondary text-xs">No department data available</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Department Performance Chart */}
      <div className="mb-4">
        {/* Department GP% Bar Chart */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-lg font-semibold text-text-primary">Top 20 Departments - GP%</h3>
          </div>
          {dailyStockLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-primary mx-auto mb-2"></div>
                <p className="text-text-secondary text-sm">Loading chart data...</p>
              </div>
            </div>
          ) : dailyStockData.departmentsHeatmap?.length > 0 ? (
            <div className="h-64">
              <Bar
                data={{
                  labels: dailyStockData.departmentsHeatmap.slice(0, 20).map(dept => dept.departmentCode),
                  datasets: [{
                    label: 'GP%',
                    data: dailyStockData.departmentsHeatmap.slice(0, 20).map(dept => {
                      const gpPercent = dept.totalTurnover > 0 ? (dept.totalGrossProfit / dept.totalTurnover) * 100 : 0;
                      return Math.round(gpPercent * 10) / 10; // Round to 1 decimal
                    }),
                    backgroundColor: dailyStockData.departmentsHeatmap.slice(0, 20).map(dept => {
                      const gpPercent = dept.totalTurnover > 0 ? (dept.totalGrossProfit / dept.totalTurnover) * 100 : 0;
                      if (gpPercent < 20) return '#dd524c'; // Red
                      if (gpPercent < 26) return '#e9a23b'; // Amber
                      if (gpPercent < 35) return '#5ec26a'; // Green
                      return '#845eee'; // Purple
                    }),
                    borderColor: '#1F2937',
                    borderWidth: 0,
                    borderRadius: 4,
                    borderSkipped: false
                  }]
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  onClick: handleDepartmentClick,
                  onHover: (event, activeElements) => {
                    event.native.target.style.cursor = activeElements.length > 0 ? 'pointer' : 'default';
                  },
                  layout: {
                    padding: {
                      top: 20,
                      bottom: 10,
                      left: 10,
                      right: 20
                    }
                  },
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      backgroundColor: '#1F2937',
                      titleColor: '#F9FAFB',
                      bodyColor: '#E5E7EB',
                      borderColor: '#374151',
                      borderWidth: 1,
                      cornerRadius: 8,
                      padding: 12,
                      titleFont: {
                        size: 14,
                        weight: '600'
                      },
                      bodyFont: {
                        size: 13
                      },
                      callbacks: {
                        title: (context) => {
                          const index = context[0].dataIndex;
                          return dailyStockData.departmentsHeatmap[index]?.departmentName || context[0].label;
                        },
                        label: (context) => {
                          const index = context.dataIndex;
                          const dept = dailyStockData.departmentsHeatmap[index];
                          return [
                            `GP%: ${context.raw}%`,
                            `Turnover: ${formatCurrency(dept.totalTurnover)}`,
                            `Gross Profit: ${formatCurrency(dept.totalGrossProfit)}`
                          ];
                        }
                      }
                    }
                  },
                                    scales: {
                    x: {
                      ticks: { 
                        color: '#E5E7EB',
                        font: { 
                          size: 12,
                          family: 'Inter, system-ui, sans-serif',
                          weight: '500'
                        }
                      },
                      grid: {
                        display: false
                      },
                      border: {
                        display: false
                      }
                    },
                    y: {
                      beginAtZero: true,
                      max: 50,
                      ticks: { 
                        color: '#E5E7EB',
                        font: { 
                          size: 12,
                          family: 'Inter, system-ui, sans-serif',
                          weight: '500'
                        },
                        callback: (value) => `${value}%`
                      },
                      grid: {
                        display: false
                      },
                      border: {
                        display: false
                      },
                      title: {
                        display: true,
                        text: 'Gross Profit %',
                        color: '#E5E7EB',
                        font: {
                          size: 14,
                          family: 'Inter, system-ui, sans-serif',
                          weight: '600'
                        },
                        padding: 10
                      }
                    }
                  }
                }}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <DollarSign className="h-8 w-8 text-text-secondary mx-auto mb-2" />
                <p className="text-text-secondary text-sm">No department data available</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Department Low GP Products Section */}
      {selectedDepartment && (
        <div className="mb-4">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-text-primary">
                  Low GP Products in {selectedDepartment.departmentName}
                </h3>
                <span className="bg-status-error bg-opacity-20 text-status-error text-xs px-2 py-1 rounded-full">
                  Below 25% GP
                </span>
              </div>
              <button
                onClick={() => {
                  setSelectedDepartment(null);
                  setDepartmentLowGPProducts([]);
                }}
                className="text-text-secondary hover:text-text-primary text-xs"
              >
                ✕ Close
              </button>
            </div>
            
            {departmentProductsLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-primary mx-auto mb-2"></div>
                  <p className="text-text-secondary text-sm">Loading products...</p>
                </div>
              </div>
            ) : departmentLowGPProducts.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {departmentLowGPProducts.map((product, index) => (
                  <div key={index} className="bg-surface-tertiary rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-text-secondary flex-shrink-0">
                            #{index + 1}.
                          </span>
                          <span className="text-sm font-medium text-text-primary truncate">
                            {product.productName}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-text-secondary">
                          <span>Code: {product.stockCode}</span>
                          <span>Qty Sold: {product.quantitySold}</span>
                          <span>Sales: {formatCurrency(product.salesValue)}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end text-xs ml-4">
                        <span className="text-status-error font-bold text-sm">
                          {product.grossProfitPercent.toFixed(1)}% GP
                        </span>
                        <span className="text-text-secondary">
                          {formatCurrency(product.grossProfit)} profit
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-center">
                  <DollarSign className="h-8 w-8 text-text-secondary mx-auto mb-2" />
                  <p className="text-text-secondary text-sm">No products with GP below 25% found</p>
                  <p className="text-text-secondary text-xs mt-1">
                    All products in this department have healthy profit margins
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Smart Alerts Panel */}
      <div className="mb-4">
        <SmartAlertsPanel 
          selectedDate={selectedDate} 
          formatCurrency={formatCurrency}
          formatDateLocal={formatDateLocal}
        />
      </div>

    </div>
  );
};

export default Stock;