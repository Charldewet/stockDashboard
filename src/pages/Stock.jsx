import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Package, AlertTriangle, DollarSign, BarChart3, Calendar, AlertCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { stockAPI, financialAPI } from '../services/api'
import { formatDateLocal } from '../utils/dateUtils.js'
import { Line, Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
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

  useEffect(() => {
    if (selectedDate && selectedPharmacy) {
      fetchStockData(selectedDate);
      fetchMonthlyChartData(selectedDate);
      fetchYearlyInventoryData(selectedDate);
    }
  }, [selectedDate, selectedPharmacy]);

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

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="card">
          <h2 className="text-xl font-semibold text-text-primary mb-4">12 Month Inventory Trend</h2>
          <div className="h-[200px]">
            {yearlyInventory.dates.length > 0 ? (
              <Bar
                data={{
                  labels: yearlyInventory.dates,
                  datasets: [
                    {
                      label: 'Inventory Value',
                      data: yearlyInventory.values,
                      backgroundColor: '#FF4500',
                      borderRadius: 6
                    }
                  ]
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  interaction: {
                    intersect: false,
                    mode: 'index'
                  },
                  plugins: {
                    legend: {
                      display: false
                    },
                    tooltip: {
                      backgroundColor: 'rgba(0, 0, 0, 0.8)',
                      titleColor: '#fff',
                      bodyColor: '#fff',
                      padding: 12,
                      displayColors: false,
                      callbacks: {
                        label: function(context) {
                          return `Inventory: ${formatCurrency(context.parsed.y)}`;
                        }
                      }
                    }
                  },
                  scales: {
                    x: {
                      grid: {
                        display: false
                      },
                      ticks: {
                        color: '#9CA3AF',
                        font: {
                          size: 11,
                          weight: 'bold'
                        },
                        maxRotation: 45
                      }
                    },
                    y: {
                      grid: {
                        display: false
                      },
                      ticks: {
                        color: '#9CA3AF',
                        callback: function(value) {
                          if (value >= 1000000) {
                            return `R${(value / 1000000).toFixed(1)}M`;
                          } else if (value >= 1000) {
                            return `R${(value / 1000).toFixed(0)}k`;
                          }
                          return `R${value}`;
                        }
                      }
                    }
                  }
                }}
              />
            ) : (
              <div className="h-full flex items-center justify-center">
                <p className="text-text-secondary">Loading inventory data...</p>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <h2 className="text-xl font-semibold text-text-primary mb-4">30-Day Purchases vs Cost of Sales</h2>
          <div className="h-[200px]">
            {monthlyData.dates.length > 0 ? (
              <Line
                data={{
                  labels: monthlyData.dates,
                  datasets: [
                    {
                      label: 'Purchases',
                      data: monthlyData.purchases,
                      borderColor: '#E24313',
                      backgroundColor: function(context) {
                        const chart = context.chart;
                        const {ctx, chartArea} = chart;
                        if (!chartArea) {
                          return 'rgba(226, 67, 19, 0.1)';
                        }
                        const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                        gradient.addColorStop(0, 'rgba(226, 67, 19, 0.2)');
                        gradient.addColorStop(1, 'rgba(226, 67, 19, 0)');
                        return gradient;
                      },
                      borderWidth: 3,
                      fill: true,
                      tension: 0.4,
                      pointBackgroundColor: '#E24313',
                      pointBorderColor: '#fff',
                      pointBorderWidth: 0,
                      pointRadius: 0,
                      pointHoverRadius: 0
                    },
                    {
                      label: 'Cost of Sales',
                      data: monthlyData.costOfSales,
                      borderColor: '#7ED957',
                      backgroundColor: function(context) {
                        const chart = context.chart;
                        const {ctx, chartArea} = chart;
                        if (!chartArea) {
                          return 'rgba(126, 217, 87, 0.1)';
                        }
                        const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                        gradient.addColorStop(0, 'rgba(126, 217, 87, 0.2)');
                        gradient.addColorStop(1, 'rgba(126, 217, 87, 0)');
                        return gradient;
                      },
                      borderWidth: 3,
                      fill: true,
                      tension: 0.4,
                      pointBackgroundColor: '#7ED957',
                      pointBorderColor: '#fff',
                      pointBorderWidth: 0,
                      pointRadius: 0,
                      pointHoverRadius: 0
                    }
                  ]
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      display: true,
                      position: 'top',
                      labels: {
                        color: '#9CA3AF',
                        usePointStyle: true,
                        pointStyle: 'circle',
                        padding: 5,
                        boxWidth: 8,
                        boxHeight: 8,
                        useBorderRadius: true,
                        borderRadius: 0
                      }
                    },
                    tooltip: {
                      backgroundColor: 'rgba(0, 0, 0, 0.8)',
                      titleColor: '#fff',
                      bodyColor: '#fff',
                      borderWidth: 0,
                      displayColors: true,
                      callbacks: {
                        label: function(context) {
                          const value = context.parsed.y;
                          let valueStr = '';
                          if (value >= 1000000) {
                            valueStr = `R ${(value / 1000000).toFixed(2)}M`;
                          } else if (value >= 1000) {
                            valueStr = `R ${(value / 1000).toFixed(0)}k`;
                          } else {
                            valueStr = `R ${value.toLocaleString('en-ZA')}`;
                          }
                          return `${context.dataset.label}: ${valueStr}`;
                        }
                      }
                    }
                  },
                  scales: {
                    x: {
                      grid: {
                        display: false,
                        color: 'rgba(156, 163, 175, 0.1)'
                      },
                      ticks: {
                        color: '#9CA3AF',
                        maxRotation: 45,
                        font: {
                          size: 11,
                          weight: 'bold'
                        },
                        padding: 8
                      }
                    },
                    y: {
                      grid: {
                        display: false
                      },
                      min: 0,
                      ticks: {
                        color: '#9CA3AF',
                        callback: function(value) {
                          if (value >= 1000000) {
                            return `R${(value / 1000000).toFixed(1)}M`;
                          } else if (value >= 1000) {
                            return `R${(value / 1000).toFixed(0)}k`;
                          }
                          return `R${value}`;
                        }
                      }
                    }
                  },
                  interaction: {
                    intersect: false,
                    mode: 'index'
                  },
                  elements: {
                    point: {
                      radius: 0,
                      hoverRadius: 0
                    }
                  }
                }}
              />
            ) : (
              <div className="h-full flex items-center justify-center">
                <p className="text-text-secondary">Loading purchase data...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Stock;