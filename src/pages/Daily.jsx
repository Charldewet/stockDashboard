import { useState, useEffect, useRef } from 'react'
import { TrendingUp, DollarSign, ShoppingCart, ShoppingBasket, Users, AlertCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { turnoverAPI, financialAPI, salesAPI } from '../services/api'
import { Doughnut, Line, Bar } from 'react-chartjs-2'
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Title, BarElement, Filler } from 'chart.js'
import 'slick-carousel/slick/slick.css'
import 'slick-carousel/slick/slick-theme.css'
import Slider from 'react-slick'
import './carousel-dots.css'
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Title, BarElement, Filler)

function formatDateLocal(date) {
  console.log('formatDateLocal input:', {
    date: date.toISOString(),
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate()
  });
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const formatted = `${year}-${month}-${day}`;
  
  console.log('formatDateLocal output:', formatted);
  return formatted;
}

// Function to get the same day of the week from the previous year
function getPreviousYearSameDayOfWeek(date) {
  const currentDate = new Date(date);
  const currentDayOfWeek = currentDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const currentYear = currentDate.getFullYear();
  const previousYear = currentYear - 1;
  
  // Find the same day of the week in the previous year
  // We'll look for the closest date that falls on the same day of the week
  const targetDate = new Date(previousYear, currentDate.getMonth(), currentDate.getDate());
  const targetDayOfWeek = targetDate.getDay();
  
  // Calculate the difference in days to get to the same day of the week
  const dayDifference = currentDayOfWeek - targetDayOfWeek;
  targetDate.setDate(targetDate.getDate() + dayDifference);
  
  return targetDate;
}

