import { TrendingUp, DollarSign, BarChart3, Target, AlertCircle, ShoppingCart, ShoppingBasket } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { turnoverAPI, financialAPI, salesAPI } from '../services/api'
import { Line, Doughnut, Bar } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler, ArcElement, BarElement } from 'chart.js'
import 'slick-carousel/slick/slick.css'
import 'slick-carousel/slick/slick-theme.css'
import Slider from 'react-slick'
import './carousel-dots.css'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler, ArcElement, BarElement)

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
    creditCardTenders: 0
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
  const [monthlyBasket12, setMonthlyBasket12] = useState({ labels: [], data: [] });
  const [sidebarData, setSidebarData] = useState({});
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

      console.log('📅 Date ranges:', {
        startDate,
        endDate,
        prevYearStartDate,
        prevYearEndDate
      });

      console.log('📅 Fetching YTD data with params:', {
        startDate,
        endDate,
        prevYearStartDate,
        prevYearEndDate,
        selectedPharmacy
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
        dispensaryPercentResponse
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
        codSales: ytdCodSales
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

  const fetchMonthlyTurnoverData = async (dateObj) => {
    try {
      const currentYear = dateObj.getFullYear();
      const currentMonth = dateObj.getMonth();
      
      // Calculate date range for last 12 months
      const startDate = formatDateLocal(new Date(currentYear, currentMonth - 11, 1)); // Start from 12 months ago
      const endDate = formatDateLocal(new Date(currentYear, currentMonth + 1, 0)); // End at current month

      console.log('📊 Fetching monthly turnover data with params:', {
        startDate,
        endDate,
        selectedPharmacy
      });

      // Get turnover data
      const turnoverResponse = await turnoverAPI.getDailyTurnoverForRange(selectedPharmacy, startDate, endDate);
      
      // Process the daily turnover data into monthly aggregates
      const monthlyData = {};
      
      turnoverResponse.daily_turnover?.forEach(day => {
        const date = new Date(day.date);
        const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthlyData[yearMonth] = (monthlyData[yearMonth] || 0) + (day.turnover || 0);
      });

      // Create arrays for chart data and fetch GP% for each month
      const labels = [];
      const data = [];
      const gpPercentages = [];

      // Get last 12 months of data
      const gpRequests = [];
      const months = [];

      for (let i = 11; i >= 0; i--) {
        const date = new Date(currentYear, currentMonth - i, 1);
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        const monthStart = formatDateLocal(date);
        const monthEndFormatted = formatDateLocal(monthEnd);
        
        const monthName = date.toLocaleString('default', { month: 'short' });
        const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        labels.push(monthName);
        data.push(monthlyData[yearMonth] || 0);
        
        // Store month info for later and create GP request
        months.push({ yearMonth, monthStart, monthEndFormatted });
        gpRequests.push(financialAPI.getGPForRange(selectedPharmacy, monthStart, monthEndFormatted));
      }

      // Fetch GP% for all months in parallel
      console.log('Fetching GP% for months:', months);
      const gpResponses = await Promise.all(gpRequests);
      
      // Process GP responses
      gpResponses.forEach((response, index) => {
        const gpPercent = response?.avg_gp_percent || 0;
        console.log(`GP% for ${months[index].yearMonth}:`, gpPercent);
        gpPercentages.push(Number(gpPercent.toFixed(1)));
      });

      setMonthlyTurnover({
        labels,
        data,
        gpPercentages
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
          <div className="flex items-center justify-between h-full">
            <div>
              <p className="text-text-secondary text-xs sm:text-sm font-medium">YTD Turnover</p>
              <p className="text-lg sm:text-xl font-bold text-accent-primary">
                {formatCurrency(ytdData.turnover)}
              </p>
              <div className="flex items-center gap-1 sm:gap-2 mt-1">
                <p className="text-text-secondary text-xs sm:text-sm">
                  vs Last Year
                </p>
                {(() => {
                  const indicator = getChangeIndicator(ytdData.turnover, previousYearYtd.turnover)
                  return (
                    <span className={`text-xs sm:text-sm font-medium ${indicator.color}`}>
                      {indicator.arrow} {indicator.text}
                    </span>
                  )
                })()}
              </div>
            </div>
            <div className="w-8 h-8 sm:w-12 sm:h-12 bg-accent-primary rounded-lg flex items-center justify-center">
              <DollarSign className="text-surface-secondary w-4 h-4 sm:w-6 sm:h-6" />
            </div>
          </div>
        </div>

        {/* Gross Profit Card */}
        <div className="card sm:p-4 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-secondary text-xs sm:text-sm font-medium">Gross Profit</p>
              <div className="flex flex-col">
                <span className="text-lg sm:text-xl font-bold text-text-primary">{formatCurrency(ytdData.grossProfit)}</span>
                <p className="text-text-secondary text-xs sm:text-sm font-medium">GP %</p>
                <span className="text-lg sm:text-xl font-semibold text-text-primary">{Number(ytdData.grossProfitPercent).toFixed(1)}%</span>
              </div>
            </div>
            <div className="w-8 h-8 sm:w-12 sm:h-12 bg-chart-gold rounded-lg flex items-center justify-center">
              <TrendingUp className="text-surface-secondary w-4 h-4 sm:w-6 sm:h-6" />
            </div>
          </div>
        </div>

        {/* Cost of Sales Card */}
        <div className="card sm:p-4 p-3">
          <div className="flex items-center justify-between h-full">
            <div>
              <p className="text-text-secondary text-xs sm:text-sm font-medium">Cost of Sales</p>
              <div className="flex flex-col">
                <span className="text-lg sm:text-xl font-bold text-cost-sales">{formatCurrency(ytdData.costOfSales)}</span>
                <p className="text-text-secondary text-xs sm:text-sm font-medium">Purchases</p>
                <span className="text-lg sm:text-xl font-bold text-accent-primary">{formatCurrency(ytdData.purchases)}</span>
              </div>
            </div>
            <div className="w-8 h-8 sm:w-12 sm:h-12 bg-cost-sales rounded-lg flex items-center justify-center">
              <ShoppingCart className="text-surface-secondary w-4 h-4 sm:w-6 sm:h-6" />
            </div>
          </div>
        </div>

        {/* Average Basket Card */}
        <div className="card sm:p-4 p-3">
          <div className="flex items-center justify-between h-full">
            <div>
              <p className="text-text-secondary text-xs sm:text-sm font-medium">Avg Basket Value</p>
              <div className="flex flex-col">
                <span className="text-lg sm:text-xl font-bold text-text-primary">{formatCurrency(ytdData.avgBasket)}</span>
                <p className="text-text-secondary text-xs sm:text-sm font-medium">Avg Basket Size</p>
                <span className="text-lg sm:text-xl font-semibold text-text-primary">{Number(ytdData.avgBasketSize).toFixed(1)} items</span>
              </div>
            </div>
            <div className="w-8 h-8 sm:w-12 sm:h-12 bg-accent-secondary-purple rounded-lg flex items-center justify-center">
              <ShoppingBasket className="text-surface-secondary w-4 h-4 sm:w-6 sm:h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chart Section */}
        <div className="lg:col-span-2" style={{position: 'relative'}}>
          {/* YTD Turnover Trend Chart */}
          <div className="card mb-4">
            <h2 className="text-2xl font-semibold text-text-primary mb-2">YTD Turnover Trend</h2>
            <div className="h-60 py-0 px-0" style={{position: 'relative'}}>
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

          {/* Monthly Turnover Trend */}
          <div className="card mb-4">
            <h2 className="text-2xl font-semibold text-text-primary mb-2">Monthly Turnover Trend</h2>
            <div className="h-60 py-0 px-0">
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
                        barThickness: 32,
                        maxBarThickness: 40,
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
                        display: false
                      },
                                              tooltip: {
                          backgroundColor: 'rgba(0, 0, 0, 0.8)',
                          titleColor: '#fff',
                          bodyColor: '#fff',
                          padding: 12,
                          cornerRadius: 4,
                          displayColors: false,
                          intersect: false,
                          mode: 'index',
                                                      callbacks: {
                              label: function(context) {
                                const dataIndex = context.dataIndex;
                                
                                if (context.dataset.yAxisID === 'y') {
                                  return 'Turnover: ' + formatCurrency(context.raw);
                                } else {
                                  return 'GP: ' + context.raw + '%';
                                }
                              },
                            title: function(context) {
                              return context[0].label + ' ' + new Date().getFullYear();
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
                          color: 'rgba(156, 163, 175, 0.1)',
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
                    },
                    layout: {
                      padding: {
                        top: 20
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
        </div>

        {/* Right Column */}
        <div className="space-y-3">
          {/* Dispensary Summary Card */}
          <div className="card">
            <h3 className="text-xl font-semibold text-text-primary mb-4">Dispensary Summary</h3>
            <div className="space-y-4">
              <div>
                <div className="flex flex-col gap-0.5">
                  <div className="flex justify-between items-center">
                    <span className="text-text-secondary">Scripts Dispensed</span>
                    <span className="text-text-primary font-medium">
                      {formatNumber(ytdData.scriptsDispensed)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-text-secondary">Dispensary Turnover</span>
                    <span className="text-text-primary font-medium">
                      {formatCurrency(ytdData.dispensaryTurnover)}
                    </span>
                  </div>
                </div>
                <div className="mt-6 flex flex-col items-center justify-center relative" style={{ height: 70, width: '100%' }}>
                  <span className="text-text-secondary">Dispensary %</span>
                  <Doughnut
                    data={{
                      labels: ['Dispensary', 'Other'],
                      datasets: [
                        {
                          data: [dispensaryPercent, 100 - dispensaryPercent],
                          backgroundColor: ['#FFC300', '#3A3F4B'],
                          borderWidth: 0,
                        },
                      ],
                    }}
                    options={{
                      rotation: -90,
                      circumference: 180,
                      cutout: '60%',
                      plugins: {
                        legend: { display: false },
                        tooltip: { enabled: false },
                      },
                      responsive: true,
                      maintainAspectRatio: false,
                    }}
                    height={120}
                  />
                  <span
                    className="absolute font-bold text-white"
                    style={{
                      fontSize: 28,
                      top: '95%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      lineHeight: 1,
                    }}
                  >
                    {Math.round(dispensaryPercent)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Sales Breakdown Card */}
          <div className="card">
            <h3 className="text-xl font-semibold text-text-primary mb-4">Sales Breakdown</h3>
            <div className="flex items-center justify-center h-50">
              <Slider
                dots={true}
                infinite={false}
                speed={500}
                slidesToShow={1}
                slidesToScroll={1}
                arrows={false}
                className="w-full custom-carousel-dots"
                appendDots={dots => (
                  <div style={{ marginTop: '-5px' }}>
                    <ul> {dots} </ul>
                  </div>
                )}
              >
                {/* Slide 1: Sales Type Donut Chart */}
                <div>
                  <Doughnut
                    data={{
                      labels: ['Cash Sales', 'Debtor Sales', 'COD Sales'],
                      datasets: [
                        {
                          data: [ytdData.cashSales, ytdData.accountSales, ytdData.codSales],
                          backgroundColor: ['#FF492C', '#7ED957', '#8F6ED5'],
                          borderWidth: 0,
                        },
                      ],
                    }}
                    options={{
                      plugins: {
                        legend: {
                          display: true,
                          position: 'bottom',
                          labels: {
                            color: '#fff',
                            font: { size: 11, weight: 'bold' },
                            usePointStyle: true,
                            padding: 13,
                          },
                        },
                      },
                      cutout: '50%',
                      layout: { padding: 0 },
                      responsive: true,
                      maintainAspectRatio: false,
                    }}
                    height={160}
                  />
                </div>
                {/* Slide 2: Tender Breakdown Donut Chart */}
                <div>
                  <Doughnut
                    data={{
                      labels: ['Cash Tenders', 'Credit Card Tenders'],
                      datasets: [
                        {
                          data: [ytdData.cashTenders, ytdData.creditCardTenders],
                          backgroundColor: ['#FFC300', '#B57BFF'],
                          borderWidth: 0,
                        },
                      ],
                    }}
                    options={{
                      plugins: {
                        legend: {
                          display: true,
                          position: 'bottom',
                          labels: {
                            color: '#fff',
                            font: { size: 11, weight: 'bold' },
                            usePointStyle: true,
                            padding: 13,
                          },
                        },
                      },
                      cutout: '50%',
                      layout: { padding: 0 },
                      responsive: true,
                      maintainAspectRatio: false,
                    }}
                    height={160}
                  />
                </div>
              </Slider>
            </div>
          </div>

          {/* Monthly Best Days Card */}
          <div className="card">
            <h3 className="text-xl font-semibold text-text-primary mb-4">Monthly Best Days</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">Most Sales</span>
                <span className="text-text-primary font-medium">
                  {sidebarData.bestSalesDay ? (() => {
                    const date = new Date(sidebarData.bestSalesDay.date);
                    const day = date.getDate();
                    const month = date.toLocaleString('en-ZA', { month: 'long' });
                    return `${day} ${month} - R ${sidebarData.bestSalesDay.turnover.toLocaleString('en-ZA')}`;
                  })() : '-'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">Best Basket Value</span>
                <span className="text-text-primary font-medium">
                  {sidebarData.bestBasketDay ? (() => {
                    const date = new Date(sidebarData.bestBasketDay.date);
                    const day = date.getDate();
                    const month = date.toLocaleString('en-ZA', { month: 'long' });
                    return `${day} ${month} - R ${sidebarData.bestBasketDay.avg_basket_value.toLocaleString('en-ZA')}`;
                  })() : '-'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full Width Side by Side Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
        {/* 12 Month Turnover Chart */}
        <div className="card">
          <h2 className="text-2xl font-semibold text-text-primary mb-2">12 Month Turnover</h2>
          <div className="h-60 py-0 px-0">
            <div className="h-full flex items-center justify-center">
              <p className="text-text-secondary">Chart coming soon...</p>
            </div>
          </div>
        </div>

        {/* Average Daily Turnover by Weekday */}
        <div className="card">
          <h2 className="text-2xl font-semibold text-text-primary mb-2">Average Daily Turnover by Weekday</h2>
          <div className="h-60 py-0 px-0">
            <div className="h-full flex items-center justify-center">
              <p className="text-text-secondary">Chart coming soon...</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Yearly 