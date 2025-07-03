import { useState, useEffect, useRef } from 'react'
import { TrendingUp, DollarSign, ShoppingCart, ShoppingBasket, Users, AlertCircle, TrendingDown, AlertTriangle, CheckCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { turnoverAPI, financialAPI, salesAPI } from '../services/api'
import { Doughnut, Line, Bar } from 'react-chartjs-2'
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Title, BarElement, Filler } from 'chart.js'
import { Area, AreaChart, ResponsiveContainer } from 'recharts'
import annotationPlugin from 'chartjs-plugin-annotation'
import 'slick-carousel/slick/slick.css'
import 'slick-carousel/slick/slick-theme.css'
import Slider from 'react-slick'
import './carousel-dots.css'
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Title, BarElement, Filler, annotationPlugin)

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
  const [dailyGPPercent30Days, setDailyGPPercent30Days] = useState({ labels: [], data: [] });
  const [dailyPurchases30Days, setDailyPurchases30Days] = useState({ labels: [], data: [] });
  const [dailyCostOfSales30Days, setDailyCostOfSales30Days] = useState({ labels: [], data: [] });
  const [turnover12, setTurnover12] = useState({ daily_turnover: [] });
  const [sparklineData, setSparklineData] = useState({
    turnover: [],
    gpPercent: [],
    avgBasket: []
  });
  const chartRef = useRef(null);

  // Add getAlerts function inside component to access formatCurrency
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
    fetchSparklineData(selectedDate);
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
      // Get date range for past 2 years (730 days)
      const endDate = dateObj;
      const startDate = new Date(dateObj);
      startDate.setDate(startDate.getDate() - 729); // 730 days total
      
      const startDateStr = formatDateLocal(startDate);
      const endDateStr = formatDateLocal(endDate);

      console.log('📅 Fetching turnover data for date range:', {
        startDateStr,
        endDateStr
      });

      // Fetch turnover data for the past 2 years
      const yearlyTurnover = await turnoverAPI.getDailyTurnoverForRange(
        selectedPharmacy,
        startDateStr,
        endDateStr
      );

      console.log('📊 Received 2 years turnover data:', yearlyTurnover);

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

      console.log('📊 Fetching 30-day daily data:', {
        selectedPharmacy,
        startDateStr,
        endDateStr,
        dateObj: dateObj.toISOString()
      });

      // Fetch turnover, dispensary, daily GP, purchases, and cost of sales data for the last 30 days
      const [dailyTurnoverData, dailyDispensaryData, dailyGPData, dailyPurchasesData, dailyCostOfSalesData] = await Promise.all([
        turnoverAPI.getDailyTurnoverForRange(selectedPharmacy, startDateStr, endDateStr),
        salesAPI.getDailyDispensaryTurnoverForRange(selectedPharmacy, startDateStr, endDateStr),
        financialAPI.getDailyGPPercentForRange(selectedPharmacy, startDateStr, endDateStr),
        financialAPI.getDailyPurchasesForRange(selectedPharmacy, startDateStr, endDateStr),
        financialAPI.getDailyCostOfSalesForRange(selectedPharmacy, startDateStr, endDateStr)
      ]);

      console.log('Raw GP Data received:', dailyGPData);

      // Generate date labels and data for the last 30 days
      const labels = [];
      const data = [];
      const dispensaryData = [];
      const gpData = [];
      const purchasesData = [];
      const costOfSalesData = [];
      const currentDate = new Date(startDate);
      
      while (currentDate <= endDate) {
        const dateStr = formatDateLocal(currentDate);
        const dayData = dailyTurnoverData.daily_turnover?.find(item => item.date === dateStr);
        const dispensaryDayData = dailyDispensaryData.daily_dispensary_turnover?.find(item => item.date === dateStr);
        const gpDayData = dailyGPData.daily_gp_percent?.find(item => item.date === dateStr);
        const purchasesDayData = dailyPurchasesData.daily_purchases?.find(item => item.date === dateStr);
        const costOfSalesDayData = dailyCostOfSalesData.daily_cost_of_sales?.find(item => item.date === dateStr);
        
        const dayTurnover = dayData?.turnover || 0;
        const dayDispensaryTurnover = dispensaryDayData?.dispensary_turnover || 0;
        const dayGPPercent = gpDayData?.gp_percent !== undefined ? gpDayData.gp_percent : 0;
        const dayPurchases = purchasesDayData?.purchases || 0;
        const dayCostOfSales = costOfSalesDayData?.cost_of_sales || 0;
        
        // Only add data points for days with actual trading (turnover > 0 and GP% > 0)
        if (dayTurnover > 0 && dayGPPercent > 0) {
          // Format label as day/month
          const label = `${currentDate.getDate()}/${currentDate.getMonth() + 1}`;
          labels.push(label);
          data.push(dayTurnover);
          dispensaryData.push(dayDispensaryTurnover);
          gpData.push(dayGPPercent);
          purchasesData.push(dayPurchases);
          costOfSalesData.push(dayCostOfSales);

          console.log(`Processing data for ${dateStr}:`, {
            gpDayData,
            dayGPPercent,
            purchasesDayData,
            dayPurchases,
            costOfSalesDayData,
            dayCostOfSales
          });
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
      }

      console.log('📈 30-day data processed:', {
        labels,
        totalTurnover: data,
        dispensaryTurnover: dispensaryData,
        gpPercent: gpData,
        purchases: purchasesData,
        costOfSales: costOfSalesData,
        dataPoints: data.length,
        filteredOutDays: 30 - data.length
      });

      setDailyTurnover30Days({
        labels,
        data
      });
      setDailyDispensaryTurnover30Days({
        labels,
        data: dispensaryData
      });
      setDailyGPPercent30Days({
        labels,
        data: gpData
      });
      setDailyPurchases30Days({
        labels,
        data: purchasesData
      });
      setDailyCostOfSales30Days({
        labels,
        data: costOfSalesData
      });
    } catch (err) {
      console.error('❌ Error fetching 30-day data:', err);
      console.error('Error details:', {
        message: err.message,
        stack: err.stack,
        response: err.response?.data
      });
    }
  };

  const fetchSparklineData = async (dateObj) => {
    try {
      const endDate = new Date(dateObj)
      const startDate = new Date(dateObj)
      startDate.setDate(startDate.getDate() - 6) // Last 7 days
      
      const startDateStr = formatDateLocal(startDate)
      const endDateStr = formatDateLocal(endDate)

      const [turnoverData, dailyGPData, basketData] = await Promise.all([
        turnoverAPI.getDailyTurnoverForRange(selectedPharmacy, startDateStr, endDateStr),
        financialAPI.getDailyGPPercentForRange(selectedPharmacy, startDateStr, endDateStr),
        financialAPI.getDailyAvgBasketForRange(selectedPharmacy, startDateStr, endDateStr)
      ])

      // Debug log to check GP data
      console.log('Daily GP Data received for sparkline:', dailyGPData);
      
      // Extract and process GP% data
      const gpPercentData = dailyGPData.daily_gp_percent?.map(d => d.gp_percent || 0) || [];
      console.log('GP% data processed for sparkline:', gpPercentData);

      setSparklineData({
        turnover: turnoverData.daily_turnover?.map(d => d.turnover) || [],
        gpPercent: gpPercentData,
        avgBasket: basketData.daily_avg_basket?.map(d => d.avg_basket_value) || []
      })
    } catch (err) {
      console.error('Error fetching sparkline data:', err)
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

  // Helper function to calculate cumulative data
  const calculateCumulativeData = (data) => {
    let cumulative = 0;
    return data.map(value => {
      cumulative += value;
      return cumulative;
    });
  };

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

  const trueDispensaryPercent = mtdData.turnover > 0 ? (mtdData.dispensaryTurnover / mtdData.turnover) * 100 : 0;

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
        <h1 className="text-3xl font-bold text-text-primary leading-tight mb-1">
              Monthly Overview
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
                <p className="text-text-secondary text-xs sm:text-sm font-medium">Monthly Turnover</p>
                <p className="text-xl sm:text-3xl font-bold text-accent-primary">
                  {formatCurrency(mtdData.turnover)}
                </p>
              </div>
              <div className="w-8 h-8 sm:w-12 sm:h-12 bg-accent-primary rounded-lg flex items-center justify-center">
                <DollarSign className="text-surface-secondary w-4 h-4 sm:w-6 sm:h-6" />
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 mb-2">
              <p className="text-text-secondary text-xs sm:text-sm">
                vs 2024: {formatCurrency(previousYearMtd.turnover)}
              </p>
              {getTrendIndicator(mtdData.turnover, previousYearMtd.turnover)}
              {(() => {
                const indicator = getChangeIndicator(mtdData.turnover, previousYearMtd.turnover)
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
                    {Number(mtdData.grossProfitPercent).toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-text-secondary text-xs sm:text-sm font-medium">Gross Profit: {formatCurrency(mtdData.grossProfit)}</p>
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
                    {formatCurrency(mtdData.costOfSales)}
                  </p>
                </div>
                <div>
                  <p className="text-text-secondary text-xs sm:text-sm font-medium">Purchases</p>
                  <p className="text-lg sm:text-2xl font-bold text-cost-sales">
                    {formatCurrency(mtdData.purchases)}
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
                  {formatCurrency(mtdData.avgBasket)}
                </p>
              </div>
              <div className="w-8 h-8 sm:w-12 sm:h-12 bg-accent-secondary-purple rounded-lg flex items-center justify-center">
                <ShoppingBasket className="text-surface-secondary w-4 h-4 sm:w-6 sm:h-6" />
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 mb-2">
              <p className="text-text-secondary text-xs sm:text-sm">
                Items per Basket: <span className="font-semibold">{Number(mtdData.avgBasketSize).toFixed(1)}</span>
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
                const alerts = getAlerts(mtdData, previousYearMtd, sparklineData);
                
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
        {/* Cumulative Purchases vs Cost of Sales */}
        <div className="card h-[300px]">
          <h2 className="text-xl font-semibold text-text-primary mb-2">Purchases vs Cost of Sales</h2>
          <div className="h-[240px] p-3" style={{position: 'relative'}}>
              {dailyPurchases30Days.labels.length > 0 ? (
                <Line
                  key={dailyPurchases30Days.labels.join(',')}
                  data={{
                    labels: dailyPurchases30Days.labels,
                    datasets: [
                      {
                        label: 'Purchases',
                        data: calculateCumulativeData(dailyPurchases30Days.data),
                        borderColor: '#E24313',
                        backgroundColor: 'transparent',
                        borderWidth: 3,
                        fill: false,
                        tension: 0.4,
                        pointBackgroundColor: '#E24313',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 0,
                        pointRadius: 0,
                        pointHoverRadius: 0,
                      },
                      {
                        label: 'Cost of Sales',
                        data: calculateCumulativeData(dailyCostOfSales30Days.data),
                        borderColor: '#7ED957',
                        backgroundColor: 'transparent',
                        borderWidth: 3,
                        fill: false,
                        tension: 0.4,
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
                  <p className="text-text-secondary">Loading cumulative data...</p>
                </div>
              )}
          </div>
        </div>

        {/* 8 Day Turnover Chart */}
        <div className="card h-[300px]">
          <h2 className="text-xl font-semibold text-text-primary mb-4">Daily GP% Trend</h2>
          <div className="h-[220px] px-2">
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
                      enabled: true,
                      backgroundColor: 'rgba(0, 0, 0, 0.8)',
                      titleColor: '#fff',
                      bodyColor: '#fff',
                      padding: 12,
                      displayColors: false,
                      position: 'nearest',
                      filter: function(tooltipItem) {
                        // Only show tooltip for the GP% dataset (index 0)
                        return tooltipItem.datasetIndex === 0;
                      },
                      callbacks: {
                        title: function(tooltipItems) {
                          const date = new Date(selectedDate);
                          const month = date.toLocaleString('default', { month: 'long' });
                          const day = tooltipItems[0].label.split('/')[0];
                          return `${day} ${month}`;
                        },
                        label: function(context) {
                          const value = context.parsed.y || 0;
                          return `Gross Profit: ${value.toFixed(1)}%`;
                        },
                        afterLabel: function(context) {
                          const value = context.parsed.y || 0;
                          let performance = '';
                          if (value < 25) {
                            performance = '⚠️ Below Target';
                          }
                          return performance;
                        }
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

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Dispensary Summary */}
        <div className="card h-[400px]">
          <h3 className="text-xl font-semibold text-text-primary mb-4">Dispensary Summary</h3>
          <div className="space-y-6">
            {/* Dispensary Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-surface-secondary rounded-lg p-3">
                <p className="text-sm text-text-secondary mb-1">Scripts This Month</p>
                <p className="text-xl font-bold text-text-primary">
                  {formatNumber(mtdData.scriptsDispensed / 100)}
                </p>
              </div>
              <div className="bg-surface-secondary rounded-lg p-3">
                <p className="text-sm text-text-secondary mb-1">Avg Script Value</p>
                <p className="text-xl font-bold text-text-primary">
                  {formatCurrency(mtdData.dispensaryTurnover / mtdData.scriptsDispensed * 100)}
                </p>
              </div>
            </div>

            {/* Dispensary Turnover */}
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-text-secondary">Dispensary</span>
                  <span className="text-lg font-semibold text-text-primary">
                    {formatCurrency(mtdData.dispensaryTurnover)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-secondary">Front Shop</span>
                  <span className="text-lg font-semibold text-text-primary">
                    {formatCurrency(mtdData.turnover - mtdData.dispensaryTurnover)}
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
                    <span className="text-lg font-semibold text-[#FFC300]">{Math.round(trueDispensaryPercent)}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-[#3A3F4B]"></div>
                      <span className="text-sm text-text-secondary">Front Shop</span>
                    </div>
                    <span className="text-lg font-semibold text-[#3A3F4B]">{Math.round(100 - trueDispensaryPercent)}%</span>
                  </div>
                </div>

                <div className="relative">
                  {/* Base Progress Bar */}
                  <div className="h-4 bg-[#3A3F4B] rounded-full overflow-hidden relative">
                    {/* Actual Progress */}
                    <div 
                      className="h-full bg-[#FFC300] rounded-full"
                      style={{ width: `${Math.min(trueDispensaryPercent, 100)}%` }}
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
                      trueDispensaryPercent >= 40 && trueDispensaryPercent <= 60 
                        ? 'text-status-success' 
                        : 'text-status-warning'
                    }`}>
                      {trueDispensaryPercent >= 40 && trueDispensaryPercent <= 60 
                        ? 'Within Target' 
                        : trueDispensaryPercent < 40 
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
                <p className="text-sm font-semibold text-text-primary">{formatCurrency(mtdData.cashSales)}</p>
                <p className="text-xs text-text-secondary mt-1">
                  {((mtdData.cashSales / mtdData.turnover) * 100).toFixed(1)}%
                </p>
              </div>
              <div className="bg-surface-secondary rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-[#7ED957]" />
                  <p className="text-xs text-text-secondary">Debtors</p>
                </div>
                <p className="text-sm font-semibold text-text-primary">{formatCurrency(mtdData.accountSales)}</p>
                <p className="text-xs text-text-secondary mt-1">
                  {((mtdData.accountSales / mtdData.turnover) * 100).toFixed(1)}%
                </p>
              </div>
              <div className="bg-surface-secondary rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-[#8F6ED5]" />
                  <p className="text-xs text-text-secondary">COD</p>
                </div>
                <p className="text-sm font-semibold text-text-primary">{formatCurrency(mtdData.codSales)}</p>
                <p className="text-xs text-text-secondary mt-1">
                  {((mtdData.codSales / mtdData.turnover) * 100).toFixed(1)}%
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
                    <p className="text-sm font-medium text-text-primary">{formatCurrency(mtdData.cashTenders)}</p>
                    <p className="text-xs text-text-secondary">
                      {((mtdData.cashTenders / (mtdData.cashTenders + mtdData.creditCardTenders)) * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#FF492C]" />
                    <span className="text-sm text-text-secondary">Card Payments</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-text-primary">{formatCurrency(mtdData.creditCardTenders)}</p>
                    <p className="text-xs text-text-secondary">
                      {((mtdData.creditCardTenders / (mtdData.cashTenders + mtdData.creditCardTenders)) * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
                <div className="h-4 bg-surface-secondary rounded-full overflow-hidden mt-2 flex">
                  <div 
                    className="h-full bg-[#FFC300]"
                    style={{ 
                      width: `${(mtdData.cashTenders / (mtdData.cashTenders + mtdData.creditCardTenders)) * 100}%` 
                    }}
                  />
                  <div 
                    className="h-full bg-[#FF492C]"
                    style={{ 
                      width: `${(mtdData.creditCardTenders / (mtdData.cashTenders + mtdData.creditCardTenders)) * 100}%`
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>



      {/* Full Width Side by Side Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
        {/* 12 Month Turnover Chart */}
        <div className="card">
          <h2 className="text-xl font-semibold text-text-primary mb-2">12 Month Turnover</h2>
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
          <h2 className="text-xl font-semibold text-text-primary mb-2">Average Daily Turnover by Weekday</h2>
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
                      grid: { display: false },
                      ticks: { color: '#9CA3AF', font: { size: 11 } },
                    },
                    y: {
                      grid: { display: false },
                      ticks: {
                        color: '#9CA3AF',
                        callback: function(value) { return formatShortCurrency(value); },
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

      {/* YoY Growth Charts Side by Side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {/* YoY Monthly Growth Chart */}
        <div className="card">
          <h2 className="text-xl font-semibold text-text-primary mb-4">YoY Monthly Growth</h2>
          <div className="h-80 py-0 px-0">
            {(() => {
              // ...existing YoY Monthly Growth chart code...
              const calculateYoYGrowth = () => {
                if (!turnover12?.daily_turnover?.length) return { labels: [], data: [] };
                const monthlyTotals = {};
                const dailyByMonth = {};
                turnover12.daily_turnover.forEach(item => {
                  if (!item.date || typeof item.turnover !== 'number') return;
                  const monthKey = item.date.slice(0, 7); // 'YYYY-MM'
                  if (!monthlyTotals[monthKey]) monthlyTotals[monthKey] = 0;
                  monthlyTotals[monthKey] += item.turnover;
                  // For MTD: group daily turnover by month
                  if (!dailyByMonth[monthKey]) dailyByMonth[monthKey] = [];
                  dailyByMonth[monthKey].push({ date: item.date, turnover: item.turnover });
                });
                const last12Months = getLast12Months(selectedDate);
                const labels = [];
                const growthData = [];
                last12Months.forEach((monthDate, idx) => {
                  const year = monthDate.getFullYear();
                  const month = String(monthDate.getMonth() + 1).padStart(2, '0');
                  const currentKey = `${year}-${month}`;
                  const prevKey = `${year - 1}-${month}`;
                  let currentValue = monthlyTotals[currentKey] || 0;
                  let prevValue = monthlyTotals[prevKey] || 0;
                  // If this is the current month (last in the array), use MTD for both years
                  const isCurrentMonth = idx === last12Months.length - 1;
                  if (isCurrentMonth) {
                    // Get selected day of month
                    const selectedDay = selectedDate.getDate();
                    // Current year MTD
                    currentValue = 0;
                    (dailyByMonth[currentKey] || []).forEach(d => {
                      const dObj = new Date(d.date);
                      if (dObj.getDate() <= selectedDay) currentValue += d.turnover;
                    });
                    // Previous year MTD (same day of month)
                    prevValue = 0;
                    (dailyByMonth[prevKey] || []).forEach(d => {
                      const dObj = new Date(d.date);
                      if (dObj.getDate() <= selectedDay) prevValue += d.turnover;
                    });
                  }
                  let growthPercent = 0;
                  if (prevValue > 0 && currentValue > 0) {
                    growthPercent = ((currentValue - prevValue) / prevValue) * 100;
                  } else if ((currentValue === 0 && prevValue > 0) || (currentValue > 0 && prevValue === 0)) {
                    growthPercent = 0;
                  } else {
                    growthPercent = 0;
                  }
                  labels.push(monthDate.toLocaleString('en-ZA', { month: 'short', year: '2-digit' }));
                  growthData.push(growthPercent);
                });
                return { labels, data: growthData };
              };
              const yoYGrowthData = calculateYoYGrowth();
              return yoYGrowthData.labels.length > 0 ? (
                <Bar
                  data={{
                    labels: yoYGrowthData.labels,
                    datasets: [
                      {
                        label: 'YoY Growth %',
                        data: yoYGrowthData.data,
                        backgroundColor: yoYGrowthData.data.map(value =>
                          value >= 0 ? 'rgba(126, 217, 87, 0.8)' : 'rgba(255, 73, 44, 0.8)'
                        ),
                        borderColor: yoYGrowthData.data.map(value =>
                          value >= 0 ? '#7ED957' : '#FF492C'
                        ),
                        borderWidth: 0,
                        borderRadius: 6,
                        borderSkipped: false,
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
                        display: false,
                      },
                      tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        callbacks: {
                          label: function(context) {
                            const value = context.parsed.y;
                            const sign = value >= 0 ? '+' : '';
                            return `YoY Growth: ${sign}${value.toFixed(1)}%`;
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
                          maxRotation: 45,
                        },
                      },
                      y: {
                        grid: {
                          color: 'rgba(156, 163, 175, 0.1)',
                        },
                        ticks: {
                          color: '#9CA3AF',
                          callback: function(value) {
                            return `${value >= 0 ? '+' : ''}${value.toFixed(0)}%`;
                          },
                        },
                        beginAtZero: false,
                      },
                    },
                  }}
                />
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-text-secondary">Loading YoY growth data...</p>
                </div>
              );
            })()}
          </div>
        </div>
        {/* 30-Day YoY Daily Growth Chart */}
        <div className="card">
          <h2 className="text-xl font-semibold text-text-primary mb-4">30-Day YoY Daily Growth</h2>
          <div className="h-80 py-0 px-0">
            {(() => {
              if (!turnover12?.daily_turnover?.length) return (
                <div className="h-full flex items-center justify-center">
                  <p className="text-text-secondary">Loading YoY daily growth data...</p>
                </div>
              );
              const turnoverByDate = {};
              turnover12.daily_turnover.forEach(item => {
                if (item.date && typeof item.turnover === 'number') {
                  turnoverByDate[item.date] = item.turnover;
                }
              });
              function findPrevYearSameWeekday(date) {
                const targetDay = date.getDay();
                const prevYear = date.getFullYear() - 1;
                const month = date.getMonth();
                const day = date.getDate();
                for (let offset = -3; offset <= 3; offset++) {
                  const candidate = new Date(prevYear, month, day + offset);
                  if (candidate.getDay() === targetDay) {
                    return formatDateLocal(candidate);
                  }
                }
                const fallback = new Date(date);
                fallback.setDate(fallback.getDate() - 364);
                return formatDateLocal(fallback);
              }
              const days = [];
              const labels = [];
              const growthData = [];
              for (let i = 29; i >= 0; i--) {
                const d = new Date(selectedDate);
                d.setDate(d.getDate() - i);
                const dateStr = formatDateLocal(d);
                days.push(dateStr);
                labels.push(`${d.getDate()}/${d.getMonth() + 1}`);
              }
              days.forEach(dateStr => {
                const d = new Date(dateStr);
                const prevYearStr = findPrevYearSameWeekday(d);
                const current = turnoverByDate[dateStr] || 0;
                const previous = turnoverByDate[prevYearStr] || 0;
                let growth = 0;
                if (current > 0 && previous > 0) {
                  growth = ((current - previous) / previous) * 100;
                } else if ((current === 0 && previous > 0) || (current > 0 && previous === 0)) {
                  growth = 0;
                } else {
                  growth = 0;
                }
                growthData.push(growth);
              });
              return (
                <Bar
                  data={{
                    labels,
                    datasets: [
                      {
                        label: 'YoY Daily Growth %',
                        data: growthData,
                        backgroundColor: growthData.map(value =>
                          value >= 0 ? 'rgba(126, 217, 87, 0.8)' : 'rgba(255, 73, 44, 0.8)'
                        ),
                        borderColor: growthData.map(value =>
                          value >= 0 ? '#7ED957' : '#FF492C'
                        ),
                        borderWidth: 0,
                        borderRadius: 4,
                        borderSkipped: false,
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
                        display: false,
                      },
                      tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        callbacks: {
                          label: function(context) {
                            const value = context.parsed.y;
                            const sign = value >= 0 ? '+' : '';
                            return `YoY Growth: ${sign}${value.toFixed(1)}%`;
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
                            size: 10,
                          },
                          maxRotation: 60,
                          minRotation: 45,
                          autoSkip: true,
                          maxTicksLimit: 15,
                        },
                      },
                      y: {
                        grid: {
                          color: 'rgba(156, 163, 175, 0.1)',
                        },
                        ticks: {
                          color: '#9CA3AF',
                          callback: function(value) {
                            return `${value >= 0 ? '+' : ''}${value.toFixed(0)}%`;
                          },
                        },
                        beginAtZero: false,
                      },
                    },
                  }}
                />
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Monthly 