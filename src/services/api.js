import axios from 'axios'

// API Configuration
const API_BASE_URL = 'https://tlcwebdashboard2.onrender.com/api'

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('authToken')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// Authentication API
export const authAPI = {
  login: async (username, password) => {
    const response = await api.post('/login', { username, password })
    return response.data
  },
  
  getPharmacies: async () => {
    const response = await api.get('/pharmacies')
    return response.data
  }
}

// Turnover API
export const turnoverAPI = {
  getTurnover: async (pharmacy, date) => {
    const params = { pharmacy }
    if (date) params.date = date
    const response = await api.get('/turnover', { params })
    return response.data
  },

  getTurnoverForRange: async (pharmacy, startDate, endDate) => {
    const response = await api.get(`/turnover_for_range/${startDate}/${endDate}`, {
      headers: { 'X-Pharmacy': pharmacy }
    })
    return response.data
  },

  getDailyTurnoverForRange: async (pharmacy, startDate, endDate) => {
    const response = await api.get(`/daily_turnover_for_range/${startDate}/${endDate}`, {
      headers: { 'X-Pharmacy': pharmacy }
    })
    return response.data
  },

  getLatestDateWithData: async (pharmacy) => {
    const response = await api.get(`/latest_date_with_data/${pharmacy}`)
    return response.data
  }
}

// Financial API
export const financialAPI = {
  getGPForRange: async (pharmacy, startDate, endDate) => {
    const response = await api.get(`/gp_for_range/${startDate}/${endDate}`, {
      headers: { 'X-Pharmacy': pharmacy }
    })
    return response.data
  },

  getDailyGPPercentForRange: async (pharmacy, startDate, endDate) => {
    const response = await api.get(`/daily_gp_percent_for_range/${startDate}/${endDate}`, {
      headers: { 'X-Pharmacy': pharmacy }
    })
    return response.data
  },

  getCostsForRange: async (pharmacy, startDate, endDate) => {
    const response = await api.get(`/costs_for_range/${startDate}/${endDate}`, {
      headers: { 'X-Pharmacy': pharmacy }
    })
    return response.data
  },

  getTransactionsForRange: async (pharmacy, startDate, endDate) => {
    const response = await api.get(`/transactions_for_range/${startDate}/${endDate}`, {
      headers: { 'X-Pharmacy': pharmacy }
    })
    return response.data
  },

  getAvgBasketForRange: async (pharmacy, startDate, endDate) => {
    const response = await api.get(`/avg_basket_for_range/${startDate}/${endDate}`, {
      headers: { 'X-Pharmacy': pharmacy }
    })
    return response.data
  },

  getDailyAvgBasketForRange: async (pharmacy, startDate, endDate) => {
    const response = await api.get(`/daily_avg_basket_for_range/${startDate}/${endDate}`, {
      headers: { 'X-Pharmacy': pharmacy }
    })
    return response.data
  },

  getDailyPurchasesForRange: async (pharmacy, startDate, endDate) => {
    const response = await api.get(`/daily_purchases_for_range/${startDate}/${endDate}`, {
      headers: { 'X-Pharmacy': pharmacy }
    })
    return response.data
  },

  getDailyCostOfSalesForRange: async (pharmacy, startDate, endDate) => {
    const response = await api.get(`/daily_cost_of_sales_for_range/${startDate}/${endDate}`, {
      headers: { 'X-Pharmacy': pharmacy }
    })
    return response.data
  }
}

// Stock API
export const stockAPI = {
  getOpeningStockForRange: async (pharmacy, startDate, endDate) => {
    const response = await api.get(`/opening_stock_for_range/${startDate}/${endDate}`, {
      headers: { 'X-Pharmacy': pharmacy }
    })
    return response.data
  },

  getClosingStockForRange: async (pharmacy, startDate, endDate) => {
    const response = await api.get(`/closing_stock_for_range/${startDate}/${endDate}`, {
      headers: { 'X-Pharmacy': pharmacy }
    })
    return response.data
  },

  getStockAdjustmentsForRange: async (pharmacy, startDate, endDate) => {
    const response = await api.get(`/stock_adjustments_for_range/${startDate}/${endDate}`, {
      headers: { 'X-Pharmacy': pharmacy }
    })
    return response.data
  },

  getTurnoverRatioForRange: async (pharmacy, startDate, endDate) => {
    const response = await api.get(`/turnover_ratio_for_range/${startDate}/${endDate}`, {
      headers: { 'X-Pharmacy': pharmacy }
    })
    return response.data
  },

  getDaysOfInventoryForRange: async (pharmacy, startDate, endDate) => {
    const response = await api.get(`/days_of_inventory_for_range/${startDate}/${endDate}`, {
      headers: { 'X-Pharmacy': pharmacy }
    })
    return response.data
  }
}

