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
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getMonthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getMonthEnd(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function getPreviousYearSameMonth(date) {
  return new Date(date.getFullYear() - 1, date.getMonth(), date.getDate());
}

function getLast12Months(date) {
  const months = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(date.getFullYear(), date.getMonth() - i, 1);
    months.push(new Date(d));
  }
  return months;
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

function calculateDayOfWeekAverages(dailyData) {
  console.log('Calculating day of week averages with data:', dailyData);
  if (!Array.isArray(dailyData)) {
    console.error('Daily data is not an array:', dailyData);
    return { labels: [], data: [] };
  }

  // Initialize counters for each day
  const totals = {
    0: { sum: 0, count: 0 }, // Sunday
    1: { sum: 0, count: 0 }, // Monday
    2: { sum: 0, count: 0 }, // Tuesday
    3: { sum: 0, count: 0 }, // Wednesday
    4: { sum: 0, count: 0 }, // Thursday
    5: { sum: 0, count: 0 }, // Friday
    6: { sum: 0, count: 0 }  // Saturday
  };

  // Sum up values for each day of the week
  dailyData.forEach(day => {
    if (!day || !day.date) {
      console.warn('Invalid day data:', day);
      return;
    }
    const date = new Date(day.date);
    const dayOfWeek = date.getDay();
    totals[dayOfWeek].sum += day.turnover || 0;
    totals[dayOfWeek].count++;
  });

  console.log('Calculated totals:', totals);

  // Calculate averages and prepare data
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const averages = dayNames.map((name, index) => ({
    day: name,
    average: totals[index].count > 0 ? totals[index].sum / totals[index].count : 0
  }));

  console.log('Calculated averages:', averages);

  return {
    labels: averages.map(item => item.day),
    data: averages.map(item => item.average)
  };
}

const Monthly = ({ selectedDate }) => {
  console.log('🚨 MONTHLY COMPONENT MOUNTED 🚨', {
    selectedDate,
    time: new Date().toISOString()
  });

  const { selectedPharmacy } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [mtdData, setMtdData] = useState({});
  const [previousYearMtd, setPreviousYearMtd] = useState({});
  const [trendlineData, setTrendlineData] = useState({ labels: [], cumulativeTurnover: [], prevYearCumulativeTurnover: [] });
  const [monthlyTurnover12, setMonthlyTurnover12] = useState({ labels: [], data: [] });
  const [monthlyBasket12, setMonthlyBasket12] = useState({ labels: [], data: [] });
  const [dispensaryPercent, setDispensaryPercent] = useState(0);
  const [sidebarData, setSidebarData] = useState({});
  const [dailyTurnover30Days, setDailyTurnover30Days] = useState({ labels: [], data: [] });
  const [dailyDispensaryTurnover30Days, setDailyDispensaryTurnover30Days] = useState({ labels: [], data: [] });
  const [turnover12, setTurnover12] = useState({ daily_turnover: [] });
  const chartRef = useRef(null);

  const getYoYBubble = () => {
    if (!trendlineData.labels.length) return null;
    
    // Find the index for the selected date
    const selectedLabel = (() => {
      const d = new Date(selectedDate);
      return `${d.getDate()}/${d.getMonth() + 1}`;
    })();
    const idx = trendlineData.labels.indexOf(selectedLabel);
    if (
      idx === -1 ||
      !trendlineData.cumulativeTurnover[idx] ||
      !trendlineData.prevYearCumulativeTurnover[idx]
    ) {
      return null;
    }
    const current = trendlineData.cumulativeTurnover[idx];
    const previous = trendlineData.prevYearCumulativeTurnover[idx];
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
        {formatShortCurrency(absDiff)} (<span style={{fontWeight: 700}}>{isUp ? '+' : '-'}{absPercent.toFixed(0)}%</span>) YoY {isUp ? 'increase' : 'decrease'}
      </div>
    );
  };

  useEffect(() => {
    console.log('🔥 MONTHLY COMPONENT EFFECT TRIGGERED 🔥', {
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

    console.log('📊 FETCHING MONTHLY DATA 📊', {
      selectedDate: selectedDate.toISOString(),
      selectedPharmacy,
      isValidDate: selectedDate instanceof Date && !isNaN(selectedDate)
    });
    
    fetchAllMonthlyData(selectedDate);
    // Debug: Fetch and log cumulative turnover for the current month
    (async () => {
      const startOfMonth = getMonthStart(selectedDate);
      const endOfMonth = selectedDate;
      const startDate = formatDateLocal(startOfMonth);
      const endDate = formatDateLocal(endOfMonth);
      console.log('[Monthly Turnover Card] Params:', { selectedPharmacy, startDate, endDate });
      const result = await turnoverAPI.getTurnoverForRange(selectedPharmacy, startDate, endDate);
      console.log('[Monthly Turnover Card] API Response:', result);
    })();
  }, [selectedPharmacy, selectedDate]);

  const fetchAllMonthlyData = async (dateObj) => {
    if (!dateObj || !(dateObj instanceof Date) || isNaN(dateObj)) {
      console.error('❌ Invalid date object provided to fetchAllMonthlyData:', dateObj);
      setError('Invalid date selected');
      return;
    }

    console.log('📈 FETCHING ALL MONTHLY DATA 📈', {
      dateObj,
      dateObjValid: dateObj instanceof Date && !isNaN(dateObj),
      time: new Date().toISOString()
    });

    setLoading(true);
    setError(null);
    try {
      // Get date range for past 365 days
      const endDate = dateObj;
      const startDate = new Date(dateObj);
      startDate.setDate(startDate.getDate() - 365);
      
      const startDateStr = formatDateLocal(startDate);
      const endDateStr = formatDateLocal(endDate);

      console.log('📅 Fetching turnover data for date range:', {
        startDateStr,
        endDateStr
      });

      // Fetch turnover data for the past year
      const yearlyTurnover = await turnoverAPI.getDailyTurnoverForRange(
        selectedPharmacy,
        startDateStr,
        endDateStr
      );

      console.log('📊 Received yearly turnover data:', yearlyTurnover);

      // Store the data
      setTurnover12(yearlyTurnover);

      // Month-to-date range
      const startOfMonth = getMonthStart(dateObj);
      const endOfMonth = dateObj;
      const startDateMtd = formatDateLocal(startOfMonth);
      const endDateMtd = formatDateLocal(endOfMonth);

      console.log('📅 CALCULATED DATE RANGES 📅', {
        startOfMonth: startOfMonth.toISOString(),
        endOfMonth: endOfMonth.toISOString(),
        startDateMtd,
        endDateMtd
      });

      // Previous year MTD
      const prevYearDate = getPreviousYearSameMonth(dateObj);
      const prevYearStart = getMonthStart(prevYearDate);
      const prevYearEnd = prevYearDate;
      const prevYearStartDate = formatDateLocal(prevYearStart);
      const prevYearEndDate = formatDateLocal(prevYearEnd);

      console.log('⏮️ PREVIOUS YEAR DATES ⏮️', {
        prevYearStartDate,
        prevYearEndDate
      });

      // Fetch trendline data
      const [dailyTurnover, prevYearDailyTurnover] = await Promise.all([
        turnoverAPI.getDailyTurnoverForRange(selectedPharmacy, startDateMtd, endDateMtd),
        turnoverAPI.getDailyTurnoverForRange(selectedPharmacy, prevYearStartDate, prevYearEndDate)
      ]);

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

      // Previous year data
      prevYearDailyTurnover.daily_turnover?.forEach(day => {
        prevYearRunningTotal += day.turnover || 0;
        prevYearCumulativeTurnover.push(prevYearRunningTotal);
      });

      console.log('Calculated Cumulative Data:', {
        labels,
        cumulativeTurnover,
        prevYearCumulativeTurnover
      });

      setTrendlineData({
        labels,
        cumulativeTurnover,
        prevYearCumulativeTurnover
      });

      // 12 months range
      const last12Months = getLast12Months(dateObj);
      const firstMonth = last12Months[0];
      const lastMonth = last12Months[last12Months.length - 1];
      const firstMonthStart = formatDateLocal(getMonthStart(firstMonth));
      const lastMonthEnd = formatDateLocal(getMonthEnd(lastMonth));

      console.log('📊 12 MONTH RANGE 📊', {
        firstMonthStart,
        lastMonthEnd,
        monthsCount: last12Months.length
      });

      // Detailed Debug: Log all API call parameters
      console.log('[Monthly] Params:', {
        pharmacy: selectedPharmacy,
        startDateMtd,
        endDateMtd,
        prevYearStartDate,
        prevYearEndDate,
        firstMonthStart,
        lastMonthEnd
      });

      // Individual API call debug logs
      const logApi = async (label, fn, ...args) => {
        console.log(`[Monthly] Calling ${label} with`, ...args);
        const res = await fn(...args);
        console.log(`[Monthly] Response for ${label}:`, res);
        return res;
      };

      const [
        turnoverMtd,
        gpMtd,
        transactionsMtd,
        avgBasketMtd,
        avgBasketSizeMtd,
        cashSalesMtd,
        accountSalesMtd,
        codSalesMtd,
        previousYearTurnoverMtd,
        cashTendersMtd,
        creditCardTendersMtd,
        scriptsDispensedMtd,
        dispensaryPercentMtd,
        dispensaryTurnoverMtd,
        costsMtd,
        turnover12,
        basket12
      ] = await Promise.all([
        logApi('getTurnoverForRange', turnoverAPI.getTurnoverForRange, selectedPharmacy, startDateMtd, endDateMtd),
        logApi('getGPForRange', financialAPI.getGPForRange, selectedPharmacy, startDateMtd, endDateMtd),
        logApi('getTransactionsForRange', financialAPI.getTransactionsForRange, selectedPharmacy, startDateMtd, endDateMtd),
        logApi('getAvgBasketForRange', financialAPI.getAvgBasketForRange, selectedPharmacy, startDateMtd, endDateMtd),
        logApi('getDailyAvgBasketForRange', financialAPI.getDailyAvgBasketForRange, selectedPharmacy, startDateMtd, endDateMtd),
        logApi('getDailyCashSalesForRange', salesAPI.getDailyCashSalesForRange, selectedPharmacy, startDateMtd, endDateMtd),
        logApi('getDailyAccountSalesForRange', salesAPI.getDailyAccountSalesForRange, selectedPharmacy, startDateMtd, endDateMtd),
        logApi('getDailyCODSalesForRange', salesAPI.getDailyCODSalesForRange, selectedPharmacy, startDateMtd, endDateMtd),
        logApi('getTurnoverForRange (prev year)', turnoverAPI.getTurnoverForRange, selectedPharmacy, prevYearStartDate, prevYearEndDate),
        logApi('getDailyCashTendersForRange', salesAPI.getDailyCashTendersForRange, selectedPharmacy, startDateMtd, endDateMtd),
        logApi('getDailyCreditCardTendersForRange', salesAPI.getDailyCreditCardTendersForRange, selectedPharmacy, startDateMtd, endDateMtd),
        logApi('getDailyScriptsDispensedForRange', salesAPI.getDailyScriptsDispensedForRange, selectedPharmacy, startDateMtd, endDateMtd),
        logApi('getDailyDispensaryPercentForRange', salesAPI.getDailyDispensaryPercentForRange, selectedPharmacy, startDateMtd, endDateMtd),
        logApi('getDailyDispensaryTurnoverForRange', salesAPI.getDailyDispensaryTurnoverForRange, selectedPharmacy, startDateMtd, endDateMtd),
        logApi('getCostsForRange', financialAPI.getCostsForRange, selectedPharmacy, startDateMtd, endDateMtd),
        logApi('getDailyTurnoverForRange (12mo)', turnoverAPI.getDailyTurnoverForRange, selectedPharmacy, firstMonthStart, lastMonthEnd),
        logApi('getDailyAvgBasketForRange (12mo)', financialAPI.getDailyAvgBasketForRange, selectedPharmacy, firstMonthStart, lastMonthEnd)
      ]);

      console.log('🔍 RAW API DATA VALUES 🔍', {
        turnoverMtd,
        gpMtd,
        transactionsMtd,
        avgBasketMtd,
        avgBasketSizeMtd,
        cashSalesMtd,
        accountSalesMtd,
        codSalesMtd,
        previousYearTurnoverMtd,
        cashTendersMtd,
        creditCardTendersMtd,
        scriptsDispensedMtd,
        dispensaryPercentMtd,
        dispensaryTurnoverMtd,
        costsMtd,
        turnover12,
        basket12
      });

      // MTD data processing
      const processedMtdData = {
        turnover: turnoverMtd.turnover || 0,
        transactions: transactionsMtd.total_transactions || 0,
        avgBasket: avgBasketMtd.avg_basket_value || 0,
        avgBasketSize: avgBasketMtd.avg_basket_size || 0,
        grossProfit: gpMtd.cumulative_gp_value || 0,
        grossProfitPercent: gpMtd.avg_gp_percent || 0,
        costOfSales: costsMtd.cost_of_sales || 0,
        purchases: costsMtd.purchases || 0,
        cashSales: cashSalesMtd.daily_cash_sales?.reduce((sum, d) => sum + (d.cash_sales || 0), 0) || 0,
        accountSales: accountSalesMtd.daily_account_sales?.reduce((sum, d) => sum + (d.account_sales || 0), 0) || 0,
        codSales: codSalesMtd.daily_cod_sales?.reduce((sum, d) => sum + (d.cod_sales || 0), 0) || 0,
        cashTenders: cashTendersMtd.daily_cash_tenders?.reduce((sum, d) => sum + (d.cash_tenders_today || 0), 0) || 0,
        creditCardTenders: creditCardTendersMtd.daily_credit_card_tenders?.reduce((sum, d) => sum + (d.credit_card_tenders_today || 0), 0) || 0,
        scriptsDispensed: scriptsDispensedMtd.daily_scripts_dispensed?.reduce((sum, d) => sum + (d.scripts_dispensed || 0), 0) || 0,
        dispensaryTurnover: dispensaryTurnoverMtd.daily_dispensary_turnover?.reduce((sum, d) => sum + (d.dispensary_turnover || 0), 0) || 0
      };

      console.log('🔢 PROCESSED MTD DATA 🔢', {
        processedMtdData,
        validations: {
          turnover: typeof processedMtdData.turnover === 'number' && !isNaN(processedMtdData.turnover),
          transactions: typeof processedMtdData.transactions === 'number' && !isNaN(processedMtdData.transactions),
          avgBasket: typeof processedMtdData.avgBasket === 'number' && !isNaN(processedMtdData.avgBasket),
          grossProfit: typeof processedMtdData.grossProfit === 'number' && !isNaN(processedMtdData.grossProfit),
          costOfSales: typeof processedMtdData.costOfSales === 'number' && !isNaN(processedMtdData.costOfSales)
        }
      });

      // Monthly data processing
      const monthlyLabels = last12Months.map(d => d.toLocaleString('en-ZA', { month: 'short', year: '2-digit' }));
      const monthlyTurnover = last12Months.map(monthDate => {
        const monthStr = formatDateLocal(getMonthStart(monthDate)).slice(0, 7); // 'YYYY-MM'
        const turnoverForMonth = turnover12.daily_turnover?.filter(item => item.date.startsWith(monthStr)).reduce((sum, d) => sum + (d.turnover || 0), 0) || 0;
        console.log('📊 Processing Month Turnover:', { monthStr, turnoverForMonth });
        return turnoverForMonth;
      });

      const monthlyBasket = last12Months.map(monthDate => {
        const monthStr = formatDateLocal(getMonthStart(monthDate)).slice(0, 7);
        const baskets = basket12.daily_avg_basket?.filter(item => item.date.startsWith(monthStr)).map(d => d.avg_basket_value || 0) || [];
        const avgBasket = baskets.length ? (baskets.reduce((a, b) => a + b, 0) / baskets.length) : 0;
        console.log('🛒 Processing Month Basket:', { monthStr, basketsCount: baskets.length, avgBasket });
        return avgBasket;
      });

      console.log('📈 MONTHLY DATA PROCESSED 📈', {
        labels: monthlyLabels,
        turnover: monthlyTurnover,
        basket: monthlyBasket,
        validations: {
          turnoverValid: monthlyTurnover.every(v => typeof v === 'number' && !isNaN(v)),
          basketValid: monthlyBasket.every(v => typeof v === 'number' && !isNaN(v))
        }
      });

      // Set all state
      setMtdData(processedMtdData);
      setPreviousYearMtd({ turnover: previousYearTurnoverMtd.turnover || 0 });
      
      // Calculate average dispensary percent for the month
      const monthlyDispensaryPercent = dispensaryPercentMtd.daily_dispensary_percent?.reduce((sum, day) => sum + (day.dispensary_percent || 0), 0) || 0;
      const daysWithData = dispensaryPercentMtd.daily_dispensary_percent?.length || 1;
      const avgDispensaryPercent = monthlyDispensaryPercent / daysWithData;
      
      console.log('📊 Dispensary Percent Calculation:', {
        monthlyDispensaryPercent,
        daysWithData,
        avgDispensaryPercent,
        rawData: dispensaryPercentMtd.daily_dispensary_percent
      });
      
      setDispensaryPercent(avgDispensaryPercent);
      setMonthlyTurnover12({ labels: monthlyLabels, data: monthlyTurnover });
      setMonthlyBasket12({ labels: monthlyLabels, data: monthlyBasket });

      // Process sidebar data
      const bestSalesDay = turnover12.daily_turnover
        ?.filter(item => item.date.startsWith(formatDateLocal(startOfMonth).slice(0, 7)))
        .reduce((max, curr) => curr.turnover > (max?.turnover || 0) ? curr : max, null);

      const bestBasketDay = basket12.daily_avg_basket
        ?.filter(item => item.date.startsWith(formatDateLocal(startOfMonth).slice(0, 7)))
        .reduce((max, curr) => curr.avg_basket_value > (max?.avg_basket_value || 0) ? curr : max, null);

      console.log('📊 SIDEBAR DATA 📊', {
        bestSalesDay,
        bestBasketDay,
        validations: {
          bestSalesDayValid: bestSalesDay && typeof bestSalesDay.turnover === 'number' && !isNaN(bestSalesDay.turnover),
          bestBasketDayValid: bestBasketDay && typeof bestBasketDay.avg_basket_value === 'number' && !isNaN(bestBasketDay.avg_basket_value)
        }
      });

      setSidebarData({ bestSalesDay, bestBasketDay });

      // Fetch 30-day daily turnover data
      await fetchDailyTurnover30Days(dateObj);

    } catch (err) {
      console.error('❌ ERROR IN MONTHLY DATA PROCESSING ❌', {
        error: err,
        message: err.message,
        stack: err.stack,
        response: err.response?.data
      });
      setError(err.response?.data?.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const fetchDailyTurnover30Days = async (dateObj) => {
    try {
      // Calculate the date 30 days ago
      const endDate = new Date(dateObj);
      const startDate = new Date(dateObj);
      startDate.setDate(startDate.getDate() - 29); // 30 days total (including today)
      
      const startDateStr = formatDateLocal(startDate);
      const endDateStr = formatDateLocal(endDate);

      console.log('📊 Fetching 30-day daily turnover data:', {
        selectedPharmacy,
        startDateStr,
        endDateStr,
        dateObj: dateObj.toISOString()
      });

      // Fetch both total and dispensary turnover for the last 30 days
      const [dailyTurnoverData, dailyDispensaryData] = await Promise.all([
        turnoverAPI.getDailyTurnoverForRange(selectedPharmacy, startDateStr, endDateStr),
        salesAPI.getDailyDispensaryTurnoverForRange(selectedPharmacy, startDateStr, endDateStr)
      ]);

      // Generate date labels and data for the last 30 days
      const labels = [];
      const data = [];
      const dispensaryData = [];
      const currentDate = new Date(startDate);
      
      while (currentDate <= endDate) {
        const dateStr = formatDateLocal(currentDate);
        const dayData = dailyTurnoverData.daily_turnover?.find(item => item.date === dateStr);
        const dispensaryDayData = dailyDispensaryData.daily_dispensary_turnover?.find(item => item.date === dateStr);
        
        const dayTurnover = dayData?.turnover || 0;
        const dayDispensaryTurnover = dispensaryDayData?.dispensary_turnover || 0;
        
        // Format label as day/month
        const label = `${currentDate.getDate()}/${currentDate.getMonth() + 1}`;
        labels.push(label);
        data.push(dayTurnover);
        dispensaryData.push(dayDispensaryTurnover);
        
        currentDate.setDate(currentDate.getDate() + 1);
      }

      console.log('📈 30-day turnover data processed:', {
        labels,
        totalTurnover: data,
        dispensaryTurnover: dispensaryData,
        dataPoints: data.length
      });

      setDailyTurnover30Days({
        labels,
        data
      });
      setDailyDispensaryTurnover30Days({
        labels,
        data: dispensaryData
      });
    } catch (err) {
      console.error('❌ Error fetching 30-day turnover data:', err);
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

  // ... Render ...
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary mx-auto mb-4"></div>
            <p className="text-text-secondary">Loading monthly data...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    console.error('Monthly component error:', error);
    return (
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-status-error mx-auto mb-4" />
            <p className="text-status-error mb-4">Error loading data: {error}</p>
            <button onClick={() => fetchAllMonthlyData(selectedDate)} className="btn-primary">
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!turnover12?.daily_turnover || !monthlyTurnover12.labels.length) {
    console.log('Monthly component waiting for data:', {
      turnover12: turnover12?.daily_turnover?.length,
      monthlyTurnover12: monthlyTurnover12.labels.length
    });
    return (
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary mx-auto mb-4"></div>
            <p className="text-text-secondary">Loading chart data...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
      {console.log('Rendering Monthly component with state:', {
        loading,
        error,
        turnover12: turnover12?.daily_turnover?.length,
        monthlyTurnover12,
        trendlineData,
      })}
      {/* Page Header */}
      <div className="mb-4">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
        <h1 className="text-3xl font-bold text-text-primary leading-tight mb-4">
              Monthly Overview
        </h1>
        <p className="text-text-secondary text-lg">
              Month-to-date performance metrics for {selectedPharmacy && selectedPharmacy.charAt(0).toUpperCase() + selectedPharmacy.slice(1)} Pharmacy
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
              <p className="text-2xl font-bold text-accent-primary">
                {formatCurrency(mtdData.turnover)}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-text-secondary text-[12px]">
                  Prev Year: {formatCurrency(previousYearMtd.turnover)}
                </p>
                {(() => {
                  const indicator = getChangeIndicator(mtdData.turnover, previousYearMtd.turnover)
                  return (
                    <span className={`text-[12px] font-medium ${indicator.color}`}>
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
                <span className="text-xl font-bold text-text-primary">{formatCurrency(mtdData.grossProfit)}</span>
                <p className="text-text-secondary text-sm font-medium">GP %</p>
                <span className="text-xl font-semibold text-text-primary">{Number(mtdData.grossProfitPercent).toFixed(1)}%</span>
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
                <span className="text-xl font-bold text-cost-sales">{formatCurrency(mtdData.costOfSales)}</span>
                <p className="text-text-secondary text-sm font-medium">Purchases</p>
                <span className="text-xl font-bold text-accent-primary">{formatCurrency(mtdData.purchases)}</span>
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
                <span className="text-xl font-bold text-text-primary">{formatCurrency(mtdData.avgBasket)}</span>
                <p className="text-text-secondary text-sm font-medium">Avg Basket Size</p>
                <span className="text-xl font-semibold text-text-primary">{Number(mtdData.avgBasketSize).toFixed(1)} items</span>
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
          {/* New Chart - Empty for now */}
          <div className="card mb-4">
            <h2 className="text-2xl font-semibold text-text-primary mb-2">30 Day Turnover Trend</h2>
            <div className="h-60 py-0 px-0" style={{position: 'relative'}}>
              {dailyTurnover30Days.labels.length > 0 ? (
                <Line
                  key={dailyTurnover30Days.labels.join(',')}
                  data={{
                    labels: dailyTurnover30Days.labels,
                    datasets: [
                      {
                        label: 'Total Turnover',
                        data: dailyTurnover30Days.data,
                        borderColor: '#FF492C',
                        backgroundColor: function(context) {
                          const chart = context.chart;
                          const {ctx, chartArea} = chart;
                          if (!chartArea) {
                            return 'rgba(255, 73, 44, 0.1)';  // fallback color
                          }
                          const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                          gradient.addColorStop(0, 'rgba(255, 73, 44, 0.8)');  // 80% opacity at top
                          gradient.addColorStop(1, 'rgba(255, 73, 44, 0)');    // 0% opacity at bottom
                          return gradient;
                        },
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
                        label: 'Dispensary Turnover',
                        data: dailyDispensaryTurnover30Days.data,
                        borderColor: '#FFC300',
                        backgroundColor: 'transparent',
                        borderWidth: 3,
                        fill: false,
                        tension: 0.4,
                        pointBackgroundColor: '#FFC300',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 0,
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
                          borderRadius: 0,
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
                          },
                        },
                      },
                    },
                    scales: {
                      x: {
                        grid: {
                          display: false,
                          color: 'rgba(156, 163, 175, 0.1)',
                        },
                        ticks: {
                          color: '#9CA3AF',
                          maxRotation: 45,
                          font: {
                            size: 11,
                            weight: 'bold'
                          },
                          padding: 8
                        },
                      },
                      y: {
                        grid: {
                          display: false,
                        },
                        min: -5000,
                        ticks: {
                          color: '#9CA3AF',
                          callback: function(value) {
                            if (value < 0) {
                              return ''; // Hide negative labels
                            }
                            if (value >= 1000000) {
                              return `R${(value / 1000000).toFixed(1)}M`;
                            } else if (value >= 1000) {
                              return `R${(value / 1000).toFixed(0)}k`;
                            } else {
                              return `R${value.toFixed(0)}`;
                            }
                          },
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
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-text-secondary">Loading 30-day turnover data...</p>
                </div>
              )}
            </div>
          </div>
          
          {/* Monthly Turnover Trend */}
          <div className="card mb-4">
            <h2 className="text-2xl font-semibold text-text-primary mb-2">Monthly Turnover Trend</h2>
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
                          label: 'Prev Year',
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
                            color: '#9CA3AF',
                            usePointStyle: true,
                            pointStyle: 'circle',
                            padding: 5,
                            boxWidth: 8,
                            boxHeight: 8,
                            useBorderRadius: true,
                            borderRadius: 0,
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
                            },
                          },
                        },
                      },
                      scales: {
                        x: {
                          grid: {
                            display: false,
                            color: 'rgba(156, 163, 175, 0.1)',
                          },
                          ticks: {
                            color: '#9CA3AF',
                            maxRotation: 45,
                            font: {
                              size: 11,
                              weight: 'bold'
                            },
                            padding: 8
                          },
                        },
                        y: {
                          grid: {
                            display: false,
                          },
                          min: -1000,
                          ticks: {
                            color: '#9CA3AF',
                            callback: function(value) {
                              if (value < 0) {
                                return ''; // Hide negative labels
                              }
                              if (value >= 1000000) {
                                return `R${(value / 1000000).toFixed(1)}M`;
                              } else if (value >= 1000) {
                                return `R${(value / 1000).toFixed(0)}k`;
                              } else {
                                return `R${value.toFixed(0)}`;
                              }
                            },
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
        </div>
        {/* Sidebar */}
        <div className="space-y-3">
          {/* Dispensary Summary, Sales Breakdown, Monthly Best Days (reuse/adapt from Daily.jsx) */}
          <div className="card">
            <h3 className="text-xl font-semibold text-text-primary mb-4">Dispensary Summary</h3>
            <div className="space-y-4">
              <div>
                <div className="flex flex-col gap-0.5">
              <div className="flex justify-between items-center">
                    <span className="text-text-secondary">Scripts Dispensed</span>
                    <span className="text-text-primary font-medium">
                      {formatNumber(mtdData.scriptsDispensed / 100)}
                    </span>
              </div>
              <div className="flex justify-between items-center">
                    <span className="text-text-secondary">Dispensary Turnover</span>
                    <span className="text-text-primary font-medium">
                      {formatCurrency(mtdData.dispensaryTurnover)}
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
                          data: [mtdData.cashSales, mtdData.accountSales, mtdData.codSales],
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
                          data: [mtdData.cashTenders, mtdData.creditCardTenders],
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-0.5">
        {console.log('Rendering charts with data:', {
          turnover12Data: turnover12?.daily_turnover,
          monthlyTurnover12Data: monthlyTurnover12,
        })}
        {/* 12 Month Turnover Chart */}
        <div className="card">
          <h2 className="text-2xl font-semibold text-text-primary mb-2">12 Month Turnover</h2>
          <div className="h-60 py-0 px-0">
            {monthlyTurnover12.labels.length > 0 ? (
              <Bar
                data={{
                  labels: monthlyTurnover12.labels,
                  datasets: [
                    {
                      label: 'Monthly Turnover',
                      data: monthlyTurnover12.data,
                      backgroundColor: '#FF492C',
                      borderRadius: 6,
                      yAxisID: 'y',
                      order: 2,
                    },
                    {
                      label: 'Avg Basket Value',
                      data: monthlyBasket12.data,
                      type: 'line',
                      borderColor: '#FFFFFF',
                      borderWidth: 3,
                      pointRadius: 0,
                      pointBackgroundColor: '#FFFFFF',
                      tension: 0.4,
                      yAxisID: 'y1',
                      order: 1,
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
                          if (context.dataset.label === 'Monthly Turnover') {
                            return `Turnover: ${formatCurrency(value)}`;
                          } else {
                            return `Avg Basket: ${formatCurrency(value)}`;
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
                          return formatShortCurrency(value);
                        },
                      },
                    },
                    y1: {
                      position: 'right',
                      grid: {
                        display: false,
                      },
                      ticks: {
                        color: '#FFFFFF',
                        callback: function(value) {
                          return formatShortCurrency(value);
                        },
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

        {/* Average Daily Turnover by Weekday */}
        <div className="card">
          <h2 className="text-2xl font-semibold text-text-primary mb-2">Average Daily Turnover by Weekday</h2>
          <div className="h-60 py-0 px-0">
            {turnover12?.daily_turnover?.length > 0 ? (
              <Bar
                data={{
                  labels: calculateDayOfWeekAverages(turnover12.daily_turnover).labels,
                  datasets: [
                    {
                      label: 'Average Turnover',
                      data: calculateDayOfWeekAverages(turnover12.daily_turnover).data,
                      backgroundColor: '#7ED957',
                      borderRadius: 6,
                    }
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
                      callbacks: {
                        label: function(context) {
                          return `Avg Turnover: ${formatCurrency(context.parsed.y)}`;
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
    </div>
  )
}

export default Monthly 