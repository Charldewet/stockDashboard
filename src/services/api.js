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

export default api 