// Sales API
export const salesAPI = {
  getDailyCashSalesForRange: async (pharmacy, startDate, endDate) => {
    const response = await api.get(`/daily_cash_sales_for_range/${startDate}/${endDate}`, {
      headers: { 'X-Pharmacy': pharmacy }
    })
    return response.data
  },

  getDailyAccountSalesForRange: async (pharmacy, startDate, endDate) => {
    const response = await api.get(`/daily_account_sales_for_range/${startDate}/${endDate}`, {
      headers: { 'X-Pharmacy': pharmacy }
    })
    return response.data
  },

  getDailyCODSalesForRange: async (pharmacy, startDate, endDate) => {
    const response = await api.get(`/daily_cod_sales_for_range/${startDate}/${endDate}`, {
      headers: { 'X-Pharmacy': pharmacy }
    })
    return response.data
  },

  getDailyScriptsDispensedForRange: async (pharmacy, startDate, endDate) => {
    const response = await api.get(`/daily_scripts_dispensed_for_range/${startDate}/${endDate}`, {
      headers: { 'X-Pharmacy': pharmacy }
    })
    return response.data
  },

  getDailyCashTendersForRange: async (pharmacy, startDate, endDate) => {
    const response = await api.get(`/daily_cash_tenders_for_range/${startDate}/${endDate}`, {
      headers: { 'X-Pharmacy': pharmacy }
    })
    return response.data
  },

  getDailyCreditCardTendersForRange: async (pharmacy, startDate, endDate) => {
    const response = await api.get(`/daily_credit_card_tenders_for_range/${startDate}/${endDate}`, {
      headers: { 'X-Pharmacy': pharmacy }
    })
    return response.data
  },

  getDailyDispensaryPercentForRange: async (pharmacy, startDate, endDate) => {
    const response = await api.get(`/daily_dispensary_percent_for_range/${startDate}/${endDate}`, {
      headers: { 'X-Pharmacy': pharmacy }
    })
    return response.data
  },

  getDailyDispensaryTurnoverForRange: async (pharmacy, startDate, endDate) => {
    const response = await api.get(`/daily_dispensary_turnover_for_range/${startDate}/${endDate}`, {
      headers: { 'X-Pharmacy': pharmacy }
    })
    return response.data
  }
}

// Utility API
export const utilityAPI = {
  getStatus: async () => {
    const response = await api.get('/status')
    return response.data
  },

  getHealth: async () => {
    const response = await api.get('/health')
    return response.data
  },

  checkTurnoverExists: async (pharmacy, date) => {
    const response = await api.get(`/check_turnover/${pharmacy}/${date}`)
    return response.data
  }
}

// Second Database API Configuration for Daily Stock Data
// Dynamic base URL that works for both localhost and network access
const getDailyStockApiBaseUrl = () => {
  const currentHost = window.location.hostname
  
  // Production: Use separate stock backend service
  if (currentHost.includes('onrender.com') || import.meta.env.PROD) {
    return 'https://tlc-stock-backend.onrender.com/api/stock'
  }
  
  // Development: Use current host (works for both localhost and network access)
  if (import.meta.env.DEV) {
    return `http://${currentHost}:5001/api/stock`
  }
  
  // Fallback to localhost
  return 'http://localhost:5001/api/stock'
}

const DAILY_STOCK_API_BASE_URL = getDailyStockApiBaseUrl()

