import { useState, useEffect, useRef } from 'react'
import { TrendingUp, DollarSign, ShoppingCart, ShoppingBasket, Users, AlertCircle, TrendingDown, AlertTriangle, CheckCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { turnoverAPI, financialAPI, salesAPI, stockAPI } from '../services/api'
import { Doughnut, Line, Bar } from 'react-chartjs-2'
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Title, BarElement, Filler } from 'chart.js'
import { Area, AreaChart, ResponsiveContainer } from 'recharts'
import 'slick-carousel/slick/slick.css'
import 'slick-carousel/slick/slick-theme.css'
import Slider from 'react-slick'
import './carousel-dots.css'

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Title, BarElement, Filler)

// SparklineChart component for quick stats
const SparklineChart = ({ data, color }) => {
  const chartData = data.map((value, index) => ({ value, index }))
  
  return (
    <div className="h-8 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            fill={color}
            fillOpacity={0.1}
            strokeWidth={1.5}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

const formatShortCurrency = (value) => {
  if (value >= 1000000) {
    return `R ${(value / 1000000).toFixed(2)}M`;
  } else if (value >= 1000) {
    return `R ${(value / 1000).toFixed(0)}k`;
  } else {
    return `R ${value.toLocaleString('en-ZA')}`;
  }
};

const Yearly = ({ selectedDate }) => {
  console.log('🚨 YEARLY COMPONENT MOUNTED 🚨', {
    selectedDate,
    time: new Date().toISOString()
  });

  const { selectedPharmacy } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dispensaryPercent, setDispensaryPercent] = useState(0);
  const [ytdData, setYtdData] = useState({
    turnover: 0,
    transactions: 0,
    avgBasket: 0,
    avgBasketSize: 0,
    grossProfit: 0,
    grossProfitPercent: 0,
    costOfSales: 0,
    purchases: 0,
    scriptsDispensed: 0,
    dispensaryTurnover: 0,
    cashSales: 0,
    accountSales: 0,
    codSales: 0,
    cashTenders: 0,
    creditCardTenders: 0,
    openingStock: 0,
    closingStock: 0,
    stockAdjustments: 0
  });
  const [previousYearYtd, setPreviousYearYtd] = useState({
    turnover: 0,
    transactions: 0,
    avgBasket: 0,
    grossProfit: 0,
    grossProfitPercent: 0
  });
  const [trendlineData, setTrendlineData] = useState({
    labels: [],
    cumulativeTurnover: [],
    prevYearCumulativeTurnover: []
  });
  const [monthlyTurnover, setMonthlyTurnover] = useState({
    labels: [],
    data: [],
    gpPercentages: []
  });
  const [monthlyTransactions, setMonthlyTransactions] = useState({
    labels: [],
    data: []
  });
  const [monthlyBasket12, setMonthlyBasket12] = useState({ labels: [], data: [] });
  const [sidebarData, setSidebarData] = useState({});
  const [sparklineData, setSparklineData] = useState({
    turnover: [],
    gpPercent: [],
    avgBasket: []
  });
  const chartRef = useRef(null);
  const [hoveredIndex, setHoveredIndex] = useState(null);

  // Helper functions
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
    if (previous === 0) return current > 0 ? 100 : 0;
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
    } else if (isDecrease) {
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

  const formatDateLocal = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Add getAlerts function here after all utility functions
  const getAlerts = (data, previousYearData, sparklineData) => {
    const alerts = [];
    
    // Helper to calculate average from array
    const getAverage = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;

    // 1. Turnover Alerts
    if (data.turnover < previousYearData.turnover) {
      const diff = previousYearData.turnover - data.turnover;
      const percentDiff = ((diff / previousYearData.turnover) * 100).toFixed(1);
      alerts.push({
        severity: 'warning',
        icon: AlertTriangle,
        title: 'YoY Turnover Down',
        description: `Down ${percentDiff}% (${formatCurrency(diff)}) vs last year`
      });
    } else if (data.turnover > previousYearData.turnover * 1.1) {
      const diff = data.turnover - previousYearData.turnover;
      const percentDiff = ((diff / previousYearData.turnover) * 100).toFixed(1);
      alerts.push({
        severity: 'positive',
        icon: CheckCircle,
        title: 'Strong YoY Performance',
        description: `Up ${percentDiff}% (${formatCurrency(diff)}) vs last year`
      });
    }

    // 2. GP% Alerts
    if (data.grossProfitPercent < 20) {
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

    // 3. Dispensary % Alerts
    const dispensaryPercent = (data.dispensaryTurnover / data.turnover) * 100;
    if (dispensaryPercent > 65) {
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

    // 4. Scripts Alert
    if (data.scriptsDispensed === 0) {
      alerts.push({
        severity: 'critical',
        icon: AlertCircle,
        title: 'No Scripts Recorded',
        description: 'Possible data import issue - please check'
      });
    }

    // 5. Basket Performance
    if (data.avgBasket < 100) {
      alerts.push({
        severity: 'critical',
        icon: AlertCircle,
        title: 'Very Poor Basket Value',
        description: `Critical: Average basket only ${formatCurrency(data.avgBasket)} - Attention needed`
      });
    } else if (data.avgBasket < 150) {
      alerts.push({
        severity: 'warning',
        icon: AlertTriangle,
        title: 'Low Basket Value',
        description: `Average basket at ${formatCurrency(data.avgBasket)} - Below target of R150`
      });
    } else if (data.avgBasket > 200) {
      alerts.push({
        severity: 'positive',
        icon: CheckCircle,
        title: 'Strong Basket Performance',
        description: `Excellent basket value of ${formatCurrency(data.avgBasket)} - Above R200 target`
      });
    }

    // 6. Cost of Sales vs Purchases Analysis
    if (data.costOfSales > 0) {  // Prevent division by zero
      const purchaseRatio = (data.purchases / data.costOfSales - 1) * 100;
      
      if (purchaseRatio > 25) {
        alerts.push({
          severity: 'critical',
          icon: AlertCircle,
          title: 'High Purchase Variance',
          description: `Purchases ${purchaseRatio.toFixed(1)}% higher than cost of sales - investigate`
        });
      } else if (purchaseRatio < -15) {
        alerts.push({
          severity: 'warning',
          icon: AlertTriangle,
          title: 'Low Purchase Variance',
          description: `Purchases ${Math.abs(purchaseRatio).toFixed(1)}% lower than cost of sales`
        });
      }
    }

    return alerts;
  };

  const getTrendIndicator = (currentValue, previousValue) => {
    const percentageChange = calculatePercentageChange(currentValue, previousValue);
    const isIncrease = percentageChange > 0;
    const isDecrease = percentageChange < 0;
    
    if (isIncrease) {
      return <TrendingUp className="w-4 h-4 text-status-success" />;
    } else if (isDecrease) {
      return <TrendingDown className="w-4 h-4 text-status-error" />;
    } else {
      return null;
    }
  };

  // Add YoY bubble component
  const getYoYBubble = () => {
    if (!trendlineData.labels.length) return null;
    
    const current = trendlineData.cumulativeTurnover[trendlineData.cumulativeTurnover.length - 1];
    const previous = trendlineData.prevYearCumulativeTurnover[trendlineData.prevYearCumulativeTurnover.length - 1];
    const diff = current - previous;
    const percent = previous === 0 ? 0 : ((diff / previous) * 100);
    const isUp = diff > 0;
    const absDiff = Math.abs(diff);
    const absPercent = Math.abs(percent);
    
    return (
      <div style={{
        position: 'absolute',
        right: 16,
        bottom: 50,
        background: '#E24313',
        color: 'white',
        borderRadius: 9999,
        padding: '0.25rem 0.75rem',
        fontWeight: 200,
        fontSize: 12,
        display: 'flex',
        alignItems: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
      }}>
        <span style={{fontSize: 16, marginRight: 6, display: 'flex', alignItems: 'center'}}>
          {isUp ? '↗' : '↘'}
        </span>
        {formatCurrency(absDiff)} (<span style={{fontWeight: 700}}>{isUp ? '+' : '-'}{absPercent.toFixed(0)}%</span>) YoY {isUp ? 'increase' : 'decrease'}
      </div>
    );
  };

  // Update chart options to match Daily page
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderWidth: 0,
        displayColors: false,
        axis: 'x',
        callbacks: {
          label: function(context) {
            const year = new Date().getFullYear() - (context.datasetIndex === 1 ? 1 : 0);
            const value = context.parsed.y;
            let valueStr = '';
            if (value >= 1000000) {
              valueStr = `R ${(value / 1000000).toFixed(2)}M`;
            } else if (value >= 1000) {
              valueStr = `R ${(value / 1000).toFixed(0)}k`;
            } else {
              valueStr = `R ${value.toLocaleString('en-ZA')}`;
            }
            return `${year}: ${valueStr}`;
          }
        },
        labelTextColor: function(context) {
          return context.datasetIndex === 0 ? '#FF492C' : '#E2AEA1';
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
          maxRotation: 45
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
            } else {
              return `R${value.toFixed(0)}`;
            }
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
  };

  // Update chart data to match Daily page colors and styling
  const chartData = {
    labels: trendlineData.labels,
    datasets: [
      {
        label: 'Cumulative Turnover',
        data: trendlineData.cumulativeTurnover,
        borderColor: '#FF492C',
        backgroundColor: 'rgba(255, 73, 44, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#FF492C',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 0
      },
      {
        label: 'Prev Year Cumulative',
        data: trendlineData.prevYearCumulativeTurnover,
        borderColor: '#E2AEA1',
        backgroundColor: 'rgba(126, 217, 87, 0.05)',
        borderWidth: 2,
        fill: false,
        tension: 0.4,
        borderDash: [8, 6],
        pointBackgroundColor: '#7ED957',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 0
      }
    ]
  };

  // Fetch YTD data
  const fetchYtdData = async (dateObj) => {
    try {
      console.log('🔄 Starting fetchYtdData with date:', dateObj);
      setLoading(true);
      setError(null);

      const currentYear = dateObj.getFullYear();
      const currentMonth = dateObj.getMonth();
      const currentDay = dateObj.getDate();

      // Calculate YTD date range
      const startDate = formatDateLocal(new Date(currentYear, 0, 1)); // Jan 1st of current year
      const endDate = formatDateLocal(new Date(currentYear, currentMonth, currentDay));

      // Calculate previous year's YTD range
      const prevYearStart = new Date(currentYear - 1, 0, 1);
      const prevYearEnd = new Date(currentYear - 1, currentMonth, currentDay);
      const prevYearStartDate = formatDateLocal(prevYearStart);
      const prevYearEndDate = formatDateLocal(prevYearEnd);

      // Get January 1st opening stock date
      const openingStockDate = formatDateLocal(new Date(currentYear, 0, 1));

      console.log('📅 Date ranges:', {
        startDate,
        endDate,
        prevYearStartDate,
        prevYearEndDate,
        openingStockDate
      });

      console.log('📅 Fetching YTD data with params:', {
        startDate,
        endDate,
        prevYearStartDate,
        prevYearEndDate,
        selectedPharmacy,
        openingStockDate
      });

      // Fetch all data in parallel with individual error handling
      const [
        turnoverResponse,
        gpResponse,
        transactionsResponse,
        avgBasketResponse,
        avgBasketSizeResponse,
        previousYearTurnoverResponse,
        scriptsDispensedResponse,
        dispensaryTurnoverResponse,
        costsResponse,
        cashSalesResponse,
        accountSalesResponse,
        codSalesResponse,
        dispensaryPercentResponse,
        openingStockResponse,
        closingStockResponse,
        stockAdjustmentsResponse
      ] = await Promise.all([
        turnoverAPI.getTurnoverForRange(selectedPharmacy, startDate, endDate).catch(err => {
          console.error('Error fetching turnover:', err);
          return { daily_turnover: [] };
        }),
        financialAPI.getGPForRange(selectedPharmacy, startDate, endDate).catch(err => {
          console.error('Error fetching GP:', err);
          return { daily_gp: [] };
        }),
        financialAPI.getTransactionsForRange(selectedPharmacy, startDate, endDate).catch(err => {
          console.error('Error fetching transactions:', err);
          return { daily_transactions: [] };
        }),
        financialAPI.getAvgBasketForRange(selectedPharmacy, startDate, endDate).catch(err => {
          console.error('Error fetching avg basket:', err);
          return { daily_avg_basket: [] };
        }),
        financialAPI.getDailyAvgBasketForRange(selectedPharmacy, startDate, endDate).catch(err => {
          console.error('Error fetching daily avg basket:', err);
          return { daily_avg_basket: [] };
        }),
        turnoverAPI.getTurnoverForRange(selectedPharmacy, prevYearStartDate, prevYearEndDate).catch(err => {
          console.error('Error fetching previous year turnover:', err);
          return { daily_turnover: [] };
        }),
        salesAPI.getDailyScriptsDispensedForRange(selectedPharmacy, startDate, endDate).catch(err => {
          console.error('Error fetching scripts dispensed:', err);
          return { daily_scripts_dispensed: [] };
        }),
        salesAPI.getDailyDispensaryTurnoverForRange(selectedPharmacy, startDate, endDate).catch(err => {
          console.error('Error fetching dispensary turnover:', err);
          return { daily_dispensary_turnover: [] };
        }),
        financialAPI.getCostsForRange(selectedPharmacy, startDate, endDate).catch(err => {
          console.error('Error fetching costs:', err);
          return { daily_costs: [] };
        }),
        salesAPI.getDailyCashSalesForRange(selectedPharmacy, startDate, endDate).catch(err => {
          console.error('Error fetching cash sales:', err);
          return { daily_cash_sales: [] };
        }),
        salesAPI.getDailyAccountSalesForRange(selectedPharmacy, startDate, endDate).catch(err => {
          console.error('Error fetching account sales:', err);
          return { daily_account_sales: [] };
        }),
        salesAPI.getDailyCODSalesForRange(selectedPharmacy, startDate, endDate).catch(err => {
          console.error('Error fetching COD sales:', err);
          return { daily_cod_sales: [] };
        }),
        salesAPI.getDailyDispensaryPercentForRange(selectedPharmacy, startDate, endDate).catch(err => {
          console.error('Error fetching dispensary percent:', err);
          return { daily_dispensary_percent: [] };
        }),
        stockAPI.getOpeningStockForRange(selectedPharmacy, openingStockDate, openingStockDate).catch(err => {
          console.error('Error fetching opening stock:', err);
          return { opening_stock: 0 };
        }),
        stockAPI.getClosingStockForRange(selectedPharmacy, endDate, endDate).catch(err => {
          console.error('Error fetching closing stock:', err);
          return { closing_stock: 0 };
        }),
        stockAPI.getStockAdjustmentsForRange(selectedPharmacy, startDate, endDate).catch(err => {
          console.error('Error fetching stock adjustments:', err);
          return { stock_adjustments: 0 };
        })
      ]);

      console.log('📊 Raw API responses:', {
        turnover: turnoverResponse,
        gp: gpResponse,
        transactions: transactionsResponse,
        avgBasket: avgBasketResponse,
        avgBasketSize: avgBasketSizeResponse,
        previousYearTurnover: previousYearTurnoverResponse,
        scriptsDispensed: scriptsDispensedResponse,
        dispensaryTurnover: dispensaryTurnoverResponse,
        costs: costsResponse,
        cashSales: cashSalesResponse,
        accountSales: accountSalesResponse,
        codSales: codSalesResponse
      });

      // Process YTD data with null checks and console logging
      console.log('Processing turnover response:', turnoverResponse);
      const ytdTurnover = turnoverResponse?.turnover || 0;
      
      console.log('Processing transactions response:', transactionsResponse);
      const ytdTransactions = transactionsResponse?.total_transactions || 0;
      
      console.log('Processing GP response:', gpResponse);
      const ytdGrossProfit = gpResponse?.cumulative_gp_value || 0;
      const grossProfitPercent = gpResponse?.avg_gp_percent || 0;
      
      console.log('Processing costs response:', costsResponse);
      const ytdCostOfSales = costsResponse?.cost_of_sales || 0;
      const ytdPurchases = costsResponse?.purchases || 0;
      
      console.log('Processing scripts dispensed response:', scriptsDispensedResponse);
      const ytdScriptsDispensed = (scriptsDispensedResponse?.daily_scripts_dispensed?.reduce((sum, d) => {
        console.log('Processing scripts day:', d);
        return sum + (d?.scripts_dispensed || 0);
      }, 0) || 0) / 100;
      
      console.log('Processing dispensary turnover response:', dispensaryTurnoverResponse);
      const ytdDispensaryTurnover = dispensaryTurnoverResponse?.daily_dispensary_turnover?.reduce((sum, d) => {
        console.log('Processing dispensary day:', d);
        return sum + (d?.dispensary_turnover || 0);
      }, 0) || 0;
      
      console.log('Processing sales responses:', { cashSalesResponse, accountSalesResponse, codSalesResponse });
      const ytdCashSales = cashSalesResponse?.daily_cash_sales?.reduce((sum, d) => sum + (d?.cash_sales || 0), 0) || 0;
      const ytdAccountSales = accountSalesResponse?.daily_account_sales?.reduce((sum, d) => sum + (d?.account_sales || 0), 0) || 0;
      const ytdCodSales = codSalesResponse?.daily_cod_sales?.reduce((sum, d) => sum + (d?.cod_sales || 0), 0) || 0;

      // Calculate average dispensary percent
      const totalDispensaryPercent = dispensaryPercentResponse?.daily_dispensary_percent?.reduce((sum, d) => sum + (d?.dispensary_percent || 0), 0) || 0;
      const daysWithData = dispensaryPercentResponse?.daily_dispensary_percent?.length || 1;
      const avgDispensaryPercent = totalDispensaryPercent / daysWithData;
      setDispensaryPercent(avgDispensaryPercent);

      // Calculate averages with null checks
      const avgBasket = avgBasketResponse?.avg_basket_value || 0;
      const avgBasketSize = avgBasketResponse?.avg_basket_size || 0;  // Changed from avgBasketSizeResponse to avgBasketResponse

      // Previous year data
      console.log('Previous Year Turnover Response:', previousYearTurnoverResponse);
      const previousYearTurnover = previousYearTurnoverResponse?.turnover || 0;

      console.log('Processed Previous Year Turnover:', previousYearTurnover);

      // Process stock data
      const openingStock = openingStockResponse?.opening_stock || 0;
      const closingStock = closingStockResponse?.closing_stock || 0;
      const stockAdjustments = stockAdjustmentsResponse?.stock_adjustments || 0;

      console.log('🔢 Processed YTD data:', {
        ytdTurnover,
        ytdTransactions,
        ytdGrossProfit,
        grossProfitPercent,
        avgBasket,
        avgBasketSize,
        ytdScriptsDispensed,
        ytdDispensaryTurnover,
        ytdCashSales,
        ytdAccountSales,
        ytdCodSales,
        previousYearTurnover
      });

      setYtdData({
        turnover: ytdTurnover,
        transactions: ytdTransactions,
        avgBasket,
        avgBasketSize,
        grossProfit: ytdGrossProfit,
        grossProfitPercent,
        costOfSales: ytdCostOfSales,
        purchases: ytdPurchases,
        scriptsDispensed: ytdScriptsDispensed,
        dispensaryTurnover: ytdDispensaryTurnover,
        cashSales: ytdCashSales,
        accountSales: ytdAccountSales,
        codSales: ytdCodSales,
        openingStock,
        closingStock,
        stockAdjustments
      });

      setPreviousYearYtd({
        turnover: previousYearTurnover,
        transactions: 0,
        avgBasket: 0,
        grossProfit: 0,
        grossProfitPercent: 0
      });

      // Fetch trendline data
      await fetchTrendlineData(dateObj);

    } catch (err) {
      console.error('❌ Error in fetchYtdData:', {
        error: err,
        message: err.message,
        stack: err.stack,
        response: err.response?.data
      });
      setError(err.response?.data?.message || 'Failed to fetch YTD data');
    } finally {
      setLoading(false);
    }
  };

  const fetchTrendlineData = async (dateObj) => {
    try {
      const currentYear = dateObj.getFullYear();
      const currentMonth = dateObj.getMonth();
      const currentDay = dateObj.getDate();

      // Calculate YTD date range
      const startDate = formatDateLocal(new Date(currentYear, 0, 1)); // Jan 1st of current year
      const endDate = formatDateLocal(new Date(currentYear, currentMonth, currentDay));

      // Calculate previous year's YTD range
      const prevYearStart = new Date(currentYear - 1, 0, 1);
      const prevYearEnd = new Date(currentYear - 1, currentMonth, currentDay);
      const prevYearStartDate = formatDateLocal(prevYearStart);
      const prevYearEndDate = formatDateLocal(prevYearEnd);

      console.log('📈 Fetching trendline data with params:', {
        startDate,
        endDate,
        prevYearStartDate,
        prevYearEndDate,
        selectedPharmacy
      });

      // Fetch daily turnover data for current and previous year
      const [dailyTurnover, prevYearDailyTurnover] = await Promise.all([
        turnoverAPI.getDailyTurnoverForRange(selectedPharmacy, startDate, endDate).catch(err => {
          console.error('Error fetching current year daily turnover:', err);
          return { daily_turnover: [] };
        }),
        turnoverAPI.getDailyTurnoverForRange(selectedPharmacy, prevYearStartDate, prevYearEndDate).catch(err => {
          console.error('Error fetching previous year daily turnover:', err);
          return { daily_turnover: [] };
        })
      ]);

      console.log('📊 Raw trendline responses:', {
        currentYear: dailyTurnover,
        previousYear: prevYearDailyTurnover
      });

      // Process trendline data
      const labels = [];
      const cumulativeTurnover = [];
      const prevYearCumulativeTurnover = [];
      let runningTotal = 0;
      let prevYearRunningTotal = 0;

      // Current year data
      dailyTurnover.daily_turnover?.forEach(day => {
        const date = new Date(day.date);
        labels.push(`${date.getDate()}/${date.getMonth() + 1}`);
        runningTotal += day.turnover || 0;
        cumulativeTurnover.push(runningTotal);
      });

      // Previous year data - align with current year dates
      const daysCount = labels.length;
      prevYearDailyTurnover.daily_turnover?.slice(0, daysCount).forEach(day => {
        prevYearRunningTotal += day.turnover || 0;
        prevYearCumulativeTurnover.push(prevYearRunningTotal);
      });

      // Pad previous year data if needed
      while (prevYearCumulativeTurnover.length < daysCount) {
        prevYearCumulativeTurnover.push(prevYearRunningTotal);
      }

      console.log('📈 Processed trendline data:', {
        labels,
        cumulativeTurnover,
        prevYearCumulativeTurnover
      });

      setTrendlineData({
        labels,
        cumulativeTurnover,
        prevYearCumulativeTurnover
      });

    } catch (err) {
      console.error('❌ Error in fetchTrendlineData:', {
        error: err,
        message: err.message,
        stack: err.stack,
        response: err.response?.data
      });
      // Don't set the error state here as this is a secondary data fetch
      // Just log the error and let the component render with the main data
    }
  };

  const fetchSparklineData = async (dateObj) => {
    try {
      const currentYear = dateObj.getFullYear();
      const currentMonth = dateObj.getMonth();
      const currentDay = dateObj.getDate();

      // Get last 7 days of data for sparklines
      const sparklineRequests = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(currentYear, currentMonth, currentDay - i);
        const formattedDate = formatDateLocal(date);
        sparklineRequests.push({
          date: formattedDate,
          turnover: turnoverAPI.getTurnoverForRange(selectedPharmacy, formattedDate, formattedDate),
          gp: financialAPI.getGPForRange(selectedPharmacy, formattedDate, formattedDate),
          avgBasket: financialAPI.getAvgBasketForRange(selectedPharmacy, formattedDate, formattedDate)
        });
      }

      const results = await Promise.all(
        sparklineRequests.map(async (req) => {
          try {
            const [turnover, gp, avgBasket] = await Promise.all([
              req.turnover.catch(() => ({ turnover: 0 })),
              req.gp.catch(() => ({ avg_gp_percent: 0 })),
              req.avgBasket.catch(() => ({ avg_basket_value: 0 }))
            ]);
            return {
              turnover: turnover.turnover || 0,
              gpPercent: gp.avg_gp_percent || 0,
              avgBasket: avgBasket.avg_basket_value || 0
            };
          } catch (error) {
            console.error('Error fetching sparkline data for date:', req.date, error);
            return { turnover: 0, gpPercent: 0, avgBasket: 0 };
          }
        })
      );

      setSparklineData({
        turnover: results.map(r => r.turnover),
        gpPercent: results.map(r => r.gpPercent),
        avgBasket: results.map(r => r.avgBasket)
      });

    } catch (err) {
      console.error('Error fetching sparkline data:', err);
    }
  };

  const fetchMonthlyTurnoverData = async (dateObj) => {
    try {
      const currentYear = dateObj.getFullYear();
      const currentMonth = dateObj.getMonth();
      
      // Calculate date range for current year only
      const startDate = formatDateLocal(new Date(currentYear, 0, 1)); // Start from January 1st
      const endDate = formatDateLocal(new Date(currentYear, currentMonth + 1, 0)); // End at current month

      console.log('📊 Fetching monthly turnover data with params:', {
        startDate,
        endDate,
        selectedPharmacy
      });

      // Get turnover and transaction data
      const [turnoverResponse, transactionsResponse] = await Promise.all([
        turnoverAPI.getDailyTurnoverForRange(selectedPharmacy, startDate, endDate),
        financialAPI.getTransactionsForRange(selectedPharmacy, startDate, endDate)
      ]);
      
      // Process the daily turnover data into monthly aggregates
      const monthlyData = {};
      const monthlyTransactionData = {};
      
      turnoverResponse.daily_turnover?.forEach(day => {
        const date = new Date(day.date);
        const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthlyData[yearMonth] = (monthlyData[yearMonth] || 0) + (day.turnover || 0);
      });

      // Process daily transactions into monthly totals
      if (transactionsResponse.daily_transactions) {
        transactionsResponse.daily_transactions.forEach(day => {
          const date = new Date(day.date);
          const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          const dailyTransactions = day.total_transactions || 0;
          monthlyTransactionData[yearMonth] = (monthlyTransactionData[yearMonth] || 0) + dailyTransactions;
        });
      } else if (transactionsResponse.total_transactions) {
        // If we get aggregated data instead of daily data, try to parse the date
        const date = new Date(transactionsResponse.date || endDate);
        const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthlyTransactionData[yearMonth] = transactionsResponse.total_transactions;
      }

      console.log('Monthly Transaction Data:', monthlyTransactionData);

      // Create arrays for chart data and fetch GP% for each month
      const labels = [];
      const data = [];
      const transactionData = [];
      const gpPercentages = [];

      // Get months for current year up to current month
      const gpRequests = [];
      const transactionRequests = [];
      const months = [];

      // Loop through months from January to current month
      for (let month = 0; month <= currentMonth; month++) {
        const date = new Date(currentYear, month, 1);
        const monthEnd = new Date(currentYear, month + 1, 0);
        const monthStart = formatDateLocal(date);
        const monthEndFormatted = formatDateLocal(monthEnd);
        
        const monthName = date.toLocaleString('default', { month: 'short' });
        const yearMonth = `${currentYear}-${String(month + 1).padStart(2, '0')}`;
        
        labels.push(monthName);
        data.push(monthlyData[yearMonth] || 0);
        
        // Store month info and create requests
        months.push({ yearMonth, monthStart, monthEndFormatted });
        gpRequests.push(financialAPI.getGPForRange(selectedPharmacy, monthStart, monthEndFormatted));
        transactionRequests.push(financialAPI.getTransactionsForRange(selectedPharmacy, monthStart, monthEndFormatted));
      }

      // Fetch GP% and transactions for all months in parallel
      console.log('Fetching GP% and transactions for months:', months);
      const [gpResponses, transactionResponses] = await Promise.all([
        Promise.all(gpRequests),
        Promise.all(transactionRequests)
      ]);
      
      // Process GP responses
      gpResponses.forEach((response, index) => {
        const gpPercent = response?.avg_gp_percent || 0;
        console.log(`GP% for ${months[index].yearMonth}:`, gpPercent);
        gpPercentages.push(Number(gpPercent.toFixed(1)));
      });

      // Process transaction responses
      transactionResponses.forEach((response, index) => {
        const transactions = response?.total_transactions || 0;
        console.log(`Transactions for ${months[index].yearMonth}:`, transactions);
        transactionData.push(transactions);
      });

      console.log('Final Transaction Data:', {
        labels,
        transactionData
      });

      setMonthlyTurnover({
        labels,
        data,
        gpPercentages
      });

      setMonthlyTransactions({
        labels,
        data: transactionData
      });

    } catch (err) {
      console.error('❌ Error in fetchMonthlyTurnoverData:', err);
    }
  };

  useEffect(() => {
    console.log('🔥 YEARLY COMPONENT EFFECT TRIGGERED 🔥', {
      selectedDate,
      selectedPharmacy,
      time: new Date().toISOString()
    });

    if (!selectedDate) {
      console.log('⚠️ No selected date available yet');
      return;
    }

    if (!selectedPharmacy) {
      console.log('⚠️ No pharmacy selected yet');
      return;
    }

    fetchYtdData(selectedDate);
    fetchMonthlyTurnoverData(selectedDate);
    fetchSparklineData(selectedDate);
  }, [selectedDate, selectedPharmacy]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary mx-auto mb-4"></div>
            <p className="text-text-secondary">Loading yearly data...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-status-error mx-auto mb-4" />
            <p className="text-status-error mb-4">Error loading data: {error}</p>
            <button onClick={() => fetchYtdData(selectedDate)} className="btn-primary">
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="mb-4">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-text-primary leading-tight mb-1">
              Yearly Overview
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
                <p className="text-text-secondary text-xs sm:text-sm font-medium">YTD Turnover</p>
                <p className="text-xl sm:text-3xl font-bold text-accent-primary">
                  {formatCurrency(ytdData.turnover)}
                </p>
              </div>
              <div className="w-8 h-8 sm:w-12 sm:h-12 bg-accent-primary rounded-lg flex items-center justify-center">
                <DollarSign className="text-surface-secondary w-4 h-4 sm:w-6 sm:h-6" />
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 mb-2">
              <p className="text-text-secondary text-xs sm:text-sm">
                vs Last Year: {formatCurrency(previousYearYtd.turnover)}
              </p>
              {getTrendIndicator(ytdData.turnover, previousYearYtd.turnover)}
              {(() => {
                const indicator = getChangeIndicator(ytdData.turnover, previousYearYtd.turnover)
                return (
                  <span className={`text-xs sm:text-sm font-medium ${indicator.color}`}>
                    {indicator.text}
                  </span>
                )
              })()}
            </div>
            {sparklineData.turnover.length > 0 && (
              <SparklineChart data={sparklineData.turnover} color="#FF492C" />
            )}
          </div>
        </div>

        <div className="card sm:p-4 p-3">
          <div className="flex flex-col h-full">
            <div className="flex items-start justify-between mb-2">
              <div className="flex flex-col gap-2">
                <div>
                  <p className="text-text-secondary text-xs sm:text-sm font-medium">Gross Profit %</p>
                  <p className="text-lg sm:text-2xl font-bold text-chart-gold">
                    {Number(ytdData.grossProfitPercent).toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-text-secondary text-xs sm:text-sm font-medium">Gross Profit: {formatCurrency(ytdData.grossProfit)}</p>
                </div>
              </div>
              <div className="w-8 h-8 sm:w-12 sm:h-12 bg-chart-gold rounded-lg flex items-center justify-center">
                <TrendingUp className="text-surface-secondary w-4 h-4 sm:w-6 sm:h-6" />
              </div>
            </div>
            {sparklineData.gpPercent && sparklineData.gpPercent.length > 0 && (
              <SparklineChart data={sparklineData.gpPercent} color="#F6C643" />
            )}
          </div>
        </div>

        <div className="card sm:p-4 p-3">
          <div className="flex flex-col h-full">
            <div className="flex items-start justify-between mb-2">
              <div className="flex flex-col gap-2">
                <div>
                  <p className="text-text-secondary text-xs sm:text-sm font-medium">Cost of Sales</p>
                  <p className="text-lg sm:text-2xl font-bold text-cost-sales">
                    {formatCurrency(ytdData.costOfSales)}
                  </p>
                </div>
                <div>
                  <p className="text-text-secondary text-xs sm:text-sm font-medium">Purchases</p>
                  <p className="text-lg sm:text-2xl font-bold text-cost-sales">
                    {formatCurrency(ytdData.purchases)}
                  </p>
                </div>
              </div>
              <div className="w-8 h-8 sm:w-12 sm:h-12 bg-cost-sales rounded-lg flex items-center justify-center">
                <ShoppingCart className="text-surface-secondary w-4 h-4 sm:w-6 sm:h-6" />
              </div>
            </div>
          </div>
        </div>

        <div className="card sm:p-4 p-3">
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-text-secondary text-xs sm:text-sm font-medium">Avg Basket Value</p>
                <p className="text-xl sm:text-3xl font-bold text-accent-secondary-purple">
                  {formatCurrency(ytdData.avgBasket)}
                </p>
              </div>
              <div className="w-8 h-8 sm:w-12 sm:h-12 bg-accent-secondary-purple rounded-lg flex items-center justify-center">
                <ShoppingBasket className="text-surface-secondary w-4 h-4 sm:w-6 sm:h-6" />
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 mb-2">
              <p className="text-text-secondary text-xs sm:text-sm">
                Items per Basket: <span className="font-semibold">{Number(ytdData.avgBasketSize).toFixed(1)}</span>
              </p>
            </div>
            {sparklineData.avgBasket.length > 0 && (
              <SparklineChart data={sparklineData.avgBasket} color="#8F6ED5" />
            )}
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
                const alerts = getAlerts(ytdData, previousYearYtd, sparklineData);
                
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

      {/* YTD Turnover Trend Chart - Full Width */}
      <div className="card w-full mb-4">
        <h2 className="text-xl font-semibold text-text-primary mb-2">YTD Turnover Trend</h2>
        <div className="h-[300px] py-0 px-0" style={{position: 'relative'}}>
          {trendlineData.labels.length > 0 ? (
            <>
              <Line
                ref={chartRef}
                data={{
                  labels: trendlineData.labels,
                  datasets: [
                    {
                      label: 'Current Year',
                      data: trendlineData.cumulativeTurnover,
                      borderColor: '#FF492C',
                      backgroundColor: 'rgba(255, 73, 44, 0.1)',
                      borderWidth: 3,
                      fill: true,
                      tension: 0.4,
                      pointBackgroundColor: '#FF492C',
                      pointBorderColor: '#fff',
                      pointBorderWidth: 0,
                      pointRadius: 0,
                      pointHoverRadius: 0,
                    },
                    {
                      label: 'Previous Year',
                      data: trendlineData.prevYearCumulativeTurnover,
                      borderColor: '#E2AEA1',
                      backgroundColor: 'rgba(126, 217, 87, 0.05)',
                      borderWidth: 2,
                      fill: false,
                      tension: 0.4,
                      borderDash: [8, 6],
                      pointBackgroundColor: '#7ED957',
                      pointBorderColor: '#fff',
                      pointBorderWidth: 0,
                      pointRadius: 0,
                      pointHoverRadius: 0,
                    }
                  ],
                }}
                options={chartOptions}
              />
              {getYoYBubble()}
            </>
          ) : (
            <div className="h-full flex items-center justify-center">
              <p className="text-text-secondary">Loading trend data...</p>
            </div>
          )}
        </div>
      </div>

      {/* Dispensary and Sales Breakdown Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Dispensary Summary */}
        <div className="card h-[400px]">
          <h3 className="text-xl font-semibold text-text-primary mb-4">Dispensary Summary</h3>
          <div className="space-y-6">
            {/* Dispensary Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-surface-secondary rounded-lg p-3">
                <p className="text-sm text-text-secondary mb-1">Scripts This Year</p>
                <p className="text-xl font-bold text-text-primary">
                  {formatNumber(ytdData.scriptsDispensed)}
                </p>
              </div>
              <div className="bg-surface-secondary rounded-lg p-3">
                <p className="text-sm text-text-secondary mb-1">Avg Script Value</p>
                <p className="text-xl font-bold text-text-primary">
                  {ytdData.scriptsDispensed > 0 ? formatCurrency(ytdData.dispensaryTurnover / ytdData.scriptsDispensed) : 'R 0'}
                </p>
              </div>
            </div>

            {/* Dispensary Turnover */}
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-text-secondary">Dispensary</span>
                  <span className="text-lg font-semibold text-text-primary">
                    {formatCurrency(ytdData.dispensaryTurnover)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-secondary">Front Shop</span>
                  <span className="text-lg font-semibold text-text-primary">
                    {formatCurrency(ytdData.turnover - ytdData.dispensaryTurnover)}
                  </span>
                </div>
              </div>

              {/* Dispensary Split Progress Bar */}
              <div className="space-y-2">
                <div className="space-y-0.5">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-[#FFC300]"></div>
                      <span className="text-sm text-text-secondary">Dispensary</span>
                    </div>
                    <span className="text-lg font-semibold text-[#FFC300]">{ytdData.turnover > 0 ? Math.round((ytdData.dispensaryTurnover / ytdData.turnover) * 100) : 0}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-[#3A3F4B]"></div>
                      <span className="text-sm text-text-secondary">Front Shop</span>
                    </div>
                    <span className="text-lg font-semibold text-[#3A3F4B]">{ytdData.turnover > 0 ? Math.round(100 - (ytdData.dispensaryTurnover / ytdData.turnover) * 100) : 100}%</span>
                  </div>
                </div>

                <div className="relative">
                  {/* Base Progress Bar */}
                  <div className="h-4 bg-[#3A3F4B] rounded-full overflow-hidden relative">
                    {/* Actual Progress */}
                    <div 
                      className="h-full bg-[#FFC300] rounded-full"
                      style={{ width: `${ytdData.turnover > 0 ? Math.min((ytdData.dispensaryTurnover / ytdData.turnover) * 100, 100) : 0}%` }}
                    />
                    {/* Target Range Lines */}
                    <div 
                      className="absolute h-full w-[4px] bg-white"
                      style={{ left: '40%', top: 0 }}
                    />
                    <div 
                      className="absolute h-full w-[4px] bg-white"
                      style={{ left: '60%', top: 0 }}
                    />
                  </div>
                </div>

                {/* Target Indicator */}
                <div className="pt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-text-secondary">Target Range: 40-60%</span>
                    <span className={`text-sm ${
                      ytdData.turnover > 0 && (ytdData.dispensaryTurnover / ytdData.turnover) * 100 >= 40 && (ytdData.dispensaryTurnover / ytdData.turnover) * 100 <= 60 
                        ? 'text-status-success' 
                        : 'text-status-warning'
                    }`}>
                      {ytdData.turnover > 0 && (ytdData.dispensaryTurnover / ytdData.turnover) * 100 >= 40 && (ytdData.dispensaryTurnover / ytdData.turnover) * 100 <= 60 
                        ? 'Within Target' 
                        : ytdData.turnover > 0 && (ytdData.dispensaryTurnover / ytdData.turnover) * 100 < 40 
                          ? 'Below Target Range'
                          : 'Above Target Range'
                      }
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Transaction Summary */}
        <div className="card h-[400px]">
          <h3 className="text-xl font-semibold text-text-primary mb-4">Transaction Summary</h3>
          <div className="space-y-6">
            {/* Transaction Values */}
            <div className="grid grid-cols-1 gap-4">
              <div className="bg-surface-secondary rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-[#7ED957]" />
                      <p className="text-sm text-text-secondary">Total Transactions</p>
                    </div>
                    <p className="text-lg font-semibold text-text-primary">{formatNumber(ytdData.transactions)}</p>
                    <p className="text-xs text-text-secondary mt-1">
                      Average {(ytdData.transactions / (trendlineData.labels?.length || 1)).toFixed(0)} per day
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2 mb-2 justify-end">
                      <div className="w-2 h-2 rounded-full bg-[#FF492C]" />
                      <p className="text-sm text-text-secondary">Scripts Dispensed</p>
                    </div>
                    <p className="text-lg font-semibold text-text-primary">{formatNumber(ytdData.scriptsDispensed)}</p>
                    <p className="text-xs text-text-secondary mt-1">
                      {((ytdData.scriptsDispensed / ytdData.transactions) * 100).toFixed(1)}% of transactions
                    </p>
                  </div>
                </div>
              </div>

              {/* Best Months Section */}
              <div className="mt-8">
                <h3 className="text-xl font-semibold text-text-primary mb-4">Best Months</h3>
                <div className="space-y-4 px-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-text-secondary">Most transactions - </span>
                      <span className="text-sm font-bold text-text-primary">
                        {monthlyTransactions.labels[
                          monthlyTransactions.data.reduce((maxIndex, current, index, arr) => 
                            current > arr[maxIndex] ? index : maxIndex, 0)
                        ] || 'N/A'}
                      </span>
                    </div>
                    <span className="text-sm text-text-primary">
                      {formatNumber(Math.max(...monthlyTransactions.data) || 0)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-text-secondary">Highest Turnover - </span>
                      <span className="text-sm font-bold text-text-primary">
                        {monthlyTurnover.labels[
                          monthlyTurnover.data.reduce((maxIndex, current, index, arr) => 
                            current > arr[maxIndex] ? index : maxIndex, 0)
                        ] || 'N/A'}
                      </span>
                    </div>
                    <span className="text-sm text-text-primary">
                      {formatCurrency(Math.max(...monthlyTurnover.data) || 0)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-text-secondary">Best GP% - </span>
                      <span className="text-sm font-bold text-text-primary">
                        {monthlyTurnover.labels[
                          monthlyTurnover.gpPercentages.reduce((maxIndex, current, index, arr) => 
                            current > arr[maxIndex] ? index : maxIndex, 0)
                        ] || 'N/A'}
                      </span>
                    </div>
                    <span className="text-sm text-text-primary">
                      {(Math.max(...monthlyTurnover.gpPercentages) || 0).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Comparison vs Previous Year */}
            {previousYearYtd.transactions > 0 && (
              <div className="pt-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-secondary">vs Previous Year</span>
                  <span className={`text-sm ${
                    ytdData.transactions > previousYearYtd.transactions 
                      ? 'text-status-success' 
                      : 'text-status-warning'
                  }`}>
                    {previousYearYtd.transactions > 0 
                      ? `${((ytdData.transactions / previousYearYtd.transactions - 1) * 100).toFixed(1)}%`
                      : 'No Previous Data'
                    }
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Monthly Turnover Trend */}
        <div className="card h-[300px]">
          <h2 className="text-xl font-semibold text-text-primary mb-2">Monthly Turnover Trend</h2>
          <div className="h-[240px] py-0 px-0">
            {monthlyTurnover.labels.length > 0 ? (
              <Bar
                data={{
                  labels: monthlyTurnover.labels,
                  datasets: [
                    {
                      type: 'bar',
                      label: 'Monthly Turnover',
                      data: monthlyTurnover.data,
                      backgroundColor: '#7ED957',
                      borderRadius: 6,
                      barThickness: 20,
                      maxBarThickness: 30,
                      yAxisID: 'y',
                      order: 2
                    },
                    {
                      type: 'line',
                      label: 'GP %',
                      data: monthlyTurnover.gpPercentages,
                      borderColor: '#FFF',
                      borderWidth: 3,
                      pointBackgroundColor: '#FFF',
                      pointBorderColor: '#FFF',
                      pointRadius: 0,
                      pointHoverRadius: 6,
                      fill: false,
                      yAxisID: 'y1',
                      order: 1
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
                        boxHeight: 8
                      }
                    },
                    tooltip: {
                      backgroundColor: 'rgba(0, 0, 0, 0.8)',
                      titleColor: '#fff',
                      bodyColor: '#fff',
                      callbacks: {
                        label: function(context) {
                          if (context.dataset.label === 'Monthly Turnover') {
                            return `Turnover: ${formatCurrency(context.parsed.y)}`;
                          } else {
                            return `GP %: ${context.parsed.y.toFixed(1)}%`;
                          }
                        }
                      }
                    }
                  },
                  scales: {
                    x: {
                      grid: {
                        display: false,
                        drawBorder: false
                      },
                      border: {
                        display: false
                      },
                      ticks: {
                        color: '#9CA3AF',
                        font: {
                          size: 11,
                          weight: '500'
                        },
                        padding: 8
                      }
                    },
                    y: {
                      position: 'left',
                      grid: {
                        display: false,
                        drawBorder: false
                      },
                      border: {
                        display: false
                      },
                      ticks: {
                        color: '#9CA3AF',
                        font: {
                          size: 11,
                          weight: '500'
                        },
                        padding: 8,
                        callback: function(value) {
                          return formatShortCurrency(value);
                        }
                      }
                    },
                    y1: {
                      position: 'right',
                      grid: {
                        display: false,
                        drawBorder: false
                      },
                      border: {
                        display: false
                      },
                      min: 22,
                      max: 32,
                      ticks: {
                        color: '#FFFFFF',
                        font: {
                          size: 11,
                          weight: '500'
                        },
                        padding: 8,
                        callback: function(value) {
                          return value + '%';
                        }
                      }
                    }
                  }
                }}
              />
            ) : (
              <div className="h-full flex items-center justify-center">
                <p className="text-text-secondary">Loading trend data...</p>
              </div>
            )}
          </div>
        </div>

        {/* Monthly Scripts Analysis */}
        <div className="card h-[300px]">
          <h2 className="text-xl font-semibold text-text-primary mb-2">Monthly Scripts Analysis</h2>
          <div className="h-[240px] py-0 px-0">
            {monthlyTransactions.labels.length > 0 ? (
              <Bar
                data={{
                  labels: monthlyTransactions.labels,
                  datasets: [
                    {
                      type: 'bar',
                      label: 'Scripts Dispensed',
                      data: monthlyTransactions.data.map((transactions, index) => {
                        // Calculate scripts for this month based on the overall ratio
                        const scriptsRatio = ytdData.scriptsDispensed / ytdData.transactions;
                        return Math.round(transactions * scriptsRatio);
                      }),
                      backgroundColor: '#FF492C',
                      borderRadius: 6,
                      barThickness: 20,
                      maxBarThickness: 30,
                      order: 1
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
                        boxHeight: 8
                      }
                    },
                    tooltip: {
                      backgroundColor: 'rgba(0, 0, 0, 0.8)',
                      titleColor: '#fff',
                      bodyColor: '#fff',
                      callbacks: {
                        label: function(context) {
                          return `Scripts: ${formatNumber(context.parsed.y)}`;
                        }
                      }
                    }
                  },
                  scales: {
                    x: {
                      grid: {
                        display: false,
                        drawBorder: false
                      },
                      border: {
                        display: false
                      },
                      ticks: {
                        color: '#9CA3AF',
                        font: {
                          size: 11,
                          weight: '500'
                        },
                        padding: 8
                      }
                    },
                    y: {
                      grid: {
                        display: false,
                        drawBorder: false
                      },
                      border: {
                        display: false
                      },
                      ticks: {
                        color: '#9CA3AF',
                        font: {
                          size: 11,
                          weight: '500'
                        },
                        padding: 8,
                        callback: function(value) {
                          return formatNumber(value);
                        }
                      }
                    }
                  }
                }}
              />
            ) : (
              <div className="h-full flex items-center justify-center">
                <p className="text-text-secondary">Loading script data...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Yearly 