const Daily = ({ selectedDate }) => {
  console.log('🚨 DAILY COMPONENT MOUNTED 🚨', {
    selectedDate,
    time: new Date().toISOString()
  });

  const { selectedPharmacy } = useAuth()
  
  // Add logging for initial props
  console.log('Daily Component Props:', {
    selectedDate: selectedDate ? selectedDate.toISOString() : null,
    selectedDateType: selectedDate ? selectedDate.constructor.name : null,
    selectedPharmacy
  });

  const [todayData, setTodayData] = useState({
    turnover: 0,
    transactions: 0,
    avgBasket: 0,
    avgBasketSize: 0,
    grossProfit: 0,
    grossProfitPercent: 0,
    cashSales: 0,
    accountSales: 0,
    codSales: 0,
    cashTenders: 0,
    creditCardTenders: 0,
    scriptsDispensed: 0,
    dispensaryTurnover: 0
  })
  const [previousYearData, setPreviousYearData] = useState({
    turnover: 0
  })
  const [trendlineData, setTrendlineData] = useState({
    labels: [],
    cumulativeTurnover: [],
    prevYearCumulativeTurnover: []
  })
  const [dailyTurnover14Days, setDailyTurnover14Days] = useState({
    labels: [],
    data: []
  })
  const [dailyBasket14Days, setDailyBasket14Days] = useState({
    labels: [],
    data: []
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [dispensaryPercent, setDispensaryPercent] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState(null)
  const chartRef = useRef(null)
  const [monthlyTurnover, setMonthlyTurnover] = useState([])
  const [monthlyBasket, setMonthlyBasket] = useState([])
  // New state variables for additional charts
  const [monthlyTurnover12, setMonthlyTurnover12] = useState({ labels: [], data: [], prevYearData: [] })
  const [monthlyBasket12, setMonthlyBasket12] = useState({ labels: [], data: [] })
  const [dailyGPPercent30Days, setDailyGPPercent30Days] = useState({ labels: [], data: [] })

  useEffect(() => {
    console.log('🔥 DAILY COMPONENT EFFECT TRIGGERED 🔥', {
      selectedDate,
      selectedPharmacy,
      time: new Date().toISOString()
    });

    if (selectedPharmacy && selectedDate) {
      console.log('📊 FETCHING DATA 📊', {
        selectedDate: selectedDate.toISOString(),
        selectedPharmacy,
        isValidDate: selectedDate instanceof Date && !isNaN(selectedDate)
      });
      
      fetchDayData(selectedDate)
      fetchTrendlineData(selectedDate)
      fetchDailyTurnover14Days(selectedDate)
      fetchDailyBasket14Days(selectedDate)
      fetchMonthlyTurnoverAndBasket(selectedDate)
      fetch8DayTurnover(selectedDate)
      fetch30DayGPTrend(selectedDate)
    }
    // eslint-disable-next-line
  }, [selectedPharmacy, selectedDate])

  const fetchDayData = async (dateObj) => {
    setLoading(true)
    setError(null)
    try {
      const date = formatDateLocal(dateObj)
      const previousYearDate = getPreviousYearSameDayOfWeek(dateObj)
      const previousYearDateStr = formatDateLocal(previousYearDate)
      
      const [
        turnoverData,
        gpData,
        transactionsData,
        avgBasketData,
        avgBasketSizeData,
        cashSalesData,
        accountSalesData,
        codSalesData,
        previousYearTurnoverData,
        cashTendersData,
        creditCardTendersData,
        scriptsDispensedData,
        dispensaryPercentData,
        dispensaryTurnoverData
      ] = await Promise.all([
        turnoverAPI.getTurnoverForRange(selectedPharmacy, date, date),
        financialAPI.getGPForRange(selectedPharmacy, date, date),
        financialAPI.getTransactionsForRange(selectedPharmacy, date, date),
        financialAPI.getAvgBasketForRange(selectedPharmacy, date, date),
        financialAPI.getDailyAvgBasketForRange(selectedPharmacy, date, date),
        salesAPI.getDailyCashSalesForRange(selectedPharmacy, date, date),
        salesAPI.getDailyAccountSalesForRange(selectedPharmacy, date, date),
        salesAPI.getDailyCODSalesForRange(selectedPharmacy, date, date),
        turnoverAPI.getTurnoverForRange(selectedPharmacy, previousYearDateStr, previousYearDateStr),
        salesAPI.getDailyCashTendersForRange(selectedPharmacy, date, date),
        salesAPI.getDailyCreditCardTendersForRange(selectedPharmacy, date, date),
        salesAPI.getDailyScriptsDispensedForRange(selectedPharmacy, date, date),
        salesAPI.getDailyDispensaryPercentForRange(selectedPharmacy, date, date),
        salesAPI.getDailyDispensaryTurnoverForRange(selectedPharmacy, date, date)
      ])

      const turnover = turnoverData.turnover || 0
      const transactions = transactionsData.total_transactions || 0
      const avgBasket = avgBasketData.avg_basket_value || 0
      const avgBasketSize = avgBasketData.avg_basket_size || 0
      const grossProfit = gpData.cumulative_gp_value || 0
      const grossProfitPercent = gpData.avg_gp_percent || 0
      const cashSales = cashSalesData.daily_cash_sales?.[0]?.cash_sales || 0
      const accountSales = accountSalesData.daily_account_sales?.[0]?.account_sales || 0
      const codSales = codSalesData.daily_cod_sales?.[0]?.cod_sales || 0
      const previousYearTurnover = previousYearTurnoverData.turnover || 0
      const cashTenders = cashTendersData.daily_cash_tenders?.[0]?.cash_tenders_today || 0
      const creditCardTenders = creditCardTendersData.daily_credit_card_tenders?.[0]?.credit_card_tenders_today || 0
      const scriptsDispensed = scriptsDispensedData.daily_scripts_dispensed?.[0]?.scripts_dispensed || 0
      const percent = dispensaryPercentData.daily_dispensary_percent?.[0]?.dispensary_percent || 0;
      setDispensaryPercent(percent);

      // Fetch cost of sales and purchases
      const costsData = await financialAPI.getCostsForRange(selectedPharmacy, date, date);
      const costOfSales = costsData.cost_of_sales || 0;
      const purchases = costsData.purchases || 0;

      // Debug logging
      console.log('API Responses:', {
        turnoverData,
        transactionsData,
        avgBasketData,
        avgBasketSizeData,
        gpData,
        cashSalesData,
        accountSalesData,
        codSalesData,
        previousYearTurnoverData
      })
      
      console.log('Processed Data:', {
        turnover,
        transactions,
        avgBasket,
        avgBasketSize,
        grossProfit,
        grossProfitPercent,
        cashSales,
        accountSales,
        codSales,
        previousYearTurnover
      })

      setTodayData({
        turnover,
        transactions,
        avgBasket,
        avgBasketSize,
        grossProfit,
        grossProfitPercent,
        costOfSales,
        purchases,
        cashSales,
        accountSales,
        codSales,
        cashTenders,
        creditCardTenders,
        scriptsDispensed,
        dispensaryTurnover: dispensaryTurnoverData.daily_dispensary_turnover?.[0]?.dispensary_turnover || 0
      })
      
      setPreviousYearData({
        turnover: previousYearTurnover
      })
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }

  const fetchTrendlineData = async (dateObj) => {
    console.log('📈 FETCHING TRENDLINE DATA 📈', {
      dateObj,
      time: new Date().toISOString()
    });
    
    try {
      const { startOfMonth, endOfMonth } = getMonthToDateRange(dateObj)
      const startDate = formatDateLocal(startOfMonth)
      const endDate = formatDateLocal(endOfMonth)

      console.log('Fetching trendline data:', {
        selectedPharmacy,
        startDate,
        endDate,
        dateObj: dateObj.toISOString()
      });

      // Previous year range
      const prevYearStart = new Date(startOfMonth)
      prevYearStart.setFullYear(prevYearStart.getFullYear() - 1)
      const prevYearEnd = new Date(endOfMonth)
      prevYearEnd.setFullYear(prevYearEnd.getFullYear() - 1)
      const prevYearStartDate = formatDateLocal(prevYearStart)
      const prevYearEndDate = formatDateLocal(prevYearEnd)

      console.log('Previous year date range:', {
        prevYearStartDate,
        prevYearEndDate
      });

      // Fetch daily turnover for current and previous year
      const [dailyTurnoverData, prevYearTurnoverData] = await Promise.all([
        turnoverAPI.getDailyTurnoverForRange(selectedPharmacy, startDate, endDate),
        turnoverAPI.getDailyTurnoverForRange(selectedPharmacy, prevYearStartDate, prevYearEndDate)
      ])

      console.log('API Response Data:', {
        currentYear: dailyTurnoverData,
        previousYear: prevYearTurnoverData
      });

      // Generate date labels
      const labels = generateDateLabels(startOfMonth, endOfMonth)
      const prevYearLabels = generateDateLabels(prevYearStart, prevYearEnd)

      console.log('Generated Labels:', {
        currentYearLabels: labels,
        prevYearLabels
      });

      // Calculate cumulative turnover for current year
      const cumulativeTurnover = []
      let runningTotal = 0
      labels.forEach(date => {
        const dayData = dailyTurnoverData.daily_turnover?.find(item => item.date === date)
        const dayTurnover = dayData?.turnover || 0
        runningTotal += dayTurnover
        cumulativeTurnover.push(runningTotal)
      })

      // Calculate cumulative turnover for previous year
      const prevYearCumulativeTurnover = []
      let prevYearRunningTotal = 0
      prevYearLabels.forEach(date => {
        const dayData = prevYearTurnoverData.daily_turnover?.find(item => item.date === date)
        const dayTurnover = dayData?.turnover || 0
        prevYearRunningTotal += dayTurnover
        prevYearCumulativeTurnover.push(prevYearRunningTotal)
      })

      console.log('Calculated Cumulative Data:', {
        cumulativeTurnover,
        prevYearCumulativeTurnover
      });

      setTrendlineData({
        labels: labels.map(date => {
          const d = new Date(date)
          return `${d.getDate()}/${d.getMonth() + 1}`
        }),
        cumulativeTurnover,
        prevYearCumulativeTurnover
      })

      console.log('Final Trendline Data Set:', {
        labels: labels.map(date => {
          const d = new Date(date)
          return `${d.getDate()}/${d.getMonth() + 1}`
        }),
        cumulativeTurnover,
        prevYearCumulativeTurnover
      });

    } catch (err) {
      console.error('Error in fetchTrendlineData:', err);
      console.error('Error details:', {
        message: err.message,
        stack: err.stack,
        response: err.response?.data
      });
    }
  }

  const fetchDailyTurnover14Days = async (dateObj) => {
    try {
      // Calculate the date 14 days ago
      const endDate = new Date(dateObj)
      const startDate = new Date(dateObj)
      startDate.setDate(startDate.getDate() - 13) // 14 days total (including today)
      
      const startDateStr = formatDateLocal(startDate)
      const endDateStr = formatDateLocal(endDate)

      // Fetch daily turnover for the last 14 days
      const dailyTurnoverData = await turnoverAPI.getDailyTurnoverForRange(selectedPharmacy, startDateStr, endDateStr)

      // Generate date labels for the last 14 days
      const labels = []
      const data = []
      const currentDate = new Date(startDate)
      
      while (currentDate <= endDate) {
        const dateStr = formatDateLocal(currentDate)
        const dayData = dailyTurnoverData.daily_turnover?.find(item => item.date === dateStr)
        const dayTurnover = dayData?.turnover || 0
        
        // Format label as day/month
        const label = `${currentDate.getDate()}/${currentDate.getMonth() + 1}`
        labels.push(label)
        data.push(dayTurnover)
        
        currentDate.setDate(currentDate.getDate() + 1)
      }

      setDailyTurnover14Days({
        labels,
        data
      })
    } catch (err) {
      console.error('Error fetching 14-day daily turnover data:', err)
    }
  }

  const fetchDailyBasket14Days = async (dateObj) => {
    try {
      // Calculate the date 14 days ago
      const endDate = new Date(dateObj)
      const startDate = new Date(dateObj)
      startDate.setDate(startDate.getDate() - 13) // 14 days total (including today)
      
      const startDateStr = formatDateLocal(startDate)
      const endDateStr = formatDateLocal(endDate)

      // Fetch daily basket for the last 14 days
      const dailyBasketData = await financialAPI.getDailyAvgBasketForRange(selectedPharmacy, startDateStr, endDateStr)

      // Generate date labels for the last 14 days
      const labels = []
      const data = []
      const currentDate = new Date(startDate)
      
      while (currentDate <= endDate) {
        const dateStr = formatDateLocal(currentDate)
        const dayData = dailyBasketData.daily_avg_basket?.find(item => item.date === dateStr)
        const dayBasket = dayData?.avg_basket_value || 0
        
        // Format label as day/month
        const label = `${currentDate.getDate()}/${currentDate.getMonth() + 1}`
        labels.push(label)
        data.push(dayBasket)
        
        currentDate.setDate(currentDate.getDate() + 1)
      }

      setDailyBasket14Days({
        labels,
        data
      })
    } catch (err) {
      console.error('Error fetching 14-day daily basket data:', err)
    }
  }

  const fetchMonthlyTurnoverAndBasket = async (dateObj) => {
    try {
      const { startOfMonth, endOfMonth } = getMonthToDateRange(dateObj)
      const startDate = formatDateLocal(startOfMonth)
      const endDate = formatDateLocal(endOfMonth)

      // Fetch daily turnover and basket values for the month
      const [dailyTurnoverData, dailyBasketData] = await Promise.all([
        turnoverAPI.getDailyTurnoverForRange(selectedPharmacy, startDate, endDate),
        financialAPI.getDailyAvgBasketForRange(selectedPharmacy, startDate, endDate)
      ])

      setMonthlyTurnover(dailyTurnoverData.daily_turnover || [])
      setMonthlyBasket(dailyBasketData.daily_avg_basket || [])
    } catch (err) {
      console.error('Error fetching monthly turnover and basket data:', err)
    }
  }

  const fetch8DayTurnover = async (dateObj) => {
    try {
      // Calculate date range for last 8 days (selected date + 7 preceding days)
      const endDate = new Date(dateObj)
      const startDate = new Date(dateObj)
      startDate.setDate(startDate.getDate() - 7) // Go back 7 days

      // Calculate corresponding dates from previous year
      const prevYearEndDate = getPreviousYearSameDayOfWeek(endDate)
      const prevYearStartDate = getPreviousYearSameDayOfWeek(startDate)
      
      const startDateStr = formatDateLocal(startDate)
      const endDateStr = formatDateLocal(endDate)
      const prevYearStartDateStr = formatDateLocal(prevYearStartDate)
      const prevYearEndDateStr = formatDateLocal(prevYearEndDate)

      // Fetch daily turnover data for both current and previous year
      const [turnoverData, prevYearTurnoverData] = await Promise.all([
        turnoverAPI.getDailyTurnoverForRange(selectedPharmacy, startDateStr, endDateStr),
        turnoverAPI.getDailyTurnoverForRange(selectedPharmacy, prevYearStartDateStr, prevYearEndDateStr)
      ])

      // Process the data
      const labels = []
      const turnoverValues = []
      const prevYearTurnoverValues = []
      const currentDate = new Date(startDate)
      const prevYearDate = new Date(prevYearStartDate)

      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

      while (currentDate <= endDate) {
        const dateStr = formatDateLocal(currentDate)
        const prevYearDateStr = formatDateLocal(prevYearDate)
        
        const dayData = turnoverData.daily_turnover?.find(item => item.date === dateStr)
        const prevYearDayData = prevYearTurnoverData.daily_turnover?.find(item => item.date === prevYearDateStr)
        
        // Format label as date and day
        const dateLabel = `${currentDate.getDate()}/${currentDate.getMonth() + 1}`
        const dayLabel = days[currentDate.getDay()]
        labels.push([dateLabel, dayLabel]) // Store as array of [date, day]
        
        turnoverValues.push(dayData?.turnover || 0)
        prevYearTurnoverValues.push(prevYearDayData?.turnover || 0)
        
        currentDate.setDate(currentDate.getDate() + 1)
        prevYearDate.setDate(prevYearDate.getDate() + 1)
      }

      setMonthlyTurnover12({ 
        labels, 
        data: turnoverValues,
        prevYearData: prevYearTurnoverValues 
      })
      setMonthlyBasket12({ labels: [], data: [] }) // Clear basket data since we don't need it

    } catch (err) {
      console.error('Error fetching 8-day turnover data:', err)
    }
  }

  // New function to fetch 30-day GP trend data
  const fetch30DayGPTrend = async (dateObj) => {
    try {
      // Calculate date range for last 30 days
      const endDate = new Date(dateObj)
      const startDate = new Date(dateObj)
      startDate.setDate(startDate.getDate() - 29) // Go back 29 days for a total of 30 days
      
      const startDateStr = formatDateLocal(startDate)
      const endDateStr = formatDateLocal(endDate)

      // Fetch daily GP data
      const gpData = await financialAPI.getGPForRange(selectedPharmacy, startDateStr, endDateStr)

      // Process the data
      const labels = []
      const gpValues = []
      const currentDate = new Date(startDate)

      while (currentDate <= endDate) {
        const dateStr = formatDateLocal(currentDate)
        const dayData = gpData.daily_gp?.find(item => item.date === dateStr)
        
        // Format label as day/month
        const label = `${currentDate.getDate()}/${currentDate.getMonth() + 1}`
        labels.push(label)
        gpValues.push(dayData?.gp_percent || 0)
        
        currentDate.setDate(currentDate.getDate() + 1)
      }

      setDailyGPPercent30Days({ labels, data: gpValues })

    } catch (err) {
      console.error('Error fetching 30-day GP trend data:', err)
    }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-ZA').format(num)
  }

  const calculatePercentageChange = (current, previous) => {
    if (previous === 0) return current > 0 ? 100 : 0
    return ((current - previous) / previous) * 100
  }

  const getChangeIndicator = (current, previous) => {
    const percentageChange = calculatePercentageChange(current, previous)
    const isIncrease = percentageChange > 0
    const isDecrease = percentageChange < 0
    
    if (isIncrease) {
      return {
        arrow: '↗',
        color: 'text-status-success',
        text: `+${percentageChange.toFixed(1)}%`
      }
    } else if (isDecrease) {
      return {
        arrow: '↘',
        color: 'text-status-error',
        text: `${percentageChange.toFixed(1)}%`
      }
    } else {
      return {
        arrow: '→',
        color: 'text-text-secondary',
        text: '0%'
      }
    }
  }

  // Helper function to get month-to-date range
  const getMonthToDateRange = (date) => {
    console.log('getMonthToDateRange input:', {
      date: date.toISOString(),
      isValidDate: date instanceof Date && !isNaN(date)
    });
    
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1)
    const endOfMonth = new Date(date)
    
    console.log('getMonthToDateRange output:', {
      startOfMonth: startOfMonth.toISOString(),
      endOfMonth: endOfMonth.toISOString()
    });
    
    return { startOfMonth, endOfMonth }
  }

  // Helper function to generate date labels for the month
  const generateDateLabels = (startDate, endDate) => {
    console.log('generateDateLabels input:', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    });
    
    const labels = []
    const currentDate = new Date(startDate)
    
    while (currentDate <= endDate) {
      labels.push(formatDateLocal(currentDate))
      currentDate.setDate(currentDate.getDate() + 1)
    }
    
    console.log('generateDateLabels output:', labels);
    return labels
  }

  const formatShortCurrency = (value) => {
    if (value >= 1000000) {
      return `R ${(value / 1000000).toFixed(2)}M`
    } else if (value >= 1000) {
      return `R ${(value / 1000).toFixed(0)}k`
    } else {
      return `R ${value.toLocaleString('en-ZA')}`
    }
  }

  // Helper to get YoY difference for the selected date
  const getYoYBubble = () => {
    if (!trendlineData.labels.length) return null
    // Find the index for the selected date
    const selectedLabel = (() => {
      const d = new Date(selectedDate)
      return `${d.getDate()}/${d.getMonth() + 1}`
    })()
    const idx = trendlineData.labels.indexOf(selectedLabel)
    if (
      idx === -1 ||
      !trendlineData.cumulativeTurnover[idx] ||
      !trendlineData.prevYearCumulativeTurnover[idx]
    ) {
      return null
    }
    const current = trendlineData.cumulativeTurnover[idx]
    const previous = trendlineData.prevYearCumulativeTurnover[idx]
    const diff = current - previous
    const percent = previous === 0 ? 0 : ((diff / previous) * 100)
    const isUp = diff > 0
    const absDiff = Math.abs(diff)
    const absPercent = Math.abs(percent)
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
        {formatShortCurrency(absDiff)} (<span style={{fontWeight: 700}}>{isUp ? '+' : '-'}{absPercent.toFixed(0)}%</span>) YoY {isUp ? 'increase' : 'decrease'}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary mx-auto mb-4"></div>
            <p className="text-text-secondary">Loading daily data...</p>
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
            <p className="text-status-error mb-4">Error loading data</p>
            <button onClick={() => fetchDayData(selectedDate)} className="btn-primary">
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
            <h1 className="text-3xl font-bold text-text-primary leading-tight mb-4">
              Daily Overview
            </h1>
            <p className="text-text-secondary text-lg">
              Real-time daily performance metrics for {selectedPharmacy && selectedPharmacy.charAt(0).toUpperCase() + selectedPharmacy.slice(1)} Pharmacy
            </p>
          </div>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="card">
          <div className="flex items-center justify-between h-full">
            <div>
              <p className="text-text-secondary text-sm font-medium">Total Turnover</p>
              <p className="text-3xl font-bold text-accent-primary">
                {formatCurrency(todayData.turnover)}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-text-secondary text-sm">
                  2024: {formatCurrency(previousYearData.turnover)}
                </p>
                {(() => {
                  const indicator = getChangeIndicator(todayData.turnover, previousYearData.turnover)
                  return (
                    <span className={`text-sm font-medium ${indicator.color}`}>
                      {indicator.arrow} {indicator.text}
                    </span>
                  )
                })()}
              </div>
            </div>
            <div className="w-12 h-12 bg-accent-primary rounded-lg flex items-center justify-center">
              <DollarSign className="text-surface-secondary" size={24} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-text-secondary text-sm font-medium">Gross Profit</p>
              <div className="flex flex-col">
                <span className="text-xl font-bold text-text-primary">{formatCurrency(todayData.grossProfit)}</span>
              <p className="text-text-secondary text-sm font-medium">GP %</p>
                <span className="text-xl font-semibold text-text-primary">{Number(todayData.grossProfitPercent).toFixed(1)}%</span>
              </div>
            </div>
            <div className="w-12 h-12 bg-chart-gold rounded-lg flex items-center justify-center">
              <TrendingUp className="text-surface-secondary" size={24} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between h-full">
            <div>
              <p className="text-text-secondary text-sm font-medium">Cost of Sales</p>
              <div className="flex flex-col">
                <span className="text-xl font-bold text-cost-sales">{formatCurrency(todayData.costOfSales)}</span>
                <p className="text-text-secondary text-sm font-medium">Purchases</p>
                <span className="text-xl font-bold text-accent-primary">{formatCurrency(todayData.purchases)}</span>
              </div>
            </div>
            <div className="w-12 h-12 bg-cost-sales rounded-lg flex items-center justify-center">
              <ShoppingCart className="text-surface-secondary" size={24} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between h-full">
            <div>
              <p className="text-text-secondary text-sm font-medium">Avg Basket Value</p>
              <div className="flex flex-col">
                <span className="text-xl font-bold text-text-primary">{formatCurrency(todayData.avgBasket)}</span>
              <p className="text-text-secondary text-sm font-medium">Avg Basket Size</p>
                <span className="text-xl font-semibold text-text-primary">{Number(todayData.avgBasketSize).toFixed(1)} items</span>
              </div>
            </div>
            <div className="w-12 h-12 bg-accent-secondary-purple rounded-lg flex items-center justify-center">
              <ShoppingBasket className="text-surface-secondary" size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chart Section */}
        <div className="lg:col-span-2" style={{position: 'relative'}}>
          <div className="card mb-4">
            <h2 className="text-2xl font-semibold text-text-primary mb-2">Monthly Turnover Trend</h2>
            <div className="h-60 p-3" style={{position: 'relative'}}>
              {trendlineData.labels.length > 0 ? (
                <>
                  <Line
                    ref={chartRef}
                    data={{
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
                          pointHoverRadius: 0,
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
                          pointHoverRadius: 0,
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          display: false,
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
                              const year = new Date().getFullYear() - (context.datasetIndex === 1 ? 1 : 0)
                              const value = context.parsed.y
                              let valueStr = ''
                              if (value >= 1000000) {
                                valueStr = `R ${(value / 1000000).toFixed(2)}M`
                              } else if (value >= 1000) {
                                valueStr = `R ${(value / 1000).toFixed(0)}k`
                              } else {
                                valueStr = `R ${value.toLocaleString('en-ZA')}`
                              }
                              return `${year}: ${valueStr}`
                            },
                          },
                          labelTextColor: function(context) {
                            return context.datasetIndex === 0 ? '#FF492C' : '#E2AEA1'
                          },
                        },
                      },
                      scales: {
                        x: {
                          grid: {
                            display: false,
                          },
                          ticks: {
                            color: '#9CA3AF',
                            maxRotation: 45,
                          },
                        },
                        y: {
                          grid: {
                            display: false,
                          },
                          min: 0,
                          ticks: {
                            color: '#9CA3AF',
                            callback: function(value) {
                              if (value >= 1000000) {
                                return `R${(value / 1000000).toFixed(1)}M`
                              } else if (value >= 1000) {
                                return `R${(value / 1000).toFixed(0)}k`
                              } else {
                                return `R${value.toFixed(0)}`
                              }
                            }
                          },
                        },
                      },
                      interaction: {
                        intersect: false,
                        mode: 'index',
                      },
                      elements: {
                        point: {
                          radius: 0,
                          hoverRadius: 0,
                        },
                      },
                    }}
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

          {/* New Chart */}
          <div className="card">
            <h2 className="text-2xl font-semibold text-text-primary mb-2">14 Day Sales Window</h2>
            <div className="h-60 p-3" style={{position: 'relative'}}>
              {dailyTurnover14Days.labels.length > 0 ? (
                <Bar
                  data={{
                    labels: dailyTurnover14Days.labels,
                    datasets: [
                      {
                        label: 'Daily Turnover',
                        data: dailyTurnover14Days.data,
                        backgroundColor: '#FF492C',
                        borderColor: '#FF492C',
                        borderWidth: 1,
                        borderRadius: 4,
                        borderSkipped: false,
                        yAxisID: 'y',
                        order: 1,
                      },
                      {
                        label: 'Avg Basket Value',
                        data: dailyBasket14Days.data,
                        type: 'line',
                        borderColor: '#FFFFFF',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 3,
                        fill: false,
                        tension: 0.4,
                        pointBackgroundColor: '#FFFFFF',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointRadius: 0,
                        pointHoverRadius: 0,
                        yAxisID: 'y1',
                        order: 0,
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        display: true,
                        position: 'top',
                        labels: {
                          color: '#fff',
                          usePointStyle: true,
                          padding: 20,
                        },
                      },
                      tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderWidth: 0,
                        displayColors: true,
                        callbacks: {
                          label: function(context) {
                            const value = context.parsed.y
                            if (context.datasetIndex === 0) {
                              // Turnover data
                              let valueStr = ''
                              if (value >= 1000000) {
                                valueStr = `R ${(value / 1000000).toFixed(2)}M`
                              } else if (value >= 1000) {
                                valueStr = `R ${(value / 1000).toFixed(0)}k`
                              } else {
                                valueStr = `R ${value.toLocaleString('en-ZA')}`
                              }
                              return `Turnover: ${valueStr}`
                            } else {
                              // Basket data
                              return `Avg Basket: R ${value.toLocaleString('en-ZA')}`
                            }
                          },
                        },
                      },
                    },
                    scales: {
                      x: {
                        grid: {
                          display: false,
                        },
                        ticks: {
                          color: '#9CA3AF',
                          maxRotation: 45,
                        },
                      },
                      y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        grid: {
                          color: 'rgba(156, 163, 175, 0.1)',
                        },
                        min: 0,
                        ticks: {
                          color: '#9CA3AF',
                          callback: function(value) {
                            if (value >= 1000000) {
                              return `R${(value / 1000000).toFixed(1)}M`
                            } else if (value >= 1000) {
                              return `R${(value / 1000).toFixed(0)}k`
                            } else {
                              return `R${value.toFixed(0)}`
                            }
                          }
                        },
                      },
                      y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        grid: {
                          drawOnChartArea: false,
                        },
                        min: 0,
                        ticks: {
                          color: '#9CA3AF',
                          callback: function(value) {
                            return `R${value.toFixed(0)}`
                          }
                        },
                      },
                    },
                    interaction: {
                      intersect: false,
                      mode: 'index',
                    },
                  }}
                />
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-text-secondary">Loading daily turnover data...</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-3">
          <div className="card">
            <h3 className="text-xl font-semibold text-text-primary mb-4">Dispensary Summary</h3>
            <div className="space-y-4">
              <div>
                <div className="flex flex-col gap-0.5">
                  <div className="flex justify-between items-center">
                    <span className="text-text-secondary">Scripts Dispensed</span>
                    <span className="text-text-primary font-medium">
                      {formatNumber(todayData.scriptsDispensed / 100)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-text-secondary">Dispensary Turnover</span>
                    <span className="text-text-primary font-medium">
                      {formatCurrency(todayData.dispensaryTurnover)}
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
                {/* Slide 1: Donut Chart */}
                <div>
                  <Doughnut
                    data={{
                      labels: ['Cash Sales', 'Debtor Sales', 'COD Sales'],
                      datasets: [
                        {
                          data: [todayData.cashSales, todayData.accountSales, todayData.codSales],
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
                          data: [todayData.cashTenders, todayData.creditCardTenders],
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

          {/* Monthly Summary Card */}
          <div className="card">
            <h3 className="text-xl font-semibold text-text-primary mb-4">Monthly Best Days</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">Most Sales</span>
                <span className="text-text-primary font-medium">
                  {(() => {
                    if (!monthlyTurnover.length) return '-';
                    const maxDay = monthlyTurnover.reduce((max, curr) => curr.turnover > max.turnover ? curr : max, monthlyTurnover[0]);
                    const date = new Date(maxDay.date);
                    const day = date.getDate();
                    const month = date.toLocaleString('en-ZA', { month: 'long' });
                    return `${day} ${month} - R ${maxDay.turnover.toLocaleString('en-ZA')}`;
                  })()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-secondary">Best Basket Value</span>
                <span className="text-text-primary font-medium">
                  {(() => {
                    if (!monthlyBasket.length) return '-';
                    const maxDay = monthlyBasket.reduce((max, curr) => curr.avg_basket_value > max.avg_basket_value ? curr : max, monthlyBasket[0]);
                    const date = new Date(maxDay.date);
                    const day = date.getDate();
                    const month = date.toLocaleString('en-ZA', { month: 'long' });
                    return `${day} ${month} - R ${maxDay.avg_basket_value.toLocaleString('en-ZA')}`;
                  })()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Additional Charts Row - Full Width */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {/* 8 Day Turnover Chart */}
        <div className="card">
          <h2 className="text-2xl font-semibold text-text-primary mb-2">8 Day Turnover</h2>
          <div className="h-60 py-0 px-0">
            {monthlyTurnover12.labels.length > 0 ? (
              <Bar
                data={{
                  labels: monthlyTurnover12.labels.map(([date, day]) => [date, day]),
                  datasets: [
                    {
                      label: 'Current Year',
                      data: monthlyTurnover12.data,
                      backgroundColor: '#F6C643',
                      borderRadius: 6,
                      barPercentage: 0.9,
                      categoryPercentage: 0.85,
                    },
                    {
                      label: 'Previous Year',
                      data: monthlyTurnover12.prevYearData,
                      backgroundColor: '#3B3F4A',
                      borderRadius: 6,
                      barPercentage: 0.9,
                      categoryPercentage: 0.85,
                    }
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  interaction: {
                    mode: 'index',
                    intersect: false,
                  },
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
                      },
                    },
                    tooltip: {
                      backgroundColor: 'rgba(0, 0, 0, 0.8)',
                      titleColor: '#fff',
                      bodyColor: '#fff',
                      callbacks: {
                        label: function(context) {
                          const value = context.parsed.y;
                          const year = context.dataset.label === 'Current Year' ? new Date().getFullYear() : new Date().getFullYear() - 1;
                          return `${year}: ${formatCurrency(value)}`;
                        },
                      },
                    },
                  },
                  scales: {
                    x: {
                      grid: {
                        display: false,
                      },
                      ticks: {
                        color: '#9CA3AF',
                        font: {
                          size: 11,
                        },
                        callback: function(value, index) {
                          const [date, day] = this.getLabelForValue(value);
                          return [date, day];
                        },
                      },
                    },
                    y: {
                      grid: {
                        display: false,
                      },
                      ticks: {
                        color: '#9CA3AF',
                        callback: function(value) {
                          return formatShortCurrency(value);
                        },
                      },
                      beginAtZero: true,
                    },
                  },
                }}
              />
            ) : (
              <div className="h-full flex items-center justify-center">
                <p className="text-text-secondary">Loading turnover data...</p>
              </div>
            )}
          </div>
        </div>

        {/* Daily GP% Trend Chart */}
        <div className="card">
          <h2 className="text-2xl font-semibold text-text-primary mb-2">Daily GP% Trend</h2>
          <div className="h-60 py-0 px-0">
            {dailyGPPercent30Days.labels.length > 0 ? (
              <Line
                data={{
                  labels: dailyGPPercent30Days.labels,
                  datasets: [
                    {
                      label: 'GP%',
                      data: dailyGPPercent30Days.data,
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
                      pointBorderWidth: 2,
                      pointRadius: 0,
                      pointHoverRadius: 6,
                      pointHoverBorderWidth: 0,
                      pointHoverBackgroundColor: '#7ED957',
                      pointHoverBorderColor: '#fff',
                      spanGaps: true,
                    },
                    {
                      label: 'Target',
                      data: Array(dailyGPPercent30Days.labels.length).fill(25),
                      borderColor: 'rgba(240, 41, 41, 0.5)',
                      borderWidth: 2,
                      borderDash: [4, 4],
                      pointRadius: 0,
                      fill: false,
                      tension: 0,
                    }
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  interaction: {
                    intersect: false,
                    mode: 'index',
                    axis: 'x',
                  },
                  plugins: {
                    legend: {
                      display: false,
                    },
                    tooltip: {
                      backgroundColor: 'rgba(0, 0, 0, 0.8)',
                      titleColor: '#fff',
                      bodyColor: '#fff',
                      callbacks: {
                        label: function(context) {
                          const value = context.parsed.y;
                          return `GP: ${value.toFixed(1)}%`;
                        },
                      },
                    },
                  },
                  scales: {
                    x: {
                      grid: {
                        display: false,
                      },
                      ticks: {
                        color: '#9CA3AF',
                        font: {
                          size: 11,
                        },
                      },
                    },
                    y: {
                      grid: {
                        display: false,
                      },
                      ticks: {
                        color: '#9CA3AF',
                        callback: function(value) {
                          return `${value.toFixed(1)}%`;
                        },
                      },
                      min: 15,
                      max: 40,
                      beginAtZero: true,
                    },
                  },
                }}
              />
            ) : (
              <div className="h-full flex items-center justify-center">
                <p className="text-text-secondary">Loading GP trend data...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Daily 