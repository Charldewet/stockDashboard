import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Package, AlertTriangle, DollarSign, BarChart3, Calendar, AlertCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { stockAPI, financialAPI } from '../services/api'
import { formatDateLocal } from '../utils/dateUtils.js'

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

const Stock = ({ selectedDate }) => {
  const { selectedPharmacy } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stockData, setStockData] = useState({
    openingStock: 0,
    closingStock: 0,
    turnoverRatio: 0,
    daysOfInventory: 0,
    stockAdjustments: 0,
    costOfSales: 0,
    purchases: 0,
    stockValue: 0,
    stockMovement: 0,
    monthlyPurchases: 0,
    monthlyCostOfSales: 0
  });
  const [beginningOfMonthStock, setBeginningOfMonthStock] = useState({
    openingStock: 0,
    closingStock: 0,
    turnoverRatio: 0,
    daysOfInventory: 0
  });
  const [sparklineData, setSparklineData] = useState({
    stockValue: [],
    turnoverRatio: [],
    daysOfInventory: []
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

  const getChangeIndicator = (current, previous, isStockValue = false) => {
    const percentageChange = calculatePercentageChange(current, previous);
    const isIncrease = percentageChange > 0;
    const isDecrease = percentageChange < 0;
    
    if (isStockValue) {
      // For stock value, large increases (>15%) are concerning (overstock)
      if (isIncrease && Math.abs(percentageChange) > 15) {
        return {
          arrow: '↗',
          color: 'text-status-error',
          text: `+${percentageChange.toFixed(1)}%`
        };
      } else if (isIncrease) {
        return {
          arrow: '↗',
          color: 'text-status-success',
          text: `+${percentageChange.toFixed(1)}%`
        };
      }
    } else {
      // For other metrics, increases are generally good
      if (isIncrease) {
        return {
          arrow: '↗',
          color: 'text-status-success',
          text: `+${percentageChange.toFixed(1)}%`
        };
      }
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

  const getAlerts = (data, beginningOfMonthData) => {
    const alerts = [];

    const stockVariancePercent = calculatePercentageChange(data.stockValue, beginningOfMonthData.openingStock);
    const absStockVariancePercent = Math.abs(stockVariancePercent);

    if (absStockVariancePercent <= 5) {
      alerts.push({
        title: 'Stable Stock Performance',
        description: `Stock value change is stable at ${stockVariancePercent.toFixed(1)}%.`,
        severity: 'success',
        icon: TrendingUp
      });
    } else if (absStockVariancePercent > 5 && absStockVariancePercent <= 15) {
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

    const daysOfInventoryTarget = 45;

    if (data.daysOfInventory < 15) {
      alerts.push({
        title: 'Critically Low Days of Inventory',
        description: 'Days of inventory are critically low. Immediate action required to restock.',
        severity: 'critical',
        icon: AlertCircle
      });
    } else if (data.daysOfInventory >= 15 && data.daysOfInventory < 30) {
      alerts.push({
        title: 'Good Inventory Levels',
        description: 'Good inventory levels. Maintain current stock strategy.',
        severity: 'success',
        icon: TrendingUp
      });
    } else if (data.daysOfInventory >= 30 && data.daysOfInventory <= 45) {
      alerts.push({
        title: 'Slightly Elevated Stock Holding',
        description: 'Slightly elevated stock holding. Monitor inventory closely.',
        severity: 'warning',
        icon: AlertTriangle
      });
    } else if (data.daysOfInventory > 45) {
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
      const date = formatDateLocal(dateObj);
      
      // Calculate beginning of month date
      const beginningOfMonth = new Date(dateObj.getFullYear(), dateObj.getMonth(), 1);
      const beginningOfMonthDate = formatDateLocal(beginningOfMonth);
      
      // Calculate month-to-date range for purchases and cost of sales
      const startOfMonth = formatDateLocal(beginningOfMonth);
      const endOfCurrentDate = formatDateLocal(dateObj);
      
      // Fetch all stock-related data in parallel
      const [
        openingStockData,
        closingStockData,
        turnoverRatioData,
        daysOfInventoryData,
        stockAdjustmentsData,
        costsData,
        // Monthly purchases and cost of sales
        monthlyPurchasesData,
        monthlyCostOfSalesData,
        // Beginning of month data
        bomOpeningStockData,
        bomClosingStockData,
        bomTurnoverRatioData,
        bomDaysOfInventoryData
      ] = await Promise.all([
        stockAPI.getOpeningStockForRange(selectedPharmacy, date, date).catch(() => ({ opening_stock: 0 })),
        stockAPI.getClosingStockForRange(selectedPharmacy, date, date).catch(() => ({ closing_stock: 0 })),
        stockAPI.getTurnoverRatioForRange(selectedPharmacy, date, date).catch(() => ({ turnover_ratio: 0 })),
        stockAPI.getDaysOfInventoryForRange(selectedPharmacy, date, date).catch(() => ({ days_of_inventory: 0 })),
        stockAPI.getStockAdjustmentsForRange(selectedPharmacy, date, date).catch(() => ({ stock_adjustments: 0 })),
        financialAPI.getCostsForRange(selectedPharmacy, date, date).catch(() => ({ cost_of_sales: 0, purchases: 0 })),
        // Monthly purchases and cost of sales
        financialAPI.getCostsForRange(selectedPharmacy, startOfMonth, endOfCurrentDate).catch(() => ({ purchases: 0 })),
        financialAPI.getCostsForRange(selectedPharmacy, startOfMonth, endOfCurrentDate).catch(() => ({ cost_of_sales: 0 })),
        // Beginning of month
        stockAPI.getOpeningStockForRange(selectedPharmacy, beginningOfMonthDate, beginningOfMonthDate).catch(() => ({ opening_stock: 0 })),
        stockAPI.getClosingStockForRange(selectedPharmacy, beginningOfMonthDate, beginningOfMonthDate).catch(() => ({ closing_stock: 0 })),
        stockAPI.getTurnoverRatioForRange(selectedPharmacy, beginningOfMonthDate, beginningOfMonthDate).catch(() => ({ turnover_ratio: 0 })),
        stockAPI.getDaysOfInventoryForRange(selectedPharmacy, beginningOfMonthDate, beginningOfMonthDate).catch(() => ({ days_of_inventory: 0 }))
      ]);

      const currentStock = {
        openingStock: openingStockData.opening_stock || 0,
        closingStock: closingStockData.closing_stock || 0,
        turnoverRatio: turnoverRatioData.turnover_ratio || 0,
        daysOfInventory: daysOfInventoryData.days_of_inventory || 0,
        stockAdjustments: stockAdjustmentsData.stock_adjustments || 0,
        costOfSales: costsData.cost_of_sales || 0,
        purchases: costsData.purchases || 0,
        stockValue: closingStockData.closing_stock || 0,
        stockMovement: (closingStockData.closing_stock || 0) - (openingStockData.opening_stock || 0),
        monthlyPurchases: monthlyPurchasesData.purchases || 0,
        monthlyCostOfSales: monthlyCostOfSalesData.cost_of_sales || 0
      };

      setStockData(currentStock);
      
      setBeginningOfMonthStock({
        openingStock: bomOpeningStockData.opening_stock || 0,
        closingStock: bomClosingStockData.closing_stock || 0,
        turnoverRatio: bomTurnoverRatioData.turnover_ratio || 0,
        daysOfInventory: bomDaysOfInventoryData.days_of_inventory || 0
      });

    } catch (err) {
      console.error('❌ Error in fetchStockData:', err);
      setError(err.response?.data?.message || 'Failed to fetch stock data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedDate || !selectedPharmacy) return;
    fetchStockData(selectedDate);
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
            <div className="flex items-center gap-1 sm:gap-2 mb-2">
              <p className="text-text-secondary text-xs sm:text-sm">
                vs Beginning of Month: {formatCurrency(beginningOfMonthStock.openingStock)}
              </p>
              {getTrendIndicator(stockData.stockValue, beginningOfMonthStock.openingStock)}
              {(() => {
                const indicator = getChangeIndicator(stockData.stockValue, beginningOfMonthStock.openingStock, true);
                return (
                  <span className={`text-xs sm:text-sm font-medium ${indicator.color}`}>
                    {indicator.text}
                  </span>
                );
              })()}
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
                    {formatNumber(stockData.daysOfInventory)}
              </p>
            </div>

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
            <div>
                <p className="text-text-secondary text-xs sm:text-sm font-medium">Stock Movement</p>
                <p className={`text-xl sm:text-3xl font-bold ${stockData.stockMovement >= 0 ? 'text-status-success' : 'text-status-error'}`}>
                  {formatCurrency(stockData.stockMovement)}
                </p>
              </div>
              <div className="w-8 h-8 sm:w-12 sm:h-12 bg-accent-secondary-purple rounded-lg flex items-center justify-center">
                {stockData.stockMovement >= 0 ? (
                  <TrendingUp className="text-surface-secondary w-4 h-4 sm:w-6 sm:h-6" />
                ) : (
                  <TrendingDown className="text-surface-secondary w-4 h-4 sm:w-6 sm:h-6" />
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 mb-2">
              <p className="text-text-secondary text-xs sm:text-sm">
                Opening: <span className="font-semibold">{formatCurrency(beginningOfMonthStock.openingStock)}</span>
              </p>
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
                const alerts = getAlerts(stockData, beginningOfMonthStock);
                
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="card">
          <h2 className="text-xl font-semibold text-text-primary mb-4">Stock Summary</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
              <span className="text-text-secondary">Opening Stock</span>
              <span className="text-text-primary font-medium">{formatCurrency(stockData.openingStock)}</span>
              </div>
              <div className="flex justify-between items-center">
              <span className="text-text-secondary">Purchases</span>
              <span className="text-text-primary font-medium">{formatCurrency(stockData.purchases)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">Cost of Sales</span>
              <span className="text-text-primary font-medium">{formatCurrency(stockData.costOfSales)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-text-secondary">Stock Adjustments</span>
              <span className="text-text-primary font-medium">{formatCurrency(stockData.stockAdjustments)}</span>
              </div>
              <div className="border-t border-border pt-4">
                <div className="flex justify-between items-center">
                <span className="text-text-primary font-semibold">Closing Stock</span>
                <span className="text-accent-primary font-bold text-lg">{formatCurrency(stockData.closingStock)}</span>
              </div>
              </div>
            </div>
          </div>

          <div className="card">
          <h2 className="text-xl font-semibold text-text-primary mb-4">Performance Metrics</h2>
          <div className="space-y-4">
              <div className="flex justify-between items-center">
              <span className="text-text-secondary">Purchase Efficiency</span>
              <span className={`font-medium ${stockData.monthlyPurchases <= stockData.monthlyCostOfSales ? 'text-status-success' : 'text-status-warning'}`}>
                {stockData.monthlyPurchases <= stockData.monthlyCostOfSales ? 'Good' : 'High Purchases'}
              </span>
              </div>
              <div className="flex justify-between items-center">
              <span className="text-text-secondary">Days of Inventory</span>
              <span className={`font-medium ${stockData.daysOfInventory <= 45 ? 'text-status-success' : 'text-status-warning'}`}>
                {stockData.daysOfInventory} days
              </span>
              </div>
              <div className="flex justify-between items-center">
              <span className="text-text-secondary">Stock Efficiency</span>
              <span className={`font-medium ${stockData.monthlyPurchases <= stockData.monthlyCostOfSales && stockData.daysOfInventory <= 45 ? 'text-status-success' : 'text-status-warning'}`}>
                {stockData.monthlyPurchases <= stockData.monthlyCostOfSales && stockData.daysOfInventory <= 45 ? 'Optimal' : 'Needs Improvement'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-text-secondary">Month-to-Date Change</span>
              <span className={`font-medium ${stockData.stockValue >= beginningOfMonthStock.openingStock ? 'text-status-success' : 'text-status-error'}`}>
                {calculatePercentageChange(stockData.stockValue, beginningOfMonthStock.openingStock).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Stock; 