// Create separate axios instance for the second database
const dailyStockApi = axios.create({
  baseURL: DAILY_STOCK_API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor for second database (if auth is needed)
dailyStockApi.interceptors.request.use(
  (config) => {
    // Add any specific auth headers for the second database
    const token = localStorage.getItem('dailyStockApiToken') // or use the same token
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Daily Stock API (from second database)
export const dailyStockAPI = {
  // Get daily stock movements for a date range
  getDailyStockMovements: async (pharmacy, startDate, endDate) => {
    const response = await dailyStockApi.get(`/movements/${pharmacy}/${startDate}/${endDate}`)
    return response.data
  },

  // Get daily stock receipts
  getDailyStockReceipts: async (pharmacy, startDate, endDate) => {
    const response = await dailyStockApi.get(`/movements/${pharmacy}/${startDate}/${endDate}`)
    return response.data
  },

  // Get daily stock issues/dispensed
  getDailyStockIssues: async (pharmacy, startDate, endDate) => {
    const response = await dailyStockApi.get(`/movements/${pharmacy}/${startDate}/${endDate}`)
    return response.data
  },

  // Get daily stock adjustments with details
  getDailyStockAdjustments: async (pharmacy, startDate, endDate) => {
    const response = await dailyStockApi.get(`/movements/${pharmacy}/${startDate}/${endDate}`)
    return response.data
  },

  // Get daily stock summary
  getDailyStockSummary: async (pharmacy, date) => {
    const response = await dailyStockApi.get(`/daily_summary/${pharmacy}/${date}`)
    return response.data
  },

  // Get top moving products for a day
  getTopMovingProducts: async (pharmacy, date, limit = 10) => {
    const response = await dailyStockApi.get(`/top_moving/${pharmacy}/${date}`, {
      params: { limit }
    })
    return response.data
  },

  // Get low stock alerts for a day
  getLowStockAlerts: async (pharmacy, date) => {
    const response = await dailyStockApi.get(`/low_stock_alerts/${pharmacy}/${date}`)
    return response.data
  },

  // Get stock KPIs for a day
  getStockKPIs: async (pharmacy, date) => {
    const response = await dailyStockApi.get(`/kpis/${pharmacy}/${date}`)
    return response.data
  },

  // Smart Alerts APIs
  getAllSmartAlerts: async (pharmacy, date) => {
    const response = await dailyStockApi.get(`/smart-alerts/all/${pharmacy}/${date}`)
    return response.data
  },

  getHighVolumeLowMarginAlerts: async (pharmacy, date, limit = 10) => {
    const response = await dailyStockApi.get(`/smart-alerts/high-volume-low-margin/${pharmacy}/${date}`, {
      params: { limit }
    })
    return response.data
  },

  getDepartmentGPDeclineAlerts: async (pharmacy, date, limit = 10) => {
    const response = await dailyStockApi.get(`/smart-alerts/department-gp-decline/${pharmacy}/${date}`, {
      params: { limit }
    })
    return response.data
  },

  getOverstockWarnings: async (pharmacy, date, thresholdDays = 60, limit = 20) => {
    const response = await dailyStockApi.get(`/smart-alerts/overstock-warnings/${pharmacy}/${date}`, {
      params: { threshold_days: thresholdDays, limit }
    })
    return response.data
  },

  getSupplierPerformanceAlerts: async (pharmacy, date, limit = 10) => {
    const response = await dailyStockApi.get(`/smart-alerts/supplier-performance/${pharmacy}/${date}`, {
      params: { limit }
    })
    return response.data
  },

  getPricePointAnalysisAlerts: async (pharmacy, date, limit = 15) => {
    const response = await dailyStockApi.get(`/smart-alerts/price-point-analysis/${pharmacy}/${date}`, {
      params: { limit }
    })
    return response.data
  },

  getWeekdayPatternAlerts: async (pharmacy, date, limit = 15) => {
    const response = await dailyStockApi.get(`/smart-alerts/weekday-patterns/${pharmacy}/${date}`, {
      params: { limit }
    })
    return response.data
  },

  // Get low GP products for a day
  getLowGPProducts: async (pharmacy, date, threshold = 20) => {
    const response = await dailyStockApi.get(`/low_gp_products/${pharmacy}/${date}`, {
      params: { threshold }
    })
    return response.data
  },

  // Get top performing departments for a day
  getTopPerformingDepartments: async (pharmacy, date, limit = 5) => {
    const response = await dailyStockApi.get(`/top_departments/${pharmacy}/${date}`, {
      params: { limit }
    })
    return response.data
  },

  // Get departments heatmap data
  getDepartmentsHeatmapData: async (pharmacy, date) => {
    const response = await dailyStockApi.get(`/departments_heatmap/${pharmacy}/${date}`)
    return response.data
  },

  // Get low GP products for a specific department
  getLowGPProductsByDepartment: async (pharmacy, date, departmentCode, threshold = 25) => {
    const response = await dailyStockApi.get(`/low_gp_products_by_department/${pharmacy}/${date}/${departmentCode}`, {
      params: { threshold }
    })
    return response.data
  }
}

export default api 