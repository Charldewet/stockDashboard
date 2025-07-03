import { useState, useEffect, useRef } from 'react'
import { TrendingUp, DollarSign, ShoppingCart, ShoppingBasket, Users, AlertCircle, TrendingDown, AlertTriangle, CheckCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { turnoverAPI, financialAPI, salesAPI } from '../services/api'
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
        title: 'High Stock Purchases',
        description: `Purchases ${purchaseRatio.toFixed(0)}% above cost of sales (${formatCurrency(data.purchases)} vs ${formatCurrency(data.costOfSales)})`
      });
    } else if (purchaseRatio > 10) {
      alerts.push({
        severity: 'warning',
        icon: AlertTriangle,
        title: 'Elevated Stock Purchases',
        description: `Purchases ${purchaseRatio.toFixed(0)}% above cost of sales (${formatCurrency(data.purchases)} vs ${formatCurrency(data.costOfSales)})`
      });
    }
  }

  return alerts;
};

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
  const [sparklineData, setSparklineData] = useState({
    turnover: [],
    grossProfit: [],
    costOfSales: [],
    avgBasket: [],
    gpPercent: []
  })
  const [scriptsVsTurnover14Days, setScriptsVsTurnover14Days] = useState({
    labels: [],
    scriptsData: [],
    turnoverData: []
  });

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
      fetchSparklineData(selectedDate)
      fetchScriptsVsTurnover14Days(selectedDate)
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
      const endDate = new Date(dateObj);
      const startDate = new Date(dateObj);
      startDate.setDate(startDate.getDate() - 13); // 14 days total (including today)
      
      const startDateStr = formatDateLocal(startDate);
      const endDateStr = formatDateLocal(endDate);

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
      const endDate = new Date(dateObj);
      const startDate = new Date(dateObj);
      startDate.setDate(startDate.getDate() - 13); // 14 days total (including today)
      
      const startDateStr = formatDateLocal(startDate);
      const endDateStr = formatDateLocal(endDate);

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

  const fetchSparklineData = async (dateObj) => {
    try {
      const endDate = new Date(dateObj)
      const startDate = new Date(dateObj)
      startDate.setDate(startDate.getDate() - 6) // Last 7 days
      
      const startDateStr = formatDateLocal(startDate)
      const endDateStr = formatDateLocal(endDate)

      const [turnoverData, gpData, dailyGPData, costsData, basketData] = await Promise.all([
        turnoverAPI.getDailyTurnoverForRange(selectedPharmacy, startDateStr, endDateStr),
        financialAPI.getGPForRange(selectedPharmacy, startDateStr, endDateStr),
        financialAPI.getDailyGPPercentForRange(selectedPharmacy, startDateStr, endDateStr),
        financialAPI.getCostsForRange(selectedPharmacy, startDateStr, endDateStr),
        financialAPI.getDailyAvgBasketForRange(selectedPharmacy, startDateStr, endDateStr)
      ])

      // Debug log to check GP data
      console.log('Daily GP Data received:', dailyGPData);
      
      // Extract and process GP% data
      const gpPercentData = dailyGPData.daily_gp_percent?.map(d => d.gp_percent || 0) || [];
      console.log('GP% data processed:', gpPercentData);

      setSparklineData({
        turnover: turnoverData.daily_turnover?.map(d => d.turnover) || [],
        grossProfit: gpData.daily_gp?.map(d => d.gp_value) || [],
        costOfSales: costsData.daily_costs?.map(d => d.cost_of_sales) || [],
        avgBasket: basketData.daily_avg_basket?.map(d => d.avg_basket_value) || [],
        gpPercent: gpPercentData
      })
    } catch (err) {
      console.error('Error fetching sparkline data:', err)
    }
  }

  const fetchScriptsVsTurnover14Days = async (dateObj) => {
    try {
      // Calculate the date 14 days ago
      const endDate = new Date(dateObj);
      const startDate = new Date(dateObj);
      startDate.setDate(startDate.getDate() - 13); // 14 days total (including today)
      
      const startDateStr = formatDateLocal(startDate);
      const endDateStr = formatDateLocal(endDate);

      // Fetch both scripts and turnover data
      const [scriptsData, turnoverData] = await Promise.all([
        salesAPI.getDailyScriptsDispensedForRange(selectedPharmacy, startDateStr, endDateStr),
        turnoverAPI.getDailyTurnoverForRange(selectedPharmacy, startDateStr, endDateStr)
      ]);

      // Generate date labels and data arrays
      const labels = [];
      const scripts = [];
      const turnover = [];
      const currentDate = new Date(startDate);
      
      while (currentDate <= endDate) {
        const dateStr = formatDateLocal(currentDate);
        const dayScripts = (scriptsData.daily_scripts_dispensed?.find(item => item.date === dateStr)?.scripts_dispensed || 0) / 100;
        const dayTurnover = turnoverData.daily_turnover?.find(item => item.date === dateStr)?.turnover || 0;
        
        // Format label as day/month
        const label = `${currentDate.getDate()}/${currentDate.getMonth() + 1}`;
        labels.push(label);
        scripts.push(dayScripts);
        turnover.push(dayTurnover);
        
        currentDate.setDate(currentDate.getDate() + 1);
      }

      setScriptsVsTurnover14Days({
        labels,
        scriptsData: scripts,
        turnoverData: turnover
      });
    } catch (err) {
      console.error('Error fetching scripts vs turnover data:', err);
    }
  };

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

  // Add helper function for trend indicators
  const getTrendIndicator = (currentValue, previousValue) => {
    const percentChange = calculatePercentageChange(currentValue, previousValue)
    if (percentChange > 0) {
      return <TrendingUp className="w-4 h-4 text-status-success" />
    } else if (percentChange < 0) {
      return <TrendingDown className="w-4 h-4 text-status-error" />
    }
    return null
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
            <h1 className="text-3xl font-bold text-text-primary leading-tight mb-1">
              Daily Overview
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
                <p className="text-text-secondary text-xs sm:text-sm font-medium">Total Turnover</p>
                <p className="text-xl sm:text-3xl font-bold text-accent-primary">
                  {formatCurrency(todayData.turnover)}
                </p>
              </div>
              <div className="w-8 h-8 sm:w-12 sm:h-12 bg-accent-primary rounded-lg flex items-center justify-center">
                <DollarSign className="text-surface-secondary w-4 h-4 sm:w-6 sm:h-6" />
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 mb-2">
              <p className="text-text-secondary text-xs sm:text-sm">
                vs 2024: {formatCurrency(previousYearData.turnover)}
              </p>
              {getTrendIndicator(todayData.turnover, previousYearData.turnover)}
              {(() => {
                const indicator = getChangeIndicator(todayData.turnover, previousYearData.turnover)
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
                    {Number(todayData.grossProfitPercent).toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-text-secondary text-xs sm:text-sm font-medium">Gross Profit: {formatCurrency(todayData.grossProfit)}</p>
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
                    {formatCurrency(todayData.costOfSales)}
                  </p>
                </div>
                <div>
                  <p className="text-text-secondary text-xs sm:text-sm font-medium">Purchases</p>
                  <p className="text-lg sm:text-2xl font-bold text-cost-sales">
                    {formatCurrency(todayData.purchases)}
                  </p>
                </div>
              </div>
              <div className="w-8 h-8 sm:w-12 sm:h-12 bg-cost-sales rounded-lg flex items-center justify-center">
                <ShoppingCart className="text-surface-secondary w-4 h-4 sm:w-6 sm:h-6" />
              </div>
            </div>
            {sparklineData.costOfSales.length > 0 && (
              <SparklineChart data={sparklineData.costOfSales} color="#E24313" />
            )}
          </div>
        </div>

        <div className="card sm:p-4 p-3">
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-text-secondary text-xs sm:text-sm font-medium">Avg Basket Value</p>
                <p className="text-xl sm:text-3xl font-bold text-accent-secondary-purple">
                  {formatCurrency(todayData.avgBasket)}
                </p>
              </div>
              <div className="w-8 h-8 sm:w-12 sm:h-12 bg-accent-secondary-purple rounded-lg flex items-center justify-center">
                <ShoppingBasket className="text-surface-secondary w-4 h-4 sm:w-6 sm:h-6" />
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 mb-2">
              <p className="text-text-secondary text-xs sm:text-sm">
                Items per Basket: <span className="font-semibold">{Number(todayData.avgBasketSize).toFixed(1)}</span>
              </p>
            </div>
            {sparklineData.avgBasket.length > 0 && (
              <SparklineChart data={sparklineData.avgBasket} color="#8F6ED5" />
            )}
          </div>
        </div>
      </div>

      {/* Alerts Section */}
      <div className="mb-4">
        <div className="card">
          <h2 className="text-xl font-semibold text-text-primary mb-4">Insights & Alerts</h2>
          <div className="max-h-[300px] overflow-y-auto">
            {(() => {
              try {
                const alerts = getAlerts(todayData, previousYearData, sparklineData);
                
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



      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Monthly Turnover Trend */}
        <div className="card h-[300px]">
          <h2 className="text-xl font-semibold text-text-primary mb-2">Monthly Turnover Trend</h2>
          <div className="h-[240px] p-3" style={{position: 'relative'}}>
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

        {/* 8 Day Turnover Chart */}
        <div className="card h-[300px]">
          <h2 className="text-xl font-semibold text-text-primary mb-4">Daily Turnover Comparison</h2>
          <div className="h-[240px] px-2">
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
                  layout: {
                    padding: {
                      bottom: 10
                    }
                  },
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
                        padding: 8,
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
      </div>

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Dispensary Summary */}
        <div className="card h-[400px]">
          <h3 className="text-xl font-semibold text-text-primary mb-4">Dispensary Summary</h3>
          <div className="space-y-6">
            {/* Dispensary Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-surface-secondary rounded-lg p-3">
                <p className="text-sm text-text-secondary mb-1">Scripts Today</p>
                <p className="text-xl font-bold text-text-primary">
                  {formatNumber(todayData.scriptsDispensed / 100)}
                </p>
              </div>
              <div className="bg-surface-secondary rounded-lg p-3">
                <p className="text-sm text-text-secondary mb-1">Avg Script Value</p>
                <p className="text-xl font-bold text-text-primary">
                  {formatCurrency(todayData.dispensaryTurnover / todayData.scriptsDispensed * 100)}
                </p>
              </div>
            </div>

            {/* Dispensary Turnover */}
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-text-secondary">Dispensary</span>
                  <span className="text-lg font-semibold text-text-primary">
                    {formatCurrency(todayData.dispensaryTurnover)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-secondary">Front Shop</span>
                  <span className="text-lg font-semibold text-text-primary">
                    {formatCurrency(todayData.turnover - todayData.dispensaryTurnover)}
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
                    <span className="text-lg font-semibold text-[#FFC300]">{Math.round(dispensaryPercent)}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-[#3A3F4B]"></div>
                      <span className="text-sm text-text-secondary">Front Shop</span>
                    </div>
                    <span className="text-lg font-semibold text-[#3A3F4B]">{Math.round(100 - dispensaryPercent)}%</span>
                  </div>
                </div>

                <div className="relative">
                  {/* Target Range Zone */}

                  {/* Base Progress Bar */}
                  <div className="h-4 bg-[#3A3F4B] rounded-full overflow-hidden relative">
                    {/* Actual Progress */}
                    <div 
                      className="h-full bg-[#FFC300] rounded-full"
                      style={{ width: `${Math.min(dispensaryPercent, 100)}%` }}
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
                      dispensaryPercent >= 40 && dispensaryPercent <= 60 
                        ? 'text-status-success' 
                        : 'text-status-warning'
                    }`}>
                      {dispensaryPercent >= 40 && dispensaryPercent <= 60 
                        ? 'Within Target' 
                        : dispensaryPercent < 40 
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

        {/* Sales Breakdown */}
        <div className="card h-[400px]">
          <h3 className="text-xl font-semibold text-text-primary mb-4">Sales Breakdown</h3>
          <div className="space-y-8">
            {/* Sales Values */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-surface-secondary rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-[#FF492C]" />
                  <p className="text-xs text-text-secondary">Cash</p>
                </div>
                <p className="text-sm font-semibold text-text-primary">{formatCurrency(todayData.cashSales)}</p>
                <p className="text-xs text-text-secondary mt-1">
                  {((todayData.cashSales / todayData.turnover) * 100).toFixed(1)}%
                </p>
              </div>
              <div className="bg-surface-secondary rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-[#7ED957]" />
                  <p className="text-xs text-text-secondary">Debtors</p>
                </div>
                <p className="text-sm font-semibold text-text-primary">{formatCurrency(todayData.accountSales)}</p>
                <p className="text-xs text-text-secondary mt-1">
                  {((todayData.accountSales / todayData.turnover) * 100).toFixed(1)}%
                </p>
              </div>
              <div className="bg-surface-secondary rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-[#8F6ED5]" />
                  <p className="text-xs text-text-secondary">COD</p>
                </div>
                <p className="text-sm font-semibold text-text-primary">{formatCurrency(todayData.codSales)}</p>
                <p className="text-xs text-text-secondary mt-1">
                  {((todayData.codSales / todayData.turnover) * 100).toFixed(1)}%
                </p>
              </div>
            </div>

            {/* Payment Methods */}
            <div>
              <h4 className="text-xl font-semibold text-text-primary mb-4">Payment Methods</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#FFC300]" />
                    <span className="text-sm text-text-secondary">Cash Tenders</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-text-primary">{formatCurrency(todayData.cashTenders)}</p>
                    <p className="text-xs text-text-secondary">
                      {((todayData.cashTenders / (todayData.cashTenders + todayData.creditCardTenders)) * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#FF492C]" />
                    <span className="text-sm text-text-secondary">Card Payments</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-text-primary">{formatCurrency(todayData.creditCardTenders)}</p>
                    <p className="text-xs text-text-secondary">
                      {((todayData.creditCardTenders / (todayData.cashTenders + todayData.creditCardTenders)) * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
                <div className="h-4 bg-surface-secondary rounded-full overflow-hidden mt-2 flex">
                  <div 
                    className="h-full bg-[#FFC300]"
                    style={{ 
                      width: `${(todayData.cashTenders / (todayData.cashTenders + todayData.creditCardTenders)) * 100}%` 
                    }}
                  />
                  <div 
                    className="h-full bg-[#FF492C]"
                    style={{ 
                      width: `${(todayData.creditCardTenders / (todayData.cashTenders + todayData.creditCardTenders)) * 100}%`
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 14 Day Turnover Chart */}
        <div className="card h-[300px]">
          <h3 className="text-xl font-semibold text-text-primary mb-4">14 Day Turnover</h3>
          <div className="h-[220px]">
            {dailyTurnover14Days.labels.length > 0 ? (
              <Bar
                data={{
                  labels: dailyTurnover14Days.labels,
                  datasets: [
                    {
                      type: 'bar',
                      label: 'Turnover',
                      data: dailyTurnover14Days.data,
                      backgroundColor: '#FF492C',
                      borderRadius: 6,
                      barPercentage: 0.9,
                      categoryPercentage: 0.95,
                      yAxisID: 'y',
                      order: 2,
                    },
                    {
                      type: 'line',
                      label: 'Basket Value',
                      data: dailyBasket14Days.data,
                      borderColor: '#FFF',
                      borderWidth: 3,
                      pointRadius: 0,
                      tension: 0.4,
                      yAxisID: 'y1',
                      order: 1,
                    }
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  layout: {
                    padding: {
                      bottom: 10
                    }
                  },
                  interaction: {
                    mode: 'index',
                    intersect: false,
                  },
                  plugins: {
                    legend: {
                      display: true,
                      position: 'top',
                      align: 'center',
                      labels: {
                        color: '#9CA3AF',
                        usePointStyle: true,
                        pointStyle: 'circle',
                        padding: 15,
                        boxWidth: 8,
                        boxHeight: 8,
                      }
                    },
                    tooltip: {
                      backgroundColor: 'rgba(0, 0, 0, 0.8)',
                      titleColor: '#fff',
                      bodyColor: '#fff',
                      callbacks: {
                        label: function(context) {
                          if (context.dataset.type === 'bar') {
                            return `Turnover: ${formatCurrency(context.parsed.y)}`;
                          } else {
                            return `Basket: ${formatCurrency(context.parsed.y)}`;
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
                        font: {
                          size: 11,
                        },
                      },
                    },
                    y: {
                      position: 'left',
                      grid: {
                        display: false,
                      },
                      ticks: {
                        color: '#9CA3AF',
                        callback: function(value) {
                          return formatNumber(value);
                        },
                      },
                      title: {
                        display: false,
                        text: 'Turnover',
                        color: '#FF492C',
                      },
                    },
                    y1: {
                      position: 'right',
                      grid: {
                        display: false,
                      },
                      ticks: {
                        color: '#9CA3AF',
                        callback: function(value) {
                          return formatShortCurrency(value);
                        },
                      },
                      title: {
                        display: false,
                        text: 'Basket',
                        color: '#FF492C',
                      },
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

        {/* Scripts vs Turnover Chart */}
        <div className="card h-[300px]">
          <h3 className="text-xl font-semibold text-text-primary mb-4">Scripts vs Turnover Trend</h3>
          <div className="h-[210px]">
            {scriptsVsTurnover14Days.labels.length > 0 ? (
              <Line
                data={{
                  labels: scriptsVsTurnover14Days.labels,
                  datasets: [
                    {
                      label: 'Scripts',
                      data: scriptsVsTurnover14Days.scriptsData,
                      borderColor: '#8F6ED5',
                      backgroundColor: 'rgba(143, 110, 213, 0.1)',
                      yAxisID: 'y',
                      fill: true,
                      tension: 0.4,
                      borderWidth: 3,
                      pointRadius: 0,
                    },
                    {
                      label: 'Turnover',
                      data: scriptsVsTurnover14Days.turnoverData,
                      borderColor: '#FF492C',
                      yAxisID: 'y1',
                      tension: 0.4,
                      borderWidth: 3,
                      pointRadius: 0,
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
                      position: 'top',
                      labels: {
                        color: '#9CA3AF',
                        usePointStyle: true,
                        pointStyle: 'circle',
                        padding: 15,
                        boxWidth: 8,
                        boxHeight: 8,
                      }
                    },
                    tooltip: {
                      backgroundColor: 'rgba(0, 0, 0, 0.8)',
                      titleColor: '#fff',
                      bodyColor: '#fff',
                      callbacks: {
                        label: function(context) {
                          if (context.dataset.label === 'Scripts') {
                            return `Scripts: ${formatNumber(context.parsed.y)}`;
                          } else {
                            return `Turnover: ${formatCurrency(context.parsed.y)}`;
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
                        font: {
                          size: 11,
                        },
                      },
                    },
                    y: {
                      position: 'left',
                      grid: {
                        display: false,
                      },
                      ticks: {
                        color: '#9CA3AF',
                        callback: function(value) {
                          return formatNumber(value);
                        },
                      },
                      title: {
                        display: false,
                        text: 'Scripts',
                        color: '#8F6ED5',
                      },
                    },
                    y1: {
                      position: 'right',
                      grid: {
                        display: false,
                      },
                      ticks: {
                        color: '#9CA3AF',
                        callback: function(value) {
                          return formatShortCurrency(value);
                        },
                      },
                      title: {
                        display: false,
                        text: 'Turnover',
                        color: '#FF492C',
                      },
                    },
                  },
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
    </div>
  )
}

export default Daily 